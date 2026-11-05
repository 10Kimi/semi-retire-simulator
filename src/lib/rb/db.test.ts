import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MODEL_ALLOCATIONS } from './types';

const db = vi.hoisted(() => ({
  result: { error: null as unknown },
  rows: [] as { asset_class: string; target_ratio: number }[],
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      upsert: async (rows: typeof db.rows) => {
        db.rows = rows;
        return db.result;
      },
      insert: async () => db.result,
    }),
  },
}));

import { adoptModelAllocation, saveRbProfile, saveSnapshot, saveTargetAllocation } from './db';

describe('目標配分の保存', () => {
  beforeEach(() => {
    db.result = { error: null };
    db.rows = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('saveTargetAllocation：保存できたら true', async () => {
    expect(await saveTargetAllocation('user-1', {})).toBe(true);
  });

  it('saveTargetAllocation：失敗したら false', async () => {
    db.result = { error: { message: 'failed' } };
    expect(await saveTargetAllocation('user-1', {})).toBe(false);
  });

  it('adoptModelAllocation：そのレベルのモデル配分を保存して true', async () => {
    expect(await adoptModelAllocation('user-1', 4)).toBe(true);
    const saved = Object.fromEntries(db.rows.map(r => [r.asset_class, r.target_ratio]));
    for (const [key, ratio] of Object.entries(MODEL_ALLOCATIONS[4])) {
      expect(saved[key]).toBe(ratio);
    }
  });

  // handleAdopt はこの戻り値が false のとき 'done' にしない
  it('adoptModelAllocation：失敗したら false', async () => {
    db.result = { error: { message: 'failed' } };
    expect(await adoptModelAllocation('user-1', 4)).toBe(false);
  });

  it('saveSnapshot：保存できたら true、失敗したら false', async () => {
    expect(await saveSnapshot('user-1', { us_equity: 100 })).toBe(true);
    db.result = { error: { message: 'failed' } };
    expect(await saveSnapshot('user-1', { us_equity: 100 })).toBe(false);
  });

  it('saveSnapshot：保存する行が無ければ true', async () => {
    db.result = { error: { message: 'failed' } };
    expect(await saveSnapshot('user-1', {})).toBe(true);
  });

  it('saveRbProfile：保存できたら true、失敗したら false', async () => {
    const profile = { monthly_living_cost: null, emergency_months: 6 };
    expect(await saveRbProfile('user-1', profile)).toBe(true);
    db.result = { error: { message: 'failed' } };
    expect(await saveRbProfile('user-1', profile)).toBe(false);
  });
});
