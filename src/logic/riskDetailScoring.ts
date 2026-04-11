import type { RiskAnswer, RiskSimpleResult } from '../types/riskSimple';
import { getRiskLevelDef } from './riskSimpleScoring';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 詳細版 Capacity 計算 */
export function calculateDetailCapacityScore(answers: RiskAnswer[]): number {
  const get = (id: string) => answers.find(a => a.questionId === id)?.value ?? 0;

  const c1 = get('C1'); // 金融資産 (1〜7)
  const c2 = get('C2'); // 年収 (1〜7)
  const c3 = get('C3'); // 負債補正 (0 〜 -2.5)
  const c4 = get('C4'); // 大型支出補正 (0 〜 -1.8)
  const c5 = get('C5'); // 投資期間 (1〜7)
  const c6 = get('C6'); // 年齢補正 (-1.5 〜 +1.5)
  const c7 = get('C7'); // 収入安定性係数 (0.6〜1.0)
  const c8 = get('C8'); // 家族構成補正 (-1.0 〜 +0.5)

  // C7はC2スコアへの係数
  const incomeScore = c2 * c7;

  const rawCapacity = c1 * 0.6 + incomeScore * 0.4 + (c5 - 1) * 0.3;
  const capacityAdj = rawCapacity + c3 + c4 + c6 + c8;

  return clamp(Math.round(capacityAdj), 1, 7);
}

/** 詳細版 Tolerance 計算（12問の総点を1〜7に正規化） */
export function calculateDetailToleranceScore(answers: RiskAnswer[]): number {
  const toleranceIds = ['T1', 'T3', 'T4', 'T6', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15'];
  const scores = toleranceIds.map(id => answers.find(a => a.questionId === id)?.value ?? 0);
  const rawTotal = scores.reduce((s, v) => s + v, 0);

  // 最小: 全問1点 = 12点, 最大: 全問7点 = 84点
  // ただしT9,T10は2択(1or7), T12は3択(1,3,7)なので理論最小は12
  const minScore = 12;
  const maxScore = 84;
  const normalized = Math.round((rawTotal - minScore) / (maxScore - minScore) * 6) + 1;

  return clamp(normalized, 1, 7);
}

/** 詳細版 最終スコア計算 */
export function calculateDetailResult(answers: RiskAnswer[]): RiskSimpleResult {
  const capacityScore = calculateDetailCapacityScore(answers);
  const toleranceScore = calculateDetailToleranceScore(answers);
  const finalLevel = Math.min(capacityScore, toleranceScore);
  const levelDef = getRiskLevelDef(finalLevel);

  let gapType: RiskSimpleResult['gapType'];
  let gapMessage: string;

  if (capacityScore === toleranceScore) {
    gapType = 'balanced';
    gapMessage = 'バランスが取れています。このリスクレベルに合ったポートフォリオを組むことで、暴落時も保有し続けられる可能性が高まります。';
  } else if (capacityScore > toleranceScore) {
    gapType = 'capacity_higher';
    gapMessage = '財務的にはより積極的に投資できる状況です。ただし心理的な耐性がそれに追いついていません。無理なリスクを取ると、暴落時に売ってしまうリスクがあります。';
  } else {
    gapType = 'tolerance_higher';
    gapMessage = '気持ちは積極的ですが、今の財務状況がリスクを制限しています。生活基盤を守りながら着実に資産を育てる戦略が合っています。';
  }

  return { capacityScore, toleranceScore, finalLevel, gapType, gapMessage, levelDef };
}
