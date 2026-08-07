import { supabase } from '../supabase';
import type { Indicators, UserMaSettings, MaSlot, MaAssetClass, MaAccount, SlotKey, JpIndex } from './types';
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
  reserve_month: string | null;
  reserve_month_base: number | null;
  jp_index: JpIndex;
  nikkei_pbr_anchor: number | null;
  nikkei_price_anchor: number | null;
  slot1_account: MaAccount;
  slot1_amount: number;
  slot1_fund_name: string;
  slot1_asset_class: MaAssetClass;
  slot2_account: MaAccount;
  slot2_amount: number;
  slot2_fund_name: string;
  slot2_asset_class: MaAssetClass;
  slot3_account: MaAccount;
  slot3_amount: number;
  slot3_fund_name: string;
  slot3_asset_class: MaAssetClass;
  slot4_account: MaAccount;
  slot4_amount: number;
  slot4_fund_name: string;
  slot4_asset_class: MaAssetClass;
  slot5_account: MaAccount;
  slot5_amount: number;
  slot5_fund_name: string;
  slot5_asset_class: MaAssetClass;
  slot6_account: MaAccount;
  slot6_amount: number;
  slot6_fund_name: string;
  slot6_asset_class: MaAssetClass;
  slot7_account: MaAccount;
  slot7_amount: number;
  slot7_fund_name: string;
  slot7_asset_class: MaAssetClass;
  slot8_account: MaAccount;
  slot8_amount: number;
  slot8_fund_name: string;
  slot8_asset_class: MaAssetClass;
  slot9_account: MaAccount;
  slot9_amount: number;
  slot9_fund_name: string;
  slot9_asset_class: MaAssetClass;
  slot10_account: MaAccount;
  slot10_amount: number;
  slot10_fund_name: string;
  slot10_asset_class: MaAssetClass;
}

function rowToSettings(row: UserMaSettingsRow): UserMaSettings {
  return {
    user_id: row.user_id,
    monthly_budget: row.monthly_budget,
    reserve_balance: row.reserve_balance,
    reserve_month: row.reserve_month ?? null,
    reserve_month_base: row.reserve_month_base ?? null,
    jp_index: row.jp_index ?? 'topix',
    nikkei_pbr_anchor: row.nikkei_pbr_anchor ?? null,
    nikkei_price_anchor: row.nikkei_price_anchor ?? null,
    slot1: { account: row.slot1_account ?? 'specific', amount: row.slot1_amount ?? 0, fund_name: row.slot1_fund_name ?? '', asset_class: row.slot1_asset_class ?? 'none' },
    slot2: { account: row.slot2_account ?? 'specific', amount: row.slot2_amount ?? 0, fund_name: row.slot2_fund_name ?? '', asset_class: row.slot2_asset_class ?? 'none' },
    slot3: { account: row.slot3_account ?? 'specific', amount: row.slot3_amount ?? 0, fund_name: row.slot3_fund_name ?? '', asset_class: row.slot3_asset_class ?? 'none' },
    slot4: { account: row.slot4_account ?? 'specific', amount: row.slot4_amount ?? 0, fund_name: row.slot4_fund_name ?? '', asset_class: row.slot4_asset_class ?? 'none' },
    slot5: { account: row.slot5_account ?? 'specific', amount: row.slot5_amount ?? 0, fund_name: row.slot5_fund_name ?? '', asset_class: row.slot5_asset_class ?? 'none' },
    slot6: { account: row.slot6_account ?? 'specific', amount: row.slot6_amount ?? 0, fund_name: row.slot6_fund_name ?? '', asset_class: row.slot6_asset_class ?? 'none' },
    slot7: { account: row.slot7_account ?? 'specific', amount: row.slot7_amount ?? 0, fund_name: row.slot7_fund_name ?? '', asset_class: row.slot7_asset_class ?? 'none' },
    slot8: { account: row.slot8_account ?? 'specific', amount: row.slot8_amount ?? 0, fund_name: row.slot8_fund_name ?? '', asset_class: row.slot8_asset_class ?? 'none' },
    slot9: { account: row.slot9_account ?? 'specific', amount: row.slot9_amount ?? 0, fund_name: row.slot9_fund_name ?? '', asset_class: row.slot9_asset_class ?? 'none' },
    slot10: { account: row.slot10_account ?? 'specific', amount: row.slot10_amount ?? 0, fund_name: row.slot10_fund_name ?? '', asset_class: row.slot10_asset_class ?? 'none' },
  };
}

function settingsToRow(userId: string, s: Omit<UserMaSettings, 'user_id'>): UserMaSettingsRow {
  return {
    user_id: userId,
    monthly_budget: s.monthly_budget,
    reserve_balance: s.reserve_balance,
    reserve_month: s.reserve_month,
    reserve_month_base: s.reserve_month_base,
    jp_index: s.jp_index,
    nikkei_pbr_anchor: s.nikkei_pbr_anchor,
    nikkei_price_anchor: s.nikkei_price_anchor,
    slot1_account: s.slot1.account, slot1_amount: s.slot1.amount, slot1_fund_name: s.slot1.fund_name, slot1_asset_class: s.slot1.asset_class,
    slot2_account: s.slot2.account, slot2_amount: s.slot2.amount, slot2_fund_name: s.slot2.fund_name, slot2_asset_class: s.slot2.asset_class,
    slot3_account: s.slot3.account, slot3_amount: s.slot3.amount, slot3_fund_name: s.slot3.fund_name, slot3_asset_class: s.slot3.asset_class,
    slot4_account: s.slot4.account, slot4_amount: s.slot4.amount, slot4_fund_name: s.slot4.fund_name, slot4_asset_class: s.slot4.asset_class,
    slot5_account: s.slot5.account, slot5_amount: s.slot5.amount, slot5_fund_name: s.slot5.fund_name, slot5_asset_class: s.slot5.asset_class,
    slot6_account: s.slot6.account, slot6_amount: s.slot6.amount, slot6_fund_name: s.slot6.fund_name, slot6_asset_class: s.slot6.asset_class,
    slot7_account: s.slot7.account, slot7_amount: s.slot7.amount, slot7_fund_name: s.slot7.fund_name, slot7_asset_class: s.slot7.asset_class,
    slot8_account: s.slot8.account, slot8_amount: s.slot8.amount, slot8_fund_name: s.slot8.fund_name, slot8_asset_class: s.slot8.asset_class,
    slot9_account: s.slot9.account, slot9_amount: s.slot9.amount, slot9_fund_name: s.slot9.fund_name, slot9_asset_class: s.slot9.asset_class,
    slot10_account: s.slot10.account, slot10_amount: s.slot10.amount, slot10_fund_name: s.slot10.fund_name, slot10_asset_class: s.slot10.asset_class,
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

export async function updateReserveBalance(
  userId: string, balance: number, month: string, monthBase: number,
): Promise<void> {
  const { error } = await supabase
    .from('user_ma_settings')
    .update({ reserve_balance: balance, reserve_month: month, reserve_month_base: monthBase })
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
