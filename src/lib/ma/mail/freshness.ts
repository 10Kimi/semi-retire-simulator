// 指標の古さの判定。古い・取得できなかった指標は、メールで「未更新（基準日 …）」と明記する
// （古い値で黙って計算しない）。
import { businessDaysBetween } from './schedule';

/** 月次で公表される指標（CAPE・PBR）の許容日数 */
export const MONTHLY_MAX_DAYS = 45;
/** 価格系の指標の許容営業日数 */
export const PRICE_MAX_BUSINESS_DAYS = 5;

export type FreshnessKind = 'monthly' | 'price';

export interface Freshness {
  stale: boolean;
  /** 基準日（不明なら null） */
  asOf: string | null;
  /** 取得に失敗した／基準日が無い */
  missing: boolean;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function checkFreshness(asOf: string | null | undefined, kind: FreshnessKind, today: string): Freshness {
  if (!asOf) return { stale: true, asOf: null, missing: true };
  const stale =
    kind === 'monthly'
      ? daysBetween(asOf, today) > MONTHLY_MAX_DAYS
      : businessDaysBetween(asOf, today) > PRICE_MAX_BUSINESS_DAYS;
  return { stale, asOf, missing: false };
}

/** 「未更新（基準日 yyyy-mm-dd）」等の注記。新しければ空文字 */
export function staleNote(f: Freshness): string {
  if (!f.stale) return '';
  return f.missing ? '未更新（取得できず）' : `未更新（基準日 ${f.asOf}）`;
}
