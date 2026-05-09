import type { RiskAnswer, RiskLevelDef, RiskResult } from '../types/risk';

// ── リスクレベル定義（7段階） ──

export const RISK_LEVEL_DEFS: RiskLevelDef[] = [
  { level: 1, name: '超保守型',   volatility: '〜3%',   color: 'bg-blue-100',   textColor: 'text-blue-800' },
  { level: 2, name: '保守型',     volatility: '3〜6%',  color: 'bg-blue-50',    textColor: 'text-blue-700' },
  { level: 3, name: 'やや保守型', volatility: '6〜9%',  color: 'bg-cyan-100',   textColor: 'text-cyan-800' },
  { level: 4, name: 'バランス型', volatility: '9〜12%', color: 'bg-green-100',  textColor: 'text-green-800' },
  { level: 5, name: 'やや積極型', volatility: '12〜15%', color: 'bg-yellow-100', textColor: 'text-yellow-800' },
  { level: 6, name: '積極型',     volatility: '15〜20%', color: 'bg-orange-100', textColor: 'text-orange-800' },
  { level: 7, name: '超積極型',   volatility: '20%〜',  color: 'bg-red-100',    textColor: 'text-red-800' },
];

export function getRiskLevelDef(level: number): RiskLevelDef {
  return RISK_LEVEL_DEFS[Math.max(0, Math.min(6, level - 1))];
}

// ── Capacity 計算 ──

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateCapacityScore(answers: RiskAnswer[]): number {
  const get = (id: string) => answers.find(a => a.questionId === id)?.value ?? 0;

  const c1 = get('C1'); // 金融資産 (1〜7)
  const c2 = get('C2'); // 年収 (1〜7)
  const c3 = get('C3'); // 負債補正 (0 〜 -3)
  const c4 = get('C4'); // 大型支出補正 (0 〜 -2.5)
  const c5 = get('C5'); // 投資期間 (1〜7)
  const c6 = get('C6'); // 年齢補正 (-1.5 〜 +1.5)

  const rawCapacity = c1 * 0.6 + c2 * 0.4 + (c5 - 1) * 0.3;
  const capacityAdj = rawCapacity + c3 + c4 + c6;

  return clamp(Math.round(capacityAdj), 1, 7);
}

// ── Tolerance 計算 ──

export function calculateToleranceScore(answers: RiskAnswer[]): number {
  const toleranceIds = ['T1', 'T2', 'T3', 'T4', 'T5'];
  const scores = toleranceIds.map(id => answers.find(a => a.questionId === id)?.value ?? 0);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  return clamp(Math.round(avg), 1, 7);
}

// ── 最終スコア ──

export function calculateRiskSimpleResult(answers: RiskAnswer[]): RiskResult {
  const capacityScore = calculateCapacityScore(answers);
  const toleranceScore = calculateToleranceScore(answers);
  const finalLevel = Math.min(capacityScore, toleranceScore);
  const levelDef = getRiskLevelDef(finalLevel);

  let gapType: RiskResult['gapType'];
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
