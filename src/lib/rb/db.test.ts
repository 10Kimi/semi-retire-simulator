import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MODEL_ALLOCATIONS } from './types';

type SnapshotRow = { snapshot_date: string; asset_class: string; amount: number; created_at: string };

const db = vi.hoisted(() => ({
  snapshots: [] as SnapshotRow[],
  clock: 0,
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
      insert: async (rows: Omit<SnapshotRow, 'created_at'>[]) => {
        if (db.result.error) return db.result;
        db.clock += 1; // 1回の insert の行は同じ created_at
        const created_at = `2026-11-05T01:00:${String(db.clock).padStart(2, '0')}.000000+00:00`;
        db.snapshots.push(...rows.map(r => ({ ...r, created_at })));
        return db.result;
      },
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async (n: number) => ({
              data: [...db.snapshots].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, n),
              error: null,
            }),
          }),
        }),
      }),
    }),
  },
}));

import {
  adoptModelAllocation,
  fetchLatestSnapshot,
  saveRbProfile,
  saveSnapshot,
  saveTargetAllocation,
  todayInJapan,
} from './db';

describe('目標配分の保存', () => {
  beforeEach(() => {
    db.result = { error: null };
    db.rows = [];
    db.snapshots = [];
    db.clock = 0;
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

describe('スナップショットの復元', () => {
  beforeEach(() => {
    db.result = { error: null };
    db.snapshots = [];
    db.clock = 0;
  });

  it('同じ日に2回保存すると、2回目の内容だけが復元される（0にした資産クラスは戻らない）', async () => {
    await saveSnapshot('user-1', { us_equity: 100, gold: 50, japan_equity: 30 });
    await saveSnapshot('user-1', { us_equity: 200, gold: 0, japan_equity: 30 });
    expect(db.snapshots).toHaveLength(5);

    const latest = await fetchLatestSnapshot('user-1');
    expect(latest?.holdings).toEqual({ us_equity: 200, japan_equity: 30 });
  });

  it('3回保存しても最後の1回分だけ（古い行の方が多くても）', async () => {
    await saveSnapshot('user-1', { us_equity: 1, gold: 2, japan_equity: 3, japan_bond: 4 });
    await saveSnapshot('user-1', { us_equity: 5, gold: 6, japan_equity: 7, japan_bond: 8 });
    await saveSnapshot('user-1', { gold: 9 });

    const latest = await fetchLatestSnapshot('user-1');
    expect(latest?.holdings).toEqual({ gold: 9 });
  });

  it('保存が無ければ null', async () => {
    expect(await fetchLatestSnapshot('user-1')).toBeNull();
  });
});

describe('todayInJapan', () => {
  it('日本時間の 0〜9 時も当日の日付になる', () => {
    expect(todayInJapan(new Date('2026-11-04T15:30:00Z'))).toBe('2026-11-05');
  });

  it('日本時間の夕方はそのままの日付', () => {
    expect(todayInJapan(new Date('2026-11-05T09:00:00Z'))).toBe('2026-11-05');
  });
});
