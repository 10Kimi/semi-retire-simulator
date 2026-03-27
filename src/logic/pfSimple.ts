/**
 * PF診断（簡易版）— 7段階リスクレベルに対応
 *
 * ポートフォリオのボラティリティから7段階リスクレベルに変換。
 * リスク診断ツール簡易版（riskSimpleScoring.ts）と同じスケールを使用。
 */

import { ASSET_CLASSES } from './portfolioAllocation';
import {
  FALLBACK_ASSET_RETURNS,
  FALLBACK_ASSET_RISKS,
  FALLBACK_CORRELATION_MATRIX,
} from './portfolioDiagnosis';
import { getRiskLevelDef } from './riskSimpleScoring';
import type { RiskLevelDef } from '../types/riskSimple';

export interface PfHoldings {
  [assetKey: string]: number; // 万円
}

export interface PfDiagnosisResult {
  totalAmount: number;
  weights: Record<string, number>;
  expectedReturn: number;
  volatility: number;
  riskLevel: number;         // 1〜7
  riskLevelDef: RiskLevelDef;
}

export interface PfGapResult {
  pfLevel: number;
  assessmentLevel: number;
  gapType: 'match' | 'pf_higher' | 'pf_lower';
  message: string;
}

/**
 * ボラティリティ → 7段階リスクレベル
 * riskSimpleScoringのリスクレベル定義に準拠
 */
export function classifyRiskLevel7(volatility: number): number {
  if (volatility <= 3) return 1;
  if (volatility <= 6) return 2;
  if (volatility <= 9) return 3;
  if (volatility <= 12) return 4;
  if (volatility <= 15) return 5;
  if (volatility <= 20) return 6;
  return 7;
}

/**
 * PF診断の計算
 */
export function calculatePfDiagnosis(
  holdings: PfHoldings,
  assetReturns?: Record<string, number>,
  assetRisks?: Record<string, number>,
  correlationMatrix?: Record<string, Record<string, number>>,
): PfDiagnosisResult {
  const returns = assetReturns ?? FALLBACK_ASSET_RETURNS;
  const risks = assetRisks ?? FALLBACK_ASSET_RISKS;
  const corr = correlationMatrix ?? FALLBACK_CORRELATION_MATRIX;

  const keys = ASSET_CLASSES.map(ac => ac.key);

  // 合計額
  const totalAmount = keys.reduce((sum, k) => sum + (holdings[k] ?? 0), 0);

  // ウェイト
  const weights: Record<string, number> = {};
  for (const k of keys) {
    weights[k] = totalAmount > 0 ? (holdings[k] ?? 0) / totalAmount : 0;
  }

  // 期待リターン（加重平均）
  let expectedReturn = 0;
  for (const k of keys) {
    expectedReturn += (weights[k] ?? 0) * (returns[k] ?? 0);
  }
  expectedReturn = Math.round(expectedReturn * 100) / 100;

  // ボラティリティ σ_p = sqrt(Σ_i Σ_j w_i * w_j * σ_i * σ_j * ρ_ij)
  let variance = 0;
  for (const ki of keys) {
    for (const kj of keys) {
      const wi = weights[ki] ?? 0;
      const wj = weights[kj] ?? 0;
      const si = (risks[ki] ?? 0) / 100;
      const sj = (risks[kj] ?? 0) / 100;
      const rho = corr[ki]?.[kj] ?? (ki === kj ? 1 : 0);
      variance += wi * wj * si * sj * rho;
    }
  }
  const volatility = Math.round(Math.sqrt(Math.max(variance, 0)) * 100 * 100) / 100;

  const riskLevel = classifyRiskLevel7(volatility);
  const riskLevelDef = getRiskLevelDef(riskLevel);

  return { totalAmount, weights, expectedReturn, volatility, riskLevel, riskLevelDef };
}

/**
 * PFリスクレベル vs リスク診断スコアのギャップ分析
 */
export function analyzePfGap(pfLevel: number, assessmentLevel: number): PfGapResult {
  if (pfLevel === assessmentLevel) {
    return {
      pfLevel,
      assessmentLevel,
      gapType: 'match',
      message: '現在のポートフォリオはあなたのリスク許容度と合っています。',
    };
  }
  if (pfLevel > assessmentLevel) {
    return {
      pfLevel,
      assessmentLevel,
      gapType: 'pf_higher',
      message: '現在のポートフォリオはあなたのリスク許容度より積極的です。暴落時に売ってしまうリスクがあります。',
    };
  }
  return {
    pfLevel,
    assessmentLevel,
    gapType: 'pf_lower',
    message: '現在のポートフォリオはあなたのリスク許容度より保守的です。もう少しリターンを狙える可能性があります。',
  };
}
