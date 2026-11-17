import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { RiskResult } from '../../types/risk';
import { getRiskLevelDef } from '../../logic/riskScoring';

// 無料は3段階、有料（is_premium）は7段階とモデル配分（FI_project #101、D-062）
const premium = { value: false };
vi.mock('../../hooks/useIsPremium', () => ({
  useIsPremium: () => ({ isPremium: premium.value, loading: false, refresh: () => {} }),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
vi.mock('../../lib/rb/db', () => ({
  adoptModelAllocation: vi.fn(),
}));

import RiskResultDisplay from './RiskResultDisplay';

function result(finalLevel: number, capacityScore = finalLevel, toleranceScore = finalLevel): RiskResult {
  return {
    capacityScore,
    toleranceScore,
    finalLevel,
    gapType: capacityScore === toleranceScore ? 'balanced' : capacityScore > toleranceScore ? 'capacity_higher' : 'tolerance_higher',
    gapMessage: 'テスト用のメッセージ',
    levelDef: getRiskLevelDef(finalLevel),
  };
}

function render(r: RiskResult): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <RiskResultDisplay result={r} onRetry={() => {}} />
    </MemoryRouter>,
  );
}

describe('RiskResultDisplay', () => {
  beforeEach(() => { premium.value = false; });

  it('無料：3段階の名前を出し、レベル番号・モデル配分・採用ボタンは出さない', () => {
    const html = render(result(5, 6, 5));
    expect(html).toContain('バランス');
    expect(html).toContain('安定重視');
    expect(html).toContain('成長重視');
    expect(html).not.toContain('レベル 5');
    expect(html).not.toContain('やや積極型');
    expect(html).not.toContain('モデル配分');
    expect(html).not.toContain('このPFを採用する');
    expect(html).not.toContain('min(');
  });

  it('無料：Lv6・Lv7 はどちらも成長重視', () => {
    expect(render(result(6))).toContain('成長重視');
    expect(render(result(7))).toContain('成長重視');
  });

  it('有料：7段階・モデル配分・採用ボタンのまま', () => {
    premium.value = true;
    const html = render(result(5, 6, 5));
    expect(html).toContain('レベル 5');
    expect(html).toContain('やや積極型');
    expect(html).toContain('モデル配分');
    expect(html).toContain('このPFを採用する');
    expect(html).not.toContain('リスク許容度の3つの段階');
  });
});
