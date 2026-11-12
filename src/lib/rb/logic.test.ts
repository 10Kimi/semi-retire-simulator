import { describe, it, expect } from 'vitest';
import { calculateDeviation, calculateAddAdjustment, calculateSellAdjustment, getTotalAssets, calculateEmergencyFund, applyEmergencyFund, calculatePeriodByMonths, calculatePeriod, simulateMonthly, isOverThreshold, countOverThreshold, estimateMonthsToRebalance, isOverOneYear, isOverTenYears, formatUnreachable, periodSellRows, formatPeriodSellRow } from './logic';
import type { DeviationItem } from './types';
import type { Holdings, TargetAllocation } from './types';

const holdings: Holdings = {
  japan_equity: 1_000_000,
  us_equity: 1_000_000,
  developed_equity: 2_000_000,
  emerging_equity: 500_000,
  japan_bond: 500_000,
  developed_bond: 1_000_000,
  gold: 500_000,
  cash: 1_500_000,
};

const target: TargetAllocation = {
  japan_equity: 15,
  us_equity: 20,
  developed_equity: 10,
  emerging_equity: 5,
  japan_bond: 10,
  developed_bond: 15,
  gold: 10,
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
    const total = getTotalAssets(holdings);

    const usEquity = result.find(r => r.key === 'us_equity')!;
    const usRatio = (1_000_000 / total) * 100;
    expect(usEquity.currentRatio).toBeCloseTo(usRatio, 1);
    expect(usEquity.deviationRatio).toBeCloseTo(usRatio - 20, 1);

    const cash = result.find(r => r.key === 'cash')!;
    const cashRatio = (1_500_000 / total) * 100;
    expect(cash.currentRatio).toBeCloseTo(cashRatio, 1);
  });

  it('総資産0の場合もエラーにならない', () => {
    const result = calculateDeviation({}, target);
    expect(result).toHaveLength(13);
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
  us_equity: 50_000_000,
  developed_equity: 13_590_586,
  emerging_equity: 563_624,
  japan_bond: 2_517_902,
  developed_bond: 30_681_043,
  gold: 3_663_909,
  commodity: 6_496_596,
  cash: 22_435_943,
};
const realTarget: TargetAllocation = {
  japan_equity: 30, us_equity: 35, emerging_equity: 15,
  developed_bond: 10, gold: 10,
};

describe('calculatePeriodByMonths', () => {
  it('現金は売却リストに出ない（余剰は内部計算のみ）', () => {
    const result = calculatePeriodByMonths(realHoldings, realTarget, 12);
    expect(result).not.toBeNull();
    expect(result!.sellItems.find(i => i.key === 'cash')).toBeUndefined();
  });

  it('目標0%の非現金クラスは売却される', () => {
    const result = calculatePeriodByMonths(realHoldings, realTarget, 12);
    // japan_bond, commodity は目標0%で保有あり → 売却
    const jbSell = result!.sellItems.find(i => i.key === 'japan_bond');
    const comSell = result!.sellItems.find(i => i.key === 'commodity');
    expect(jbSell).toBeDefined();
    expect(comSell).toBeDefined();
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

describe('isOverThreshold / countOverThreshold', () => {
  it('目安「以上」を判定する（誤差で少し下回る値も含む）', () => {
    expect(isOverThreshold(4.99, 5)).toBe(false);
    expect(isOverThreshold(5, 5)).toBe(true);
    expect(isOverThreshold(-5, 5)).toBe(true);
    expect(isOverThreshold(5.0000000001, 5)).toBe(true);
    expect(isOverThreshold(4.99999999999, 5)).toBe(true);
    expect(isOverThreshold(9.99, 10)).toBe(false);
    expect(isOverThreshold(10, 10)).toBe(true);
  });

  it('目安以上の資産クラスを数える', () => {
    const items = [1.2, -4.99, 5, -7.3, 10.4].map(d => ({ deviationRatio: d }) as DeviationItem);
    expect(countOverThreshold(items, 5)).toBe(3);
    expect(countOverThreshold(items, 10)).toBe(1);
    expect(countOverThreshold([], 5)).toBe(0);
  });
});

describe('calculatePeriod（期間指定・積立あり）', () => {
  const h: Holdings = { cash: 3_456_789, japan_equity: 2_100_000, us_equity: 7_350_000, developed_bond: 1_234_567, japan_bond: 980_000, gold: 50_000 };
  const t: TargetAllocation = { cash: 10, us_equity: 40, emerging_equity: 15, developed_bond: 25, gold: 10 };
  const T = 15_171_356;

  it('months<=0 なら null、M が負なら0扱い', () => {
    expect(calculatePeriod(h, t, 0, 100_000)).toBeNull();
    const r = calculatePeriod(h, t, 12, -50_000)!;
    expect(r.monthlyAmount).toBe(0);
    expect(r.endTotal).toBe(T);
  });

  it('回帰：M＝0 は変更前の calculatePeriodByMonths と同じ', () => {
    const r = calculatePeriod(h, t, 12, 0)!;
    expect(r.sellItems.map(i => i.key)).toEqual(['japan_equity', 'us_equity', 'japan_bond']);
    expect(r.sellItems[0].amount).toBe(-2_100_000);
    expect(Math.abs(r.sellItems[1].amount - -1_281_458)).toBeLessThanOrEqual(1);
    expect(r.sellItems[2].amount).toBe(-980_000);
    expect(r.requiredSellAmount).toBeCloseTo(4_361_457.6, 0);
    expect(r.cashSurplus).toBeCloseTo(1_939_653.4, 0);
    expect(Math.abs(r.totalDeficit - 6_301_111)).toBeLessThanOrEqual(1);
    // 薄い呼び出しも同じ
    expect(calculatePeriodByMonths(h, t, 12)).toEqual(r);
  });

  it.each([0, 123_457, 5_000_000])('毎月の恒等式 M=%i：買い＋現金に残す ≒ 売却充当＋取り崩し＋M', M => {
    const r = calculatePeriod(h, t, 12, M)!;
    const buys = r.monthlyItems.reduce((s, i) => s + i.amount, 0);
    const lhs = buys + r.monthlyCashDeposit;
    const rhs = r.monthlySellContribution + r.monthlyCashContribution + M;
    expect(Math.abs(lhs - rhs)).toBeLessThanOrEqual(5);
    expect(r.monthlyTotal).toBe(rhs);
    expect(r.endTotal).toBe(T + M * 12);
  });

  it.each([0, 123_457])('N か月で (T+M×N)×目標配分 に着く M=%i', M => {
    const r = calculatePeriod(h, t, 12, M)!;
    const snaps = simulateMonthly(h, t, r);
    expect(snaps).toHaveLength(12);
    const last = snaps[11];
    expect(Math.abs(last.totalAssets - (T + M * 12))).toBeLessThanOrEqual(1);
    for (const op of last.operations) {
      expect(Math.abs(op.ratio - (t[op.key] || 0))).toBeLessThanOrEqual(0.1);
    }
    // 毎月の総資産は T + k×M
    expect(Math.abs(snaps[0].totalAssets - (T + M))).toBeLessThanOrEqual(1);
  });

  it('M を増やすと売却総額は増えない', () => {
    const sells = [0, 100_000, 500_000, 2_000_000].map(M => calculatePeriod(h, t, 12, M)!.requiredSellAmount);
    for (let i = 1; i < sells.length; i++) {
      expect(sells[i]).toBeLessThanOrEqual(sells[i - 1] + 1e-6);
    }
    expect(sells[3]).toBeLessThan(sells[0]);
  });

  it('M が十分大きいと売却なし（目標0%の保有がない場合）', () => {
    // 上の h は日本株・日本債券が目標0%なので、M をいくら増やしても売却は残る。目標>0% の保有だけで確かめる
    const h2: Holdings = { cash: 3_456_789, us_equity: 7_350_000, developed_bond: 1_234_567, gold: 50_000 };
    const r = calculatePeriod(h2, t, 12, 50_000_000)!;
    expect(r.requiredSellAmount).toBe(0);
    expect(r.sellItems).toHaveLength(0);
    expect(r.cashSurplus).toBe(0);
  });

  it('架空の例：積立を不足へ回し、足りない分だけ売る', () => {
    // T = 4,567,890、M = 87,654、N = 6 → E = 5,093,814
    const h3: Holdings = { cash: 345_678, us_equity: 2_987_654, emerging_equity: 1_234_558 };
    const t3: TargetAllocation = { cash: 5, us_equity: 55, emerging_equity: 40 };
    const r = calculatePeriod(h3, t3, 6, 87_654)!;
    expect(r.endTotal).toBe(5_093_814);
    // 米国株の目標 2,801,597.7 → 売却 186,056.3、新興国株の目標 2,037,525.6 → 買い 802,967.6
    // 現金の目標 254,690.7 → 取り崩し 90,987.3
    expect(r.requiredSellAmount).toBeCloseTo(186_056.3, 1);
    expect(r.totalDeficit).toBeCloseTo(802_967.6, 1);
    expect(r.cashSurplus).toBeCloseTo(90_987.3, 1);
    expect(r.cashDeposit).toBe(0);
    expect(r.monthlySellContribution).toBe(31_009);
    expect(r.monthlyCashContribution).toBe(15_165);
    expect(r.monthlyItems).toEqual([{ key: 'emerging_equity', label: 'エマージング株', amount: 133_828 }]);
    expect(r.monthlyTotal).toBe(31_009 + 15_165 + 87_654);
  });
});

describe('estimateMonthsToRebalance（積立のみ・売らずに戻る月数、#76）', () => {
  it('保有0なら1ヶ月（今月の積立を目標配分どおりに買う）', () => {
    const t: TargetAllocation = { us_equity: 70, developed_bond: 30 };
    expect(estimateMonthsToRebalance({}, t, 123_457)).toBe(1);
    const r = calculatePeriod({}, t, 1, 123_457)!;
    expect(r.requiredSellAmount).toBe(0);
    const buy = r.monthlyItems.reduce((a, i) => a + i.amount, 0);
    expect(Math.abs(buy - 123_457)).toBeLessThanOrEqual(2);
  });

  const sumBuys = (items: { amount: number }[]) => items.reduce((s, i) => s + i.amount, 0);

  it('例：米国株100万、目標 米国株50・先進国債券50、M=10万 → 10ヶ月、売却0、毎月 先進国債券に10万', () => {
    const h: Holdings = { us_equity: 1_000_000 };
    const t: TargetAllocation = { us_equity: 50, developed_bond: 50 };
    expect(estimateMonthsToRebalance(h, t, 100_000)).toBe(10);
    const r = calculatePeriod(h, t, 10, 100_000)!;
    expect(r.requiredSellAmount).toBe(0);
    expect(r.sellItems).toHaveLength(0);
    expect(r.monthlyItems).toEqual([{ key: 'developed_bond', label: '先進国債券', amount: 100_000 }]);
    // 9ヶ月なら米国株を売ることになる
    expect(calculatePeriod(h, t, 9, 100_000)!.requiredSellAmount).toBeGreaterThan(0);
  });

  it('M≤0 なら出さない', () => {
    expect(estimateMonthsToRebalance({ us_equity: 1_000_000 }, { developed_bond: 100 }, 0)).toBeNull();
  });

  it('現金以外で目標0%なのに保有がある → 積立だけでは戻らない（名前を返す）', () => {
    const h: Holdings = { us_equity: 500_000, gold: 123_456, japan_reit: 1 };
    const t: TargetAllocation = { us_equity: 100 };
    expect(estimateMonthsToRebalance(h, t, 100_000)).toEqual({ unreachable: [{ label: '日本REIT', amount: 1 }, { label: '金', amount: 123_456 }] });
  });

  it('現金だけが目標0%で保有あり → 月数が出る（現金は縛らない）', () => {
    const h: Holdings = { cash: 200_000, us_equity: 800_000 };
    const t: TargetAllocation = { us_equity: 100 };
    expect(estimateMonthsToRebalance(h, t, 50_000)).toBe(1);
    const r = calculatePeriod(h, t, 1, 50_000)!;
    expect(r.requiredSellAmount).toBe(0);
    expect(r.monthlyCashContribution).toBe(200_000);
    expect(r.monthlyItems).toEqual([{ key: 'us_equity', label: '米国株', amount: 250_000 }]);
  });

  it('すでに目標どおり → 0', () => {
    const h: Holdings = { us_equity: 600_000, developed_bond: 400_000 };
    expect(estimateMonthsToRebalance(h, { us_equity: 60, developed_bond: 40 }, 100_000)).toBe(0);
  });

  it('最小性（架空の例）：超過2クラス・現金の余りあり → 32ヶ月。31ヶ月では売却>0、32ヶ月では0', () => {
    // T = 6,000,097、M = 87,654
    // 米国株：3,456,789/0.4 − T = 2,641,875.5 → ÷M = 30.14 → 31
    // 日本株：  876,543/0.1 − T = 2,765,333   → ÷M = 31.55 → 32
    const h: Holdings = { cash: 1_234_567, us_equity: 3_456_789, japan_equity: 876_543, developed_bond: 432_198 };
    const t: TargetAllocation = { cash: 5, us_equity: 40, japan_equity: 10, developed_bond: 45 };
    const M = 87_654;
    expect(estimateMonthsToRebalance(h, t, M)).toBe(32);

    const before = calculatePeriod(h, t, 31, M)!;
    expect(before.requiredSellAmount).toBeGreaterThan(0);
    expect(before.sellItems.map(i => i.key)).toEqual(['japan_equity']);

    const r = calculatePeriod(h, t, 32, M)!;
    expect(r.endTotal).toBe(8_805_025);
    expect(r.requiredSellAmount).toBe(0);
    expect(r.sellItems).toHaveLength(0);
    // 目標：現金 440,251.25、米国株 3,522,010、日本株 880,502.5、先進国債券 3,962,261.25
    // 取り崩し 794,315.75 ÷32 = 24,822.4、買い 先進国債券 3,530,063.25 ÷32 = 110,314.5、米国株 65,221 ÷32 = 2,038.2、日本株 3,959.5 ÷32 = 123.7
    expect(r.monthlyCashContribution).toBe(24_822);
    expect(r.monthlyCashDeposit).toBe(0);
    expect(r.monthlyItems).toEqual([
      { key: 'developed_bond', label: '先進国債券', amount: 110_314 },
      { key: 'us_equity', label: '米国株', amount: 2_038 },
      { key: 'japan_equity', label: '日本株', amount: 124 },
    ]);
    expect(Math.abs(sumBuys(r.monthlyItems) + r.monthlyCashDeposit - (M + r.monthlyCashContribution))).toBeLessThanOrEqual(3);
  });

  it('超過クラスが無く現金の余りだけ → 1', () => {
    // T = 1,012,345、E = 1,066,666。米国株の目標 959,999.4 → 買い 259,999.4、現金の目標 106,666.6 → 取り崩し 205,678.4
    const h: Holdings = { cash: 312_345, us_equity: 700_000 };
    const t: TargetAllocation = { cash: 10, us_equity: 90 };
    expect(estimateMonthsToRebalance(h, t, 54_321)).toBe(1);
    const r = calculatePeriod(h, t, 1, 54_321)!;
    expect(r.requiredSellAmount).toBe(0);
    expect(r.monthlyCashContribution).toBe(205_678);
    expect(r.monthlyItems).toEqual([{ key: 'us_equity', label: '米国株', amount: 259_999 }]);
  });

  it('毎月の恒等式：買いの合計＋現金のまま置く＝M＋取り崩し（現金のまま置くがある例）', () => {
    // 1,000,000/0.8 − 1,000,000 = 250,000 → ÷123,457 = 2.03 → 3。E = 1,370,371
    // 現金の目標 274,074.2 → 毎月 91,358.1 置く、米国株の目標 1,096,296.8 → 毎月 32,098.9 買う
    const h: Holdings = { us_equity: 1_000_000 };
    const t: TargetAllocation = { cash: 20, us_equity: 80 };
    const M = 123_457;
    expect(estimateMonthsToRebalance(h, t, M)).toBe(3);
    const r = calculatePeriod(h, t, 3, M)!;
    expect(r.requiredSellAmount).toBe(0);
    expect(r.monthlyCashDeposit).toBe(91_358);
    expect(r.monthlyItems).toEqual([{ key: 'us_equity', label: '米国株', amount: 32_099 }]);
    expect(Math.abs(sumBuys(r.monthlyItems) + r.monthlyCashDeposit - (M + r.monthlyCashContribution))).toBeLessThanOrEqual(3);
  });
});

describe('表示（#76 の差し戻し）', () => {
  it('期間指定：売却の行の総額は calculatePeriod の売却総額（丸める前）と一致', () => {
    const h: Holdings = { cash: 3_456_789, japan_equity: 2_100_000, us_equity: 7_350_000, developed_bond: 1_234_567, japan_bond: 980_000, gold: 50_000 };
    const t: TargetAllocation = { cash: 10, us_equity: 40, emerging_equity: 15, developed_bond: 25, gold: 10 };
    const r = calculatePeriod(h, t, 3, 123_457)!;
    const rows = periodSellRows(r);
    expect(rows.map(x => x.key).sort()).toEqual(Object.keys(r.sellTotals).sort());
    for (const row of rows) {
      expect(row.total).toBe(-r.sellTotals[row.key]!);
      expect(row.monthly * 3).toBeCloseTo(row.total, 6);
      expect(Math.abs(row.total + Math.abs(r.sellItems.find(i => i.key === row.key)!.amount))).toBeLessThanOrEqual(0.5);
    }
    const sum = rows.reduce((a, x) => a - x.total, 0);
    expect(sum).toBeCloseTo(r.requiredSellAmount, 6);
    expect(formatPeriodSellRow({ monthly: -341_712.4, total: -1_025_137.2 }, 3)).toBe('毎月 -¥342,000（3ヶ月で計 -¥1,025,000）');
  });

  it('積立のみ：1年超の注意は12ヶ月では出ず13ヶ月で出る、120ヶ月を超えたら10年超', () => {
    expect(isOverOneYear(12)).toBe(false);
    expect(isOverOneYear(13)).toBe(true);
    expect(isOverTenYears(120)).toBe(false);
    expect(isOverTenYears(121)).toBe(true);
  });

  it('積立のみ：戻らないときの文言に金額が入る', () => {
    const h: Holdings = { us_equity: 500_000, gold: 123, japan_reit: 1 };
    const t: TargetAllocation = { us_equity: 100 };
    const m = estimateMonthsToRebalance(h, t, 100_000);
    expect(typeof m).toBe('object');
    expect(formatUnreachable((m as { unreachable: { label: string; amount: number }[] }).unreachable)).toBe('日本REIT 1円、金 123円');
  });
});
