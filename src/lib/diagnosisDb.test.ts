import { beforeEach, describe, expect, it, vi } from 'vitest';

// /pf を使っても金額がサーバーに送られないことを確かめる（FI_project #110、D-065）
const db = vi.hoisted(() => ({
  calls: [] as { fn: string; args: Record<string, unknown> }[],
  fromCalled: false,
}));

vi.mock('./supabase', () => ({
  supabase: {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      db.calls.push({ fn, args });
      return { data: 'new-id', error: null };
    },
    from: () => {
      db.fromCalled = true;
      throw new Error('テーブルに直接書かない');
    },
  },
}));

import { buildPfSaveInput, savePfWithSnapshot, toHoldingWeights } from './diagnosisDb';

// 架空の保有額（万円）
const holdings = { us_equity: 1234, japan_equity: 456, gold: 78, cash: 0 };
const total = 1234 + 456 + 78;

describe('toHoldingWeights', () => {
  it('保有額を割合（%）に変え、0 のクラスは入れない', () => {
    const w = toHoldingWeights(holdings);
    expect(Object.keys(w).sort()).toEqual(['gold', 'japan_equity', 'us_equity']);
    expect(w.us_equity).toBeCloseTo((1234 / total) * 100, 3);
    expect(w.gold).toBeCloseTo((78 / total) * 100, 3);
    const sum = Object.values(w).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  it('合計が 0 なら空', () => {
    expect(toHoldingWeights({ us_equity: 0 })).toEqual({});
    expect(toHoldingWeights({})).toEqual({});
  });

  it('保有額をいくら変えても、同じ比なら同じ割合になる（金額は復元できない）', () => {
    const doubled = Object.fromEntries(Object.entries(holdings).map(([k, v]) => [k, v * 2]));
    expect(toHoldingWeights(doubled)).toEqual(toHoldingWeights(holdings));
  });
});

describe('/pf の保存で送るもの', () => {
  beforeEach(() => {
    db.calls = [];
    db.fromCalled = false;
  });

  it('RPC には割合と指標だけを送り、金額（保有額・合計）は送らない', async () => {
    const input = buildPfSaveInput({
      holdings,
      expectedReturn: 5.2,
      volatility: 14.1,
      riskLevel: 5,
      assessmentLevel: 4,
      assessmentId: 'a-1',
      assessedAt: '2026-11-01T00:00:00Z',
    });
    const id = await savePfWithSnapshot(input);

    expect(id).toBe('new-id');
    expect(db.fromCalled).toBe(false);
    expect(db.calls).toHaveLength(1);
    const { fn, args } = db.calls[0];
    expect(fn).toBe('save_pf_weights_with_snapshot');
    expect(Object.keys(args).sort()).toEqual([
      'p_assessed_at',
      'p_assessment_id',
      'p_assessment_level_7',
      'p_assessment_risk_level',
      'p_assessment_source',
      'p_expected_return',
      'p_holding_weights',
      'p_risk_level',
      'p_risk_level_key',
      'p_volatility',
    ]);

    // 送る中身のどこにも保有額・合計の数が出てこない
    const sent = JSON.stringify(args);
    for (const v of [1234, 456, 78, total]) {
      expect(sent).not.toMatch(new RegExp(`(^|[^0-9.])${v}([^0-9]|$)`));
    }
    // 割合はどれも 0〜100、合計は 100
    const weights = args.p_holding_weights as Record<string, number>;
    for (const v of Object.values(weights)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(Object.values(weights).reduce((s, v) => s + v, 0)).toBeCloseTo(100, 2);
  });

  it('診断が無い人は診断の欄を null で送る', () => {
    const input = buildPfSaveInput({
      holdings,
      expectedReturn: 5.2,
      volatility: 14.1,
      riskLevel: 5,
      assessmentLevel: null,
      assessmentId: null,
      assessedAt: null,
    });
    expect(input.assessmentRiskLevel).toBeNull();
    expect(input.assessmentSource).toBeNull();
    expect(input.assessmentLevel7).toBeNull();
    expect(input.riskLevelKey).toBe('level_5');
  });
});
