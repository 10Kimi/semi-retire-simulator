import { supabase } from '../supabase';
import type { Indicators, UserMaSettings, MaSlot, MaAssetClass, MaAccount, SlotKey, JpIndex, CrashRecord } from './types';
import { DEFAULT_SETTINGS } from './types';
import { rowToSettings, settingsToRow, type UserMaSettingsRow } from './settingsRow';

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

  if (data) return rowToSettings(data as UserMaSettingsRow);

  // 初回：デフォルト値で作成
  if (error?.code === 'PGRST116') {
    const row = settingsToRow(userId, DEFAULT_SETTINGS);
    const { data: inserted, error: insertError } = await supabase
      .from('user_ma_settings')
      .insert(row)
      .select()
      .single();

    if (insertError) {
      console.error('settings insert error:', insertError);
      return { user_id: userId, ...DEFAULT_SETTINGS };
    }
    return rowToSettings(inserted as UserMaSettingsRow);
  }

  console.error('settings fetch error:', error);
  return { user_id: userId, ...DEFAULT_SETTINGS };
}

export async function updateReserveBalance(
  userId: string, balance: number, month: string, monthBase: number, crashState?: CrashRecord,
): Promise<void> {
  // 暴落ルールの段階は待機資金と同じタイミング（投資実行）で確定する。指標が無く判定しなかった月は触らない
  const { error } = await supabase
    .from('user_ma_settings')
    .update({
      reserve_balance: balance, reserve_month: month, reserve_month_base: monthBase,
      ...(crashState !== undefined ? { crash_state: crashState } : {}),
    })
    .eq('user_id', userId);

  if (error) console.error('reserve update error:', error);
}

/**
 * 月次予算 / 待機資金以外は slot 単位で更新する。
 * top-level scalar フィールド: monthly_budget / reserve_balance
 * slot フィールド: slot{N}.amount / slot{N}.fund_name / slot{N}.asset_class
 */
type UpdatePatch =
  | { monthly_budget: number }
  | { reserve_balance: number }
  | { jp_index: JpIndex }
  | { nikkei_pbr_anchor: number; nikkei_price_anchor: number }
  | { slot: SlotKey; field: keyof MaSlot; value: number | string | MaAssetClass | MaAccount };

export async function updateSettings(userId: string, patch: UpdatePatch): Promise<void> {
  let dbPatch: Record<string, number | string> = {};
  if ('monthly_budget' in patch) {
    dbPatch = { monthly_budget: patch.monthly_budget };
  } else if ('reserve_balance' in patch) {
    dbPatch = { reserve_balance: patch.reserve_balance };
  } else if ('jp_index' in patch) {
    dbPatch = { jp_index: patch.jp_index };
  } else if ('nikkei_pbr_anchor' in patch) {
    dbPatch = { nikkei_pbr_anchor: patch.nikkei_pbr_anchor, nikkei_price_anchor: patch.nikkei_price_anchor };
  } else {
    const col = `${patch.slot}_${patch.field}`;   // account / amount / fund_name / asset_class
    dbPatch = { [col]: patch.value };
  }

  const { error } = await supabase
    .from('user_ma_settings')
    .update(dbPatch)
    .eq('user_id', userId);

  if (error) console.error('settings update error:', error);
}
