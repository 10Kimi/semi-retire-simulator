import { supabase } from './supabase';
import type { RiskAnswer } from '../types/riskSimple';

export async function saveRiskSimpleResult(
  userId: string,
  capacityScore: number,
  toleranceScore: number,
  finalLevel: number,
  answers: RiskAnswer[],
  version: 'simple' | 'detail' = 'detail',
): Promise<string | null> {
  const { data, error } = await supabase
    .from('risk_assessment_simple')
    .insert({
      user_id: userId,
      capacity_score: capacityScore,
      tolerance_score: toleranceScore,
      final_level: finalLevel,
      answers,
      version,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to save risk simple result:', error);
    return null;
  }
  return data?.id ?? null;
}

export async function loadLatestRiskSimple(userId: string) {
  const { data } = await supabase
    .from('risk_assessment_simple')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}
