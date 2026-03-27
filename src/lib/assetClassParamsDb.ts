import { supabase } from './supabase';

export interface AssetClassParam {
  asset_class: string;
  volatility: number;
  expected_return: number;
  correlation: Record<string, number>;
  data_source: string;
  updated_at: string;
}

/**
 * asset_class_params テーブルから全資産クラスのパラメータを取得
 */
export async function loadAssetClassParams(): Promise<AssetClassParam[] | null> {
  const { data, error } = await supabase
    .from('asset_class_params')
    .select('*');

  if (error || !data || data.length === 0) {
    return null;
  }
  return data as AssetClassParam[];
}

/**
 * asset_class_params → portfolioDiagnosis.ts が使う形式に変換
 */
export function buildMarketDataFromParams(params: AssetClassParam[]): {
  assetReturns: Record<string, number>;
  assetRisks: Record<string, number>;
  correlationMatrix: Record<string, Record<string, number>>;
} {
  const assetReturns: Record<string, number> = {};
  const assetRisks: Record<string, number> = {};
  const correlationMatrix: Record<string, Record<string, number>> = {};

  for (const p of params) {
    assetReturns[p.asset_class] = p.expected_return;
    assetRisks[p.asset_class] = p.volatility;
    correlationMatrix[p.asset_class] = p.correlation;
  }

  return { assetReturns, assetRisks, correlationMatrix };
}
