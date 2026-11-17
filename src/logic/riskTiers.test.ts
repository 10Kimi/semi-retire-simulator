import { describe, it, expect } from 'vitest';
import { RISK_TIER_DEFS, levelToTier, analyzePfTierGap, limitingAxisText, tierView } from './riskTiers';
import { classifyRiskLevel7 } from './pfSimple';

describe('levelToTier（7段階 → 3段階、FI_project #101）', () => {
  it.each([
    [1, '安定重視'], [2, '安定重視'], [3, '安定重視'],
    [4, 'バランス'], [5, 'バランス'],
    [6, '成長重視'], [7, '成長重視'],
  ])('Lv%i → %s', (level, name) => {
    expect(levelToTier(level).name).toBe(name);
  });

  it('範囲外は端に寄せる', () => {
    expect(levelToTier(0).key).toBe('stable');
    expect(levelToTier(8).key).toBe('growth');
  });

  it('3段階は並び順どおり', () => {
    expect(RISK_TIER_DEFS.map(d => d.order)).toEqual([1, 2, 3]);
  });

  it('境目はボラ 9%・15%（classifyRiskLevel7 とずれない）', () => {
    expect(levelToTier(classifyRiskLevel7(9)).key).toBe('stable');
    expect(levelToTier(classifyRiskLevel7(9.01)).key).toBe('balance');
    expect(levelToTier(classifyRiskLevel7(15)).key).toBe('balance');
    expect(levelToTier(classifyRiskLevel7(15.01)).key).toBe('growth');
  });
});

describe('analyzePfTierGap（無料の /pf のズレは3段階どうし）', () => {
  it('同じ段階の中の違いは「合っている」', () => {
    expect(analyzePfTierGap(3, 1).gapType).toBe('match');
    expect(analyzePfTierGap(5, 4).gapType).toBe('match');
    expect(analyzePfTierGap(7, 6).gapType).toBe('match');
  });

  it('段階が上なら pf_higher、下なら pf_lower', () => {
    expect(analyzePfTierGap(4, 3).gapType).toBe('pf_higher');
    expect(analyzePfTierGap(6, 1).gapType).toBe('pf_higher');
    expect(analyzePfTierGap(3, 4).gapType).toBe('pf_lower');
  });

  it('段階名を返す', () => {
    const r = analyzePfTierGap(6, 2);
    expect(r.pfTier.name).toBe('成長重視');
    expect(r.assessmentTier.name).toBe('安定重視');
  });
});

describe('tierView（有料かどうかを読み込んでいる間はどちらも出さない）', () => {
  it('読み込み中は loading（isPremium の値によらない）', () => {
    expect(tierView(true, false)).toBe('loading');
    expect(tierView(true, true)).toBe('loading');
  });
  it('読み終えたら無料は3段階、有料は7段階', () => {
    expect(tierView(false, false)).toBe('tiers3');
    expect(tierView(false, true)).toBe('levels7');
  });
});

describe('limitingAxisText（数字を出さない）', () => {
  it('低いほうを言葉で出す', () => {
    expect(limitingAxisText(2, 5)).toContain('投資余力');
    expect(limitingAxisText(5, 2)).toContain('投資許容度（気持ちの面）です');
    expect(limitingAxisText(4, 4)).toContain('同じ水準');
  });

  it('数字を含まない', () => {
    for (const [c, t] of [[1, 7], [7, 1], [3, 3]]) {
      expect(limitingAxisText(c, t)).not.toMatch(/[0-9０-９]/);
    }
  });
});
