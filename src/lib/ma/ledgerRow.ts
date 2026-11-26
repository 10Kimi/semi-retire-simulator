// ma_ledger の PostgREST の行を LedgerRow に（bigint が文字列で来ても数値にする）。
// Supabase クライアントを持たないので、画面（ledgerDb.ts）と月次メールのスクリプト（Node）の両方から使える。
import type { LedgerRow } from './ledger';

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export function toLedgerRow(r: Record<string, unknown>): LedgerRow {
  return {
    ...(r as unknown as LedgerRow),
    opening_balance: num(r.opening_balance),
    monthly_reserve: Number(r.monthly_reserve ?? 0),
    crash_deployment: Number(r.crash_deployment ?? 0),
    closing_balance: Number(r.closing_balance),
    override_balance: num(r.override_balance),
    crash_triggered: (r.crash_triggered as number[] | null) ?? [],
  };
}
