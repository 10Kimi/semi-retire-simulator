import { supabase } from '../supabase';
import type { Indicators, UserMaSettings, MaSlot, MaAssetClass } from './types';
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

interface UserMaSettingsRow {
  user_id: string;
  monthly_budget: number;
  reserve_balance: number;
  slot1_amount: number;
  slot1_fund_name: string;
  slot1_asset_class: MaAssetClass;
  slot2_amount: number;
  slot2_fund_name: string;
  slot2_asset_class: MaAssetClass;
  slot3_amount: number;
  slot3_fund_name: string;
  slot3_asset_class: MaAssetClass;
  slot4_amount: number;
  slot4_fund_name: string;
  slot4_asset_class: MaAssetClass;
  slot5_amount: number;
  slot5_fund_name: string;
  slot5_asset_class: MaAssetClass;
}

function rowToSettings(row: UserMaSettingsRow): UserMaSettings {
  return {
    user_id: row.user_id,
    monthly_budget: row.monthly_budget,
    reserve_balance: row.reserve_balance,
    slot1: { amount: row.slot1_amount, fund_name: row.slot1_fund_name, asset_class: row.slot1_asset_class },
    slot2: { amount: row.slot2_amount, fund_name: row.slot2_fund_name, asset_class: row.slot2_asset_class },
    slot3: { amount: row.slot3_amount, fund_name: row.slot3_fund_name, asset_class: row.slot3_asset_class },
    slot4: { amount: row.slot4_amount, fund_name: row.slot4_fund_name, asset_class: row.slot4_asset_class },
    slot5: { amount: row.slot5_amount, fund_name: row.slot5_fund_name, asset_class: row.slot5_asset_class },
  };
}

function settingsToRow(userId: string, s: Omit<UserMaSettings, 'user_id'>): UserMaSettingsRow {
  return {
    user_id: userId,
    monthly_budget: s.monthly_budget,
    reserve_balance: s.reserve_balance,
    slot1_amount: s.slot1.amount, slot1_fund_name: s.slot1.fund_name, slot1_asset_class: s.slot1.asset_class,
    slot2_amount: s.slot2.amount, slot2_fund_name: s.slot2.fund_name, slot2_asset_class: s.slot2.asset_class,
    slot3_amount: s.slot3.amount, slot3_fund_name: s.slot3.fund_name, slot3_asset_class: s.slot3.asset_class,
    slot4_amount: s.slot4.amount, slot4_fund_name: s.slot4.fund_name, slot4_asset_class: s.slot4.asset_class,
    slot5_amount: s.slot5.amount, slot5_fund_name: s.slot5.fund_name, slot5_asset_class: s.slot5.asset_class,
  };
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

export async function updateReserveBalance(userId: string, balance: number): Promise<void> {
  const { error } = await supabase
    .from('user_ma_settings')
    .update({ reserve_balance: balance })
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
  | { slot: 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5'; field: keyof MaSlot; value: number | string | MaAssetClass };

export async function updateSettings(userId: string, patch: UpdatePatch): Promise<void> {
  let dbPatch: Record<string, number | string> = {};
  if ('monthly_budget' in patch) {
    dbPatch = { monthly_budget: patch.monthly_budget };
  } else if ('reserve_balance' in patch) {
    dbPatch = { reserve_balance: patch.reserve_balance };
  } else {
    const col = `${patch.slot}_${patch.field === 'amount' ? 'amount' : patch.field === 'fund_name' ? 'fund_name' : 'asset_class'}`;
    dbPatch = { [col]: patch.value };
  }

  const { error } = await supabase
    .from('user_ma_settings')
    .update(dbPatch)
    .eq('user_id', userId);

  if (error) console.error('settings update error:', error);
}
