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
 * Reduction happens at startAge, startAge + interval, startAge + interval*2, ...
 */
function getReductionFactor(
  age: number,
  startAge: number,
  interval: number,
  reductionRate: number,
): number {
  if (interval <= 0 || age < startAge) return 1;
  for (let n = 0; n <= 7; n++) {
    if (age === startAge + interval * n) {
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
    taxableAssets,
    nisaAssets,
    idecoAssets,
    cashAssets,
    annualLivingExpense,
    legacyAmount,
    monthlyTaxable,
    monthlyNisa,
    monthlyIdeco,
    monthlyCash,
    savingsStartAge,
    savingsEndAge,
    preRetirementROI,
    postRetirementROI,
    cashInterestRate,
    investmentTaxRate,
    inflationRate,
    reductionStartAge,
    reductionInterval,
    reductionRate,
    oneTimeEvents,
    retirementIncomes,
    currentMonth,
  } = input;

  const remainingMonths = 12 - currentMonth;
  const totalYears = deathAge - currentAge + 1;
  const rows: AnnualRow[] = [];
  const currentYear = new Date().getFullYear();

  // NISA constraints
  const NISA_MONTHLY_CAP = 300000; // 月30万円 (年360万円)
  const NISA_CUMULATIVE_CAP = 18000000; // 累計1,800万円

  // Track 4 asset boxes and depletion
  let depletionAge: number | null = null;
  let taxableBal = taxableAssets;
  let nisaBal = nisaAssets;
  let idecoBal = idecoAssets;
  let cashBal = cashAssets;
  let nisaCumulativeContribution = nisaAssets; // track cumulative NISA contributions

  for (let i = 0; i < totalYears; i++) {
    const age = currentAge + i;
    const year = currentYear + i;
    const isFirstRow = i === 0;
    const isRetired = age >= retireAge;
    const isDead = age > deathAge;
    const monthFraction = isFirstRow ? remainingMonths / 12 : 1;

    // L: Start balance (combined)
    const startBalance = taxableBal + nisaBal + idecoBal + cashBal;

    // M: Savings with NISA constraints
    let taxableSav = 0;
    let nisaSav = 0;
    let idecoSav = 0;
    let cashSav = 0;

    if (age >= savingsStartAge && age < savingsEndAge) {
      const mf = isFirstRow ? monthFraction : 1;

      // NISA: apply monthly cap and cumulative cap
      let effectiveMonthlyNisa = Math.min(monthlyNisa, NISA_MONTHLY_CAP);
      let nisaAnnual = effectiveMonthlyNisa * 12 * mf;
      // Check cumulative cap
      if (nisaCumulativeContribution + nisaAnnual > NISA_CUMULATIVE_CAP) {
        const nisaRoom = Math.max(0, NISA_CUMULATIVE_CAP - nisaCumulativeContribution);
        const overflow = nisaAnnual - nisaRoom;
        nisaAnnual = nisaRoom;
        // Overflow goes to taxable
        taxableSav += overflow;
      }
      nisaCumulativeContribution += nisaAnnual;
      nisaSav = nisaAnnual;

      taxableSav += monthlyTaxable * 12 * mf;
      idecoSav = monthlyIdeco * 12 * mf;
      cashSav = monthlyCash * 12 * mf;
    }

    taxableBal += taxableSav;
    nisaBal += nisaSav;
    idecoBal += idecoSav;
    cashBal += cashSav;

    // Negative one-time events: deduct from cash
    const negativeOneTime = oneTimeEvents
      .filter(e => e.age === age && e.amount < 0)
      .reduce((sum, e) => sum + e.amount, 0);
    cashBal += negativeOneTime; // negativeOneTime is negative, so this subtracts

    const savings = taxableSav + nisaSav + idecoSav + cashSav + negativeOneTime;

    // N: Investment return (ROI for investment accounts, cash rate for cash)
    const investROI = isRetired ? postRetirementROI : preRetirementROI;
    const taxableReturn = taxableBal * investROI * monthFraction;
    const nisaReturn = nisaBal * investROI * monthFraction;
    const idecoReturn = idecoBal * investROI * monthFraction;
    const cashReturn = cashBal * cashInterestRate * monthFraction;
    taxableBal += taxableReturn;
    nisaBal += nisaReturn;
    idecoBal += idecoReturn;
    cashBal += cashReturn;
    const investmentReturn = taxableReturn + nisaReturn + idecoReturn + cashReturn;

    // Positive one-time events: add to cash
    const positiveOneTime = oneTimeEvents
      .filter(e => e.age === age && e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);
    cashBal += positiveOneTime;

    // O: Living expense (with inflation and reduction)
    const rf = getReductionFactor(age, reductionStartAge, reductionInterval, reductionRate);
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
    retirementIncome += positiveOneTime;

    // Q: Net expense (only after retirement)
    const netExpense = isRetired ? livingExpense - retirementIncome : 0;

    // R: Withdrawal from 4 boxes
    // Order: 1.NISA(tax-free) → 2.iDeCo(60+, tax-free) → 3.Taxable(taxed) → 4.Cash(tax-free)
    let preTaxExpense = 0;
    let unmetExpense = 0; // Track expenses that couldn't be covered
    if (isDead) {
      preTaxExpense = 0;
    } else if (netExpense < 0) {
      // Income exceeds expenses — add surplus to cash
      preTaxExpense = netExpense;
      cashBal -= netExpense;
    } else if (isRetired && netExpense >= 0) {
      let remaining = netExpense;
      let totalWithdrawn = 0;

      // 1. NISA (tax-free)
      const fromNisa = Math.min(remaining, Math.max(0, nisaBal));
      nisaBal -= fromNisa;
      remaining -= fromNisa;
      totalWithdrawn += fromNisa;

      // 2. iDeCo (60+ only, tax-free)
      if (age >= 60) {
        const fromIdeco = Math.min(remaining, Math.max(0, idecoBal));
        idecoBal -= fromIdeco;
        remaining -= fromIdeco;
        totalWithdrawn += fromIdeco;
      }

      // 3. Taxable (taxed — need to withdraw extra to cover tax)
      if (remaining > 0) {
        const grossTaxable = remaining / (1 - investmentTaxRate);
        const fromTaxable = Math.min(grossTaxable, Math.max(0, taxableBal));
        taxableBal -= fromTaxable;
        // How much of netExpense did this cover?
        const netCovered = fromTaxable * (1 - investmentTaxRate);
        remaining -= netCovered;
        totalWithdrawn += fromTaxable;
      }

      // 4. Cash (last resort, tax-free)
      if (remaining > 0) {
        const fromCash = Math.min(remaining, Math.max(0, cashBal));
        cashBal -= fromCash;
        remaining -= fromCash;
        totalWithdrawn += fromCash;
      }

      preTaxExpense = totalWithdrawn;
      unmetExpense = remaining; // > 0 means assets couldn't cover full expenses
    }

    // Floor balances at 0 after retirement
    if (isRetired) {
      taxableBal = Math.max(0, taxableBal);
      nisaBal = Math.max(0, nisaBal);
      idecoBal = Math.max(0, idecoBal);
      cashBal = Math.max(0, cashBal);
    }

    const endBalance = taxableBal + nisaBal + idecoBal + cashBal;

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

    // Track depletion: expenses couldn't be fully covered from all 4 boxes
    if (depletionAge === null && isRetired && unmetExpense > 0.01) {
      depletionAge = age;
    }
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

  let scorePercent: number;
  if (depletionAge !== null) {
    // Assets depleted: score based on how long they lasted
    const yearsLasted = depletionAge - retireAge;
    const totalRetirementYears = deathAge - retireAge;
    scorePercent = totalRetirementYears > 0
      ? Math.min((yearsLasted / totalRetirementYears) * 100, 99.9) // cap below 100
      : 0;
  } else if (requiredAssets < 0) {
    scorePercent = 150;
  } else if (requiredAssets === 0) {
    scorePercent = assetsAtRetirement > 0 ? 150 : 0;
  } else {
    scorePercent = Math.min(assetsAtRetirement / requiredAssets, 1.5) * 100;
  }

  const achievementScore = scorePercent / 100;

  let message: string;
  if (depletionAge !== null) {
    message = `${depletionAge}歳で資産が枯渇します。計画の見直しが必要です。`;
  } else if (scorePercent >= 150) {
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
    depletionAge,
  };
}
