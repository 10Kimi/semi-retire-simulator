import { describe, it, expect } from 'vitest';
import {
  calculateCapacityScore,
  calculateToleranceScore,
  calculateRiskSimpleResult,
  getRiskLevelDef,
} from './riskScoring';
import type { RiskAnswer } from '../types/risk';

/** ヘルパー: 指定IDと値でRiskAnswer配列を構築 */
function makeAnswers(values: Record<string, number>): RiskAnswer[] {
  return Object.entries(values).map(([questionId, value]) => ({
    questionId,
    selectedIndex: 0,
    value,
  }));
}

describe('calculateCapacityScore', () => {
  it('3-1: 基本計算 — C1=6,C2=5,C3=0,C4=0,C5=5,C6=0 → 7', () => {
    const answers = makeAnswers({ C1: 6, C2: 5, C3: 0, C4: 0, C5: 5, C6: 0 });
    const score = calculateCapacityScore(answers);
    // rawCapacity = (6+5)/2 + (5-1)*0.3 = 5.5 + 1.2 = 6.7
    // round(6.7) = 7, clamp(7, 1, 7) = 7
    expect(score).toBe(7);
  });

  it('3-2: 大きな補正値でクランプ下限=1', () => {
    const answers = makeAnswers({ C1: 1, C2: 1, C3: -3, C4: -2.5, C5: 1, C6: -1.5 });
    const score = calculateCapacityScore(answers);
    // rawCapacity = (1+1)/2 + (1-1)*0.3 = 1
    // capacityAdj = 1 + (-3) + (-2.5) + (-1.5) = -6
    // clamp(round(-6), 1, 7) = 1
    expect(score).toBe(1);
  });

  it('3-3: 高資産+若年齢でもクランプ上限=7', () => {
    const answers = makeAnswers({ C1: 7, C2: 7, C3: 0, C4: 0, C5: 7, C6: 1.5 });
    const score = calculateCapacityScore(answers);
    // rawCapacity = (7+7)/2 + (7-1)*0.3 = 7 + 1.8 = 8.8
    // capacityAdj = 8.8 + 0 + 0 + 1.5 = 10.3
    // clamp(round(10.3), 1, 7) = 7
    expect(score).toBe(7);
  });

  it('3-2b: 中間的な入力の計算検証', () => {
    const answers = makeAnswers({ C1: 4, C2: 3, C3: -1, C4: -0.5, C5: 3, C6: 0 });
    const score = calculateCapacityScore(answers);
    // rawCapacity = (4+3)/2 + (3-1)*0.3 = 3.5 + 0.6 = 4.1
    // capacityAdj = 4.1 + (-1) + (-0.5) + 0 = 2.6
    // round(2.6) = 3, clamp(3, 1, 7) = 3
    expect(score).toBe(3);
  });
});

describe('calculateToleranceScore', () => {
  it('3-4: 基本計算 — T1=5,T2=3,T3=5,T4=5,T5=7 → avg=5', () => {
    const answers = makeAnswers({ T1: 5, T2: 3, T3: 5, T4: 5, T5: 7 });
    const score = calculateToleranceScore(answers);
    // avg = (5+3+5+5+7)/5 = 25/5 = 5
    expect(score).toBe(5);
  });

  it('3-5a: 全1 → 下限1', () => {
    const answers = makeAnswers({ T1: 1, T2: 1, T3: 1, T4: 1, T5: 1 });
    expect(calculateToleranceScore(answers)).toBe(1);
  });

  it('3-5b: 全7 → 上限7', () => {
    const answers = makeAnswers({ T1: 7, T2: 7, T3: 7, T4: 7, T5: 7 });
    expect(calculateToleranceScore(answers)).toBe(7);
  });
});

describe('calculateRiskSimpleResult', () => {
  it('3-6: balanced — capacity == tolerance', () => {
    // capacity=4, tolerance=4 → balanced
    const answers = makeAnswers({
      C1: 4, C2: 4, C3: 0, C4: 0, C5: 4, C6: 0, // rawCap=(4+4)/2+(4-1)*0.3=4+0.9=4.9 → 5
      T1: 5, T2: 5, T3: 5, T4: 5, T5: 5,          // avg=5
    });
    const result = calculateRiskSimpleResult(answers);
    expect(result.capacityScore).toBe(5);
    expect(result.toleranceScore).toBe(5);
    expect(result.gapType).toBe('balanced');
    expect(result.finalLevel).toBe(5);
  });

  it('3-7: capacity_higher — capacity > tolerance → finalLevel = tolerance', () => {
    const answers = makeAnswers({
      C1: 6, C2: 6, C3: 0, C4: 0, C5: 5, C6: 0,  // high capacity
      T1: 1, T2: 1, T3: 3, T4: 1, T5: 1,           // low tolerance → avg=1.4 → 1
    });
    const result = calculateRiskSimpleResult(answers);
    expect(result.capacityScore).toBeGreaterThan(result.toleranceScore);
    expect(result.gapType).toBe('capacity_higher');
    expect(result.finalLevel).toBe(result.toleranceScore);
  });

  it('3-8: tolerance_higher — tolerance > capacity → finalLevel = capacity', () => {
    const answers = makeAnswers({
      C1: 1, C2: 1, C3: -1, C4: -0.5, C5: 1, C6: -0.5, // low capacity
      T1: 7, T2: 7, T3: 7, T4: 7, T5: 7,                 // high tolerance → 7
    });
    const result = calculateRiskSimpleResult(answers);
    expect(result.toleranceScore).toBeGreaterThan(result.capacityScore);
    expect(result.gapType).toBe('tolerance_higher');
    expect(result.finalLevel).toBe(result.capacityScore);
  });
});

describe('getRiskLevelDef', () => {
  it('3-9: 境界値 — level 1→超保守型, level 7→超積極型', () => {
    expect(getRiskLevelDef(1).name).toBe('超保守型');
    expect(getRiskLevelDef(4).name).toBe('バランス型');
    expect(getRiskLevelDef(7).name).toBe('超積極型');
  });

  it('3-9b: 範囲外の値もクランプされる', () => {
    // level 0 → index clamp to 0 → level 1 def
    expect(getRiskLevelDef(0).level).toBe(1);
    // level 8 → index clamp to 6 → level 7 def
    expect(getRiskLevelDef(8).level).toBe(7);
  });
});
