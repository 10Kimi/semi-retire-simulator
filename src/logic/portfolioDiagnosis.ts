// ── ポートフォリオ診断 計算ロジック ──

import type { RiskLevel, AssetAllocation } from '../types/assessment';
import type {
  HoldingAmounts,
  DiagnosisResult,
  GapAnalysis,
  ImprovementSuggestion,
} from '../types/portfolioDiagnosis';
import { ASSET_CLASSES } from './portfolioAllocation';
import { getRiskLevelByKey } from './riskLevels';

// ── リスクレベル番号マッピング ──

const RISK_LEVEL_NUMBER_MAP: Record<RiskLevel, number> = {
  conservative: 1,
  moderately_conservative: 2,
  balanced: 3,
  moderately_aggressive: 4,
  aggressive: 5,
};

const RISK_LEVEL_FROM_NUMBER: Record<number, RiskLevel> = {
  1: 'conservative',
  2: 'moderately_conservative',
  3: 'balanced',
  4: 'moderately_aggressive',
  5: 'aggressive',
};

// ── フォールバック用パラメータ（GPIFベース） ──
// market_data テーブルが空の場合に使用

export const FALLBACK_ASSET_RETURNS: Record<string, number> = {
  japan_equity: 5.6,
  us_equity: 7.2,
  developed_equity: 6.5,
  emerging_equity: 7.8,
  japan_bond: 0.7,
  developed_bond: 2.6,
  emerging_bond: 4.2,
  japan_reit: 4.5,
  developed_reit: 5.8,
  gold: 3.0,
  cash: 0.1,
};

export const FALLBACK_ASSET_RISKS: Record<string, number> = {
  japan_equity: 18.0,
  us_equity: 20.0,
  developed_equity: 19.0,
  emerging_equity: 24.0,
  japan_bond: 2.5,
  developed_bond: 8.0,
  emerging_bond: 12.0,
  japan_reit: 16.0,
  developed_reit: 18.0,
  gold: 15.0,
  cash: 0.5,
};

// 簡易化した相関行列（フォールバック用）
// 行・列の順序: japan_equity, us_equity, developed_equity, emerging_equity,
//               japan_bond, developed_bond, emerging_bond,
//               japan_reit, developed_reit, gold, cash
const FALLBACK_CORRELATION_FLAT: number[][] = [
  // japan_eq  us_eq  dev_eq  em_eq  jp_bd  dev_bd  em_bd  jp_rt  dev_rt  gold   cash
  [  1.00,     0.65,  0.70,  0.55,  -0.10,  0.05,  0.20,  0.45,  0.40,  0.05,  0.00 ],  // japan_equity
  [  0.65,     1.00,  0.85,  0.65,  -0.15,  0.10,  0.30,  0.40,  0.65,  0.00, -0.05 ],  // us_equity
  [  0.70,     0.85,  1.00,  0.70,  -0.10,  0.15,  0.35,  0.40,  0.55,  0.05,  0.00 ],  // developed_equity
  [  0.55,     0.65,  0.70,  1.00,  -0.05,  0.10,  0.50,  0.30,  0.45,  0.10,  0.00 ],  // emerging_equity
  [ -0.10,    -0.15, -0.10, -0.05,   1.00,  0.30,  0.15,  0.20,  0.05,  0.10,  0.30 ],  // japan_bond
  [  0.05,     0.10,  0.15,  0.10,   0.30,  1.00,  0.50,  0.15,  0.20,  0.25,  0.20 ],  // developed_bond
  [  0.20,     0.30,  0.35,  0.50,   0.15,  0.50,  1.00,  0.20,  0.30,  0.15,  0.10 ],  // emerging_bond
  [  0.45,     0.40,  0.40,  0.30,   0.20,  0.15,  0.20,  1.00,  0.55,  0.10,  0.05 ],  // japan_reit
  [  0.40,     0.65,  0.55,  0.45,   0.05,  0.20,  0.30,  0.55,  1.00,  0.05,  0.00 ],  // developed_reit
  [  0.05,     0.00,  0.05,  0.10,   0.10,  0.25,  0.15,  0.10,  0.05,  1.00,  0.10 ],  // gold
  [  0.00,    -0.05,  0.00,  0.00,   0.30,  0.20,  0.10,  0.05,  0.00,  0.10,  1.00 ],  // cash
];

function buildFallbackCorrelationMatrix(): Record<string, Record<string, number>> {
  const keys = ASSET_CLASSES.map((ac) => ac.key);
  const matrix: Record<string, Record<string, number>> = {};
  for (let i = 0; i < keys.length; i++) {
    matrix[keys[i]] = {};
    for (let j = 0; j < keys.length; j++) {
      matrix[keys[i]][keys[j]] = FALLBACK_CORRELATION_FLAT[i][j];
    }
  }
  return matrix;
}

export const FALLBACK_CORRELATION_MATRIX = buildFallbackCorrelationMatrix();

// ── 計算関数 ──

/**
 * 保有金額 → 配分比率（weight）を計算
 */
export function calculateWeights(
  holdings: HoldingAmounts,
): { weights: Record<string, number>; totalAmount: number } {
  const total = ASSET_CLASSES.reduce((sum, ac) => sum + (holdings[ac.key] ?? 0), 0);

  if (total === 0) {
    const zeros: Record<string, number> = {};
    for (const ac of ASSET_CLASSES) zeros[ac.key] = 0;
    return { weights: zeros, totalAmount: 0 };
  }

  const weights: Record<string, number> = {};
  for (const ac of ASSET_CLASSES) {
    weights[ac.key] = (holdings[ac.key] ?? 0) / total;
  }
  return { weights, totalAmount: total };
}

/**
 * 期待リターン（加重平均）を計算
 */
export function calculateExpectedReturn(
  weights: Record<string, number>,
  assetReturns: Record<string, number>,
): number {
  let ret = 0;
  for (const ac of ASSET_CLASSES) {
    ret += (weights[ac.key] ?? 0) * (assetReturns[ac.key] ?? 0);
  }
  return Math.round(ret * 100) / 100;
}

/**
 * ポートフォリオボラティリティを計算
 * σ_p = sqrt( Σ_i Σ_j w_i * w_j * σ_i * σ_j * ρ_ij )
 */
export function calculateVolatility(
  weights: Record<string, number>,
  assetRisks: Record<string, number>,
  correlationMatrix: Record<string, Record<string, number>>,
): number {
  const keys = ASSET_CLASSES.map((ac) => ac.key);
  let variance = 0;

  for (const ki of keys) {
    for (const kj of keys) {
      const wi = weights[ki] ?? 0;
      const wj = weights[kj] ?? 0;
      const si = (assetRisks[ki] ?? 0) / 100; // %→小数
      const sj = (assetRisks[kj] ?? 0) / 100;
      const rho = correlationMatrix[ki]?.[kj] ?? (ki === kj ? 1 : 0);
      variance += wi * wj * si * sj * rho;
    }
  }

  // 負値ガード（浮動小数点の誤差対策）
  const vol = Math.sqrt(Math.max(variance, 0)) * 100; // 小数→%に戻す
  return Math.round(vol * 100) / 100;
}

/**
 * ボラティリティ → リスクレベル（1〜5）に変換
 */
export function classifyRiskLevel(
  volatility: number,
): { number: number; key: RiskLevel } {
  if (volatility <= 6) return { number: 1, key: 'conservative' };
  if (volatility <= 9) return { number: 2, key: 'moderately_conservative' };
  if (volatility <= 12) return { number: 3, key: 'balanced' };
  if (volatility <= 15) return { number: 4, key: 'moderately_aggressive' };
  return { number: 5, key: 'aggressive' };
}

/**
 * 各計算を統合して DiagnosisResult を生成
 */
export function buildDiagnosisResult(
  holdings: HoldingAmounts,
  assetReturns: Record<string, number>,
  assetRisks: Record<string, number>,
  correlationMatrix: Record<string, Record<string, number>>,
): DiagnosisResult {
  const { weights, totalAmount } = calculateWeights(holdings);
  const expectedReturn = calculateExpectedReturn(weights, assetReturns);
  const volatility = calculateVolatility(weights, assetRisks, correlationMatrix);
  const riskLevel = classifyRiskLevel(volatility);

  // AssetAllocation[] を構築（チャート・テーブル用）
  const allocations: AssetAllocation[] = ASSET_CLASSES.map((ac) => ({
    key: ac.key,
    label: ac.label,
    percentage: totalAmount > 0
      ? Math.round((weights[ac.key] ?? 0) * 10000) / 100 // 小数第2位まで
      : 0,
    color: ac.color,
  }));

  return {
    holdingAmounts: holdings,
    totalAmount,
    weights,
    allocations,
    expectedReturn,
    volatility,
    riskLevelNumber: riskLevel.number,
    riskLevelKey: riskLevel.key,
  };
}

/**
 * 現在PFのリスクレベル vs リスク許容度のギャップ分析
 */
export function analyzeGap(
  diagnosisResult: DiagnosisResult,
  assessedRiskLevelKey: RiskLevel | null,
): GapAnalysis {
  const pfLevel = diagnosisResult.riskLevelNumber;
  const pfInfo = getRiskLevelByKey(diagnosisResult.riskLevelKey);

  if (!assessedRiskLevelKey) {
    return {
      hasAssessment: false,
      assessedRiskLevelKey: null,
      assessedRiskLevelNumber: null,
      assessedRiskLevelLabel: null,
      portfolioRiskLevelNumber: pfLevel,
      portfolioRiskLevelLabel: pfInfo.label,
      gapDirection: 'match',
      gapSize: 0,
      message: '',
    };
  }

  const assessedNum = RISK_LEVEL_NUMBER_MAP[assessedRiskLevelKey];
  const assessedInfo = getRiskLevelByKey(assessedRiskLevelKey);
  const diff = pfLevel - assessedNum;

  let direction: 'over' | 'under' | 'match';
  let message: string;

  if (diff === 0) {
    direction = 'match';
    message = 'あなたのポートフォリオはリスク許容度と一致しています。';
  } else if (diff > 0) {
    direction = 'over';
    message = `あなたのPFはリスクレベル${pfLevel}（${pfInfo.label}）ですが、リスク許容度はレベル${assessedNum}（${assessedInfo.label}）です。暴落時に耐えられない可能性があります。`;
  } else {
    direction = 'under';
    message = `あなたのPFはリスクレベル${pfLevel}（${pfInfo.label}）ですが、リスク許容度はレベル${assessedNum}（${assessedInfo.label}）です。リターンを高める余地があります。`;
  }

  return {
    hasAssessment: true,
    assessedRiskLevelKey,
    assessedRiskLevelNumber: assessedNum,
    assessedRiskLevelLabel: assessedInfo.label,
    portfolioRiskLevelNumber: pfLevel,
    portfolioRiskLevelLabel: pfInfo.label,
    gapDirection: direction,
    gapSize: Math.abs(diff),
    message,
  };
}

/**
 * 推奨PFとの差分から具体的な売買金額を算出
 */
export function calculateImprovements(
  holdings: HoldingAmounts,
  totalAmount: number,
  recommendedAllocations: Record<string, number>, // key → percentage (0〜100)
): ImprovementSuggestion[] {
  if (totalAmount === 0) return [];

  const suggestions: ImprovementSuggestion[] = [];

  for (const ac of ASSET_CLASSES) {
    const currentAmount = holdings[ac.key] ?? 0;
    const currentPercent = (currentAmount / totalAmount) * 100;
    const targetPercent = recommendedAllocations[ac.key] ?? 0;
    const targetAmount = Math.round(totalAmount * targetPercent / 100);
    const differenceAmount = targetAmount - currentAmount;

    // 差が1万円未満なら表示しない
    if (Math.abs(differenceAmount) < 1) continue;

    suggestions.push({
      assetKey: ac.key,
      assetLabel: ac.label,
      currentAmount,
      targetAmount,
      differenceAmount,
      currentPercent: Math.round(currentPercent * 10) / 10,
      targetPercent: Math.round(targetPercent * 10) / 10,
    });
  }

  // 絶対差が大きい順にソート
  suggestions.sort((a, b) => Math.abs(b.differenceAmount) - Math.abs(a.differenceAmount));

  return suggestions;
}

/**
 * リスクレベルキー → 番号（1〜5）を取得するユーティリティ
 */
export function riskLevelKeyToNumber(key: RiskLevel): number {
  return RISK_LEVEL_NUMBER_MAP[key] ?? 3;
}

/**
 * リスクレベル番号（1〜5）→ キーを取得するユーティリティ
 */
export function riskLevelNumberToKey(num: number): RiskLevel {
  return RISK_LEVEL_FROM_NUMBER[num] ?? 'balanced';
}
