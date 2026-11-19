// /ma の金額を本人の鍵で暗号化してサーバーにも置く（案B、FI_project #117、D-070）。
// ここは Supabase を持たない純粋な関数だけ（状態の判定と画面の文言）。サーバーへの読み書きは db.ts。
import type { PassphraseIssue, VaultErrorCode } from '../vault/vault';
import { VaultError } from '../vault/vault';
import { baseOf, sameTime } from './localAmounts';

/** サーバーの暗号文の列（user_ma_settings、migration 048） */
export interface VaultColumns {
  amounts_vault: string | null;
  vault_verifier: string | null;
  vault_saved_at: string | null;
}

export const EMPTY_VAULT: VaultColumns = { amounts_vault: null, vault_verifier: null, vault_saved_at: null };

/**
 * 画面を開いたときの状態
 * - owner：オーナー本人の行（金額は平文でサーバー、D-066）。暗号化の画面は出さない
 * - none：パスフレーズをまだ設定していない
 * - locked：設定済み。この端末の値を使う（サーバーの暗号文より新しいか同じ）。パスフレーズを入れるとサーバーにも保存する
 * - restore-needed：この端末に値が無いか、この端末が最後にそろえたあとでサーバーの暗号文が変わった（ほかの端末が保存した）。
 *   パスフレーズを入れて戻すまで画面を出さない。両方で変えていたらサーバーの方を採る
 *   （古い値のまま「投資実行」すると、暴落ルールの投入が二重になりうるため、§13-69、#117 のレビュー役の指摘・高1）
 * - unavailable：サーバーの行を読めなかった（通信の失敗など）。設定の画面は出さない（ほかの端末の暗号文を上書きしないように）
 *
 * 新しい・古いは時刻の大小ではなく、サーバーの版（vault_saved_at）とこの端末の base が同じかで決める（端末の時計のずれに左右されない）
 */
export type VaultStatus = 'owner' | 'none' | 'locked' | 'restore-needed' | 'unavailable';

export function vaultStatus(
  amountsOnServer: boolean, cols: VaultColumns | null, localRaw: string | null,
): VaultStatus {
  if (amountsOnServer) return 'owner';
  if (!cols) return 'unavailable';
  if (!cols.vault_verifier) return 'none';
  if (!cols.amounts_vault) return 'locked';
  if (!localRaw) return 'restore-needed';
  return sameTime(baseOf(localRaw), cols.vault_saved_at) ? 'locked' : 'restore-needed';
}

const ISSUE_TEXT: Record<PassphraseIssue, string> = {
  'too-short': '6文字以上にしてください',
  'no-upper': '英大文字（A〜Z）を1文字以上入れてください',
  'no-lower': '英小文字（a〜z）を1文字以上入れてください',
  'no-digit': '数字（0〜9）を1文字以上入れてください',
};

export function passphraseIssueText(issues: PassphraseIssue[]): string[] {
  return issues.map((i) => ISSUE_TEXT[i]);
}

const ERROR_TEXT: Record<VaultErrorCode, string> = {
  'wrong-passphrase': 'パスフレーズが違います',
  'decrypt-failed': 'サーバーの暗号文を開けませんでした（パスフレーズが違うか、データが壊れています）',
  'unsupported-version': 'サーバーの暗号文の形式が新しすぎて読めません。ページを再読み込みしてください',
  malformed: 'サーバーの暗号文が壊れています',
  'key-mismatch': 'パスフレーズが違います',
};

export function vaultErrorText(e: unknown): string {
  // db.ts の LocalSaveError（ここは Supabase を読み込まないので名前で見る）
  if (e instanceof Error && e.name === 'LocalSaveError') {
    return 'このブラウザに保存できませんでした（プライベートブラウズ・容量の上限など）。別のブラウザか、通常のウィンドウでお試しください';
  }
  return e instanceof VaultError ? ERROR_TEXT[e.code] : '保存か読み込みに失敗しました。時間をおいてもう一度お試しください';
}
