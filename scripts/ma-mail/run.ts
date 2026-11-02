/**
 * /ma 月次メール（Phase A：オーナー個人向け・ローカル実行）
 *
 * launchd（jp.largogk.fi.ma-mail）が毎月20〜31日 9:00 と RunAtLoad で起動する。
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
 *
 * 設定: scripts/ma-mail/config.local.json（gitignore。config.example.json を参照）
 * 秘密: scripts/market/.env の SUPABASE_URL / SUPABASE_SERVICE_KEY / RESEND_API_KEY
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Indicators, MarketMode, PricePoint } from '../../src/lib/ma/types';
import { calculateMonthlyFromIndicators } from '../../src/lib/ma/logic';
import { rowToSettings, type UserMaSettingsRow } from '../../src/lib/ma/settingsRow';
import { decideSend } from '../../src/lib/ma/mail/schedule';
import { checkFreshness, type Freshness } from '../../src/lib/ma/mail/freshness';
import { buildMail } from '../../src/lib/ma/mail/buildMail';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PYTHON = join(ROOT, 'scripts/market/.venv/bin/python');

interface Config {
  userId: string;
  to: string;
  from: string;
  sendDay: number;
  mode: MarketMode;
}

interface State {
  sentMonths: string[];
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

function runPython(script: string, env: Record<string, string>, extraArgs: string[] = []): boolean {
  const r = spawnSync(PYTHON, [script, ...extraArgs], { cwd: dirname(script), env: { ...process.env, ...env }, encoding: 'utf8' });
  process.stdout.write(r.stdout ?? '');
  process.stderr.write(r.stderr ?? '');
  return r.status === 0;
}

async function main() {
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
  const decision = decideSend(today, config.sendDay, state.sentMonths);
  console.log(`  判定: ${decision.send ? '送る' : '送らない'}（${decision.reason}）`);
  if (!decision.send && !dryRun && !forceSend) return;

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
  if (dryRun) return;

  // 5. 送信（Resend。Phase A はドメイン認証なしの onboarding@resend.dev から本人宛て）
  if (!env.RESEND_API_KEY) throw new Error('scripts/market/.env に RESEND_API_KEY がありません');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.from, to: [config.to], subject: mail.subject, html: mail.html, text: mail.text }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend: ${res.status} ${body}`);
  console.log(`  送信しました: ${body}`);

  // 6. 送信済みの記録（テスト送信では記録しない＝本番の送信を妨げない）。暴落段階は画面の「投資実行」で確定する
  if (!forceSend) {
    state.sentMonths = [...state.sentMonths, decision.month].slice(-24);
    writeFileSync(statePath, JSON.stringify(state, null, 2));
  }
}

main().catch((e) => {
  console.error(`  エラー: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
