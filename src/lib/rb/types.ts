// 13アセットクラス（My Index定義）
export const ASSET_CLASSES = [
  { key: 'cash', label: '現金', hint: '銀行預金・MRF・外貨預金・証券口座現金等' },
  { key: 'japan_equity', label: '日本株', hint: '日本個別株・国内株式ETF・国内株式投信の合計' },
  { key: 'us_equity', label: '米国株', hint: 'S&P500・VTI・米国個別株等' },
  { key: 'developed_equity', label: '先進国株（米・日除く）', hint: '欧州株・先進国株式投信（米国除く）等' },
  { key: 'emerging_equity', label: 'エマージング株', hint: '新興国株式ETF・投信等' },
  { key: 'japan_bond', label: '日本債券', hint: '国内債券ETF・個人向け国債等' },
  { key: 'developed_bond', label: '先進国債券', hint: 'BND・先進国債券投信・米国債等' },
  { key: 'emerging_bond', label: 'エマージング債', hint: '新興国債券ETF・投信等' },
  { key: 'japan_reit', label: '日本REIT', hint: 'J-REIT・国内REIT投信等' },
  { key: 'developed_reit', label: '先進国REIT', hint: '先進国REIT ETF・投信等' },
  { key: 'emerging_reit', label: 'エマージングREIT', hint: '新興国REIT ETF・投信等' },
  { key: 'commodity', label: 'コモディティ', hint: '農産物ETF・商品ファンド等' },
  { key: 'gold', label: '金', hint: '金ETF・ゴールドファンド等' },
] as const;

export type AssetClassKey = (typeof ASSET_CLASSES)[number]['key'];

// リスクレベル別モデル配分（optimal_portfolios と一本化、2026-08-12 再最適化）
// 出所: scripts/optimize_portfolios.py（上限5資産 / vol上部狙い(実効上限の90%) / 新興上限）。
// optimal_portfolios テーブルの確定値と一致させている。
export const MODEL_ALLOCATIONS: Record<number, Record<AssetClassKey, number>> = {
  1: { cash: 35, japan_equity: 0, us_equity: 10, developed_equity: 0, emerging_equity: 0, japan_bond: 35, developed_bond: 15, emerging_bond: 0, japan_reit: 0, developed_reit: 0, emerging_reit: 0, commodity: 0, gold: 5 },
  2: { cash: 0, japan_equity: 0, us_equity: 15, developed_equity: 0, emerging_equity: 10, japan_bond: 45, developed_bond: 25, emerging_bond: 0, japan_reit: 0, developed_reit: 0, emerging_reit: 0, commodity: 0, gold: 5 },
  3: { cash: 0, japan_equity: 0, us_equity: 25, developed_equity: 0, emerging_equity: 15, japan_bond: 15, developed_bond: 40, emerging_bond: 0, japan_reit: 0, developed_reit: 0, emerging_reit: 0, commodity: 0, gold: 5 },
  4: { cash: 0, japan_equity: 0, us_equity: 30, developed_equity: 0, emerging_equity: 20, japan_bond: 0, developed_bond: 35, emerging_bond: 0, japan_reit: 5, developed_reit: 0, emerging_reit: 0, commodity: 0, gold: 10 },
  5: { cash: 0, japan_equity: 0, us_equity: 45, developed_equity: 0, emerging_equity: 30, japan_bond: 0, developed_bond: 15, emerging_bond: 0, japan_reit: 0, developed_reit: 0, emerging_reit: 0, commodity: 0, gold: 10 },
  6: { cash: 0, japan_equity: 0, us_equity: 45, developed_equity: 0, emerging_equity: 40, japan_bond: 0, developed_bond: 0, emerging_bond: 0, japan_reit: 0, developed_reit: 0, emerging_reit: 5, commodity: 0, gold: 10 },
  7: { cash: 0, japan_equity: 0, us_equity: 35, developed_equity: 5, emerging_equity: 60, japan_bond: 0, developed_bond: 0, emerging_bond: 0, japan_reit: 0, developed_reit: 0, emerging_reit: 0, commodity: 0, gold: 0 },
};

// リスクレベル別メタデータ（MODEL_ALLOCATIONS と同一PFの計算結果に同期）
export const MODEL_META: Record<number, { name: string; expectedReturn: number; volatility: number; sharpe: number }> = {
  1: { name: '超保守型', expectedReturn: 1.54, volatility: 2.94, sharpe: 0.35 },
  2: { name: '保守型', expectedReturn: 2.98, volatility: 5.71, sharpe: 0.43 },
  3: { name: 'やや保守型', expectedReturn: 4.27, volatility: 8.52, sharpe: 0.44 },
  4: { name: 'バランス型', expectedReturn: 5.16, volatility: 10.47, sharpe: 0.44 },
  5: { name: 'やや積極型', expectedReturn: 6.27, volatility: 13.2, sharpe: 0.44 },
  6: { name: '積極型', expectedReturn: 6.99, volatility: 15.11, sharpe: 0.43 },
  7: { name: '超積極型', expectedReturn: 7.53, volatility: 16.91, sharpe: 0.42 },
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
  sellItems: AdjustmentItem[];       // 売却クラス（期間で分散）
  monthlyItems: AdjustmentItem[];    // 毎月の積立配分
  totalDeficit: number;              // 不足額合計
  totalSurplus: number;              // 超過額合計
  requiredSellAmount: number;        // 売却総額（現金除く）
  cashSurplus: number;               // 現金余剰額
  months: number;                    // 完了期間
  monthlyAmount: number;             // 毎月の追加積立額（売却・現金取り崩し後に必要な分）
  monthlySellContribution: number;   // 毎月の売却充当額（requiredSellAmount / months）
  monthlyCashContribution: number;   // 毎月の現金取り崩し額（cashSurplus / months）
  monthlyTotal: number;              // 毎月の操作合計（売却充当 + 現金取り崩し + 追加積立）
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
