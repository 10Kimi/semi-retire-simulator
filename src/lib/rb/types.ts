// 11アセットクラス
export const ASSET_CLASSES = [
  { key: 'japan_equity', label: '国内株式', hint: '日本個別株・国内株式ETF・国内株式投信の合計' },
  { key: 'developed_equity', label: '先進国株式', hint: '米国株・欧州株・VTI・先進国株式投信等' },
  { key: 'emerging_equity', label: '新興国株式', hint: '新興国株式ETF・投信等' },
  { key: 'japan_bond', label: '国内債券', hint: '国内債券ETF・個人向け国債・国内債券投信等' },
  { key: 'developed_bond', label: '先進国債券', hint: 'BND・先進国債券投信・外国債券等' },
  { key: 'emerging_bond', label: '新興国債券', hint: '新興国債券ETF・投信等' },
  { key: 'japan_reit', label: '国内REIT', hint: 'J-REIT・国内REIT投信等' },
  { key: 'foreign_reit', label: '外国REIT', hint: '外国REIT ETF・投信等' },
  { key: 'commodity', label: 'コモディティ', hint: '金ETF・農産物ETF・商品ファンド等' },
  { key: 'alternative', label: 'オルタナティブ', hint: 'カバードコール系ETF（JEPI・QYLD等）・ヘッジファンド等' },
  { key: 'cash', label: '現金・預金', hint: '銀行預金・MRF・外貨預金・証券口座現金等' },
] as const;

export type AssetClassKey = (typeof ASSET_CLASSES)[number]['key'];

// リスクレベル別モデル配分（仕様書 §3-2）
export const MODEL_ALLOCATIONS: Record<number, Record<AssetClassKey, number>> = {
  1: { japan_equity: 5, developed_equity: 10, emerging_equity: 0, japan_bond: 20, developed_bond: 30, emerging_bond: 0, japan_reit: 0, foreign_reit: 0, commodity: 5, alternative: 0, cash: 30 },
  2: { japan_equity: 10, developed_equity: 20, emerging_equity: 5, japan_bond: 15, developed_bond: 25, emerging_bond: 0, japan_reit: 0, foreign_reit: 0, commodity: 5, alternative: 0, cash: 20 },
  3: { japan_equity: 15, developed_equity: 30, emerging_equity: 5, japan_bond: 10, developed_bond: 15, emerging_bond: 0, japan_reit: 2.5, foreign_reit: 2.5, commodity: 5, alternative: 0, cash: 15 },
  4: { japan_equity: 20, developed_equity: 35, emerging_equity: 10, japan_bond: 5, developed_bond: 10, emerging_bond: 0, japan_reit: 2.5, foreign_reit: 2.5, commodity: 5, alternative: 0, cash: 10 },
  5: { japan_equity: 25, developed_equity: 40, emerging_equity: 15, japan_bond: 0, developed_bond: 5, emerging_bond: 0, japan_reit: 2.5, foreign_reit: 2.5, commodity: 5, alternative: 0, cash: 5 },
};

export interface Holdings {
  [key: string]: number; // asset_class key → 保有額（円）
}

export interface TargetAllocation {
  [key: string]: number; // asset_class key → 目標比率（%）
}

export interface DeviationItem {
  key: AssetClassKey;
  label: string;
  amount: number;
  currentRatio: number;
  targetRatio: number;
  deviationRatio: number;
  deviationAmount: number;
  severity: 'ok' | 'minor' | 'warning' | 'danger';
}

export type AdjustmentMode = 'add' | 'sell';

export interface AdjustmentItem {
  key: AssetClassKey;
  label: string;
  amount: number; // 正=追加購入、負=売却
}
