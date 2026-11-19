// /rb が現金から別枠にする /ma の待機資金を決める（FI_project #118）。
// オーナー本人の行（keep_amounts_on_server、D-066）はサーバーの reserve_balance、ほかの人は同じブラウザの /ma の値。
// サーバーの暗号文（D-071）は読まない（/rb ではパスフレーズを聞かない）。/rb からは書き換えない。
import { baseOf, loadLocalRaw, parseAmountsJson, sameTime, type AmountStorage } from '../ma/localAmounts';

export interface MaReserveRow {
  keep_amounts_on_server: boolean | null;
  reserve_balance: number | string | null;
  /** 暗号文の版（D-071）。この端末の値が古いかを見るだけに使う */
  vault_saved_at?: string | null;
}

/**
 * - server：本人の行のサーバーの値
 * - browser：この端末の /ma の値
 * - browser-stale：この端末の /ma の値だが、ほかの端末で /ma を保存したあと（値が古い可能性）
 * - unavailable：サーバーを読めず、この端末にも値が無い（0 として計算）
 * - none：この端末に /ma の値が無い（0 として計算）
 */
export type MaReserveSource = 'server' | 'browser' | 'browser-stale' | 'unavailable' | 'none';

export interface MaReserve {
  amount: number;
  source: MaReserveSource;
}

const nonNegative = (n: number) => Math.max(0, n);

/** サーバーの行（無ければ null）とこの端末の /ma の値から、待機資金と出どころを決める */
export function pickMaReserve(
  row: MaReserveRow | null,
  storage: AmountStorage | null,
  userId: string,
  fetchFailed = false,
): MaReserve {
  if (row?.keep_amounts_on_server && row.reserve_balance != null) {
    const n = Number(row.reserve_balance);
    if (Number.isFinite(n)) return { amount: nonNegative(n), source: 'server' };
  }
  const raw = storage ? loadLocalRaw(storage, userId) : null;
  const local = raw ? parseAmountsJson(raw) : null;
  if (local) {
    // /ma の vaultStatus と同じく、版は時刻の大小ではなく、この端末が最後にそろえた版（base）と同じかで見る
    const stale = !row?.keep_amounts_on_server && row?.vault_saved_at != null && !sameTime(baseOf(raw), row.vault_saved_at);
    return { amount: nonNegative(local.reserve_balance), source: stale ? 'browser-stale' : 'browser' };
  }
  return { amount: 0, source: fetchFailed ? 'unavailable' : 'none' };
}
