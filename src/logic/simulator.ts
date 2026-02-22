import type { SimulationInput, AnnualRow, SimulationResult } from '../types';

/**
 * Calculate retirement income for a given age and income definition.
 * Mirrors the Excel logic for columns with two growth start modes.
 */
function calcRetirementIncome(
  income: { monthlyAmount: number; startAge: number; endAge: number; growthRate: number; growthStartMode: 'receiveStart' | 'retireStart' },
  age: number,
  retireAge: number,
  isFirstRow: boolean,
): number {
  if (income.monthlyAmount === 0) return 0;

  const { monthlyAmount, startAge, endAge, growthRate, growthStartMode } = income;
  const annualBase = monthlyAmount * 12;

  if (growthStartMode === 'receiveStart') {
    // Mode 1: growth starts from receive start age
    if (age < startAge || age > endAge) return 0;
    const yearsFromStart = age - startAge;
    if (isFirstRow) {
      // First row (row4 in Excel): exponent is 1
      return annualBase * (1 + growthRate);
    }
    return annualBase * Math.pow(1 + growthRate, yearsFromStart + 1);
  } else {
    // Mode 2: growth starts from retire age (growthStartAge = retireAge)
    const growthStartAge = retireAge;
    if (age > endAge || age < startAge) return 0;
    if (age >= growthStartAge) {
      const yearsFromGrowthStart = age - growthStartAge;
      if (isFirstRow) {
        return annualBase * (1 + growthRate);
      }
      return annualBase * Math.pow(1 + growthRate, yearsFromGrowthStart + 1);
    } else {
      // Before growth start but within receive period: flat
      return annualBase;
    }
  }
}

/**
 * Check if the given age triggers a living expense reduction.
 * Reduction happens at retireAge + interval*1, retireAge + interval*2, ..., retireAge + interval*7
 */
function getReductionFactor(
  age: number,
  retireAge: number,
  interval: number,
  reductionRate: number,
): number {
  if (interval <= 0) return 1;
  for (let n = 1; n <= 7; n++) {
    if (age === retireAge + interval * n) {
      return 1 - reductionRate;
    }
  }
  return 1;
}

/**
 * Run the full simulation. Returns annual rows and summary results.
 */
export function runSimulation(input: SimulationInput): SimulationResult {
  const {
    currentAge,
    retireAge,
    deathAge,
    currentAssets,
    annualLivingExpense,
    legacyAmount,
    monthlyInvestment,
    savingsGrowthRate,
    savingsStartAge,
    savingsEndAge,
    preRetirementROI,
    postRetirementROI,
    taxRate,
    inflationRate,
    reductionInterval,
    reductionRate,
    oneTimeEvents,
    retirementIncomes,
    currentMonth,
  } = input;

  const remainingMonths = 12 - currentMonth;
  const totalYears = deathAge - currentAge + 1; // include death year
  const rows: AnnualRow[] = [];
  const currentYear = new Date().getFullYear();

  for (let i = 0; i < totalYears; i++) {
    const age = currentAge + i;
    const year = currentYear + i;
    const isFirstRow = i === 0;
    const isRetired = age >= retireAge;
    const isDead = age > deathAge;
    const monthFraction = isFirstRow ? remainingMonths / 12 : 1;

    // L: Start balance
    const startBalance = isFirstRow ? currentAssets : rows[i - 1].endBalance;

    // M: Savings + negative one-time events
    // Excel: M4 = D15*12*(1+0)/12*(12-MONTH), M5+ = D15*12*(1+D16) (flat, no compounding)
    let savings = 0;
    if (age >= savingsStartAge && age < savingsEndAge) {
      if (isFirstRow) {
        savings = monthlyInvestment * 12 * monthFraction;
      } else {
        savings = monthlyInvestment * 12 * (1 + savingsGrowthRate);
      }
    }
    // Add negative one-time events to savings column
    const negativeOneTime = oneTimeEvents
      .filter(e => e.age === age && e.amount < 0)
      .reduce((sum, e) => sum + e.amount, 0);
    savings += negativeOneTime;

    // N: Investment return
    const roi = isRetired ? postRetirementROI : preRetirementROI;
    const investmentReturn = startBalance * roi * monthFraction;

    // O: Living expense (with inflation and reduction)
    // Excel: O4 = D11*AB4, O5+ = O_prev*(1+D25)*AB
    const rf = getReductionFactor(age, retireAge, reductionInterval, reductionRate);
    let livingExpense: number;
    if (isFirstRow) {
      livingExpense = annualLivingExpense * rf;
    } else {
      livingExpense = rows[i - 1].livingExpense * (1 + inflationRate) * rf;
    }

    // P: Retirement income + positive one-time events
    let retirementIncome = 0;
    for (const inc of retirementIncomes) {
      retirementIncome += calcRetirementIncome(inc, age, retireAge, isFirstRow);
    }
    // Add positive one-time events to income column
    const positiveOneTime = oneTimeEvents
      .filter(e => e.age === age && e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);
    retirementIncome += positiveOneTime;

    // Q: Net expense (only after retirement)
    const netExpense = isRetired ? livingExpense - retirementIncome : 0;

    // R: Pre-tax expense
    let preTaxExpense = 0;
    if (isDead) {
      preTaxExpense = 0;
    } else if (netExpense < 0) {
      // Income exceeds expenses, "negative expense" passed through
      preTaxExpense = netExpense;
    } else if (isRetired && netExpense >= 0) {
      preTaxExpense = netExpense / (1 - taxRate);
    }

    // S: End balance
    let endBalance = startBalance + savings + investmentReturn - preTaxExpense;
    if (isRetired) {
      endBalance = Math.max(0, endBalance);
    }

    // Present value placeholder (calculated in second pass)
    rows.push({
      year,
      age,
      startBalance,
      savings,
      investmentReturn,
      livingExpense,
      retirementIncome,
      netExpense,
      preTaxExpense,
      endBalance,
      presentValue: 0,
      isRetired,
      isDead,
    });
  }

  // Second pass: calculate present values (AK column)
  let retirementYearCounter = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.age >= retireAge) {
      retirementYearCounter++;
      const legacyAtDeath = row.age === deathAge ? legacyAmount : 0;
      row.presentValue = (row.preTaxExpense + legacyAtDeath) / Math.pow(1 + postRetirementROI, retirementYearCounter);
    }
  }

  // Calculate results
  const retireRow = rows.find(r => r.age === retireAge);
  const assetsAtRetirement = retireRow ? retireRow.startBalance : 0;
  const requiredAssets = rows.reduce((sum, r) => sum + r.presentValue, 0);
  const surplus = assetsAtRetirement - requiredAssets;

  let additionalMonthly = 0;
  if (surplus < 0) {
    const monthsUntilRetire = (retireAge - currentAge) * 12 - currentMonth;
    additionalMonthly = monthsUntilRetire > 0 ? -surplus / monthsUntilRetire : 0;
  }

  let achievementScore: number;
  if (requiredAssets < 0) {
    // Special case: required assets negative means income exceeds expenses
    achievementScore = 1.5;
  } else if (requiredAssets === 0) {
    achievementScore = assetsAtRetirement > 0 ? 1.5 : 0;
  } else {
    achievementScore = assetsAtRetirement / requiredAssets;
  }

  const scorePercent = Math.min(achievementScore, 1.5) * 100;

  let message: string;
  if (scorePercent >= 150) {
    message = '余裕のリタイア計画です！';
  } else if (scorePercent >= 120) {
    message = 'かなり安心できる計画です。';
  } else if (scorePercent >= 100) {
    message = '計画は達成可能です。';
  } else if (scorePercent >= 80) {
    message = 'もう少しで達成できます。';
  } else if (scorePercent >= 50) {
    message = '追加の貯蓄・収入が必要です。';
  } else {
    message = '計画の大幅な見直しが必要です。';
  }

  return {
    rows,
    assetsAtRetirement,
    requiredAssets,
    surplus,
    additionalMonthly,
    achievementScore,
    scorePercent,
    message,
  };
}
