// ── Portfolio Diagnosis DB Layer ──
//
// 利用者の金額（円・万円）はサーバーに送らない（FI_project D-065、#110）。
// /pf の保存では資産クラス別の「割合（%）」だけを送り、金額はブラウザの中にとどめる。

import { supabase } from './supabase';
import type { DbPortfolioDiagnosis, HoldingAmounts, HoldingWeights } from '../types/portfolioDiagnosis';

export type SavePfWithSnapshotInput = {
  holdingWeights: HoldingWeights; // 資産クラス別の割合（%、合計100）。金額は入れない
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
 * 保有額から資産クラス別の割合（%、小数4桁）を作る。
 * 0 以下・数でない値のクラスは入れない。合計が 0 なら空。
 */
export function toHoldingWeights(holdings: HoldingAmounts): HoldingWeights {
  const entries = Object.entries(holdings).filter(
    ([, v]) => typeof v === 'number' && Number.isFinite(v) && v > 0,
  );
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return {};
  const weights: HoldingWeights = {};
  for (const [k, v] of entries) {
    weights[k] = Math.round((v / total) * 100 * 10000) / 10000;
  }
  return weights;
}

/** /pf の画面が保存に渡す値を組み立てる（保有額は割合に変えてから渡す） */
export function buildPfSaveInput(args: {
  holdings: HoldingAmounts;
  expectedReturn: number;
  volatility: number;
  riskLevel: number;
  assessmentLevel: number | null;
  assessmentId: string | null;
  assessedAt: string | null;
}): SavePfWithSnapshotInput {
  return {
    holdingWeights: toHoldingWeights(args.holdings),
    expectedReturn: args.expectedReturn,
    volatility: args.volatility,
    riskLevel: args.riskLevel,
    riskLevelKey: `level_${args.riskLevel}`,
    assessmentRiskLevel: args.assessmentLevel !== null ? `level_${args.assessmentLevel}` : null,
    assessmentSource: args.assessmentId ? 'detailed' : null,
    assessmentId: args.assessmentId,
    assessmentLevel7: args.assessmentLevel,
    assessedAt: args.assessedAt,
  };
}

/**
 * PF診断結果（割合・指標だけ）を portfolio_diagnoses と risk_gap_snapshots に
 * 同トランザクションで保存する（Supabase RPC 経由）。
 *
 * 診断未実施（assessmentId = null）の場合は portfolio_diagnoses のみ書き込む。
 */
export async function savePfWithSnapshot(
  input: SavePfWithSnapshotInput,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('save_pf_weights_with_snapshot', {
    p_holding_weights: input.holdingWeights,
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
 * ユーザーの最新のPF診断結果を取得
 */
export async function loadLatestDiagnosis(
  userId: string,
): Promise<DbPortfolioDiagnosis | null> {
  const { data } = await supabase
    .from('portfolio_diagnoses')
    .select('id, user_id, holding_weights, expected_return, volatility, risk_level, risk_level_key, assessment_risk_level, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data as DbPortfolioDiagnosis | null;
}
