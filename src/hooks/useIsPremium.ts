import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function useIsPremium(): { isPremium: boolean; loading: boolean; refresh: () => void } {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) { setIsPremium(false); setLoading(false); return; }

    const { data } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('user_id', user.id)
      .single();

    setIsPremium(data?.is_premium ?? false);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  return { isPremium, loading, refresh: load };
}
