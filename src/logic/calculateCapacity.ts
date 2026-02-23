import type {
  StepBasicInput,
  StepFinancialInput,
  LifeEventInput,
  CapacityResult,
  CapacitySubScore,
} from '../types/assessment';
import { calculateTotalEducationCost, calculateCaregivingCost } from './educationCosts';

// ── 2.1 Time Horizon（投資期間）— 30点満点 ──

function scoreTimeHorizon(yearsToRetire: number): CapacitySubScore {
  let score: number;
  if (yearsToRetire >= 20) score = 30;
  else if (yearsToRetire >= 15) score = 25;
  else if (yearsToRetire >= 10) score = 20;
  else if (yearsToRetire >= 5) score = 10;
  else score = 5;

  return {
    key: 'timeHorizon',
    label: '投資期間',
    score,
    maxScore: 30,
  };
}

// ── 2.2 Portfolio vs Future Additions — 25点満点 ──

function scorePortfolioRatio(
  currentAssets: number,
  annualSavings: number,
  yearsToRetire: number,
): CapacitySubScore {
  const futureAdditions = annualSavings * yearsToRetire;
  const total = currentAssets + futureAdditions;
  const ratio = total > 0 ? currentAssets / total : 1;

  let score: number;
  if (ratio < 0.20) score = 25;
  else if (ratio < 0.40) score = 20;
  else if (ratio < 0.60) score = 15;
  else if (ratio < 0.80) score = 10;
  else score = 5;

  return {
    key: 'portfolioRatio',
    label: '現在資産 vs 将来積立',
    score,
    maxScore: 25,
  };
}

// ── 2.3 Cash Flow Needs — 25点満点 ──

function scoreCashFlow(
  currentAssets: number,
  lifeEvents: LifeEventInput,
): {
  subScore: CapacitySubScore;
  detail: CapacityResult['cashFlowDetail'];
} {
  // Education costs
  const educationCostTotal = lifeEvents.hasChildren
    ? calculateTotalEducationCost(lifeEvents.children)
    : 0;

  // Caregiving costs
  const caregivingCostTotal = lifeEvents.hasCaregiving
    ? calculateCaregivingCost(lifeEvents.caregivingYears)
    : 0;

  // Housing loan
  const housingLoanTotal = lifeEvents.hasHousingLoan
    ? lifeEvents.housingLoanRemaining
    : 0;

  // Other events (general inflation 2.0%)
  const otherEventsTotal = lifeEvents.otherEvents.reduce((sum, evt) => {
    if (evt.amount <= 0 || evt.age <= 0) return sum;
    return sum + evt.amount;
  }, 0);

  const totalFutureExpenses = educationCostTotal + caregivingCostTotal + housingLoanTotal + otherEventsTotal;
  const expenseRatio = currentAssets > 0 ? totalFutureExpenses / currentAssets : 999;

  let score: number;
  if (expenseRatio < 0.10) score = 25;
  else if (expenseRatio < 0.20) score = 20;
  else if (expenseRatio < 0.30) score = 15;
  else if (expenseRatio < 0.50) score = 10;
  else score = 5;

  return {
    subScore: {
      key: 'cashFlow',
      label: 'キャッシュフロー需要',
      score,
      maxScore: 25,
    },
    detail: {
      educationCostTotal,
      caregivingCostTotal,
      housingLoanTotal,
      otherEventsTotal,
      totalFutureExpenses,
      expenseRatio,
    },
  };
}

// ── 2.4 Income Stability — 10点満点 ──

function scoreIncomeStability(incomeType: string): CapacitySubScore {
  const scores: Record<string, number> = {
    stable: 10,       // 安定収入（給与・年金）
    real_estate: 8,   // 不動産収入
    dividend: 6,      // 配当収入
    unstable: 4,      // 不安定（事業収入・フリーランス）
    none: 2,          // 無収入（資産取り崩し中）
  };

  return {
    key: 'incomeStability',
    label: '収入の安定性',
    score: scores[incomeType] ?? 4,
    maxScore: 10,
  };
}

// ── 2.5 Emergency Fund — 10点満点 ──

function scoreEmergencyFund(months: number): CapacitySubScore {
  let score: number;
  if (months >= 24) score = 10;
  else if (months >= 12) score = 8;
  else if (months >= 6) score = 6;
  else if (months >= 3) score = 4;
  else score = 2;

  return {
    key: 'emergencyFund',
    label: '緊急資金',
    score,
    maxScore: 10,
  };
}

// ── Main Calculation ──

export function calculateCapacity(
  basic: StepBasicInput,
  financial: StepFinancialInput,
  lifeEvents: LifeEventInput,
): CapacityResult {
  const yearsToRetire = Math.max(0, basic.retireAge - basic.age);

  const timeHorizon = scoreTimeHorizon(yearsToRetire);
  const portfolioRatio = scorePortfolioRatio(
    financial.currentAssets,
    financial.annualSavings,
    yearsToRetire,
  );
  const { subScore: cashFlow, detail: cashFlowDetail } = scoreCashFlow(
    financial.currentAssets,
    lifeEvents,
  );
  const incomeStability = scoreIncomeStability(financial.incomeType);
  const emergencyFund = scoreEmergencyFund(financial.emergencyMonths);

  const totalScore =
    timeHorizon.score +
    portfolioRatio.score +
    cashFlow.score +
    incomeStability.score +
    emergencyFund.score;

  return {
    totalScore,
    subScores: {
      timeHorizon,
      portfolioRatio,
      cashFlow,
      incomeStability,
      emergencyFund,
    },
    cashFlowDetail,
  };
}
