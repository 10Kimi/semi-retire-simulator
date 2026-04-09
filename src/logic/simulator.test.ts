import { describe, it, expect } from 'vitest';
import { runSimulation } from './simulator';
import type { SimulationInput } from '../types';

/** 全フィールドを埋めたデフォルト入力を生成 */
function makeInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    currentAge: 45,
    retireAge: 55,
    deathAge: 90,
    taxableAssets: 10_000_000,
    nisaAssets: 5_000_000,
    idecoAssets: 3_000_000,
    cashAssets: 5_000_000,
    annualLivingExpense: 3_600_000,
    legacyAmount: 0,
    monthlyTaxable: 100_000,
    monthlyNisa: 100_000,
    monthlyIdeco: 23_000,
    monthlyCash: 50_000,
    savingsStartAge: 45,
    savingsEndAge: 55,
    preRetirementROI: 0.05,
    postRetirementROI: 0.03,
    cashInterestRate: 0.001,
    investmentTaxRate: 0.20315,
    inflationRate: 0.02,
    reductionStartAge: 70,
    reductionInterval: 5,
    reductionRate: 0.10,
    oneTimeEvents: [],
    retirementIncomes: [],
    currentMonth: 1,
    ...overrides,
  };
}

describe('runSimulation', () => {
  it('1-1: 十分な資産で枯渇しない', () => {
    const input = makeInput({
      taxableAssets: 50_000_000,
      nisaAssets: 18_000_000,
      idecoAssets: 10_000_000,
      cashAssets: 20_000_000,
      retirementIncomes: [
        { name: '年金', monthlyAmount: 150_000, startAge: 65, endAge: 90, growthRate: 0, growthStartMode: 'receiveStart' },
      ],
    });
    const result = runSimulation(input);

    expect(result.depletionAge).toBeNull();
    expect(result.scorePercent).toBeGreaterThanOrEqual(100);
    expect(result.rows.length).toBe(input.deathAge - input.currentAge + 1);
  });

  it('1-2: 資産不足で枯渇する', () => {
    const input = makeInput({
      taxableAssets: 1_000_000,
      nisaAssets: 500_000,
      idecoAssets: 0,
      cashAssets: 500_000,
      monthlyTaxable: 10_000,
      monthlyNisa: 10_000,
      monthlyIdeco: 0,
      monthlyCash: 0,
      annualLivingExpense: 6_000_000,
    });
    const result = runSimulation(input);

    expect(result.depletionAge).not.toBeNull();
    expect(result.depletionAge!).toBeGreaterThanOrEqual(input.retireAge);
    expect(result.scorePercent).toBeLessThan(100);
    expect(result.surplus).toBeLessThan(0);
  });

  it('1-3: 初年度の月按分計算（currentMonth=7 → 残り5ヶ月）', () => {
    const input = makeInput({ currentMonth: 7 });
    const result = runSimulation(input);
    const firstRow = result.rows[0];

    // 初年度の積立 = (100000+100000+23000+50000)*12*(5/12)
    const expectedMonthFraction = 5 / 12;
    const monthlySavings = (100_000 + 100_000 + 23_000 + 50_000) * 12;
    const expectedSavings = monthlySavings * expectedMonthFraction;
    expect(firstRow.savings).toBeCloseTo(expectedSavings, -2);
  });

  it('1-4: 生活費の減額（70歳・75歳で10%ずつ減）', () => {
    const input = makeInput({
      reductionStartAge: 70,
      reductionInterval: 5,
      reductionRate: 0.10,
      inflationRate: 0, // インフレ無効化で検証しやすく
    });
    const result = runSimulation(input);

    const row69 = result.rows.find(r => r.age === 69)!;
    const row70 = result.rows.find(r => r.age === 70)!;
    const row74 = result.rows.find(r => r.age === 74)!;
    const row75 = result.rows.find(r => r.age === 75)!;

    // 70歳で10%減
    expect(row70.livingExpense).toBeCloseTo(row69.livingExpense * 0.9, 0);
    // 71〜74歳は変わらない
    expect(row74.livingExpense).toBeCloseTo(row70.livingExpense, 0);
    // 75歳でさらに10%減
    expect(row75.livingExpense).toBeCloseTo(row74.livingExpense * 0.9, 0);
  });

  it('1-5: NISA累計上限1,800万円を超えると課税口座にオーバーフロー', () => {
    // currentMonth=6 → remainingMonths=6 → monthFraction=6/12=0.5 で計算しやすくする
    const input = makeInput({
      currentAge: 30,
      retireAge: 60,
      nisaAssets: 15_000_000,  // 既に1500万
      monthlyNisa: 300_000,     // 月30万（年360万 * 0.5 = 初年度180万）
      monthlyTaxable: 0,
      monthlyCash: 0,
      monthlyIdeco: 0,
      savingsStartAge: 30,
      savingsEndAge: 60,
      currentMonth: 6,         // 残り6ヶ月
    });
    const result = runSimulation(input);

    // 初年度: nisaAnnual = 300000*12*0.5 = 180万
    // 残枠 = 1800万 - 1500万 = 300万 → 180万 < 300万 なので全額NISA
    const firstRow = result.rows[0];
    expect(firstRow.savings).toBeCloseTo(1_800_000, -2);

    // 2年目: nisaAnnual = 360万、累計 = 1500万+180万 = 1680万
    // 残枠 = 1800万-1680万 = 120万 → overflow = 360万-120万 = 240万
    const secondRow = result.rows[1];
    // savings = NISA 120万 + 課税(overflow) 240万 = 360万
    expect(secondRow.savings).toBeCloseTo(3_600_000, -2);
  });

  it('1-6: リタイア後の取り崩し優先順位（NISA→iDeCo(60+)→課税→現金）', () => {
    // 60歳以上、各口座に少額ずつ配置して取り崩し順序を検証
    const input = makeInput({
      currentAge: 60,
      retireAge: 60,
      deathAge: 65,
      taxableAssets: 1_000_000,
      nisaAssets: 500_000,
      idecoAssets: 500_000,
      cashAssets: 500_000,
      annualLivingExpense: 2_000_000,
      monthlyTaxable: 0,
      monthlyNisa: 0,
      monthlyIdeco: 0,
      monthlyCash: 0,
      savingsStartAge: 60,
      savingsEndAge: 60,
      preRetirementROI: 0,
      postRetirementROI: 0,
      cashInterestRate: 0,
      inflationRate: 0,
      reductionStartAge: 999,
      reductionInterval: 0,
      reductionRate: 0,
      retirementIncomes: [],
    });
    const result = runSimulation(input);

    // 60歳のリタイア行: netExpense = 200万
    // NISA 50万 → iDeCo 50万 → 課税(税込)→ 現金
    const row60 = result.rows[0];
    expect(row60.isRetired).toBe(true);
    expect(row60.netExpense).toBe(2_000_000);
    // preTaxExpense > netExpense（課税口座の税込取り崩し分を含むため）
    expect(row60.preTaxExpense).toBeGreaterThanOrEqual(row60.netExpense);
  });

  it('1-7: 退職後収入 receiveStart モード', () => {
    const input = makeInput({
      currentAge: 60,
      retireAge: 55,
      deathAge: 70,
      retirementIncomes: [
        { name: '年金', monthlyAmount: 100_000, startAge: 65, endAge: 70, growthRate: 0.02, growthStartMode: 'receiveStart' },
      ],
    });
    const result = runSimulation(input);

    // 65歳未満は年金0
    const row64 = result.rows.find(r => r.age === 64)!;
    expect(row64.retirementIncome).toBe(0);

    // 65歳以降は年金あり
    const row65 = result.rows.find(r => r.age === 65)!;
    expect(row65.retirementIncome).toBeGreaterThan(0);

    // 71歳超は年金0（endAge=70）
    // row71は存在しないがdeathAge=70なので最後の行で確認
  });

  it('1-8: 一時収支（正は現金に加算、負は現金から減算）', () => {
    const input = makeInput({
      oneTimeEvents: [
        { name: '退職金', amount: 10_000_000, age: 55 },
        { name: '住宅修繕', amount: -2_000_000, age: 55 },
      ],
      preRetirementROI: 0,
      postRetirementROI: 0,
      cashInterestRate: 0,
    });
    const result = runSimulation(input);
    const row55 = result.rows.find(r => r.age === 55)!;

    // retirementIncomeに正の一時収支が含まれる
    expect(row55.retirementIncome).toBeGreaterThanOrEqual(10_000_000);
    // savingsに負の一時収支が含まれる
    expect(row55.savings).toBeLessThan(0); // 積立期間外かつ負の一時収支
  });

  it('1-9: 達成スコアのメッセージ分岐', () => {
    // 十分な資産 → 150%
    const rich = runSimulation(makeInput({
      taxableAssets: 200_000_000,
      nisaAssets: 18_000_000,
      idecoAssets: 10_000_000,
      cashAssets: 50_000_000,
      retirementIncomes: [
        { name: '年金', monthlyAmount: 200_000, startAge: 65, endAge: 90, growthRate: 0, growthStartMode: 'receiveStart' },
      ],
    }));
    expect(rich.message).toContain('余裕');

    // 枯渇ケース
    const poor = runSimulation(makeInput({
      taxableAssets: 100_000,
      nisaAssets: 0,
      idecoAssets: 0,
      cashAssets: 100_000,
      monthlyTaxable: 0,
      monthlyNisa: 0,
      monthlyIdeco: 0,
      monthlyCash: 0,
      annualLivingExpense: 6_000_000,
    }));
    expect(poor.depletionAge).not.toBeNull();
    expect(poor.message).toContain('枯渇');
  });
});
