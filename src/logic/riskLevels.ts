import type { RiskLevel, RiskLevelInfo, LimitingFactor } from '../types/assessment';

// 仕様書セクション4.2 準拠: 5段階リスクレベル

export const RISK_LEVELS: RiskLevelInfo[] = [
  {
    level: 'conservative',
    label: '保守的',
    scoreMin: 0,
    scoreMax: 24,
    color: 'bg-blue-100',
    textColor: 'text-blue-800',
  },
  {
    level: 'moderately_conservative',
    label: 'やや保守的',
    scoreMin: 25,
    scoreMax: 39,
    color: 'bg-cyan-100',
    textColor: 'text-cyan-800',
  },
  {
    level: 'balanced',
    label: 'バランス型',
    scoreMin: 40,
    scoreMax: 59,
    color: 'bg-green-100',
    textColor: 'text-green-800',
  },
  {
    level: 'moderately_aggressive',
    label: 'やや攻撃的',
    scoreMin: 60,
    scoreMax: 74,
    color: 'bg-orange-100',
    textColor: 'text-orange-800',
  },
  {
    level: 'aggressive',
    label: '攻撃的',
    scoreMin: 75,
    scoreMax: 100,
    color: 'bg-red-100',
    textColor: 'text-red-800',
  },
];

export function calculateFinalScore(capacityScore: number, toleranceScore: number): number {
  return Math.min(capacityScore, toleranceScore);
}

export function determineLimitingFactor(
  capacityScore: number,
  toleranceScore: number,
): LimitingFactor {
  return capacityScore <= toleranceScore ? 'capacity' : 'tolerance';
}

export function getRiskLevel(finalScore: number): RiskLevelInfo {
  for (const level of RISK_LEVELS) {
    if (finalScore >= level.scoreMin && finalScore <= level.scoreMax) {
      return level;
    }
  }
  return RISK_LEVELS[0]; // fallback to conservative
}

export function getRiskLevelByKey(key: RiskLevel): RiskLevelInfo {
  return RISK_LEVELS.find((l) => l.level === key) ?? RISK_LEVELS[0];
}

/**
 * 制限要因メッセージ（仕様書セクション4.3）
 */
export function getLimitingFactorMessage(
  limitingFactor: LimitingFactor,
  riskLevelLabel: string,
): string {
  if (limitingFactor === 'capacity') {
    return `あなたはリスクを取る意欲がありますが、将来の支出需要（教育費・介護費等）を考慮すると、${riskLevelLabel}のポートフォリオが適切です。`;
  }
  return `財務的にはより高いリスクを取れますが、心理的な許容度を考慮すると、${riskLevelLabel}のポートフォリオが適切です。`;
}
