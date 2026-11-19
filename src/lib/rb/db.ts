import { supabase } from '../supabase';
import { ASSET_CLASSES, MODEL_ALLOCATIONS } from './types';
import type { TargetAllocation } from './types';
import type { FundMasterEntry } from './allocator';
import type { MaReserveRow } from './maReserve';

/** 目標配分を取得 */
export async function fetchTargetAllocation(userId: string): Promise<TargetAllocation | null> {
  const { data, error } = await supabase
    .from('user_rb_settings')
    .select('asset_class, target_ratio')
    .eq('user_id', userId);

  if (error) {
    console.error('rb settings fetch error:', error);
    return null;
  }
  if (!data || data.length === 0) return null;

  const allocation: TargetAllocation = {};
  for (const row of data) {
    allocation[row.asset_class] = Number(row.target_ratio);
  }
  return allocation;
}

/** 目標配分を保存（upsert）。成否を返す */
export async function saveTargetAllocation(userId: string, allocation: TargetAllocation): Promise<boolean> {
  const rows = ASSET_CLASSES.map(ac => ({
    user_id: userId,
    asset_class: ac.key,
    target_ratio: allocation[ac.key] || 0,
  }));

  const { error } = await supabase
    .from('user_rb_settings')
    .upsert(rows, { onConflict: 'user_id,asset_class' });

  if (error) {
    console.error('rb settings save error:', error);
    return false;
  }
  return true;
}

/** /risk の「このPFを採用する」：そのレベルのモデル配分を目標配分として保存する。成否を返す */
export async function adoptModelAllocation(userId: string, level: number): Promise<boolean> {
  const target: TargetAllocation = {};
  ASSET_CLASSES.forEach(ac => {
    target[ac.key] = MODEL_ALLOCATIONS[level]?.[ac.key] ?? 0;
  });
  return saveTargetAllocation(userId, target);
}

// 残高（rb_snapshots）はサーバーに保存しない・読まない（D-065、FI_project #109）。
// 残高はブラウザ（localAmounts.ts）に持つ。rb_snapshots の過去の行は migration 047 で割合と指数に置き換えた。

/** 日本時間の日付（YYYY-MM-DD） */
export function todayInJapan(now: Date = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

/** fund_masterの全レコードを取得 */
export async function fetchFundMaster(): Promise<FundMasterEntry[]> {
  const { data, error } = await supabase
    .from('fund_master')
    .select('ticker, fund_name, asset_class, ratio');

  if (error) {
    console.error('fund_master fetch error:', error);
    return [];
  }
  return data ?? [];
}

/** Yahoo Finance APIでティッカーを検証 */
async function verifyTicker(ticker: string): Promise<boolean> {
  // 日本株（数字のみ）は .T を付与
  const queryTicker = /^\d+$/.test(ticker) ? `${ticker}.T` : ticker;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(queryTicker)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!resp.ok) return false;
    const json = await resp.json();
    return !!json?.chart?.result;
  } catch {
    return false;
  }
}

export type FundRequestResult =
  | { status: 'auto_approved' }    // Yahoo OK → fund_masterに即登録
  | { status: 'pending_review' }   // Yahoo NG のまま送信 → 審査待ち（fund_master には未登録。FI_project #38）
  | { status: 'needs_confirm' }    // Yahoo NG → ユーザーに確認を促す
  | { status: 'already_sent' }     // 重複リクエスト
  | { status: 'error'; message: string };

/** 登録リクエストを送信（Yahoo Finance検証付き） */
export async function submitFundRequest(
  userId: string,
  ticker: string,
  fundName: string,
  suggestedAssetClass: string,
  forceSubmit: boolean = false,
): Promise<FundRequestResult> {
  // 重複チェック
  const { data: existing } = await supabase
    .from('fund_master_requests')
    .select('id, status')
    .eq('user_id', userId)
    .eq('ticker', ticker)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].status === 'pending_review' ? { status: 'pending_review' } : { status: 'already_sent' };
  }

  // fund_masterに既存なら不要
  const { data: masterExisting } = await supabase
    .from('fund_master')
    .select('id')
    .eq('ticker', ticker)
    .limit(1);

  if (masterExisting && masterExisting.length > 0) return { status: 'auto_approved' };

  // forceSubmit=falseの場合のみYahoo検証
  if (!forceSubmit) {
    const valid = await verifyTicker(ticker);
    if (valid) {
      // Yahoo OK → fund_masterに即登録 + requests に approved で記録
      await supabase.from('fund_master').insert({
        ticker, fund_name: fundName, asset_class: suggestedAssetClass, ratio: 1.0,
      });
      await supabase.from('fund_master_requests').insert({
        ticker, fund_name: fundName, suggested_asset_class: suggestedAssetClass,
        user_id: userId, status: 'approved',
      });
      return { status: 'auto_approved' };
    }
    // Yahoo NG → ユーザーに確認を求める
    return { status: 'needs_confirm' };
  }

  // forceSubmit=true → pending_reviewで登録（fund_masterには未登録）
  const { error } = await supabase.from('fund_master_requests').insert({
    ticker, fund_name: fundName, suggested_asset_class: suggestedAssetClass,
    user_id: userId, status: 'pending_review',
  });

  if (error) return { status: 'error', message: error.message };
  return { status: 'pending_review' }; // 承認（approve_all_pending_review）までは fund_master に入らない
}

/** ユーザーの送信済みリクエストの ticker。pending は審査待ち（fund_master には未登録）のもの */
export async function fetchSubmittedRequestTickers(userId: string): Promise<{ all: Set<string>; pending: Set<string> }> {
  const { data, error } = await supabase
    .from('fund_master_requests')
    .select('ticker, status')
    .eq('user_id', userId);

  if (error) {
    console.error('fund requests fetch error:', error);
    return { all: new Set(), pending: new Set() };
  }
  return {
    all: new Set(data.map(r => r.ticker)),
    pending: new Set(data.filter(r => r.status === 'pending_review').map(r => r.ticker)),
  };
}

/** 未分類の行に出す登録リクエストの状態の表示（審査待ちを「登録済み」と見せない。#38）。送っていなければ null */
export function fundRequestBadge(ticker: string, requested: Set<string>, pending: Set<string>): string | null {
  if (pending.has(ticker)) return '送信しました（審査中）';
  if (requested.has(ticker)) return '登録済み';
  return null;
}

/**
 * 緊急資金プロフィール（サーバーに置くのは月数だけ）。
 * 月の生活費（円）はブラウザに持つ（D-065、FI_project #109）。
 * legacy_monthly_living_cost は #109 より前にサーバーに保存された生活費で、ブラウザへ移してから消すためだけに読む。
 */
export interface RbProfile {
  emergency_months: number;
  legacy_monthly_living_cost: number | null;
}

const DEFAULT_PROFILE: RbProfile = { emergency_months: 6, legacy_monthly_living_cost: null };

/** 緊急資金設定を取得 */
export async function fetchRbProfile(userId: string): Promise<RbProfile> {
  const { data, error } = await supabase
    .from('user_rb_profile')
    .select('monthly_living_cost, emergency_months')
    .eq('user_id', userId)
    .single();

  if (data) {
    return {
      emergency_months: data.emergency_months ?? DEFAULT_PROFILE.emergency_months,
      legacy_monthly_living_cost: data.monthly_living_cost ?? null,
    };
  }
  if (error?.code !== 'PGRST116') console.error('rb profile fetch error:', error); // PGRST116＝行が無い
  return { ...DEFAULT_PROFILE };
}

/** 緊急資金の月数を保存する。生活費（円）は送らない。成否を返す */
export async function saveRbProfile(userId: string, emergencyMonths: number): Promise<boolean> {
  const { error } = await supabase
    .from('user_rb_profile')
    .upsert({
      user_id: userId,
      emergency_months: emergencyMonths,
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('rb profile save error:', error);
    return false;
  }
  return true;
}

/** サーバーに残っている生活費を消す（ブラウザへ移したあとに呼ぶ）。成否を返す */
export async function clearServerLivingCost(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_rb_profile')
    .update({ monthly_living_cost: null })
    .eq('user_id', userId);

  if (error) {
    console.error('rb profile clear error:', error);
    return false;
  }
  return true;
}

/** /ma の待機資金を決めるための行（目印・待機資金・暗号文の版だけ）。行が無ければ row は null、読めなければ failed（FI_project #118） */
export async function fetchMaReserveRow(userId: string): Promise<{ row: MaReserveRow | null; failed: boolean }> {
  const { data, error } = await supabase
    .from('user_ma_settings')
    .select('keep_amounts_on_server, reserve_balance, vault_saved_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('ma reserve fetch error:', error);
    return { row: null, failed: true };
  }
  return { row: data ?? null, failed: false };
}
