import { describe, it, expect } from 'vitest';
import {
  calculateWeights,
  calculateExpectedReturn,
  calculateVolatility,
  classifyRiskLevel,
  buildDiagnosisResult,
  analyzeGap,
  calculateImprovements,
  FALLBACK_ASSET_RETURNS,
  FALLBACK_ASSET_RISKS,
  FALLBACK_CORRELATION_MATRIX,
} from './portfolioDiagnosis';
import { PORTFOLIO_PRESETS, getPortfolioForRiskLevel } from './portfolioAllocation';
import { calculatePfDiagnosis } from './pfSimple';
import type { RiskLevel } from '../types/assessment';

// #12 ステップ2：資産クラスを13クラスに統一しても、/pf・旧リスク診断の計算結果が
// 11クラスの入力では変わらないことを固定する。
// ラベル・並び順・値0のクラスの有無は統一で変わる前提なので、比べるのは
// 11クラスのキーごとの数値（と、売買提案の並び順）だけ。
const KEYS_11 = [
  'japan_equity', 'us_equity', 'developed_equity', 'emerging_equity',
  'japan_bond', 'developed_bond', 'emerging_bond',
  'japan_reit', 'developed_reit', 'gold', 'cash',
];
const LEVELS: RiskLevel[] = [
  'conservative', 'moderately_conservative', 'balanced', 'moderately_aggressive', 'aggressive',
];

const pick11 = (rec: Record<string, number>) =>
  Object.fromEntries(KEYS_11.map(k => [k, rec[k] ?? 0]));
const allocToRecord = (allocs: { key: string; percentage: number }[]) =>
  Object.fromEntries(allocs.map(a => [a.key, a.percentage]));
const presetHoldings = (level: RiskLevel) =>
  allocToRecord(PORTFOLIO_PRESETS[level].allocations);

// 代表的な入力（万円）
const INPUTS: Record<string, Record<string, number>> = {
  ...Object.fromEntries(LEVELS.map(l => [`preset_${l}`, presetHoldings(l)])),
  skew_us: { us_equity: 900, cash: 100 },
  skew_bond: { japan_bond: 700, developed_bond: 200, gold: 100 },
  odd: {
    japan_equity: 123, us_equity: 4567, developed_equity: 89, emerging_equity: 1011,
    japan_bond: 37, developed_bond: 777, emerging_bond: 5, japan_reit: 61,
    developed_reit: 13, gold: 333, cash: 2049,
  },
  empty: {},
};

const diag = (h: Record<string, number>) =>
  buildDiagnosisResult(h, FALLBACK_ASSET_RETURNS, FALLBACK_ASSET_RISKS, FALLBACK_CORRELATION_MATRIX);

describe('11クラス入力の計算結果（統一前後で不変）', () => {
  it('プリセット（フォールバック）', () => {
    const out = Object.fromEntries(LEVELS.map(l => {
      const p = getPortfolioForRiskLevel(l);
      return [l, {
        allocations: pick11(allocToRecord(p.allocations)),
        expectedReturn: p.expectedReturn,
        expectedVolatility: p.expectedVolatility,
      }];
    }));
    expect(out).toMatchSnapshot();
  });

  it('calculateWeights / calculateExpectedReturn / calculateVolatility / classifyRiskLevel', () => {
    const out = Object.fromEntries(Object.entries(INPUTS).map(([name, h]) => {
      const { weights, totalAmount } = calculateWeights(h);
      const vol = calculateVolatility(weights, FALLBACK_ASSET_RISKS, FALLBACK_CORRELATION_MATRIX);
      return [name, {
        weights: pick11(weights),
        totalAmount,
        expectedReturn: calculateExpectedReturn(weights, FALLBACK_ASSET_RETURNS),
        volatility: vol,
        riskLevel: classifyRiskLevel(vol),
      }];
    }));
    expect(out).toMatchSnapshot();
  });

  it('buildDiagnosisResult', () => {
    const out = Object.fromEntries(Object.entries(INPUTS).map(([name, h]) => {
      const r = diag(h);
      return [name, {
        totalAmount: r.totalAmount,
        weights: pick11(r.weights),
        allocations: pick11(allocToRecord(r.allocations)),
        expectedReturn: r.expectedReturn,
        volatility: r.volatility,
        riskLevelNumber: r.riskLevelNumber,
        riskLevelKey: r.riskLevelKey,
      }];
    }));
    expect(out).toMatchSnapshot();
  });

  it('analyzeGap', () => {
    const out = Object.fromEntries(Object.entries(INPUTS).map(([name, h]) => {
      const r = diag(h);
      return [name, [null, ...LEVELS].map(l => analyzeGap(r, l as RiskLevel | null))];
    }));
    expect(out).toMatchSnapshot();
  });

  // 差が同じ項目の並びは ASSET_CLASSES の順（#12 で cash が先頭に）
  it('calculateImprovements（並び順を含む）', () => {
    const out = Object.fromEntries(Object.entries(INPUTS).map(([name, h]) => {
      const r = diag(h);
      return [name, Object.fromEntries(LEVELS.map(l => [
        l,
        calculateImprovements(h, r.totalAmount, presetHoldings(l)).map(s => ({
          assetKey: s.assetKey,
          currentAmount: s.currentAmount,
          targetAmount: s.targetAmount,
          differenceAmount: s.differenceAmount,
          currentPercent: s.currentPercent,
          targetPercent: s.targetPercent,
        })),
      ]))];
    }));
    expect(out).toMatchSnapshot();
  });

  it('calculatePfDiagnosis（/pf）', () => {
    const out = Object.fromEntries(Object.entries(INPUTS).map(([name, h]) => {
      const r = calculatePfDiagnosis(h);
      return [name, {
        totalAmount: r.totalAmount,
        weights: pick11(r.weights),
        expectedReturn: r.expectedReturn,
        volatility: r.volatility,
        riskLevel: r.riskLevel,
      }];
    }));
    expect(out).toMatchSnapshot();
  });
});

describe('13クラス入力（commodity・emerging_reit を含む）', () => {
  const h13 = {
    cash: 100, japan_equity: 50, us_equity: 300, developed_equity: 40, emerging_equity: 120,
    japan_bond: 60, developed_bond: 150, emerging_bond: 30, japan_reit: 20, developed_reit: 25,
    emerging_reit: 35, commodity: 45, gold: 70,
  };
  const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

  it('buildDiagnosisResult・calculateImprovements・calculatePfDiagnosis が NaN・undefined にならない', () => {
    const r = diag(h13);
    expect(r.totalAmount).toBe(1045);
    expect(Object.keys(r.weights)).toHaveLength(13);
    expect(r.weights.commodity).toBeCloseTo(45 / 1045, 12);
    expect(r.weights.emerging_reit).toBeCloseTo(35 / 1045, 12);
    expect(Object.values(r.weights).every(isNum)).toBe(true);
    expect(r.allocations).toHaveLength(13);
    expect(r.allocations.every(a => isNum(a.percentage) && a.label && a.color)).toBe(true);
    expect(isNum(r.expectedReturn) && isNum(r.volatility)).toBe(true);
    expect(r.volatility).toBeGreaterThan(0);

    const imps = calculateImprovements(h13, r.totalAmount, presetHoldings('balanced'));
    expect(imps.map(s => s.assetKey)).toEqual(expect.arrayContaining(['commodity', 'emerging_reit']));
    expect(imps.every(s => s.assetLabel && [s.currentAmount, s.targetAmount, s.differenceAmount,
      s.currentPercent, s.targetPercent].every(isNum))).toBe(true);

    const p = calculatePfDiagnosis(h13);
    expect(p.totalAmount).toBe(1045);
    expect(Object.values(p.weights).every(isNum)).toBe(true);
    expect(isNum(p.expectedReturn) && isNum(p.volatility)).toBe(true);
    expect(p.riskLevelDef).toBeDefined();
  });
});
