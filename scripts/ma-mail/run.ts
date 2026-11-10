/**
 * /ma 月次メール（Phase A：オーナー個人向け・ローカル実行）
 *
 * launchd（jp.largogk.fi.ma-mail）が毎日 9:00 と RunAtLoad で起動する（送るかどうかはこのスクリプトが判定）。
 * 送信日の判定・計算・本文の組み立ては src/lib/ma/（画面と共通・実行環境に依存しない）。
 * このファイルはローカル固有の部分だけ：設定・状態ファイル、Python での取得、Resend への送信。
 * 暴落ルールの段階は user_ma_settings.crash_state（画面の「投資実行」で確定）を読むだけで、メールは書き換えない。
 *
 * 使い方:
 *   npx tsx scripts/ma-mail/run.ts                 # 送信日なら送る（launchd から）
 *   npx tsx scripts/ma-mail/run.ts --dry-run       # 日付に関係なく HTML を out/ に書き出すだけ（送信・状態更新なし）
 *   npx tsx scripts/ma-mail/run.ts --force-send    # 日付に関係なくテスト送信（送信済みの記録・暴落段階は更新しない）
 * テスト用:
 *   --today=YYYY-MM-DD          判定日を偽装
 *   --no-fetch                  指標・高値を取得し直さない（前回の値を使う）
 *   --simulate-drawdown=-0.25   S&P500 ドル建ての現在値を「最高値×(1−25%)」に置き換える（暴落ルールの表示確認用）
 *   --simulate-fail=cape,sp500_usd   指定した指標を取得失敗として扱う
 *   --state=path                状態ファイルを差し替える
 *   --simulate-error            開始直後にエラーにする（監視の失敗側の確認用）
 *
 * 監視: 実行のたびに ~/Library/Logs/jp.largogk.fi/ma-mail-runs.jsonl（1行追記・直近400行）と
 *   ma-mail-last.json（最後の1回）に結果を書く。healthchecks.io への合図は、本番の送信をしたとき（HEALTHCHECK_URL）と
 *   エラーのとき（/fail）だけ。送信日でない日・送信済み・dry-run・テスト送信では送らない（Mac は毎日起動するとは限らないため、
 *   監視は「毎月、月末ごろまでに送信の合図が来るか」で行う）。HEALTHCHECK_URL が未設定なら記録だけ書く。金額は送らない
 *
 * 暴落ルールの通知（FI_project #34）: 送信日でない日は、S&P500 の高値と現在値だけを取得し（scripts/market/fetch_sp500_drawdown.py、
 *   DB には書かない）、暴落ルールの段階にまだ知らせていない段階で新たに達していたら、短い通知メールを1通送る（判定は
 *   src/lib/ma/mail/crashAlert.ts）。通知済みの段階は state.json の crashAlert。画面の「投資実行」で確定済みの段階は通知しない。
 *   通知は知らせるだけで、待機資金・crash_state は書き換えない。結果（not_due など）と healthchecks.io の合図は変えず、
 *   記録ファイルの alert に書く。通知の確認の失敗はエラーにしない（毎日 /fail が飛ぶため。月次の送信の監視を変えない）。
 *   送信日に月次メールを送ったときは、そのメールで知らせた段階を通知済みにする（翌日に二度知らせない）。
 *   --dry-run では送信日でない日も通知の HTML（out/alert-YYYY-MM-DD.html）を書き出すだけ（送信・状態更新なし）
 *
 * 設定: scripts/ma-mail/config.local.json（gitignore。config.example.json を参照）
 * 秘密: scripts/market/.env の SUPABASE_URL / SUPABASE_SERVICE_KEY / RESEND_API_KEY / HEALTHCHECK_URL（任意）
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Indicators, MarketMode, PricePoint } from '../../src/lib/ma/types';
import { calculateMonthlyFromIndicators } from '../../src/lib/ma/logic';
import { rowToSettings, type UserMaSettingsRow } from '../../src/lib/ma/settingsRow';
import { decideSend } from '../../src/lib/ma/mail/schedule';
import { checkFreshness, type Freshness } from '../../src/lib/ma/mail/freshness';
import { buildMail } from '../../src/lib/ma/mail/buildMail';
import { buildCrashAlert, decideCrashAlert, markNotified, type CrashAlertState } from '../../src/lib/ma/mail/crashAlert';
import { runOnce, sendPing, type RunRecord, type RunResult } from './monitor';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PYTHON = join(ROOT, 'scripts/market/.venv/bin/python');
const LOG_DIR = join(homedir(), 'Library/Logs/jp.largogk.fi');
const RUNS_LOG = join(LOG_DIR, 'ma-mail-runs.jsonl');
const LAST_RUN = join(LOG_DIR, 'ma-mail-last.json');
const RUNS_KEEP = 400;

interface Config {
  userId: string;
  to: string;
  from: string;
  sendDay: number;
  mode: MarketMode;
}

interface State {
  sentMonths: string[];
  /** 暴落ルールの通知済みの段階（#34）。無ければ未通知 */
  crashAlert?: CrashAlertState | null;
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

function loadEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function rest<T>(env: Record<string, string>, path: string): Promise<T> {
  const key = env.SUPABASE_SERVICE_KEY;
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** S&P500 の高値と現在値だけを取得する（DB には書かない）。失敗したら null */
function fetchSp500(env: Record<string, string>): { sp500_usd: PricePoint | null; sp500_jpy: PricePoint | null } | null {
  const script = join(ROOT, 'scripts/market/fetch_sp500_drawdown.py');
  const r = spawnSync(PYTHON, [script], { cwd: dirname(script), env: { ...process.env, ...env }, encoding: 'utf8', timeout: 180_000 });
  process.stderr.write(r.stderr ?? '');
  const last = (r.stdout ?? '').trim().split('\n').pop();
  if (r.status !== 0 || !last) return null;
  try {
    return JSON.parse(last);
  } catch {
    return null;
  }
}

function sendViaResend(env: Record<string, string>, config: Config, mail: { subject: string; html: string; text: string }) {
  if (!env.RESEND_API_KEY) throw new Error('scripts/market/.env に RESEND_API_KEY がありません');
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.from, to: [config.to], subject: mail.subject, html: mail.html, text: mail.text }),
  });
}

/**
 * 送信日でない日の暴落ルールの通知（#34）。戻り値は記録ファイルの alert に書く文（結果と合図は変えない）。
 * ここで起きた失敗は投げずに文で返す（月次の送信の監視＝エラーの合図を毎日鳴らさないため）
 */
async function checkCrashAlert(p: {
  env: Record<string, string>; config: Config; state: State; statePath: string; today: string; dryRun: boolean;
}): Promise<string> {
  try {
    const [indicators] = await rest<Indicators[]>(p.env, 'indicators?select=*&order=fetched_at.desc&limit=1');
    let fetched: { sp500_usd: PricePoint | null; sp500_jpy: PricePoint | null } | null;
    if (flag('no-fetch')) {
      fetched = { sp500_usd: indicators.drawdown?.sp500_usd ?? null, sp500_jpy: indicators.drawdown?.sp500_jpy ?? null };
    } else {
      fetched = fetchSp500(p.env);
    }
    let sp500Usd = fetched?.sp500_usd ?? null;
    if (!sp500Usd) return '確認できず（S&P500 の取得に失敗）';
    const simDd = opt('simulate-drawdown');
    if (simDd) sp500Usd = { ...sp500Usd, last: sp500Usd.ath * (1 + Number(simDd)), lastDate: p.today };

    const [row] = await rest<UserMaSettingsRow[]>(p.env, `user_ma_settings?select=*&user_id=eq.${p.config.userId}`);
    if (!row) return `確認できず（user_ma_settings に ${p.config.userId} がありません）`;
    const settings = rowToSettings(row);
    const decision = decideCrashAlert(sp500Usd, settings.crash_state?.current ?? null, p.state.crashAlert ?? null);
    const dd = (Math.min(0, sp500Usd.last / sp500Usd.ath - 1) * 100).toFixed(1);
    console.log(`  暴落ルールの通知: S&P500 ドル建て ${dd}%、通知する段階 ${decision.stages.length ? decision.stages.map((s) => `−${s}%`).join('・') : 'なし'}`);
    if (decision.stages.length === 0) return `なし（${dd}%）`;

    // 投入額の見込みは画面と同じ計算（evaluateCrash）。最新の indicators の高値データだけ今日の値に差し替える
    const ind: Indicators = { ...indicators, drawdown: { ...(indicators.drawdown ?? { sp500_jpy: null, classes: {} }), sp500_usd: sp500Usd } };
    const calc = calculateMonthlyFromIndicators(ind, settings, p.config.mode, new Date(`${p.today}T09:00:00`));
    // --simulate-drawdown はドル建てだけを差し替えるので、円建て（参考）は出さない（実際の値と食い違うため）
    const sp500Jpy = simDd ? null : fetched?.sp500_jpy ?? null;
    const mail = buildCrashAlert({ today: p.today, stages: decision.stages, sp500Usd, sp500Jpy, crash: calc?.crash ?? null });
    const outDir = join(HERE, 'out');
    mkdirSync(outDir, { recursive: true });
    const preview = join(outDir, `alert-${p.today}.html`);
    writeFileSync(preview, `<!doctype html><meta charset="utf-8"><title>${mail.subject}</title>${mail.html}`);
    console.log(`  通知の件名: ${mail.subject}`);
    console.log(`  通知の HTML: ${preview}`);
    if (p.dryRun) return `dry-run（${decision.stages.join('・')}）`;

    const res = await sendViaResend(p.env, p.config, mail);
    const body = await res.text();
    if (!res.ok) return `送れず（Resend: ${res.status} ${body}）`;
    console.log(`  通知を送信しました: ${body}`);
    p.state.crashAlert = decision.next;
    writeFileSync(p.statePath, JSON.stringify(p.state, null, 2));
    return `送信（${decision.stages.map((s) => `−${s}%`).join('・')}）`;
  } catch (e) {
    return `確認できず（${e instanceof Error ? e.message : e}）`;
  }
}

function runPython(script: string, env: Record<string, string>, extraArgs: string[] = []): boolean {
  const r = spawnSync(PYTHON, [script, ...extraArgs], { cwd: dirname(script), env: { ...process.env, ...env }, encoding: 'utf8' });
  process.stdout.write(r.stdout ?? '');
  process.stderr.write(r.stderr ?? '');
  return r.status === 0;
}

async function main(): Promise<{ result: RunResult; targetMonth: string; catchup: boolean; alert?: string | null }> {
  const dryRun = flag('dry-run');
  const forceSend = flag('force-send');
  const today = opt('today') ?? localToday();
  const statePath = opt('state') ?? join(HERE, 'state.json');
  const config = JSON.parse(readFileSync(join(HERE, 'config.local.json'), 'utf8')) as Config;
  const env = loadEnv(join(ROOT, 'scripts/market/.env'));
  const state: State = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, 'utf8'))
    : { sentMonths: [] };

  console.log(`[${new Date().toISOString()}] /ma 月次メール today=${today}${dryRun ? ' dry-run' : ''}${forceSend ? ' force-send' : ''}`);
  if (flag('simulate-error')) throw new Error('--simulate-error');
  const decision = decideSend(today, config.sendDay, state.sentMonths);
  console.log(`  判定: ${decision.send ? '送る' : '送らない'}（${decision.reason}）`);
  const catchup = decision.send && today !== decision.scheduled;
  // 送信日でない日は暴落ルールの通知を確かめる（#34）。テスト送信では確かめない
  const alert = !decision.send && !forceSend ? await checkCrashAlert({ env, config, state, statePath, today, dryRun }) : null;
  if (alert) console.log(`  暴落ルールの通知: ${alert}`);
  if (!decision.send && !dryRun && !forceSend) {
    return { result: state.sentMonths.includes(decision.month) ? 'already_sent' : 'not_due', targetMonth: decision.month, catchup: false, alert };
  }

  // 1. 取得（送る日だけ。共有の indicators は通常の定期取得と同じく上書きされる）
  if (!flag('no-fetch')) {
    if (!runPython(join(ROOT, 'scripts/market/fetch_indicators.py'), env, ['--fetch-only'])) console.log('  fetch_indicators.py が失敗（前回の値と基準日で続行）');
  }

  // 2. 読み込み
  const [indicators] = await rest<Indicators[]>(env, 'indicators?select=*&order=fetched_at.desc&limit=1');
  const [row] = await rest<UserMaSettingsRow[]>(env, `user_ma_settings?select=*&user_id=eq.${config.userId}`);
  if (!row) throw new Error(`user_ma_settings に ${config.userId} がありません`);
  const settings = rowToSettings(row);
  const fails = new Set((opt('simulate-fail') ?? '').split(',').filter(Boolean));
  const simDd = opt('simulate-drawdown');
  const dd = indicators.drawdown;
  let sp500Usd: PricePoint | null = fails.has('sp500_usd') ? null : dd?.sp500_usd ?? null;
  const sp500Jpy: PricePoint | null = dd?.sp500_jpy ?? null;
  if (simDd && sp500Usd) sp500Usd = { ...sp500Usd, last: sp500Usd.ath * (1 + Number(simDd)), lastDate: today };
  // 計算（暴落ルールを含む）にも同じ値を使う
  const ind: Indicators = dd ? { ...indicators, drawdown: { ...dd, sp500_usd: sp500Usd } } : indicators;

  // 3. 古さの判定
  const asOf = indicators.as_of ?? {};
  const fr = (key: string, date: string | null | undefined, kind: 'monthly' | 'price'): Freshness =>
    checkFreshness(fails.has(key) ? null : date, kind, today);
  const freshness: Record<string, Freshness> = {
    cape: fr('cape', asOf.cape, 'monthly'),
    // 日経225 の PBR は株価比の推定なので、日経225 の株価の鮮度で見る
    pbr: settings.jp_index === 'topix' ? fr('pbr', asOf.topix_pbr, 'monthly') : fr('pbr', asOf.momentum_jp, 'price'),
    gsr: fr('gsr', asOf.gold_silver_ratio, 'price'),
    momentum_us: fr('momentum_us', asOf.momentum_us, 'price'),
    momentum_jp: fr('momentum_jp', asOf.momentum_jp, 'price'),
    momentum_em: fr('momentum_em', asOf.momentum_em, 'price'),
    momentum_gold: fr('momentum_gold', asOf.momentum_gold, 'price'),
    sp500_usd: fr('sp500_usd', simDd ? sp500Usd?.lastDate : asOf.sp500_usd, 'price'),
    sp500_jpy: fr('sp500_jpy', asOf.sp500_jpy, 'price'),
  };

  // 4. 計算（画面と同じ関数。暴落ルールの判定を含む。待機資金・段階は書き換えない）
  const now = new Date(`${today}T09:00:00`);
  const calc = calculateMonthlyFromIndicators(ind, settings, config.mode, now);

  const mail = buildMail({
    month: decision.month,
    mode: config.mode,
    settings,
    indicators: ind,
    calc,
    freshness,
    sp500Usd,
    sp500Jpy,
  });

  const outDir = join(HERE, 'out');
  mkdirSync(outDir, { recursive: true });
  const preview = join(outDir, `preview-${today}.html`);
  writeFileSync(preview, `<!doctype html><meta charset="utf-8"><title>${mail.subject}</title>${mail.html}`);
  console.log(`  件名: ${mail.subject}`);
  console.log(`  HTML: ${preview}`);
  const crash = calc?.crash;
  if (crash?.newlyTriggered.length) console.log(`  暴落ルール: 第${crash.newlyTriggered.map((s) => s / 10 - 1).join('・')}段階に該当（投入額の合計 ${crash.total}円）`);
  if (dryRun) return { result: 'dry_run', targetMonth: decision.month, catchup, alert };

  // 5. 送信（Resend。Phase A はドメイン認証なしの onboarding@resend.dev から本人宛て）
  const res = await sendViaResend(env, config, mail);
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend: ${res.status} ${body}`);
  console.log(`  送信しました: ${body}`);

  // 6. 送信済みの記録（テスト送信では記録しない＝本番の送信を妨げない）。暴落段階は画面の「投資実行」で確定する
  if (!forceSend) {
    state.sentMonths = [...state.sentMonths, decision.month].slice(-24);
    // 月次メールで知らせた段階は通知済みにする（#34。翌日に同じ段階を二度知らせない）
    if (sp500Usd && crash?.newlyTriggered.length) state.crashAlert = markNotified(sp500Usd, crash.newlyTriggered, state.crashAlert ?? null);
    writeFileSync(statePath, JSON.stringify(state, null, 2));
  }
  return { result: forceSend ? 'force_sent' : 'sent', targetMonth: decision.month, catchup };
}

function writeRecord(record: RunRecord) {
  mkdirSync(LOG_DIR, { recursive: true });
  const lines = existsSync(RUNS_LOG) ? readFileSync(RUNS_LOG, 'utf8').split('\n').filter(Boolean) : [];
  lines.push(JSON.stringify(record));
  writeFileSync(RUNS_LOG, lines.slice(-RUNS_KEEP).join('\n') + '\n');
  writeFileSync(LAST_RUN, JSON.stringify(record, null, 2) + '\n');
}

function healthcheckUrl(): string | undefined {
  if (process.env.HEALTHCHECK_URL) return process.env.HEALTHCHECK_URL;
  try {
    return loadEnv(join(ROOT, 'scripts/market/.env')).HEALTHCHECK_URL;
  } catch {
    return undefined; // .env が読めないときも記録は書く
  }
}

// 送信と state.json は main の中、合図と記録ファイルはそのあと（monitor.ts の runOnce）
runOnce(opt('today') ?? localToday(), {
  main,
  ping: (record) => sendPing(record, healthcheckUrl()),
  write: writeRecord,
}).then(({ record, exitCode }) => {
  if (record.error) console.error(`  エラー: ${record.error}`);
  console.log(`  記録: ${record.result}（合図: ${record.ping}）`);
  process.exitCode = exitCode;
});
