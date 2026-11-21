import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * 有料（profiles.is_premium）かどうか。
 * loading は「今のユーザーについてまだ読み終えていない」間 true。ログインの確認中（AuthContext の loading）も true。
 * 以前はログイン前の空のユーザーで読み終えた結果（無料）をそのまま返し、ユーザーが入ってから読み直す間も
 * loading が false だったため、有料の人に無料の画面が一瞬出ていた（FI_project #101）。
 */
export function useIsPremium(): { isPremium: boolean; loading: boolean; refresh: () => void } {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [isPremium, setIsPremium] = useState(false);
  // どのユーザーについて読み終えたか（undefined はまだ一度も読んでいない）
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);

  const load = async () => {
    if (!userId) { setIsPremium(false); setLoadedFor(null); return; }

    const { data } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('user_id', userId)
      .single();

    setIsPremium(data?.is_premium ?? false);
    setLoadedFor(userId);
  };

  useEffect(() => { load(); }, [userId]);

  const loading = authLoading || loadedFor !== userId;
  return { isPremium: loading ? false : isPremium, loading, refresh: load };
}
