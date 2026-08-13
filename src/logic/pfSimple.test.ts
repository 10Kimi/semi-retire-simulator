import { describe, it, expect } from 'vitest';
import { classifyRiskLevel7, calculatePfDiagnosis, analyzePfGap } from './pfSimple';
import type { PfHoldings } from './pfSimple';
import {
  FALLBACK_ASSET_RETURNS,
  FALLBACK_ASSET_RISKS,
  FALLBACK_CORRELATION_MATRIX,
} from './portfolioDiagnosis';

describe('classifyRiskLevel7', () => {
  it('2-1: 境界値テスト', () => {
    expect(classifyRiskLevel7(0)).toBe(1);
    expect(classifyRiskLevel7(3)).toBe(1);
    expect(classifyRiskLevel7(3.01)).toBe(2);
    expect(classifyRiskLevel7(6)).toBe(2);
    expect(classifyRiskLevel7(6.01)).toBe(3);
    expect(classifyRiskLevel7(9)).toBe(3);
    expect(classifyRiskLevel7(9.01)).toBe(4);
    expect(classifyRiskLevel7(12)).toBe(4);
    expect(classifyRiskLevel7(12.01)).toBe(5);
    expect(classifyRiskLevel7(15)).toBe(5);
    expect(classifyRiskLevel7(15.01)).toBe(6);
    expect(classifyRiskLevel7(16.5)).toBe(6);   // 2026-08-12: 境界 20→16.5
    expect(classifyRiskLevel7(16.51)).toBe(7);
    expect(classifyRiskLevel7(30)).toBe(7);
  });
});

describe('calculatePfDiagnosis', () => {
  it('2-2: 全額現金 → ボラティリティ≒0.5%, リスクレベル1', () => {
    const holdings: PfHoldings = { cash: 1000 };
    const result = calculatePfDiagnosis(
      holdings,
      FALLBACK_ASSET_RETURNS,
      FALLBACK_ASSET_RISKS,
      FALLBACK_CORRELATION_MATRIX,
    );

    expect(result.totalAmount).toBe(1000);
    expect(result.weights.cash).toBe(1);
    expect(result.volatility).toBeCloseTo(0.5, 0);
    expect(result.riskLevel).toBe(1);
    expect(result.expectedReturn).toBeCloseTo(0.1, 1);
  });

  it('2-3: 全額新興国株式 → ボラティリティ≒24%, リスクレベル7', () => {
    const holdings: PfHoldings = { emerging_equity: 1000 };
    const result = calculatePfDiagnosis(
      holdings,
      FALLBACK_ASSET_RETURNS,
      FALLBACK_ASSET_RISKS,
      FALLBACK_CORRELATION_MATRIX,
    );

    expect(result.volatility).toBeCloseTo(24, 0);
    expect(result.riskLevel).toBe(7);
    expect(result.expectedReturn).toBeCloseTo(7.8, 1);
  });

  it('2-4: 分散PFはボラティリティが単一資産より低い', () => {
    const singleHoldings: PfHoldings = { japan_equity: 1000 };
    const singleResult = calculatePfDiagnosis(
      singleHoldings,
      FALLBACK_ASSET_RETURNS,
      FALLBACK_ASSET_RISKS,
      FALLBACK_CORRELATION_MATRIX,
    );

    const diversifiedHoldings: PfHoldings = {
      japan_equity: 300,
      us_equity: 300,
      japan_bond: 200,
      gold: 100,
      cash: 100,
    };
    const diversifiedResult = calculatePfDiagnosis(
      diversifiedHoldings,
      FALLBACK_ASSET_RETURNS,
      FALLBACK_ASSET_RISKS,
      FALLBACK_CORRELATION_MATRIX,
    );

    expect(diversifiedResult.volatility).toBeLessThan(singleResult.volatility);
  });

  it('2-5: 保有額ゼロ → 安全にリターン', () => {
    const holdings: PfHoldings = {};
    const result = calculatePfDiagnosis(
      holdings,
      FALLBACK_ASSET_RETURNS,
      FALLBACK_ASSET_RISKS,
      FALLBACK_CORRELATION_MATRIX,
    );

    expect(result.totalAmount).toBe(0);
    expect(result.volatility).toBe(0);
    expect(result.expectedReturn).toBe(0);
    expect(result.riskLevel).toBe(1);
  });
});

describe('analyzePfGap', () => {
  it('2-6: match / pf_higher / pf_lower の3パターン', () => {
    const match = analyzePfGap(4, 4);
    expect(match.gapType).toBe('match');
    expect(match.message).toContain('合っています');

    const higher = analyzePfGap(6, 3);
    expect(higher.gapType).toBe('pf_higher');
    expect(higher.message).toContain('積極的');

    const lower = analyzePfGap(2, 5);
    expect(lower.gapType).toBe('pf_lower');
    expect(lower.message).toContain('保守的');
  });
});
