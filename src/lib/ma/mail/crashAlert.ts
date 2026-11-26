// 暴落ルールの段階に達したときの通知（FI_project #34）。月次メールの送信日を待たずに知らせる。
// 判定は暴落ルールと同じ（S&P500 ドル建ての高値比、CRASH_STAGES）。知らせるだけで、待機資金・crash_state は書き換えない。
// 送信や取得はしない（実行環境に依存しない）。文言は「計算結果」「条件に該当」に統一する。
import type { CrashState, PricePoint } from '../types';
import { CRASH_STAGES, isNewHigh, type CrashEvaluation } from '../crash';
import { formatCurrency } from '../logic';

/** 通知済みの段階（scripts/ma-mail/state.json の crashAlert に持つ） */
export interface CrashAlertState {
  /** 通知を数え始めた最高値（これを上回ったら数え直す） */
  athValue: number;
  athDate: string;
  /** 通知済みの段階（20 / 30 / 40） */
  notified: number[];
}

export interface CrashAlertDecision {
  /** 今回通知する段階（空なら送らない） */
  stages: number[];
  /** 通知したら保存する状態 */
  next: CrashAlertState;
}

/**
 * @param confirmed 確定済みの状態（台帳の最後の行の crash_state。台帳が空なら crash_state.current）。ここで発動済みの段階は通知しない
 * @param prev 前回までの通知の状態
 */
export function decideCrashAlert(
  sp500: PricePoint,
  confirmed: CrashState | null,
  prev: CrashAlertState | null,
): CrashAlertDecision {
  const drawdown = Math.min(0, sp500.last / sp500.ath - 1);
  // 高値を更新したら数え直す（台帳の段階のリセットと同じ判定：値が大きく、かつ日付が後のときだけ）
  const reset = !prev || isNewHigh(sp500, prev, { strictNewHigh: true });
  const notified = reset ? [] : prev.notified;
  // 確定済みの段階を数え直すかは台帳と同じ判定（値が大きく、かつ日付が後のときだけ最高値の更新）
  const confirmedStages = confirmed && !isNewHigh(sp500, confirmed, { strictNewHigh: true }) ? confirmed.triggered : [];
  const stages = CRASH_STAGES.filter(
    (s) => drawdown <= -s / 100 && !notified.includes(s) && !confirmedStages.includes(s),
  );
  return {
    stages: [...stages],
    next: {
      athValue: reset ? sp500.ath : prev.athValue,
      athDate: reset ? sp500.athDate : prev.athDate,
      notified: [...new Set([...notified, ...stages])].sort((a, b) => a - b),
    },
  };
}

/** 月次メールで知らせた段階を、通知済みとして記録する（翌日以降に同じ段階を二度知らせないため） */
export function markNotified(sp500: PricePoint, stages: number[], prev: CrashAlertState | null): CrashAlertState {
  const reset = !prev || isNewHigh(sp500, prev, { strictNewHigh: true });
  const base = reset ? [] : prev.notified;
  return {
    athValue: reset ? sp500.ath : prev.athValue,
    athDate: reset ? sp500.athDate : prev.athDate,
    notified: [...new Set([...base, ...stages])].sort((a, b) => a - b),
  };
}

const pct = (x: number) => (x === 0 ? '0.0%' : `${x < 0 ? '−' : '+'}${Math.abs(x * 100).toFixed(1)}%`);
const price = (x: number) => x.toLocaleString('en-US', { maximumFractionDigits: 2 });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface CrashAlertMail {
  subject: string;
  html: string;
  text: string;
}

export function buildCrashAlert(i: {
  today: string;
  stages: number[];
  sp500Usd: PricePoint;
  sp500Jpy: PricePoint | null;
  /** evaluateCrash の結果（投入額の見込み）。計算できなければ null */
  crash: CrashEvaluation | null;
  /** 月次メールの送信日（config の sendDay）。無ければ日付を出さない */
  sendDay?: number;
}): CrashAlertMail {
  const stageLabel = (s: number) => `第${s / 10 - 1}段階（高値比 −${s}%）`;
  const subject = `【/ma 暴落ルール】${i.stages.map(stageLabel).join('・')}の条件に該当（${i.today}）`;
  const ddUsd = Math.min(0, i.sp500Usd.last / i.sp500Usd.ath - 1);
  const lines: string[] = [
    `S&P500（ドル建て）が、暴落ルールの${i.stages.map(stageLabel).join('・')}の条件に該当しました。`,
    `S&P500（ドル建て）の高値からの位置：${pct(ddUsd)}（${i.sp500Usd.lastDate} の終値 ${price(i.sp500Usd.last)}、最高値 ${price(i.sp500Usd.ath)}（${i.sp500Usd.athDate}））`,
  ];
  if (i.sp500Jpy) {
    lines.push(`参考：S&P500（円建て）の高値からの位置 ${pct(Math.min(0, i.sp500Jpy.last / i.sp500Jpy.ath - 1))}`);
  }
  const amounts: string[] = [];
  for (const s of i.stages) {
    const d = i.crash?.deployments.find((x) => x.stage === s);
    const how = s === 40 ? '待機資金の残高の全額' : '基準残高の1/3';
    amounts.push(`${stageLabel(s)}：${how} ${d ? formatCurrency(d.amount) : '（計算できませんでした）'}`);
  }
  const total = i.stages.every((s) => i.crash?.deployments.some((x) => x.stage === s))
    ? `投入額の見込み（計算結果）の合計：${formatCurrency(
        i.stages.reduce((sum, s) => sum + (i.crash?.deployments.find((x) => x.stage === s)?.amount ?? 0), 0),
      )}`
    : '';
  const sendDayText = i.sendDay != null ? `次の送信日（${i.sendDay}日）` : '次の送信日';
  const guide = `/ma を開いて、買うものを選んでください。この段階は、${sendDayText}の月次メールで台帳に記録します。このメールでは記録していません。`;
  const notes = [
    '台帳には、月次メールの日の下落率で判定して記録します。それまでに下落率が戻っていれば、この段階は記録されません。',
  ];

  const text = [...lines, '', ...amounts, ...(total ? [total] : []), '', guide, ...notes].join('\n') + '\n';
  const html = [
    '<div style="font-family:sans-serif;font-size:14px;color:#0f172a">',
    ...lines.map((l) => `<p style="margin:4px 0">${esc(l)}</p>`),
    ...amounts.map(
      (l) => `<p style="margin:4px 0;padding:8px;background:#fff7ed;border-left:4px solid #ea580c"><b>${esc(l)}</b></p>`,
    ),
    total ? `<p style="margin:4px 0;font-size:15px"><b>${esc(total)}</b></p>` : '',
    `<p style="color:#475569;font-size:13px">${esc(guide)}</p>`,
    ...notes.map((n) => `<p style="color:#475569;font-size:12px">${esc(n)}</p>`),
    '</div>',
  ].join('\n');
  return { subject, html, text };
}
