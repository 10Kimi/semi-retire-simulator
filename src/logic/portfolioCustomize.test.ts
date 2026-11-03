import { describe, it, expect } from 'vitest';
import { computeResult, FALLBACK_MARKET } from './portfolioCustomize';
import { MODEL_ALLOCATIONS } from '../lib/rb/types';

// /portfolio の計算の「今の動き」を固定する（#12 ステップ1）。market はフォールバック値。
const toWeights = (alloc: Record<string, number>) =>
  Object.fromEntries(Object.entries(alloc).map(([k, v]) => [k, v / 100]));

describe('computeResult（フォールバック値）', () => {
  it.each([
    // [レベル, riskLevel, expectedReturn, volatility, sharpeRatio, overLimit（基準Lv4）]
    [1, 1, 1.5, 2.9, 0.34, false],
    [2, 2, 3.0, 5.8, 0.43, false],
    [3, 3, 4.3, 8.9, 0.43, false],
    [4, 4, 5.2, 11.1, 0.42, false],
    [5, 6, 6.3, 15.1, 0.38, true],
    [6, 7, 7.2, 18.7, 0.36, true],  // #12 で Lv6 を新興国REIT→日本株に（検算役のスクリプトで再計算して一致）
    [7, 7, 7.5, 20.5, 0.34, true],
  ])('A%i: モデル配分（基準Lv4）', (level, riskLevel, expectedReturn, volatility, sharpeRatio, overLimit) => {
    const r = computeResult(toWeights(MODEL_ALLOCATIONS[level]), 4, FALLBACK_MARKET);
    expect(r).toEqual({ riskLevel, expectedReturn, volatility, sharpeRatio, overLimit });
  });

  it('B: us_equity 100%', () => {
    expect(computeResult({ us_equity: 1 }, 4, FALLBACK_MARKET)).toEqual({
      riskLevel: 7, expectedReturn: 7.2, volatility: 20, sharpeRatio: 0.34, overLimit: true,
    });
  });

  it('C: cash 100%（シャープはマイナス）', () => {
    expect(computeResult({ cash: 1 }, 4, FALLBACK_MARKET)).toEqual({
      riskLevel: 1, expectedReturn: 0.1, volatility: 0.5, sharpeRatio: -0.8, overLimit: false,
    });
  });

  it('D: weights が空 → ボラ0・シャープ0', () => {
    expect(computeResult({}, 4, FALLBACK_MARKET)).toEqual({
      riskLevel: 1, expectedReturn: 0, volatility: 0, sharpeRatio: 0, overLimit: false,
    });
  });

  it('E: us_equity 50%・japan_bond 50%、基準Lv1 → 上限超え', () => {
    expect(computeResult({ us_equity: 0.5, japan_bond: 0.5 }, 1, FALLBACK_MARKET)).toEqual({
      riskLevel: 4, expectedReturn: 4.0, volatility: 9.9, sharpeRatio: 0.35, overLimit: true,
    });
  });

  it('F: 未知のキー foo は無視される', () => {
    expect(computeResult({ us_equity: 0.5, japan_bond: 0.5, foo: 0.5 }, 4, FALLBACK_MARKET)).toEqual({
      riskLevel: 4, expectedReturn: 4.0, volatility: 9.9, sharpeRatio: 0.35, overLimit: false,
    });
  });

  it('G: japan_equity 33.3%・developed_bond 33.3%・gold 33.4%、基準Lv7', () => {
    expect(computeResult({ japan_equity: 0.333, developed_bond: 0.333, gold: 0.334 }, 7, FALLBACK_MARKET)).toEqual({
      riskLevel: 3, expectedReturn: 3.7, volatility: 8.9, sharpeRatio: 0.36, overLimit: false,
    });
  });
});

describe('computeResult（境目・欠けたデータ）', () => {
  // 1資産だけの小さな market。ボラ＝その資産のリスク
  const single = (risk: number, ret = 6) => ({ risks: { us_equity: risk }, returns: { us_equity: ret }, corr: {} });

  it('ボラが基準レベルの上限とちょうど等しいときは上限超えにしない', () => {
    expect(computeResult({ us_equity: 1 }, 4, single(12))).toMatchObject({ volatility: 12, riskLevel: 4, overLimit: false });
    expect(computeResult({ us_equity: 1 }, 3, single(12))).toMatchObject({ volatility: 12, overLimit: true });
  });

  it('ボラ 16.0 は Lv6・16.1 は Lv7', () => {
    expect(computeResult({ us_equity: 1 }, 6, single(16))).toMatchObject({ volatility: 16, riskLevel: 6, overLimit: false });
    expect(computeResult({ us_equity: 1 }, 6, single(16.1))).toMatchObject({ volatility: 16.1, riskLevel: 7, overLimit: true });
  });

  it('market にクラスが欠けている → risk 0・return 0', () => {
    const market = { risks: { us_equity: 20 }, returns: { us_equity: 8 }, corr: {} };
    expect(computeResult({ us_equity: 0.5, gold: 0.5 }, 4, market)).toEqual({
      riskLevel: 4, expectedReturn: 4, volatility: 10, sharpeRatio: 0.35, overLimit: false,
    });
  });

  it('相関が欠けている → 同じキー同士 1・違うキー 0', () => {
    const market = { risks: { us_equity: 20, gold: 15 }, returns: { us_equity: 8, gold: 3 }, corr: {} };
    // sqrt(0.5²·0.2² + 0.5²·0.15²) = 0.125 → 12.5%
    expect(computeResult({ us_equity: 0.5, gold: 0.5 }, 4, market)).toEqual({
      riskLevel: 5, expectedReturn: 5.5, volatility: 12.5, sharpeRatio: 0.4, overLimit: true,
    });
  });
});
