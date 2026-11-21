import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRiskLevelDef } from '../../logic/riskScoring';
import { analyzePfGap, type PfDiagnosisResult } from '../../logic/pfSimple';

// /pf の無料は3段階、有料（is_premium）は7段階（FI_project #101、D-062）
vi.mock('../risk/RiskExcessWarning', () => ({
  default: () => <div>RISK_EXCESS_WARNING</div>,
}));

import { PfAssessmentBadge, PfResultView } from './PfResultView';

// 金額・数値はすべて架空
function diag(riskLevel: number): PfDiagnosisResult {
  return {
    totalAmount: 1000,
    weights: { us_equity: 1 },
    expectedReturn: 6.1,
    volatility: 16.2,
    riskLevel,
    riskLevelDef: getRiskLevelDef(riskLevel),
  };
}

function render(pfLevel: number, assessmentLevel: number | null, isPremium: boolean): string {
  return renderToStaticMarkup(
    <PfResultView
      diagResult={diag(pfLevel)}
      gapResult={assessmentLevel !== null ? analyzePfGap(pfLevel, assessmentLevel) : null}
      assessmentLevel={assessmentLevel}
      isPremium={isPremium}
      onRetry={() => {}}
    />,
  );
}

describe('PfResultView（/pf の結果）', () => {
  it('無料：3段階の名前を出し、「レベル N」・7段階の一覧・RiskExcessWarning は出さない', () => {
    // PF は Lv6（成長重視）、診断は Lv3（安定重視）→ PF のほうが積極的
    const html = render(6, 3, false);
    expect(html).toContain('成長重視');
    expect(html).toContain('安定重視');
    expect(html).toContain('リスクの3つの段階');
    expect(html).toContain('現在のポートフォリオはあなたのリスク許容度より積極的です');
    expect(html).toContain('有料のプログラムで扱います');
    expect(html).not.toMatch(/レベル\s*(<!-- -->)?\s*\d/);
    expect(html).not.toContain('/ 7');
    expect(html).not.toContain('リスクレベル一覧');
    expect(html).not.toContain(getRiskLevelDef(6).name);
    expect(html).not.toContain('RISK_EXCESS_WARNING');
  });

  it('無料：7段階では違っても3段階で同じなら「合っている」', () => {
    // Lv4 と Lv5 はどちらもバランス
    const html = render(5, 4, false);
    expect(html).toContain('バランス');
    expect(html).toContain('現在のポートフォリオはあなたのリスク許容度と合っています');
    expect(html).not.toContain('RISK_EXCESS_WARNING');
  });

  it('有料：7段階（レベル N・7段階の一覧）と RiskExcessWarning のまま', () => {
    const html = render(6, 3, true);
    expect(html).toMatch(/レベル\s*(<!-- -->)?\s*6/);
    expect(html).toMatch(/レベル\s*(<!-- -->)?\s*3/);
    expect(html).toContain(getRiskLevelDef(6).name);
    expect(html).toContain('リスクレベル一覧');
    expect(html).toContain('RISK_EXCESS_WARNING');
    expect(html).not.toContain('リスクの3つの段階');
    expect(html).not.toContain('有料のプログラムで扱います');
  });

  it('有料：7段階で違えば3段階で同じでもズレとして出す', () => {
    const html = render(5, 4, true);
    expect(html).toContain('現在のポートフォリオはあなたのリスク許容度より積極的です');
    expect(html).toContain('RISK_EXCESS_WARNING');
  });
});

describe('PfAssessmentBadge（/pf の入力画面のリスク許容度）', () => {
  it('無料は3段階の名前だけ', () => {
    const html = renderToStaticMarkup(<PfAssessmentBadge assessmentLevel={5} isPremium={false} />);
    expect(html).toContain('バランス');
    expect(html).not.toContain('レベル');
  });

  it('有料はレベル番号と7段階の名前', () => {
    const html = renderToStaticMarkup(<PfAssessmentBadge assessmentLevel={5} isPremium={true} />);
    expect(html).toContain('レベル 5');
    expect(html).toContain(getRiskLevelDef(5).name);
  });
});
