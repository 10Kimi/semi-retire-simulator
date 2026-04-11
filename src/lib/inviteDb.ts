import { supabase } from './supabase';

export async function redeemInviteCode(
  userId: string,
  code: string,
): Promise<{ success: boolean; message: string }> {
  // 1. コード照合
  const { data: invite, error: findErr } = await supabase
    .from('invite_codes')
    .select('id, is_used')
    .eq('code', code.trim())
    .single();

  if (findErr || !invite) {
    return { success: false, message: 'このコードは存在しません' };
  }

  if (invite.is_used) {
    return { success: false, message: 'このコードは既に使用されています' };
  }

  // 2. コードを使用済みに更新
  const { error: updateErr } = await supabase
    .from('invite_codes')
    .update({ is_used: true, used_by: userId, used_at: new Date().toISOString() })
    .eq('id', invite.id);

  if (updateErr) {
    return { success: false, message: 'コードの適用に失敗しました' };
  }

  // 3. プロフィールにis_premium=trueをセット
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      is_premium: true,
      premium_source: 'invite',
      premium_granted_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (profileErr) {
    return { success: false, message: 'プランの有効化に失敗しました' };
  }

  return { success: true, message: '有料プランが有効になりました' };
}
