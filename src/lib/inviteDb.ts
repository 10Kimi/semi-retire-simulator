import { supabase } from './supabase';

// 照合・使用済みにする・有料の付与はサーバー側の関数 redeem_invite_code（migration 042）が行う
const MESSAGES: Record<string, string> = {
  ok: '有料プランが有効になりました',
  not_found: 'このコードは存在しません',
  used: 'このコードは既に使用されています',
};

export async function redeemInviteCode(
  code: string,
): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('redeem_invite_code', { p_code: code.trim() });

  if (error) {
    return { success: false, message: 'コードの適用に失敗しました' };
  }

  const status = typeof data === 'string' ? data : '';
  return {
    success: status === 'ok',
    message: MESSAGES[status] ?? 'コードの適用に失敗しました',
  };
}
