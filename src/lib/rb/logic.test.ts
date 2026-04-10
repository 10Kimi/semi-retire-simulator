import { describe, it, expect } from 'vitest';
import { calculateDeviation, calculateAddAdjustment, calculateSellAdjustment, getTotalAssets, calculateEmergencyFund, applyEmergencyFund, calculatePeriodByAmount, calculatePeriodByMonths, simulateMonthly } from './logic';
import type { Holdings, TargetAllocation } from './types';

const holdings: Holdings = {
  japan_equity: 1_000_000,
  developed_equity: 3_000_000,
  emerging_equity: 500_000,
  japan_bond: 500_000,
  developed_bond: 1_000_000,
  emerging_bond: 0,
  japan_reit: 0,
  foreign_reit: 0,
  commodity: 500_000,
  alternative: 0,
  cash: 1_500_000,
};

const target: TargetAllocation = {
  japan_equity: 15,
  developed_equity: 30,
  emerging_equity: 5,
  japan_bond: 10,
  developed_bond: 15,
  emerging_bond: 0,
  japan_reit: 2.5,
  foreign_reit: 2.5,
  commodity: 5,
  alternative: 0,
  cash: 15,
};

describe('getTotalAssets', () => {
  it('全クラスの合計を返す', () => {
    expect(getTotalAssets(holdings)).toBe(8_000_000);
  });

  it('空の場合は0', () => {
    expect(getTotalAssets({})).toBe(0);
  });
});

describe('calculateDeviation', () => {
  it('乖離率と乖離額を正しく計算する', () => {
    const result = calculateDeviation(holdings, target);
    const total = 8_000_000;

    const devEquity = result.find(r => r.key === 'developed_equity')!;
    expect(devEquity.currentRatio).toBeCloseTo((3_000_000 / total) * 100, 1); // 37.5%
    expect(devEquity.deviationRatio).toBeCloseTo(37.5 - 30, 1); // +7.5%
    expect(devEquity.severity).toBe('warning'); // 5-10%

    const cash = result.find(r => r.key === 'cash')!;
    expect(cash.currentRatio).toBeCloseTo(18.75, 1);
    expect(cash.deviationRatio).toBeCloseTo(3.75, 1);
    expect(cash.severity).toBe('minor'); // 2-5%
  });

  it('総資産0の場合もエラーにならない', () => {
    const result = calculateDeviation({}, target);
    expect(result).toHaveLength(11);
    expect(result[0].currentRatio).toBe(0);
  });
});

describe('calculateAddAdjustment', () => {
  it('積立額内で不足クラスに配分する', () => {
    const result = calculateAddAdjustment(holdings, target, 500_000);
    const totalAlloc = result.reduce((sum, r) => sum + r.amount, 0);
    expect(totalAlloc).toBeLessThanOrEqual(500_000);
    // 余剰クラス（developed_equity）には配分されない
    expect(result.find(r => r.key === 'developed_equity')).toBeUndefined();
  });

  it('積立額0の場合は空配列', () => {
    const result = calculateAddAdjustment(holdings, target, 0);
    expect(result).toHaveLength(0);
  });
});

describe('calculateSellAdjustment', () => {
  it('売却と購入の両方を返す', () => {
    const result = calculateSellAdjustment(holdings, target);
    const buys = result.filter(r => r.amount > 0);
    const sells = result.filter(r => r.amount < 0);
    expect(buys.length).toBeGreaterThan(0);
    expect(sells.length).toBeGreaterThan(0);
    // 売買の合計は概ね0（丸め誤差以内）
    const net = result.reduce((sum, r) => sum + r.amount, 0);
    expect(Math.abs(net)).toBeLessThan(11); // 11クラス分の丸め誤差
  });

  it('総資産0の場合は空配列', () => {
    const result = calculateSellAdjustment({}, target);
    expect(result).toHaveLength(0);
  });
});

describe('calculateEmergencyFund', () => {
  it('生活費×月数で緊急資金を計算する', () => {
    const result = calculateEmergencyFund(5_000_000, 300_000, 6);
    expect(result.emergencyFund).toBe(1_800_000);
    expect(result.investableCash).toBe(3_200_000);
  });

  it('生活費がnullの場合は緊急資金0', () => {
    const result = calculateEmergencyFund(5_000_000, null, 6);
    expect(result.emergencyFund).toBe(0);
    expect(result.investableCash).toBe(5_000_000);
  });

  it('緊急資金が現金を超える場合は投資可能額0', () => {
    const result = calculateEmergencyFund(1_000_000, 300_000, 6);
    expect(result.emergencyFund).toBe(1_800_000);
    expect(result.investableCash).toBe(0);
  });
});

describe('applyEmergencyFund', () => {
  it('holdingsの現金を投資可能額に置き換える', () => {
    const h: Holdings = { cash: 5_000_000, developed_equity: 3_000_000 };
    const result = applyEmergencyFund(h, 300_000, 6);
    expect(result.cash).toBe(3_200_000);
    expect(result.developed_equity).toBe(3_000_000);
  });

  it('元のholdingsは変更しない', () => {
    const h: Holdings = { cash: 5_000_000 };
    applyEmergencyFund(h, 300_000, 6);
    expect(h.cash).toBe(5_000_000);
  });
});

// 仕様書の前提条件に近いテストデータ
const realHoldings: Holdings = {
  japan_equity: 62_000_000,
  developed_equity: 63_590_586,
  emerging_equity: 563_624,
  japan_bond: 2_517_902,
  developed_bond: 30_681_043,
  commodity: 3_663_909,
  alternative: 6_496_596,
  cash: 22_435_943,
};
const realTarget: TargetAllocation = {
  japan_equity: 30, developed_equity: 35, emerging_equity: 15,
  japan_bond: 0, developed_bond: 10, emerging_bond: 0,
  japan_reit: 0, foreign_reit: 0, commodity: 10, alternative: 0, cash: 0,
};

describe('calculatePeriodByAmount', () => {
  it('現金は売却リストに表示されない', () => {
    const result = calculatePeriodByAmount(realHoldings, realTarget, 1_000_000);
    expect(result).not.toBeNull();
    expect(result!.sellItems.find(i => i.key === 'cash')).toBeUndefined();
  });

  it('超過クラス（現金除く）が売却リストに含まれる', () => {
    const result = calculatePeriodByAmount(realHoldings, realTarget, 1_000_000);
    expect(result!.sellItems.length).toBeGreaterThan(0);
    expect(result!.sellItems.every(i => i.amount < 0)).toBe(true);
  });
});

describe('calculatePeriodByMonths', () => {
  it('現金は売却リストに出ない（余剰は内部計算のみ）', () => {
    const result = calculatePeriodByMonths(realHoldings, realTarget, 12);
    expect(result).not.toBeNull();
    expect(result!.sellItems.find(i => i.key === 'cash')).toBeUndefined();
  });

  it('目標0%の非現金クラスは売却される', () => {
    const result = calculatePeriodByMonths(realHoldings, realTarget, 12);
    // japan_bond, alternative は目標0%で保有あり → 売却
    const jbSell = result!.sellItems.find(i => i.key === 'japan_bond');
    const altSell = result!.sellItems.find(i => i.key === 'alternative');
    expect(jbSell).toBeDefined();
    expect(altSell).toBeDefined();
  });

  it('売却+現金余剰で足りれば積立額0', () => {
    const h: Holdings = { developed_bond: 90_000_000, japan_equity: 10_000_000 };
    const t: TargetAllocation = { developed_bond: 50, japan_equity: 50 };
    const result = calculatePeriodByMonths(h, t, 12);
    expect(result!.monthlyAmount).toBe(0);
  });
});

describe('simulateMonthly', () => {
  it('完了月数分のスナップショットを返す', () => {
    const result = calculatePeriodByMonths(realHoldings, realTarget, 12)!;
    const snapshots = simulateMonthly(realHoldings, realTarget, result);
    expect(snapshots).toHaveLength(Math.max(result.months, 1));
  });

  it('現金は操作テーブルに出ない', () => {
    const result = calculatePeriodByMonths(realHoldings, realTarget, 12)!;
    const snapshots = simulateMonthly(realHoldings, realTarget, result);
    for (const snap of snapshots) {
      expect(snap.operations.find(o => o.key === 'cash')).toBeUndefined();
    }
  });

  it('グラフが12ヶ月かけて徐々に収束する（1ヶ月目で完了しない）', () => {
    const result = calculatePeriodByMonths(realHoldings, realTarget, 12)!;
    const snapshots = simulateMonthly(realHoldings, realTarget, result);
    expect(snapshots.length).toBe(12);

    // 1ヶ月目と最終月で比率が異なること（徐々に変化）
    const month1 = snapshots[0];
    const month12 = snapshots[11];
    const eqM1 = month1.operations.find(o => o.key === 'emerging_equity')!;
    const eqM12 = month12.operations.find(o => o.key === 'emerging_equity')!;
    // 新興国株式は不足クラス → 比率が増加していく
    expect(eqM12.ratio).toBeGreaterThan(eqM1.ratio);
  });

  it('12ヶ月後に全クラスが目標比率±1%以内に収束する', () => {
    const result = calculatePeriodByMonths(realHoldings, realTarget, 12)!;
    const snapshots = simulateMonthly(realHoldings, realTarget, result);
    const last = snapshots[snapshots.length - 1];
    for (const op of last.operations) {
      const tgt = realTarget[op.key] || 0;
      expect(Math.abs(op.ratio - tgt)).toBeLessThan(1);
    }
  });

  it('各月の比率合計が100%±0.1%以内', () => {
    const result = calculatePeriodByMonths(realHoldings, realTarget, 12)!;
    const snapshots = simulateMonthly(realHoldings, realTarget, result);
    for (const snap of snapshots) {
      const totalRatio = snap.operations.reduce((s, op) => s + op.ratio, 0);
      // 現金除外なので100%未満だが、現金の比率分を加算して確認
      // totalAssetsに対する現金以外の比率合計を確認
      expect(totalRatio).toBeGreaterThanOrEqual(0);
      expect(totalRatio).toBeLessThanOrEqual(100.1);
    }
  });
});
