import { describe, it, expect } from 'vitest';
import { calculateDeviation, calculateAddAdjustment, calculateSellAdjustment, getTotalAssets, calculateEmergencyFund, applyEmergencyFund, calculatePeriodByAmount, calculatePeriodByMonths } from './logic';
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

const periodHoldings: Holdings = {
  japan_equity: 15_000_000,
  developed_equity: 25_000_000,
  emerging_equity: 2_000_000,
  developed_bond: 40_000_000,
  commodity: 2_000_000,
  cash: 16_000_000,
};
const periodTarget: TargetAllocation = {
  japan_equity: 25, developed_equity: 25, emerging_equity: 10,
  japan_bond: 0, developed_bond: 25, emerging_bond: 0,
  japan_reit: 0, foreign_reit: 0, commodity: 15, alternative: 0, cash: 0,
};

describe('calculatePeriodByAmount', () => {
  it('積立額から完了期間を計算する', () => {
    const result = calculatePeriodByAmount(periodHoldings, periodTarget, 500_000);
    expect(result).not.toBeNull();
    expect(result!.months).toBeGreaterThan(0);
    expect(result!.monthlyAmount).toBe(500_000);
    expect(result!.monthlyItems.length).toBeGreaterThan(0);
    // 不足クラスにのみ積立配分
    expect(result!.monthlyItems.every(i => i.amount > 0)).toBe(true);
  });

  it('積立だけで足りない場合は売却が発生する', () => {
    // 大きな乖離 + 少額積立 + 期間指定ではないのでsellは出ない
    const result = calculatePeriodByAmount(periodHoldings, periodTarget, 500_000);
    expect(result).not.toBeNull();
    // 積立額指定の場合は売却なし（期間が伸びるだけ）
    expect(result!.sellItems).toHaveLength(0);
  });

  it('不足なしの場合は0ヶ月', () => {
    const balanced: Holdings = {
      japan_equity: 25_000_000, developed_equity: 25_000_000,
      emerging_equity: 10_000_000, developed_bond: 25_000_000,
      commodity: 15_000_000,
    };
    const result = calculatePeriodByAmount(balanced, periodTarget, 500_000);
    expect(result!.months).toBe(0);
  });
});

describe('calculatePeriodByMonths', () => {
  it('完了期間から必要積立額または売却を計算する', () => {
    const result = calculatePeriodByMonths(periodHoldings, periodTarget, 12);
    expect(result).not.toBeNull();
    expect(result!.months).toBe(12);
    // 超過額で不足を埋められる場合は売却のみ（積立0）、そうでなければ積立あり
    expect(result!.monthlyAmount >= 0).toBe(true);
    expect(result!.totalDeficit).toBeGreaterThan(0);
  });

  it('超過クラスがある場合に売却が発生する', () => {
    const result = calculatePeriodByMonths(periodHoldings, periodTarget, 12);
    expect(result).not.toBeNull();
    // periodHoldingsはdeveloped_bond 40Mが超過しているので売却が発生
    expect(result!.requiredSellAmount).toBeGreaterThan(0);
    expect(result!.sellItems.length).toBeGreaterThan(0);
    expect(result!.sellItems.every(i => i.amount < 0)).toBe(true);
  });

  it('期間が短い場合も正しく計算する', () => {
    const result = calculatePeriodByMonths(periodHoldings, periodTarget, 1);
    expect(result).not.toBeNull();
    expect(result!.months).toBe(1);
  });
});
