import { describe, it, expect, vi, afterEach } from 'vitest';
import { runMonteCarlo } from './monteCarlo';

// ボラ0なら乱数に依らず決まる（#12 ステップ1）
describe('runMonteCarlo（ボラ0）', () => {
  it('MC1: 初期1000・積立5・10年・5% → 2421', () => {
    const r = runMonteCarlo(1000, 5, 10, 5, 0, 1000);
    expect(r.median).toBe(2421);
    expect(r.percentile25).toBe(2421);
    expect(r.percentile75).toBe(2421);
    expect(r.histogram).toHaveLength(20);
    expect(r.histogram.slice(0, 3)).toEqual([
      { bin: 2421, count: 1000 }, { bin: 2422, count: 0 }, { bin: 2423, count: 0 },
    ]);
    expect(r.histogram[19]).toEqual({ bin: 2440, count: 0 });
  });

  it('MC2: 初期0・積立0 → すべて0', () => {
    const r = runMonteCarlo(0, 0, 10, 5, 0);
    expect([r.median, r.percentile25, r.percentile75]).toEqual([0, 0, 0]);
    expect(r.histogram[0]).toEqual({ bin: 0, count: 1000 });
  });

  it('MC3: 0年 → 初期資産のまま', () => {
    const r = runMonteCarlo(1000, 0, 0, 5, 0);
    expect([r.median, r.percentile25, r.percentile75]).toEqual([1000, 1000, 1000]);
    expect(r.histogram[0]).toEqual({ bin: 1000, count: 1000 });
  });

  it('MC4: リターン −150% → 最終値は0で下止まり', () => {
    const r = runMonteCarlo(1000, 10, 5, -150, 0);
    expect([r.median, r.percentile25, r.percentile75]).toEqual([0, 0, 0]);
    expect(r.histogram[0]).toEqual({ bin: 0, count: 1000 });
  });

  it('MC5: 初期2345・積立3・7年・3.3%・試行10 → 3231', () => {
    const r = runMonteCarlo(2345, 3, 7, 3.3, 0, 10);
    expect([r.median, r.percentile25, r.percentile75]).toEqual([3231, 3231, 3231]);
    expect(r.histogram.slice(0, 2)).toEqual([{ bin: 3231, count: 10 }, { bin: 3232, count: 0 }]);
  });
});

describe('runMonteCarlo（ボラ>0・乱数固定）', () => {
  afterEach(() => vi.restoreAllMocks());

  // 決まった乱数列（線形合同法）。(0,1) の値だけを返す
  const fixRandom = () => {
    let s = 12345;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return (s + 1) / 2147483650;
    });
  };

  it('同じ乱数列なら結果が再現し、ヒストグラムの合計は試行回数', () => {
    fixRandom();
    const a = runMonteCarlo(1000, 5, 10, 5, 15, 500);
    vi.restoreAllMocks();
    fixRandom();
    const b = runMonteCarlo(1000, 5, 10, 5, 15, 500);

    expect(b).toEqual(a);
    expect(a.histogram).toHaveLength(20);
    expect(a.histogram.reduce((s, h) => s + h.count, 0)).toBe(500);
    expect(a.percentile25).toBeLessThanOrEqual(a.median);
    expect(a.median).toBeLessThanOrEqual(a.percentile75);
    expect(a.percentile25).toBeLessThan(a.percentile75); // ボラ>0 なのでばらつく
    // 値そのものも固定（式が変わったら落ちる）
    expect([a.median, a.percentile25, a.percentile75]).toEqual([2356, 1707, 2999]);
    expect(a.histogram.slice(0, 4)).toEqual([
      { bin: 548, count: 13 }, { bin: 972, count: 54 }, { bin: 1396, count: 87 }, { bin: 1820, count: 72 },
    ]);
  });
});
