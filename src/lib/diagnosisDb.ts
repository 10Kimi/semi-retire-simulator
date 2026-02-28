// ── Portfolio Diagnosis DB Layer ──

import { supabase } from './supabase';
import type { DiagnosisResult } from '../types/portfolioDiagnosis';
import type { DbPortfolioDiagnosis } from '../types/portfolioDiagnosis';

/**
 * PF診断結果を portfolio_diagnoses テーブルに保存
 */
export async function saveDiagnosis(
  userId: string,
  result: DiagnosisResult,
  assessedRiskLevel?: string | null,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('portfolio_diagnoses')
    .insert({
      user_id: userId,
      holding_amounts: result.holdingAmounts,
      total_amount: result.totalAmount,
      expected_return: result.expectedReturn,
      volatility: result.volatility,
      risk_level: result.riskLevelNumber,
      risk_level_key: result.riskLevelKey,
      assessment_risk_level: assessedRiskLevel ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to save portfolio diagnosis:', error);
    return null;
  }

  return data?.id ?? null;
}

/**
 * ユーザーの最新のPF診断結果を取得
 */
export async function loadLatestDiagnosis(
  userId: string,
): Promise<DbPortfolioDiagnosis | null> {
  const { data } = await supabase
    .from('portfolio_diagnoses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data as DbPortfolioDiagnosis | null;
}
