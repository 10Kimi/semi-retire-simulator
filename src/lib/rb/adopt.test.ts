import { describe, it, expect } from 'vitest';
import { ASSET_CLASSES } from './types';
import { isCompleteTarget, percentsFromAmounts } from './adopt';

const sum = (t: Record<string, number>) => ASSET_CLASSES.reduce((s, ac) => s + (t[ac.key] ?? 0), 0);

describe('percentsFromAmounts（/portfolio の採用、D-099）', () => {
  it('3等分のように割り切れなくても、合計をちょうど100%にする', () => {
    const t = percentsFromAmounts({ cash: 100, japan_equity: 100, us_equity: 100 })!;
    expect(Math.abs(sum(t) - 100)).toBeLessThan(1e-9);
    expect(isCompleteTarget(t)).toBe(true);
  });
  it('割合は0.1%単位', () => {
    const t = percentsFromAmounts({ cash: 1, us_equity: 2 })!;
    ASSET_CLASSES.forEach(ac => expect(Math.round(t[ac.key] * 10)).toBeCloseTo(t[ac.key] * 10, 9));
  });
  it('マイナスの金額は0として扱い、マイナスの割合を出さない', () => {
    const t = percentsFromAmounts({ us_equity: 1, japan_bond: -1, gold: 4 })!;
    expect(t.japan_bond).toBe(0);
    expect(t.us_equity).toBe(20);
    expect(t.gold).toBe(80);
  });
  it('金額が全部0なら null', () => {
    expect(percentsFromAmounts({})).toBeNull();
  });
});

describe('isCompleteTarget', () => {
  it('合計100%なら採用済みの配分として使う', () => {
    expect(isCompleteTarget({ us_equity: 60, cash: 40 })).toBe(true);
  });
  it('空・合計が100%でないものは使わない（モデル配分から始める）', () => {
    expect(isCompleteTarget(null)).toBe(false);
    expect(isCompleteTarget({})).toBe(false);
    expect(isCompleteTarget({ us_equity: 50 })).toBe(false);
  });
});
