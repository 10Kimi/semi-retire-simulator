import { supabase } from '../supabase';
import type { Indicators, UserMaSettings, MaSlot, MaAssetClass, MaAccount, SlotKey, JpIndex, CrashRecord } from './types';
import { DEFAULT_SETTINGS } from './types';
import { rowToSettings, settingsToRow, type UserMaSettingsRow } from './settingsRow';
import {
  amountsToRowPatch, loadLocalAmounts, mergeAmounts, nullAmountsPatch, patchLocalAmounts, planAmountMove, rowAmounts,
  saveLocalAmounts, withoutAmounts, type AmountStorage,
} from './localAmounts';

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

/** 行を読む。無ければ既定値で作る（金額の列は送らない）。読めなければ null */
async function fetchUserSettingsRow(userId: string): Promise<UserMaSettingsRow | null> {
  const { data, error } = await supabase
    .from('user_ma_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data) return data as UserMaSettingsRow;

  // 初回：デフォルト値で作成。金額は送らない（D-065。金額はブラウザに持つ）
  if (error?.code === 'PGRST116') {
    const row = withoutAmounts(settingsToRow(userId, DEFAULT_SETTINGS));
    // 同時に2回作ろうとしても失敗しない。既にある行は上書きしない（重複なら行が返らないので読み直す）
    const { data: inserted, error: insertError } = await supabase
      .from('user_ma_settings')
      .upsert(row, { onConflict: 'user_id', ignoreDuplicates: true })
      .select()
      .maybeSingle();

    if (insertError) {
      console.error('settings insert error:', insertError);
      return null;
    }
    if (inserted) return inserted as UserMaSettingsRow;

    const { data: existing, error: refetchError } = await supabase
      .from('user_ma_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) return existing as UserMaSettingsRow;
    console.error('settings refetch error:', refetchError);
    return null;
  }

  console.error('settings fetch error:', error);
  return null;
}

/** サーバーの行だけから作った設定（金額の移し替えはしない） */
export async function fetchUserSettings(userId: string): Promise<UserMaSettings> {
  const row = await fetchUserSettingsRow(userId);
  return row ? rowToSettings(row) : { user_id: userId, ...DEFAULT_SETTINGS };
}

function browserStorage(): AmountStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null; // ストレージが無効なブラウザ
  }
}

/**
 * /ma の画面が使う設定。オーナー本人の行（amounts_on_server）はサーバーの金額をそのまま使う。
 * それ以外は金額をブラウザ（localStorage）から読み、サーバーに金額が残っていれば一度ブラウザへ移してからサーバー側を消す（D-065、#111）。
 */
export async function loadUserSettings(userId: string, storage: AmountStorage | null = browserStorage()): Promise<UserMaSettings> {
  const row = await fetchUserSettingsRow(userId);
  if (!row) {
    const base: UserMaSettings = { user_id: userId, ...DEFAULT_SETTINGS };
    const local = storage ? loadLocalAmounts(storage, userId) : null;
    return local ? mergeAmounts(base, local) : base;
  }
  const base = rowToSettings(row);
  if (base.amounts_on_server) {
    // 目印を付ける前に新しい画面で開き、金額がブラウザへ移っていた場合の戻し道：サーバーが全部 null でブラウザに値があれば書き戻す
    const local = storage ? loadLocalAmounts(storage, userId) : null;
    if (rowAmounts(row) || !local) return base;
    const restored = mergeAmounts(base, local);
    const { error } = await supabase.from('user_ma_settings').update(amountsToRowPatch(local)).eq('user_id', userId);
    if (error) console.error('settings restore amounts error:', error);
    return restored;
  }

  const plan = planAmountMove(rowAmounts(row), storage ? loadLocalAmounts(storage, userId) : null);
  let clear = plan.clearServer;
  if (plan.saveToLocal) {
    // ブラウザに保存できなかったら、サーバーの金額は消さない（その回はサーバーの値で表示する）
    clear = !!storage && saveLocalAmounts(storage, userId, plan.saveToLocal);
  }
  if (clear) {
    const { error } = await supabase.from('user_ma_settings').update(nullAmountsPatch()).eq('user_id', userId);
    if (error) console.error('settings clear amounts error:', error);
  }
  return mergeAmounts(base, plan.use);
}

/**
 * 待機資金と暴落ルールの段階を確定する（投資実行）。オーナー本人の行はサーバーへ、それ以外はブラウザへ。
 * 暴落ルールの段階は待機資金と同じタイミングで確定する。指標が無く判定しなかった月は触らない
 */
export async function updateReserveBalance(
  userId: string, balance: number, month: string, monthBase: number, crashState: CrashRecord | undefined,
  amountsOnServer: boolean, storage: AmountStorage | null = browserStorage(),
): Promise<boolean> {
  if (!amountsOnServer) {
    const ok = !!storage && patchLocalAmounts(storage, userId, {
      reserve_balance: balance, reserve_month: month, reserve_month_base: monthBase,
      ...(crashState !== undefined ? { crash_state: crashState } : {}),
    });
    if (!ok) console.error('reserve save error: このブラウザに保存できませんでした');
    return ok;
  }
  const { error } = await supabase
    .from('user_ma_settings')
    .update({
      reserve_balance: balance, reserve_month: month, reserve_month_base: monthBase,
      ...(crashState !== undefined ? { crash_state: crashState } : {}),
    })
    .eq('user_id', userId);

  if (error) console.error('reserve update error:', error);
  return !error;
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

export async function updateSettings(
  userId: string, patch: UpdatePatch, amountsOnServer: boolean, storage: AmountStorage | null = browserStorage(),
): Promise<boolean> {
  // 金額（月の予算・待機資金・積立額）は、オーナー本人の行以外はブラウザにだけ保存する（D-065）
  if (!amountsOnServer) {
    let local: Parameters<typeof patchLocalAmounts>[2] | null = null;
    if ('monthly_budget' in patch) local = { monthly_budget: patch.monthly_budget };
    else if ('reserve_balance' in patch) local = { reserve_balance: patch.reserve_balance };
    else if ('slot' in patch && patch.field === 'amount') local = { slot_amounts: { [patch.slot]: patch.value as number } };
    if (local) {
      const ok = !!storage && patchLocalAmounts(storage, userId, local);
      if (!ok) console.error('settings save error: このブラウザに保存できませんでした');
      return ok;
    }
  }

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
  return !error;
}
