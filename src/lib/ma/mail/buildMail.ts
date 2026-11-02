// /ma 月次メールの件名・本文（HTML とテキスト）を組み立てる。送信や取得はしない（実行環境に依存しない）。
// 文言は「計算結果」「条件に該当」に統一する（legal-check の禁止語は使わない。mail.test.ts で検査）。
import type { Indicators, MarketMode, UserMaSettings, MaAssetClass, AllocationResult, PricePoint } from '../types';
import { MA_ACCOUNT_OPTIONS, MA_ASSET_CLASS_OPTIONS, SLOT_KEYS, isTaxAdvantaged } from '../types';
import type { MonthlyInputs } from '../logic';
import { formatCurrency } from '../logic';
import type { Freshness } from './freshness';
import { staleNote } from './freshness';
import type { CrashEvaluation } from '../crash';

export const MODE_LABELS: Record<MarketMode, string> = {
  bullish: '強気（+0.25）',
  neutral: '平常（補正なし）',
  cautious: '慎重（−0.25）',
};

/** freshness のキー: cape / pbr / gsr / momentum_us / momentum_jp / momentum_em / momentum_gold / sp500_usd / sp500_jpy */
export interface MailInput {
  month: string; // 'YYYY-MM'
  mode: MarketMode;
  settings: UserMaSettings;
  indicators: Indicators;
  calc: { inputs: MonthlyInputs; result: AllocationResult; reserveMonthBase: number; crash: CrashEvaluation | null } | null;
  freshness: Record<string, Freshness>;
  sp500Usd: PricePoint | null;
  sp500Jpy: PricePoint | null;
}

export interface BuiltMail {
  subject: string;
  html: string;
  text: string;
  hasStale: boolean;
}

const pct = (x: number) => (x === 0 ? '0.0%' : `${x < 0 ? '−' : '+'}${Math.abs(x * 100).toFixed(1)}%`);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 下落率の段階（色と文字の両方で示す） */
function drawdownBand(dd: number): { color: string; label: string } {
  if (dd <= -0.4) return { color: '#b91c1c', label: '−40%以下（第3段階の水準）' };
  if (dd <= -0.3) return { color: '#ea580c', label: '−30%以下（第2段階の水準）' };
  if (dd <= -0.2) return { color: '#d97706', label: '−20%以下（第1段階の水準）' };
  return { color: '#334155', label: '−20%未満' };
}

function positionText(p: PricePoint): string {
  const dd = Math.min(0, p.last / p.ath - 1);
  return dd === 0 ? '0%（最高値更新中）' : pct(dd);
}

const INDICATOR_LABELS: Record<string, string> = {
  cape: 'CAPE',
  pbr: 'PBR',
  gsr: '金銀比率',
  momentum_us: '米国モメンタム',
  momentum_jp: '日本モメンタム',
  momentum_em: '新興国モメンタム',
  momentum_gold: '金モメンタム',
};

/** 資産クラスごとに、倍率に使う指標のキー */
const CLASS_INDICATORS: Record<MaAssetClass, string[]> = {
  us: ['cape', 'momentum_us'],
  jp: ['pbr', 'momentum_jp'],
  em: ['momentum_em'],
  gold: ['gsr', 'momentum_gold'],
  bond: [],
  none: [],
};

export function buildMail(i: MailInput): BuiltMail {
  const f = (k: string) => i.freshness[k] ?? { stale: true, asOf: null, missing: true };
  const hasStale = Object.values(i.freshness).some((x) => x.stale) || !i.calc || !i.sp500Usd;
  const [y, m] = i.month.split('-').map(Number);
  const usdDd = i.sp500Usd ? Math.min(0, i.sp500Usd.last / i.sp500Usd.ath - 1) : null;

  const subject =
    (hasStale ? '【データ未更新あり】' : '') +
    `【/ma】${y}年${m}月の計算結果（S&P500 高値比 ${usdDd == null ? '取得できず' : usdDd === 0 ? '0.0%' : pct(usdDd)}）`;

  const html: string[] = [];
  const text: string[] = [];
  const h2 = (t: string) => {
    html.push(`<h2 style="font-size:16px;margin:24px 0 8px;border-bottom:1px solid #cbd5e1;padding-bottom:4px">${esc(t)}</h2>`);
    text.push('', `■ ${t}`);
  };
  const note = (s: string) => (s ? ` <span style="color:#b91c1c;font-weight:bold">［${esc(s)}］</span>` : '');
  const tnote = (s: string) => (s ? ` ［${s}］` : '');

  // 1. 高値からの位置
  h2('S&P500 の高値からの位置');
  const pointRow = (label: string, p: PricePoint | null, fr: Freshness, unit: string) => {
    if (!p) {
      html.push(`<p>${esc(label)}：<b style="color:#b91c1c">取得できず</b></p>`);
      text.push(`${label}：取得できず`);
      return;
    }
    const dd = Math.min(0, p.last / p.ath - 1);
    const band = drawdownBand(dd);
    const fmt = (v: number) => `${unit}${v.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}`;
    html.push(
      `<p style="margin:4px 0">${esc(label)}：<b style="font-size:18px;color:${band.color}">${positionText(p)}</b>` +
        ` <span style="color:${band.color}">［${esc(band.label)}］</span>${note(staleNote(fr))}<br>` +
        `<span style="color:#475569;font-size:13px">現在 ${fmt(p.last)}（${p.lastDate}）／最高値 ${fmt(p.ath)}（${p.athDate}）</span></p>`,
    );
    text.push(`${label}：${positionText(p)} ［${band.label}］${tnote(staleNote(fr))}`, `  現在 ${fmt(p.last)}（${p.lastDate}）／最高値 ${fmt(p.ath)}（${p.athDate}）`);
  };
  pointRow('ドル建て（判定用）', i.sp500Usd, f('sp500_usd'), '$');
  pointRow('円建て（参考）', i.sp500Jpy, f('sp500_jpy'), '¥');

  // 2. 暴落ルール（該当するときだけ）。投入額は待機資金から。何を買うかは本人が選ぶ
  const crash = i.calc?.crash ?? null;
  if (crash && crash.newlyTriggered.length > 0) {
    h2('暴落ルール');
    for (const dpl of crash.deployments) {
      const how = dpl.stage === 40 ? '待機資金の残高の全額' : '基準残高の1/3';
      const line = `第${dpl.stage / 10 - 1}段階（高値比 −${dpl.stage}%）の条件に該当：${how} ${formatCurrency(dpl.amount)}`;
      html.push(`<p style="margin:4px 0;padding:8px;background:#fff7ed;border-left:4px solid #ea580c"><b>${esc(line)}</b></p>`);
      text.push(line);
    }
    const totalLine = `暴落ルールによる投入額：${formatCurrency(crash.total)}（待機資金から。基準残高 ${formatCurrency(crash.nextState.baseReserve ?? 0)}）`;
    html.push(`<p style="margin:4px 0;font-size:15px"><b>${esc(totalLine)}</b></p>`);
    text.push(totalLine);
    const sub = '何を買うかはご自身で選んでください。資産クラスごとの高値からの下落率：';
    html.push(`<p style="color:#475569;font-size:13px">${sub}</p>`);
    text.push(sub);
    html.push('<table style="border-collapse:collapse;font-size:13px">');
    for (const c of Object.values(i.indicators.drawdown?.classes ?? {})) {
      const v = c.last != null && c.ath != null && c.athDate
        ? positionText({ last: c.last, ath: c.ath, athDate: c.athDate, lastDate: c.lastDate ?? '' })
        : '取得できず';
      html.push(`<tr><td style="padding:2px 12px 2px 0">${esc(c.label)}</td><td>${v}</td></tr>`);
      text.push(`  ${c.label}：${v}`);
    }
    html.push('</table>');
  }

  // 3. 今月の指標
  h2('今月の指標');
  const ind = i.indicators;
  const d = i.calc?.result.details;
  const rows: [string, string, string, string, string][] = [
    // [指標, 値, 基準日の注記キー, 判定, 倍率]
    ['CAPE（米国株）', ind.cape != null ? String(ind.cape) : '—', 'cape', d?.capeResult.label ?? '—', d ? `×${d.usMultiplier}` : '—'],
    ['CAPE 5年平均', i.calc?.inputs.cape5yMA != null ? i.calc.inputs.cape5yMA.toFixed(2) : '—', '', '', ''],
    [i.settings.jp_index === 'topix' ? 'PBR（TOPIX）' : 'PBR（日経225・推定）', i.calc?.inputs.pbr != null ? String(i.calc.inputs.pbr) : '—', 'pbr', d?.pbrResult.label ?? '—', d ? `×${d.jpMultiplier}` : '—'],
    ['金銀比率', ind.gold_silver_ratio != null ? String(ind.gold_silver_ratio) : '—', 'gsr', d?.gsrResult.label ?? '—', d ? `×${d.goldMultiplier}` : '—'],
    // 新興国株は割安・割高の指標を持たず、倍率はモメンタム（VWO と10ヶ月平均の比較）だけで決まる
    [
      '新興国株（VWO・モメンタムのみ）',
      ind.momentum?.em?.last_price != null && ind.momentum.em.ma10 != null
        ? `${ind.momentum.em.last_price}（10ヶ月平均 ${ind.momentum.em.ma10}）`
        : '—',
      'momentum_em',
      i.calc?.inputs.momentum.em == null ? '取得できず（上昇扱い）' : i.calc.inputs.momentum.em ? '平均より上' : '平均より下',
      d ? `×${d.emMultiplier}` : '—',
    ],
  ];
  const mom = (key: 'us' | 'jp' | 'em' | 'gold') => {
    const v = i.calc?.inputs.momentum[key];
    return v == null ? '取得できず（上昇扱い）' : v ? '10ヶ月平均より上' : '10ヶ月平均より下';
  };
  html.push('<table style="border-collapse:collapse;font-size:13px">');
  html.push('<tr style="background:#f1f5f9"><th style="text-align:left;padding:4px 8px">指標</th><th style="text-align:left;padding:4px 8px">値</th><th style="text-align:left;padding:4px 8px">基準日</th><th style="text-align:left;padding:4px 8px">判定</th><th style="text-align:left;padding:4px 8px">倍率</th></tr>');
  for (const [name, val, key, judge, mult] of rows) {
    const fr = key ? f(key) : null;
    const asOf = fr ? (fr.asOf ?? '—') : '';
    const n = fr ? staleNote(fr) : '';
    html.push(`<tr><td style="padding:4px 8px">${esc(name)}</td><td style="padding:4px 8px">${esc(val)}</td><td style="padding:4px 8px">${asOf}${note(n)}</td><td style="padding:4px 8px">${esc(judge)}</td><td style="padding:4px 8px">${esc(mult)}</td></tr>`);
    text.push(`${name}：${val}（基準日 ${asOf || '—'}）${tnote(n)} ${judge} ${mult}`.trimEnd());
  }
  html.push('</table>');
  const momLine = `モメンタム：米国 ${mom('us')}${tnote(staleNote(f('momentum_us')))}／日本 ${mom('jp')}${tnote(staleNote(f('momentum_jp')))}／新興国 ${mom('em')}${tnote(staleNote(f('momentum_em')))}／金 ${mom('gold')}${tnote(staleNote(f('momentum_gold')))}`;
  html.push(`<p style="font-size:13px">${esc(momLine)}</p>`);
  text.push(momLine);
  const modeLine = `計算に使った市場モード：${MODE_LABELS[i.mode]}`;
  html.push(`<p style="font-size:13px"><b>${esc(modeLine)}</b></p>`);
  text.push(modeLine);

  // 4. 今月の計算結果
  h2('今月の計算結果');
  if (!i.calc) {
    const msg = 'CAPE・PBR・金銀比率のいずれかが取得できず、計算できませんでした。/ma の画面で値を入力して計算してください。';
    html.push(`<p style="color:#b91c1c"><b>${esc(msg)}</b></p>`);
    text.push(msg);
  } else {
    const r = i.calc.result;
    const multOf: Record<MaAssetClass, number> = {
      us: r.details.usMultiplier, jp: r.details.jpMultiplier, em: r.details.emMultiplier, gold: r.details.goldMultiplier, bond: 1, none: 1,
    };
    html.push('<table style="border-collapse:collapse;font-size:13px">');
    html.push('<tr style="background:#f1f5f9"><th style="text-align:left;padding:4px 8px">枠</th><th style="text-align:left;padding:4px 8px">口座・銘柄</th><th style="text-align:right;padding:4px 8px">設定額</th><th style="text-align:left;padding:4px 8px">倍率</th><th style="text-align:right;padding:4px 8px">今月の額</th></tr>');
    SLOT_KEYS.forEach((key, idx) => {
      const slot = i.settings[key];
      const amount = r.perSlotAmount[idx];
      if (slot.amount === 0 && amount === 0) return;
      const fixed = isTaxAdvantaged(slot.account);
      const account = MA_ACCOUNT_OPTIONS.find((o) => o.value === slot.account)?.label ?? slot.account;
      const cls = MA_ASSET_CLASS_OPTIONS.find((o) => o.value === slot.asset_class)?.label ?? slot.asset_class;
      const mult = fixed ? '固定枠（満額）' : `変動枠 ×${multOf[slot.asset_class]}`;
      const staleKeys = fixed ? [] : CLASS_INDICATORS[slot.asset_class].filter((k) => f(k).stale);
      const n = staleKeys.length ? `未更新の指標を含む（${staleKeys.map((k) => INDICATOR_LABELS[k]).join('・')}）` : '';
      const name = `${account}／${slot.fund_name || cls}`;
      html.push(`<tr><td style="padding:4px 8px">${fixed ? '固定' : '変動'}</td><td style="padding:4px 8px">${esc(name)}</td><td style="padding:4px 8px;text-align:right">${formatCurrency(slot.amount)}</td><td style="padding:4px 8px">${esc(mult)}${note(n)}</td><td style="padding:4px 8px;text-align:right"><b>${formatCurrency(amount)}</b></td></tr>`);
      text.push(`[${fixed ? '固定' : '変動'}] ${name}：${formatCurrency(slot.amount)} → ${formatCurrency(amount)}（${mult}）${tnote(n)}`);
    });
    html.push('</table>');
    const lines = [
      `今月の投資額の合計（スロット）：${formatCurrency(r.totalInvest)}`,
      r.crashDeployment > 0 ? `暴落ルールによる投入額（待機資金から・別枠）：${formatCurrency(r.crashDeployment)}` : '',
    ].filter(Boolean);
    for (const l of lines) {
      html.push(`<p style="margin:4px 0;font-size:14px">${esc(l)}</p>`);
      text.push(l);
    }

    // 待機資金の流れ（現在の残高 → 今月の積み増し → 暴落ルールによる投入 → 計算後の残高）
    h2('待機資金');
    const flow: [string, string][] = [
      ['現在の残高', formatCurrency(i.calc.reserveMonthBase)],
      ['今月の積み増し', `+${formatCurrency(r.monthlyReserve)}`],
      ...(r.crashDeployment > 0 ? [['暴落ルールによる投入', `−${formatCurrency(r.crashDeployment)}`] as [string, string]] : []),
      ['計算後の残高', formatCurrency(r.newReserveBalance)],
    ];
    html.push('<table style="border-collapse:collapse;font-size:14px">');
    flow.forEach(([k, v], idx) => {
      const last = idx === flow.length - 1;
      html.push(`<tr${last ? ' style="border-top:1px solid #cbd5e1;font-weight:bold"' : ''}><td style="padding:3px 16px 3px 0">${k}</td><td style="text-align:right">${v}</td></tr>`);
      text.push(`${k}：${v}`);
    });
    html.push('</table>');
    const reserveNote = 'メールでは残高を更新していません。/ma の画面の「投資実行＆待機資金を更新」で確定してください。';
    html.push(`<p style="color:#475569;font-size:12px">${reserveNote}</p>`);
    text.push(reserveNote);
  }

  // 5. 末尾
  const footer = '設定したルールに当てはめた計算結果です。';
  html.push(`<p style="margin-top:24px;color:#475569;font-size:12px">${footer}</p>`);
  text.push('', footer);

  return {
    subject,
    html: `<div style="font-family:-apple-system,'Hiragino Sans',sans-serif;color:#0f172a;max-width:640px">${html.join('\n')}</div>`,
    text: text.join('\n'),
    hasStale,
  };
}
