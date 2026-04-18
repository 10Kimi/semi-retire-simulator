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

// ── リスク超過インパクト計算 ──

/** リスクレベル別の代表ボラティリティ（%） */
const LEVEL_VOLATILITY: Record<number, number> = {
  1: 2, 2: 5, 3: 8, 4: 11, 5: 14, 6: 18, 7: 23,
};

/** リスクレベル別の代表期待リターン（%） */
const LEVEL_RETURN: Record<number, number> = {
  1: 0.5, 2: 2.0, 3: 3.5, 4: 5.0, 5: 6.5, 6: 8.0, 7: 9.5,
};

/** リスクレベル別の暴落時下落率（2σ相当、%、正の値） */
function crashDrawdown(level: number): number {
  const vol = LEVEL_VOLATILITY[level] ?? 14;
  return Math.round(vol * 2.5 * 10) / 10; // 2.5σ ≈ リーマン級
}

/** リスクレベル別の底値売却確率の人数表現 */
function panicSellRate(level: number, toleranceLevel: number): { numerator: number; denominator: number } {
  const gap = level - toleranceLevel;
  if (gap <= 0) return { numerator: 1, denominator: 10 };
  if (gap === 1) return { numerator: 1, denominator: 5 };
  if (gap === 2) return { numerator: 1, denominator: 3 };
  return { numerator: 2, denominator: 5 }; // gap >= 3
}

/** 離脱期間の推定（年） */
function estimatedAbsenceYears(level: number, toleranceLevel: number): number {
  const gap = level - toleranceLevel;
  if (gap <= 0) return 0.5;
  if (gap === 1) return 1.5;
  if (gap === 2) return 2.5;
  return 3;
}

export interface RiskExcessImpact {
  /** 第1の痛み: 暴落時の下落額（万円） */
  crashLoss: number;
  /** 暴落時の下落率（%） */
  crashPercent: number;
  /** 許容度レベルでの下落額（万円） */
  toleranceCrashLoss: number;
  /** 許容度レベルでの下落率（%） */
  toleranceCrashPercent: number;
  /** 第2の痛み: 底値売却の人数表現 */
  panicSell: { numerator: number; denominator: number };
  /** 第3の痛み: 離脱期間（年） */
  absenceYears: number;
  /** 離脱による機会損失額（万円） */
  opportunityCost: number;
  /** 許容度レベルでの離脱機会損失（万円） */
  toleranceOpportunityCost: number;
  /** 総コスト（万円） = 暴落下落額 + 離脱機会損失 */
  totalCost: number;
  /** 許容度レベルでの総コスト（万円） */
  toleranceTotalCost: number;
  /** チャート用: 持ち続けた場合の12年半後の資産（万円） */
  holdValue12y: number;
  /** チャート用: 売った場合の確定額（万円） */
  soldValue: number;
}

/**
 * リスク超過時の3段階インパクトを計算
 * 任意のリスクレベルで計算可能（スライダー連動用）
 */
export function calculateRiskExcessImpact(
  totalAmount: number,
  pfLevel: number,
  toleranceLevel: number,
): RiskExcessImpact {
  // 第1の痛み: 暴落時下落
  const crashPct = crashDrawdown(pfLevel);
  const crashLoss = Math.round(totalAmount * crashPct / 100);
  const tolCrashPct = crashDrawdown(toleranceLevel);
  const tolCrashLoss = Math.round(totalAmount * tolCrashPct / 100);

  // 第2の痛み: 底値売却確率
  const panicSell = panicSellRate(pfLevel, toleranceLevel);

  // 第3の痛み: 離脱による機会損失
  const absYears = estimatedAbsenceYears(pfLevel, toleranceLevel);
  const returnRate = (LEVEL_RETURN[pfLevel] ?? 5) / 100;
  const bottomAsset = totalAmount - crashLoss;
  const recoveredAsset = bottomAsset * Math.pow(1 + returnRate, absYears);
  const opportunityCost = Math.round(recoveredAsset - bottomAsset);

  const tolAbsYears = estimatedAbsenceYears(toleranceLevel, toleranceLevel);
  const tolReturnRate = (LEVEL_RETURN[toleranceLevel] ?? 3.5) / 100;
  const tolBottomAsset = totalAmount - tolCrashLoss;
  const tolRecoveredAsset = tolBottomAsset * Math.pow(1 + tolReturnRate, tolAbsYears);
  const tolOpportunityCost = Math.round(tolRecoveredAsset - tolBottomAsset);

  // 総コスト
  const totalCost = crashLoss + opportunityCost;
  const toleranceTotalCost = tolCrashLoss + tolOpportunityCost;

  // チャート用: 持ち続けた場合 12.5年後 (三菱UFJデータ: +84%)
  const holdReturn = (LEVEL_RETURN[pfLevel] ?? 5) / 100;
  const holdValue12y = Math.round(totalAmount * Math.pow(1 + holdReturn, 12.5));
  const soldValue = totalAmount - crashLoss; // 底値売却で確定

  return {
    crashLoss,
    crashPercent: crashPct,
    toleranceCrashLoss: tolCrashLoss,
    toleranceCrashPercent: tolCrashPct,
    panicSell,
    absenceYears: absYears,
    opportunityCost,
    toleranceOpportunityCost: tolOpportunityCost,
    totalCost,
    toleranceTotalCost,
    holdValue12y,
    soldValue,
  };
}
