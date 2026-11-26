// /ma の待機資金の台帳（ma_ledger、FI_project #140、§13-69）の読み書き。オーナー本人の行（keep_amounts_on_server）だけ。
// 画面にできるのは、読む・最初の行（seed）を作る・最後の行に実際の残高を上書きする／取り消す、だけ（migration の RLS とトリガー）。
// 計算した行（record）は月次メールのジョブ（scripts/ma-mail/run.ts、service key）が作る。
import { supabase } from '../supabase';
import type { LedgerRow } from './ledger';
import { toLedgerRow } from './ledgerRow';

export async function fetchLedger(userId: string): Promise<{ rows: LedgerRow[]; failed: boolean }> {
  const { data, error } = await supabase.from('ma_ledger').select('*').eq('user_id', userId).order('month');
  if (error) {
    console.error('ma_ledger fetch error:', error);
    return { rows: [], failed: true };
  }
  return { rows: (data ?? []).map(toLedgerRow), failed: false };
}

/** 台帳が空のときの最初の行（seed）を、実際の残高の上書きつきで作る */
export async function insertSeedWithOverride(seed: LedgerRow, amount: number): Promise<boolean> {
  const { error } = await supabase.from('ma_ledger').insert({
    ...seed,
    override_balance: amount,
    override_at: new Date().toISOString(),
  });
  if (error) console.error('ma_ledger seed insert error:', error);
  return !error;
}

/** 最後の行に実際の残高を上書きする（amount が null なら取り消す） */
export async function setLedgerOverride(userId: string, month: string, amount: number | null): Promise<boolean> {
  const { error } = await supabase
    .from('ma_ledger')
    .update({ override_balance: amount, override_at: amount == null ? null : new Date().toISOString() })
    .eq('user_id', userId)
    .eq('month', month);
  if (error) console.error('ma_ledger override error:', error);
  return !error;
}
