// /ma 月次メールの送信日判定。実行環境（ローカル launchd／将来のクラウド）に依存しないよう、
// 日付は 'YYYY-MM-DD' の文字列で扱い、タイムゾーンに左右される Date の暦計算は使わない。
import holiday_jp from '@holiday-jp/holiday_jp';

const HOLIDAYS = holiday_jp.holidays as Record<string, unknown>;

function toUtc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  const d = toUtc(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** 土日・祝日（振替休日・国民の休日を含む）以外 */
export function isBusinessDay(ymd: string): boolean {
  const dow = toUtc(ymd).getUTCDay();
  return dow !== 0 && dow !== 6 && !(ymd in HOLIDAYS);
}

/** from の翌日〜to までに含まれる営業日数（from < to のとき） */
export function businessDaysBetween(from: string, to: string): number {
  let n = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) {
    if (isBusinessDay(d)) n++;
  }
  return n;
}

/** その月の送信日。sendDay が土日祝なら直前の営業日。月末を超える sendDay は月末に丸める */
export function scheduledSendDate(month: string, sendDay: number): string {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
  let d = `${month}-${String(Math.min(sendDay, lastDay)).padStart(2, '0')}`;
  while (!isBusinessDay(d)) d = addDays(d, -1);
  return d;
}

export interface SendDecision {
  send: boolean;
  month: string;
  scheduled: string;
  reason: string;
}

/**
 * 今日送るかどうか。
 * - その月の送信日に達していて、まだ送っていなければ送る（送信日を過ぎていても送る＝キャッチアップ）
 * - 同じ月に送信済みなら送らない（二重送信の防止）
 */
export function decideSend(today: string, sendDay: number, sentMonths: string[]): SendDecision {
  const month = today.slice(0, 7);
  const scheduled = scheduledSendDate(month, sendDay);
  if (sentMonths.includes(month)) {
    return { send: false, month, scheduled, reason: `${month} は送信済み` };
  }
  if (today < scheduled) {
    return { send: false, month, scheduled, reason: `送信日（${scheduled}）より前` };
  }
  return {
    send: true,
    month,
    scheduled,
    reason: today === scheduled ? '送信日' : `送信日（${scheduled}）を過ぎて未送信のためキャッチアップ`,
  };
}
