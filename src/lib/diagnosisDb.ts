// ── Portfolio Diagnosis DB Layer ──

import { supabase } from './supabase';
import type { DiagnosisResult } from '../types/portfolioDiagnosis';
import type { DbPortfolioDiagnosis } from '../types/portfolioDiagnosis';

export type SavePfWithSnapshotInput = {
  holdingAmounts: Record<string, number>;
  totalAmount: number;
  expectedReturn: number;
  volatility: number;
  riskLevel: number;         // 1〜7
  riskLevelKey: string;      // 'level_1' ... 'level_7'
  assessmentRiskLevel: string | null;
  // 診断済みユーザーのみセット（null なら portfolio_diagnoses のみ書き込み）
  assessmentSource: 'simple' | 'detailed' | null;
  assessmentId: string | null;
  assessmentLevel7: number | null;
  assessedAt: string | null; // ISO8601
};

/**
 * PF診断結果を portfolio_diagnoses と risk_gap_snapshots に
 * 同トランザクションで保存する（Supabase RPC 経由）。
 *
 * 診断未実施（assessmentId = null）の場合は portfolio_diagnoses のみ書き込む。
 */
export async function savePfWithSnapshot(
  input: SavePfWithSnapshotInput,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('save_pf_with_snapshot', {
    p_holding_amounts: input.holdingAmounts,
    p_total_amount: input.totalAmount,
    p_expected_return: input.expectedReturn,
    p_volatility: input.volatility,
    p_risk_level: input.riskLevel,
    p_risk_level_key: input.riskLevelKey,
    p_assessment_risk_level: input.assessmentRiskLevel,
    p_assessment_source: input.assessmentSource,
    p_assessment_id: input.assessmentId,
    p_assessment_level_7: input.assessmentLevel7,
    p_assessed_at: input.assessedAt,
  });

  if (error) {
    console.error('Failed to save pf with snapshot:', error);
    return null;
  }

  return (data as string) ?? null;
}

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
