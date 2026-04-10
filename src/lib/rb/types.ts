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
  { key: 'commodity', label: 'ゴールド', hint: '金ETF・ゴールドファンド等' },
  { key: 'alternative', label: 'オルタナティブ', hint: 'カバードコール系ETF（JEPI・QYLD等）・ヘッジファンド等' },
  { key: 'cash', label: '現金・預金', hint: '銀行預金・MRF・外貨預金・証券口座現金等' },
] as const;

export type AssetClassKey = (typeof ASSET_CLASSES)[number]['key'];

// リスクレベル別モデル配分（GPIF高成長ケースベース・効率的フロンティア計算結果）
export const MODEL_ALLOCATIONS: Record<number, Record<AssetClassKey, number>> = {
  1: { japan_equity: 5, developed_equity: 5, emerging_equity: 0, japan_bond: 80, developed_bond: 5, emerging_bond: 0, japan_reit: 0, foreign_reit: 0, commodity: 5, alternative: 0, cash: 0 },
  2: { japan_equity: 10, developed_equity: 10, emerging_equity: 5, japan_bond: 40, developed_bond: 25, emerging_bond: 0, japan_reit: 0, foreign_reit: 0, commodity: 10, alternative: 0, cash: 0 },
  3: { japan_equity: 15, developed_equity: 15, emerging_equity: 5, japan_bond: 5, developed_bond: 45, emerging_bond: 0, japan_reit: 0, foreign_reit: 0, commodity: 15, alternative: 0, cash: 0 },
  4: { japan_equity: 25, developed_equity: 25, emerging_equity: 10, japan_bond: 0, developed_bond: 25, emerging_bond: 0, japan_reit: 0, foreign_reit: 0, commodity: 15, alternative: 0, cash: 0 },
  5: { japan_equity: 30, developed_equity: 35, emerging_equity: 15, japan_bond: 0, developed_bond: 10, emerging_bond: 0, japan_reit: 0, foreign_reit: 0, commodity: 10, alternative: 0, cash: 0 },
  6: { japan_equity: 15, developed_equity: 45, emerging_equity: 40, japan_bond: 0, developed_bond: 0, emerging_bond: 0, japan_reit: 0, foreign_reit: 0, commodity: 0, alternative: 0, cash: 0 },
  7: { japan_equity: 0, developed_equity: 0, emerging_equity: 100, japan_bond: 0, developed_bond: 0, emerging_bond: 0, japan_reit: 0, foreign_reit: 0, commodity: 0, alternative: 0, cash: 0 },
};

// リスクレベル別メタデータ
export const MODEL_META: Record<number, { name: string; expectedReturn: number; volatility: number; sharpe: number }> = {
  1: { name: '超保守型',   expectedReturn: 3.8, volatility: 3.1,  sharpe: 0.75 },
  2: { name: '保守型',     expectedReturn: 5.0, volatility: 6.2,  sharpe: 0.57 },
  3: { name: 'やや保守型', expectedReturn: 5.9, volatility: 8.9,  sharpe: 0.49 },
  4: { name: 'バランス型', expectedReturn: 6.7, volatility: 12.1, sharpe: 0.43 },
  5: { name: 'やや積極型', expectedReturn: 7.3, volatility: 15.1, sharpe: 0.39 },
  6: { name: '積極型',     expectedReturn: 8.2, volatility: 19.9, sharpe: 0.33 },
  7: { name: '超積極型',   expectedReturn: 8.5, volatility: 24.0, sharpe: 0.29 },
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

export type AdjustmentMode = 'add' | 'sell' | 'period';

export interface AdjustmentItem {
  key: AssetClassKey;
  label: string;
  amount: number; // 正=追加購入、負=売却
}

/** 期間指定リバランスの計算結果 */
export interface PeriodRebalanceResult {
  sellItems: AdjustmentItem[];       // 初月に売却（超過クラス）
  monthlyItems: AdjustmentItem[];    // 毎月の積立配分
  totalDeficit: number;              // 不足額合計
  totalSurplus: number;              // 超過額合計
  requiredSellAmount: number;        // 必要な売却額
  months: number;                    // 完了期間
  monthlyAmount: number;             // 毎月の積立額
}

/** 月次推移の1ヶ月分 */
export interface MonthlySnapshot {
  month: number;
  operations: {
    key: AssetClassKey;
    label: string;
    operationAmount: number; // マイナス=売却、プラス=積立、0=なし
    ratio: number;           // 月末比率(%)
    reachedTarget: boolean;
  }[];
  totalAssets: number;
}
