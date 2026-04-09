import { supabase } from '../supabase';
import type { Indicators, UserMaSettings } from './types';
import { DEFAULT_SETTINGS } from './types';

export async function fetchLatestIndicators(): Promise<Indicators | null> {
  const { data, error } = await supabase
    .from('indicators')
    .select('*')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('indicators fetch error:', error);
    return null;
  }
  return data;
}

export async function fetchUserSettings(userId: string): Promise<UserMaSettings> {
  const { data, error } = await supabase
    .from('user_ma_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data) return data;

  // 初回：デフォルト値で作成
  if (error?.code === 'PGRST116') {
    const newSettings: UserMaSettings = { user_id: userId, ...DEFAULT_SETTINGS };
    const { data: inserted, error: insertError } = await supabase
      .from('user_ma_settings')
      .insert(newSettings)
      .select()
      .single();

    if (insertError) {
      console.error('settings insert error:', insertError);
      return newSettings;
    }
    return inserted;
  }

  console.error('settings fetch error:', error);
  return { user_id: userId, ...DEFAULT_SETTINGS };
}

export async function updateReserveBalance(userId: string, balance: number): Promise<void> {
  const { error } = await supabase
    .from('user_ma_settings')
    .update({ reserve_balance: balance })
    .eq('user_id', userId);

  if (error) console.error('reserve update error:', error);
}

export async function updateUserSettings(userId: string, settings: Partial<UserMaSettings>): Promise<void> {
  const { error } = await supabase
    .from('user_ma_settings')
    .update(settings)
    .eq('user_id', userId);

  if (error) console.error('settings update error:', error);
}
