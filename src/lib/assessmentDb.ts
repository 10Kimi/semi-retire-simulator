import { supabase } from './supabase';
import type {
  StepBasicInput,
  StepFinancialInput,
  LifeEventInput,
  ToleranceAnswer,
  AssessmentResult,
  DbRiskAssessment,
} from '../types/assessment';

// ── Consent ──

export async function hasUserConsented(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('assessment_consents')
    .select('id')
    .eq('user_id', userId)
    .single();

  return !!data;
}

export async function saveConsent(userId: string): Promise<void> {
  await supabase
    .from('assessment_consents')
    .upsert({ user_id: userId, consented_at: new Date().toISOString() });
}

// ── Assessment ──

function getToleranceScoreByQuestionId(answers: ToleranceAnswer[], questionId: number): number {
  return answers.find((a) => a.questionId === questionId)?.score ?? 0;
}

export async function saveAssessment(
  userId: string,
  basicInput: StepBasicInput,
  financialInput: StepFinancialInput,
  lifeEventInput: LifeEventInput,
  toleranceAnswers: ToleranceAnswer[],
  result: AssessmentResult,
): Promise<string | null> {
  const allocationMap: Record<string, number> = {};
  for (const a of result.portfolio.allocations) {
    allocationMap[a.key] = a.percentage;
  }

  const { data, error } = await supabase
    .from('risk_assessments')
    .insert({
      user_id: userId,
      assessed_at: new Date().toISOString(),
      capacity_score: result.capacityResult.totalScore,
      capacity_time_horizon: result.capacityResult.subScores.timeHorizon.score,
      capacity_portfolio_ratio: result.capacityResult.subScores.portfolioRatio.score,
      capacity_cash_flow: result.capacityResult.subScores.cashFlow.score,
      capacity_income_stability: result.capacityResult.subScores.incomeStability.score,
      capacity_emergency_fund: result.capacityResult.subScores.emergencyFund.score,
      input_age: basicInput.age,
      input_retirement_age: basicInput.retireAge,
      input_current_assets: financialInput.currentAssets,
      input_annual_savings: financialInput.annualSavings,
      input_monthly_expenses: financialInput.monthlyExpenses,
      input_emergency_months: financialInput.emergencyMonths,
      input_income_type: financialInput.incomeType,
      input_life_events: lifeEventInput,
      tolerance_score: result.toleranceResult.totalScore,
      tolerance_loss_reaction: getToleranceScoreByQuestionId(toleranceAnswers, 1),
      tolerance_investment_goal: getToleranceScoreByQuestionId(toleranceAnswers, 2),
      tolerance_volatility: getToleranceScoreByQuestionId(toleranceAnswers, 3),
      tolerance_knowledge: getToleranceScoreByQuestionId(toleranceAnswers, 4),
      tolerance_past_experience: getToleranceScoreByQuestionId(toleranceAnswers, 5),
      final_score: result.finalScore,
      risk_level: result.riskLevel,
      limiting_factor: result.limitingFactor,
      recommended_allocation: allocationMap,
      expected_return: result.portfolio.expectedReturn,
      expected_volatility: result.portfolio.expectedVolatility,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to save assessment:', error);
    return null;
  }

  return data?.id ?? null;
}

export async function loadLatestAssessment(userId: string): Promise<DbRiskAssessment | null> {
  const { data } = await supabase
    .from('risk_assessments')
    .select('*')
    .eq('user_id', userId)
    .order('assessed_at', { ascending: false })
    .limit(1)
    .single();

  return data as DbRiskAssessment | null;
}

export async function loadAssessmentHistory(userId: string): Promise<DbRiskAssessment[]> {
  const { data } = await supabase
    .from('risk_assessments')
    .select('*')
    .eq('user_id', userId)
    .order('assessed_at', { ascending: false });

  return (data as DbRiskAssessment[]) ?? [];
}

// ── Market Data ──

export interface MarketDataRecord {
  id: string;
  calculated_at: string;
  data_period: string;
  asset_returns: string;  // JSON string
  asset_risks: string;    // JSON string
  correlation_matrix: string; // JSON string
  optimal_allocations: string; // JSON string
  is_current: boolean;
}

export async function loadCurrentMarketData(): Promise<MarketDataRecord | null> {
  const { data, error } = await supabase
    .from('market_data')
    .select('*')
    .eq('is_current', true)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data as MarketDataRecord;
}

// ── Parsed Market Data for Portfolio Diagnosis ──

export interface ParsedMarketData {
  assetReturns: Record<string, number>;
  assetRisks: Record<string, number>;
  correlationMatrix: Record<string, Record<string, number>>;
}

/**
 * market_data テーブルからPF診断に必要なパラメータを取得・パースして返す。
 * データが無い場合は null を返す（呼び出し元がフォールバック値を使う）。
 */
export async function loadMarketDataForDiagnosis(): Promise<ParsedMarketData | null> {
  const record = await loadCurrentMarketData();
  if (!record) return null;

  try {
    const assetReturns = typeof record.asset_returns === 'string'
      ? JSON.parse(record.asset_returns)
      : record.asset_returns;

    const assetRisks = typeof record.asset_risks === 'string'
      ? JSON.parse(record.asset_risks)
      : record.asset_risks;

    const correlationMatrix = typeof record.correlation_matrix === 'string'
      ? JSON.parse(record.correlation_matrix)
      : record.correlation_matrix;

    // 最低限のバリデーション: 各オブジェクトが空でないこと
    if (
      !assetReturns || Object.keys(assetReturns).length === 0 ||
      !assetRisks || Object.keys(assetRisks).length === 0 ||
      !correlationMatrix || Object.keys(correlationMatrix).length === 0
    ) {
      return null;
    }

    return { assetReturns, assetRisks, correlationMatrix };
  } catch (e) {
    console.error('Failed to parse market data for diagnosis:', e);
    return null;
  }
}
