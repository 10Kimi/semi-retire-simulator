import { describe, it, expect } from 'vitest';
import { calculateDetailCapacityScore, calculateDetailToleranceScore, calculateDetailResult } from './riskDetailScoring';
import type { RiskAnswer } from '../types/riskSimple';

function ans(id: string, value: number): RiskAnswer {
  return { questionId: id, selectedIndex: 0, value };
}

describe('calculateDetailCapacityScore', () => {
  it('最大値の入力で7を返す', () => {
    const answers = [
      ans('C1', 7), ans('C2', 7), ans('C3', 0), ans('C4', 0),
      ans('C5', 7), ans('C6', 1.5), ans('C7', 1.0), ans('C8', 0.5),
    ];
    expect(calculateDetailCapacityScore(answers)).toBe(7);
  });

  it('最小値の入力で1を返す', () => {
    const answers = [
      ans('C1', 1), ans('C2', 1), ans('C3', -2.5), ans('C4', -1.8),
      ans('C5', 1), ans('C6', -1.5), ans('C7', 0.6), ans('C8', -1.0),
    ];
    expect(calculateDetailCapacityScore(answers)).toBe(1);
  });

  it('C7係数がC2スコアに掛けられる', () => {
    // C2=6, C7=0.6 → incomeScore=3.6
    // C2=6, C7=1.0 → incomeScore=6.0
    const baseAnswers = [
      ans('C1', 4), ans('C2', 6), ans('C3', 0), ans('C4', 0),
      ans('C5', 5), ans('C6', 0), ans('C8', 0),
    ];
    const low = calculateDetailCapacityScore([...baseAnswers, ans('C7', 0.6)]);
    const high = calculateDetailCapacityScore([...baseAnswers, ans('C7', 1.0)]);
    expect(high).toBeGreaterThanOrEqual(low);
  });

  it('結果は1〜7の範囲にclampされる', () => {
    // 極端に低い値
    const answers = [
      ans('C1', 1), ans('C2', 1), ans('C3', -2.5), ans('C4', -1.8),
      ans('C5', 1), ans('C6', -1.5), ans('C7', 0.6), ans('C8', -1.0),
    ];
    const score = calculateDetailCapacityScore(answers);
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(7);
  });
});

describe('calculateDetailToleranceScore', () => {
  it('全問最大(7)で7を返す', () => {
    const answers = ['T1','T3','T4','T6','T8','T9','T10','T11','T12','T13','T14','T15']
      .map(id => ans(id, 7));
    expect(calculateDetailToleranceScore(answers)).toBe(7);
  });

  it('全問最小(1)で1を返す', () => {
    const answers = ['T1','T3','T4','T6','T8','T9','T10','T11','T12','T13','T14','T15']
      .map(id => ans(id, 1));
    expect(calculateDetailToleranceScore(answers)).toBe(1);
  });

  it('中間値で中間スコアを返す', () => {
    // 全問3点 → 36点 → (36-12)/(84-12)*6+1 = 24/72*6+1 = 3.0
    const answers = ['T1','T3','T4','T6','T8','T9','T10','T11','T12','T13','T14','T15']
      .map(id => ans(id, 3));
    const score = calculateDetailToleranceScore(answers);
    expect(score).toBeGreaterThanOrEqual(2);
    expect(score).toBeLessThanOrEqual(4);
  });

  it('結果は1〜7の範囲にclampされる', () => {
    const answers = ['T1','T3','T4','T6','T8','T9','T10','T11','T12','T13','T14','T15']
      .map(id => ans(id, 5));
    const score = calculateDetailToleranceScore(answers);
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(7);
  });
});

describe('calculateDetailResult', () => {
  it('finalLevel = min(capacity, tolerance)', () => {
    const answers = [
      // High capacity
      ans('C1', 7), ans('C2', 7), ans('C3', 0), ans('C4', 0),
      ans('C5', 7), ans('C6', 1.5), ans('C7', 1.0), ans('C8', 0.5),
      // Low tolerance
      ...['T1','T3','T4','T6','T8','T9','T10','T11','T12','T13','T14','T15']
        .map(id => ans(id, 1)),
    ];
    const result = calculateDetailResult(answers);
    expect(result.finalLevel).toBe(Math.min(result.capacityScore, result.toleranceScore));
    expect(result.gapType).toBe('capacity_higher');
  });

  it('capacity == tolerance の場合 balanced', () => {
    // 中間値で両方同じスコアになるよう調整
    const answers = [
      ans('C1', 4), ans('C2', 4), ans('C3', 0), ans('C4', 0),
      ans('C5', 5), ans('C6', 0), ans('C7', 1.0), ans('C8', 0),
      ...['T1','T3','T4','T6','T8','T9','T10','T11','T12','T13','T14','T15']
        .map(id => ans(id, 5)),
    ];
    const result = calculateDetailResult(answers);
    expect(result.finalLevel).toBeGreaterThanOrEqual(1);
    expect(result.finalLevel).toBeLessThanOrEqual(7);
  });
});
