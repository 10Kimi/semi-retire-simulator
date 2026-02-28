// ── Portfolio Diagnosis Type Definitions ──

import type { RiskLevel, AssetAllocation } from './assessment';

// ユーザーが入力する保有金額（万円）
export type HoldingAmounts = Record<string, number>;

// PF診断の計算結果
export interface DiagnosisResult {
  holdingAmounts: HoldingAmounts;
  totalAmount: number;                // 合計保有額（万円）
  weights: Record<string, number>;    // 各資産の配分比率（0〜1）
  allocations: AssetAllocation[];     // チャート・テーブル表示用（percentage: 0〜100）
  expectedReturn: number;             // 期待リターン（%、例: 5.2）
  volatility: number;                 // ボラティリティ（%、例: 12.3）
  riskLevelNumber: number;            // リスクレベル（1〜5）
  riskLevelKey: RiskLevel;            // 'conservative' | 'balanced' 等
}

// ギャップ分析結果
export interface GapAnalysis {
  hasAssessment: boolean;
  assessedRiskLevelKey: RiskLevel | null;
  assessedRiskLevelNumber: number | null;
  assessedRiskLevelLabel: string | null;
  portfolioRiskLevelNumber: number;
  portfolioRiskLevelLabel: string;
  gapDirection: 'over' | 'under' | 'match';  // PFがリスク許容度より攻撃的/保守的/一致
  gapSize: number;                            // リスクレベルの絶対差
  message: string;                            // 表示用メッセージ
}

// 改善提案（資産クラスごとの売買金額）
export interface ImprovementSuggestion {
  assetKey: string;
  assetLabel: string;
  currentAmount: number;     // 現在の保有額（万円）
  targetAmount: number;      // 推奨額（万円）
  differenceAmount: number;  // 正=買い増し、負=売却
  currentPercent: number;
  targetPercent: number;
}

// 入力ページ → 結果ページへの state 受け渡し
export interface DiagnosisNavigationState {
  diagnosisResult: DiagnosisResult;
  gapAnalysis: GapAnalysis;
  improvements: ImprovementSuggestion[];
  assessedPortfolioAllocations: AssetAllocation[] | null;
}

// Supabase portfolio_diagnoses テーブルの行型
export interface DbPortfolioDiagnosis {
  id: string;
  user_id: string;
  holding_amounts: HoldingAmounts;
  total_amount: number;
  expected_return: number;
  volatility: number;
  risk_level: number;
  risk_level_key: string;
  assessment_risk_level: string | null;
  created_at: string;
}
