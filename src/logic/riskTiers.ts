/**
 * 無料の /risk・/pf で見せる3段階（FI_project #101、決定台帳 D-062）
 *
 * 計算と保存は7段階（final_level / classifyRiskLevel7）のまま。
 * 無料の画面に出すときだけ、7段階をこの3段階にまとめて見せる。
 * 境目は7段階のレベルの境目（ボラ 9%・15%）にそろえてあるので、
 * /pf の classifyRiskLevel7 とずれない。有料の利用者（is_premium）は7段階のまま。
 */

export type RiskTierKey = 'stable' | 'balance' | 'growth';

export interface RiskTierDef {
  key: RiskTierKey;
  /** 1〜3（並び順・ズレの判定に使う） */
  order: number;
  name: string;
  /** 7段階との対応（表示用） */
  levels: string;
  volatility: string;
  color: string;
  textColor: string;
}

export const RISK_TIER_DEFS: RiskTierDef[] = [
  { key: 'stable',  order: 1, name: '安定重視', levels: 'Lv1〜3', volatility: '±9%以内',  color: 'bg-blue-100',   textColor: 'text-blue-800' },
  { key: 'balance', order: 2, name: 'バランス', levels: 'Lv4〜5', volatility: '±9〜15%', color: 'bg-green-100',  textColor: 'text-green-800' },
  { key: 'growth',  order: 3, name: '成長重視', levels: 'Lv6〜7', volatility: '±15%超',  color: 'bg-orange-100', textColor: 'text-orange-800' },
];

export type TierView = 'loading' | 'tiers3' | 'levels7';

/**
 * 3段階（無料）と7段階（有料）のどちらを見せるか。
 * 有料かどうかを読み込んでいる間はどちらも出さない（有料の人に3段階が一瞬出ないように、FI_project #101）。
 */
export function tierView(premiumLoading: boolean, isPremium: boolean): TierView {
  if (premiumLoading) return 'loading';
  return isPremium ? 'levels7' : 'tiers3';
}

/** 7段階のレベル（1〜7）→ 3段階。範囲外は端に寄せる（getRiskLevelDef と同じ扱い） */
export function levelToTier(level: number): RiskTierDef {
  const lv = Math.max(1, Math.min(7, Math.round(level)));
  if (lv <= 3) return RISK_TIER_DEFS[0];
  if (lv <= 5) return RISK_TIER_DEFS[1];
  return RISK_TIER_DEFS[2];
}

export interface PfTierGapResult {
  pfTier: RiskTierDef;
  assessmentTier: RiskTierDef;
  gapType: 'match' | 'pf_higher' | 'pf_lower';
  message: string;
}

/**
 * 無料の /pf のズレの判定：ポートフォリオと診断を3段階どうしで比べる。
 * 文言は analyzePfGap（7段階、有料の画面）と同じ。
 */
export function analyzePfTierGap(pfLevel: number, assessmentLevel: number): PfTierGapResult {
  const pfTier = levelToTier(pfLevel);
  const assessmentTier = levelToTier(assessmentLevel);
  if (pfTier.order === assessmentTier.order) {
    return { pfTier, assessmentTier, gapType: 'match', message: '現在のポートフォリオはあなたのリスク許容度と合っています。' };
  }
  if (pfTier.order > assessmentTier.order) {
    return { pfTier, assessmentTier, gapType: 'pf_higher', message: '現在のポートフォリオはあなたのリスク許容度より積極的です。暴落時に売ってしまうリスクがあります。' };
  }
  return { pfTier, assessmentTier, gapType: 'pf_lower', message: '現在のポートフォリオはあなたのリスク許容度より保守的です。もう少しリターンを狙える可能性があります。' };
}

/**
 * 無料の /risk で「どちらが結果を決めたか（低いほう）」を言葉で出す。数字は出さない。
 */
export function limitingAxisText(capacityScore: number, toleranceScore: number): string {
  if (capacityScore === toleranceScore) {
    return '投資余力（家計面）と投資許容度（気持ちの面）が同じ水準で、どちらも結果を決めています。';
  }
  if (capacityScore < toleranceScore) {
    return '結果を決めたのは投資余力（家計面）です。気持ちの面より、家計の条件のほうが取れるリスクを小さくしています。';
  }
  return '結果を決めたのは投資許容度（気持ちの面）です。家計の条件より、値下がりへの気持ちの耐えやすさのほうが取れるリスクを小さくしています。';
}
