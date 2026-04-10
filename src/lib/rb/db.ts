import { supabase } from '../supabase';
import { ASSET_CLASSES } from './types';
import type { AssetClassKey, Holdings, TargetAllocation } from './types';
import type { FundMasterEntry } from './allocator';

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

/** 目標配分を保存（upsert） */
export async function saveTargetAllocation(userId: string, allocation: TargetAllocation): Promise<void> {
  const rows = ASSET_CLASSES.map(ac => ({
    user_id: userId,
    asset_class: ac.key,
    target_ratio: allocation[ac.key] || 0,
  }));

  const { error } = await supabase
    .from('user_rb_settings')
    .upsert(rows, { onConflict: 'user_id,asset_class' });

  if (error) console.error('rb settings save error:', error);
}

/** 最新のスナップショットを取得 */
export async function fetchLatestSnapshot(userId: string): Promise<{ holdings: Holdings; date: string } | null> {
  const { data, error } = await supabase
    .from('rb_snapshots')
    .select('snapshot_date, asset_class, amount')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })
    .limit(11); // 最大11クラス

  if (error) {
    console.error('rb snapshot fetch error:', error);
    return null;
  }
  if (!data || data.length === 0) return null;

  // 最新日付のレコードのみ抽出
  const latestDate = data[0].snapshot_date;
  const latestRows = data.filter(r => r.snapshot_date === latestDate);

  const holdings: Holdings = {};
  for (const row of latestRows) {
    holdings[row.asset_class] = Number(row.amount);
  }
  return { holdings, date: latestDate };
}

/** スナップショットを保存 */
export async function saveSnapshot(userId: string, holdings: Holdings): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = ASSET_CLASSES
    .filter(ac => (holdings[ac.key] || 0) > 0)
    .map(ac => ({
      user_id: userId,
      snapshot_date: today,
      asset_class: ac.key as AssetClassKey,
      amount: holdings[ac.key] || 0,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('rb_snapshots')
    .insert(rows);

  if (error) console.error('rb snapshot save error:', error);
}

/** スナップショット履歴（日付一覧）を取得 */
export async function fetchSnapshotDates(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('rb_snapshots')
    .select('snapshot_date')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false });

  if (error) {
    console.error('rb snapshot dates fetch error:', error);
    return [];
  }

  // 重複排除
  const dates = [...new Set(data.map(r => r.snapshot_date))];
  return dates;
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

/** 登録リクエストを送信 */
export async function submitFundRequest(
  userId: string,
  ticker: string,
  fundName: string,
  suggestedAssetClass: string,
): Promise<boolean> {
  // 重複チェック
  const { data: existing } = await supabase
    .from('fund_master_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('ticker', ticker)
    .limit(1);

  if (existing && existing.length > 0) return false; // 既に送信済み

  const { error } = await supabase
    .from('fund_master_requests')
    .insert({
      ticker,
      fund_name: fundName,
      suggested_asset_class: suggestedAssetClass,
      user_id: userId,
    });

  if (error) {
    console.error('fund request submit error:', error);
    return false;
  }
  return true;
}

/** ユーザーの送信済みリクエストのtickerセットを取得 */
export async function fetchSubmittedRequestTickers(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('fund_master_requests')
    .select('ticker')
    .eq('user_id', userId);

  if (error) {
    console.error('fund requests fetch error:', error);
    return new Set();
  }
  return new Set(data.map(r => r.ticker));
}
