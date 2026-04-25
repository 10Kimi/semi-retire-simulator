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

/** コロナ級の暴落時下落率（1.7σ、%、正の値）— 10年に1回程度 */
function crashDrawdownCorona(level: number): number {
  const vol = LEVEL_VOLATILITY[level] ?? 14;
  return Math.round(vol * 1.7 * 10) / 10;
}

/** リーマン級の暴落時下落率（2.5σ、%、正の値）— 20〜30年に1回程度 */
function crashDrawdownLehman(level: number): number {
  const vol = LEVEL_VOLATILITY[level] ?? 14;
  return Math.round(vol * 2.5 * 10) / 10;
}


/** リスクレベル別の底値売却確率の人数表現。許容度以下なら0（売却リスクなし） */
function panicSellRate(level: number, toleranceLevel: number): { numerator: number; denominator: number } {
  const gap = level - toleranceLevel;
  if (gap <= 0) return { numerator: 0, denominator: 0 }; // 許容度以下 = 売却リスクなし
  if (gap === 1) return { numerator: 1, denominator: 5 };
  if (gap === 2) return { numerator: 1, denominator: 3 };
  return { numerator: 2, denominator: 5 }; // gap >= 3
}

/**
 * コロナ級暴落後の離脱期間（年）— 下落が浅いので短い
 * 段階テーブルは引用元データではなく設計上の見積もり値（gap が大きいほど痛みが深く、
 * 復帰判断が遅れるという仮定）。表示側では「少なくともN年」と幅を持たせて断定を避ける。
 * 三菱UFJ銀行データ（離脱4年後プラス転換）は「離脱コストが大きい」という一般論の裏付け
 * であって、本テーブルの個別値の根拠ではない。
 */
function absenceYearsCorona(level: number, toleranceLevel: number): number {
  const gap = level - toleranceLevel;
  if (gap <= 0) return 0;
  if (gap === 1) return 0.5;
  if (gap === 2) return 1;
  return 1.5;
}

/**
 * リーマン級暴落後の離脱期間（年）— 下落が深いので長い
 * 段階テーブルは引用元データではなく設計上の見積もり値（gap が大きいほど痛みが深く、
 * 復帰判断が遅れるという仮定）。表示側では「少なくともN年」と幅を持たせて断定を避ける。
 * 三菱UFJ銀行データ（離脱4年後プラス転換）は「離脱コストが大きい」という一般論の裏付け
 * であって、本テーブルの個別値の根拠ではない。
 */
function absenceYearsLehman(level: number, toleranceLevel: number): number {
  const gap = level - toleranceLevel;
  if (gap <= 0) return 0;
  if (gap === 1) return 2;
  if (gap === 2) return 3;
  return 4;
}

export interface RiskExcessImpact {
  /** コロナ級: 暴落時の下落額（万円） */
  crashLossCorona: number;
  /** コロナ級: 暴落時の下落率（%） */
  crashPercentCorona: number;
  /** リーマン級: 暴落時の下落額（万円） */
  crashLossLehman: number;
  /** リーマン級: 暴落時の下落率（%） */
  crashPercentLehman: number;
  /** 許容度レベルでのコロナ級下落額（万円） */
  toleranceCrashLossCorona: number;
  /** 許容度レベルでのコロナ級下落率（%） */
  toleranceCrashPercentCorona: number;
  /** 許容度レベルでのリーマン級下落額（万円） */
  toleranceCrashLossLehman: number;
  /** 許容度レベルでのリーマン級下落率（%） */
  toleranceCrashPercentLehman: number;
  /** Step表示用: コロナ級の下落額・率（crashDrawdown互換） */
  crashLoss: number;
  crashPercent: number;
  toleranceCrashLoss: number;
  toleranceCrashPercent: number;
  /** 底値売却の人数表現 */
  panicSell: { numerator: number; denominator: number };
  /** コロナ級後の離脱期間（年） */
  absenceYearsCorona: number;
  /** リーマン級後の離脱期間（年） */
  absenceYearsLehman: number;
  /** Step表示用: リーマン級の離脱期間 */
  absenceYears: number;
  /** 離脱による機会損失額（万円）— リーマン級ベース */
  opportunityCost: number;
  toleranceOpportunityCost: number;
  /** 総コスト = リーマン級下落額 + リーマン級機会損失 */
  totalCost: number;
  toleranceTotalCost: number;
  /** チャート用: コロナ級で売った場合の確定額（万円） */
  soldValue: number;
  /** 20年後資産額: このレベルで持ち続けた場合（暴落2回込み） */
  properValue20y: number;
  /** 20年後資産額: 売却→離脱→復帰を繰り返した場合 */
  soldValue20y: number;
}

/**
 * リスク超過時の3段階インパクトを計算
 * 20年間で2回の暴落: 5年目コロナ級、15年目リーマン級
 * （タイミングと頻度は設計上の見積もり。コロナ級は10年に1回、リーマン級は20〜30年に1回程度
 * という頻度感を 20年スパンの中で表現したもの。引用元データに直接の根拠はない）
 */
export function calculateRiskExcessImpact(
  totalAmount: number,
  pfLevel: number,
  toleranceLevel: number,
): RiskExcessImpact {
  // コロナ級（1.7σ）
  const coronaPct = crashDrawdownCorona(pfLevel);
  const coronaLoss = Math.round(totalAmount * coronaPct / 100);
  const tolCoronaPct = crashDrawdownCorona(toleranceLevel);
  const tolCoronaLoss = Math.round(totalAmount * tolCoronaPct / 100);

  // リーマン級（2.5σ）
  const lehmanPct = crashDrawdownLehman(pfLevel);
  const lehmanLoss = Math.round(totalAmount * lehmanPct / 100);
  const tolLehmanPct = crashDrawdownLehman(toleranceLevel);
  const tolLehmanLoss = Math.round(totalAmount * tolLehmanPct / 100);

  // 底値売却確率
  const panicSell = panicSellRate(pfLevel, toleranceLevel);

  // 離脱期間（暴落の種類別）
  const absCorona = absenceYearsCorona(pfLevel, toleranceLevel);
  const absLehman = absenceYearsLehman(pfLevel, toleranceLevel);

  // 機会損失（リーマン級ベース — 最大の痛み）
  const returnRate = (LEVEL_RETURN[pfLevel] ?? 5) / 100;
  const lehmanBottom = totalAmount - lehmanLoss;
  const recoveredAsset = lehmanBottom * Math.pow(1 + returnRate, absLehman);
  const opportunityCost = Math.round(recoveredAsset - lehmanBottom);

  const tolReturnRate = (LEVEL_RETURN[toleranceLevel] ?? 3.5) / 100;
  const tolAbsLehman = absenceYearsLehman(toleranceLevel, toleranceLevel);
  const tolLehmanBottom = totalAmount - tolLehmanLoss;
  const tolRecoveredAsset = tolLehmanBottom * Math.pow(1 + tolReturnRate, tolAbsLehman);
  const tolOpportunityCost = Math.round(tolRecoveredAsset - tolLehmanBottom);

  // 総コスト = リーマン級下落額 + リーマン級機会損失
  const totalCost = lehmanLoss + opportunityCost;
  const toleranceTotalCost = tolLehmanLoss + tolOpportunityCost;

  // Step表示・スライダー用（コロナ級をデフォルトに）
  const soldValue = totalAmount - coronaLoss;

  // ── 20年後資産額（5年目コロナ級、15年目リーマン級）──
  const pfReturnR = (LEVEL_RETURN[pfLevel] ?? 6.5) / 100;
  const pfCoronaCrashR = coronaPct / 100;
  const pfLehmanCrashR = lehmanPct / 100;

  // このレベルで持ち続けた場合
  let proper20 = totalAmount;
  for (let y = 1; y <= 20; y++) {
    if (y === 5) proper20 *= (1 - pfCoronaCrashR);
    else if (y === 15) proper20 *= (1 - pfLehmanCrashR);
    else proper20 *= (1 + pfReturnR);
  }
  const properValue20y = Math.round(proper20);

  // 売却を繰り返した場合
  const aggressiveCoronaCrashR = coronaPct / 100;
  const aggressiveLehmanCrashR = lehmanPct / 100;
  let sold20 = totalAmount;
  let inCash = false;
  let countdown = 0;
  for (let y = 1; y <= 20; y++) {
    if (y === 5) {
      if (!inCash) {
        sold20 *= (1 - aggressiveCoronaCrashR);
        inCash = true;
        countdown = Math.round(absCorona);
      }
    } else if (y === 15) {
      if (!inCash) {
        sold20 *= (1 - aggressiveLehmanCrashR);
        inCash = true;
        countdown = Math.round(absLehman);
      }
    } else {
      if (inCash) {
        countdown--;
        if (countdown <= 0) inCash = false;
      } else {
        // 次の暴落前は攻撃的PFで運用、最後の暴落後は適正PFで運用
        if (y < 15) {
          sold20 *= (1 + pfReturnR);
        } else {
          sold20 *= (1 + tolReturnRate);
        }
      }
    }
  }
  const soldValue20y = Math.round(sold20);

  return {
    crashLossCorona: coronaLoss,
    crashPercentCorona: coronaPct,
    crashLossLehman: lehmanLoss,
    crashPercentLehman: lehmanPct,
    toleranceCrashLossCorona: tolCoronaLoss,
    toleranceCrashPercentCorona: tolCoronaPct,
    toleranceCrashLossLehman: tolLehmanLoss,
    toleranceCrashPercentLehman: tolLehmanPct,
    // Step表示互換（コロナ級をデフォルト表示）
    crashLoss: coronaLoss,
    crashPercent: coronaPct,
    toleranceCrashLoss: tolCoronaLoss,
    toleranceCrashPercent: tolCoronaPct,
    panicSell,
    absenceYearsCorona: absCorona,
    absenceYearsLehman: absLehman,
    absenceYears: absLehman,
    opportunityCost,
    toleranceOpportunityCost: tolOpportunityCost,
    totalCost,
    toleranceTotalCost,
    soldValue,
    properValue20y,
    soldValue20y,
  };
}
