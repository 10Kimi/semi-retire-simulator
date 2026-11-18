import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MODEL_ALLOCATIONS } from './types';

type Write = { table: string; op: 'insert' | 'upsert' | 'update'; payload: unknown };

const db = vi.hoisted(() => ({
  writes: [] as Write[],
  result: { error: null as unknown },
  profileRow: null as Record<string, unknown> | null,
  profileError: null as unknown,
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => ({
      upsert: async (payload: unknown) => {
        db.writes.push({ table, op: 'upsert', payload });
        return db.result;
      },
      insert: async (payload: unknown) => {
        db.writes.push({ table, op: 'insert', payload });
        return db.result;
      },
      update: (payload: unknown) => ({
        eq: async () => {
          db.writes.push({ table, op: 'update', payload });
          return db.result;
        },
      }),
      select: () => ({
        eq: () => ({
          single: async () => ({ data: db.profileRow, error: db.profileError }),
        }),
      }),
    }),
  },
}));

import {
  adoptModelAllocation,
  clearServerLivingCost,
  fetchRbProfile,
  saveRbProfile,
  saveTargetAllocation,
  todayInJapan,
} from './db';
import * as rbDb from './db';

beforeEach(() => {
  db.result = { error: null };
  db.writes = [];
  db.profileRow = null;
  db.profileError = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('目標配分の保存', () => {
  it('saveTargetAllocation：保存できたら true', async () => {
    expect(await saveTargetAllocation('user-1', {})).toBe(true);
  });

  it('saveTargetAllocation：失敗したら false', async () => {
    db.result = { error: { message: 'failed' } };
    expect(await saveTargetAllocation('user-1', {})).toBe(false);
  });

  it('adoptModelAllocation：そのレベルのモデル配分を保存して true', async () => {
    expect(await adoptModelAllocation('user-1', 4)).toBe(true);
    const rows = db.writes[0].payload as { asset_class: string; target_ratio: number }[];
    const saved = Object.fromEntries(rows.map(r => [r.asset_class, r.target_ratio]));
    for (const [key, ratio] of Object.entries(MODEL_ALLOCATIONS[4])) {
      expect(saved[key]).toBe(ratio);
    }
  });

  // handleAdopt はこの戻り値が false のとき 'done' にしない
  it('adoptModelAllocation：失敗したら false', async () => {
    db.result = { error: { message: 'failed' } };
    expect(await adoptModelAllocation('user-1', 4)).toBe(false);
  });
});

describe('金額をサーバーに書かない（D-065、FI_project #109）', () => {
  it('残高をサーバーに保存・読み込みする関数は無い', () => {
    expect('saveSnapshot' in rbDb).toBe(false);
    expect('fetchLatestSnapshot' in rbDb).toBe(false);
    expect('fetchSnapshotDates' in rbDb).toBe(false);
  });

  it('saveRbProfile は月数だけを送り、生活費の列を送らない', async () => {
    expect(await saveRbProfile('user-1', 12)).toBe(true);
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0].table).toBe('user_rb_profile');
    expect(db.writes[0].payload).toEqual({ user_id: 'user-1', emergency_months: 12 });
    expect(db.writes.some(w => w.table === 'rb_snapshots')).toBe(false);
  });

  it('saveRbProfile：失敗したら false', async () => {
    db.result = { error: { message: 'failed' } };
    expect(await saveRbProfile('user-1', 6)).toBe(false);
  });

  it('clearServerLivingCost は生活費を null にするだけ', async () => {
    expect(await clearServerLivingCost('user-1')).toBe(true);
    expect(db.writes).toEqual([{ table: 'user_rb_profile', op: 'update', payload: { monthly_living_cost: null } }]);
    db.result = { error: { message: 'failed' } };
    expect(await clearServerLivingCost('user-1')).toBe(false);
  });
});

describe('fetchRbProfile', () => {
  it('行があれば月数と、移すための古い生活費を返す', async () => {
    db.profileRow = { monthly_living_cost: 300000, emergency_months: 12 };
    expect(await fetchRbProfile('user-1')).toEqual({ emergency_months: 12, legacy_monthly_living_cost: 300000 });
  });

  it('生活費が null なら null', async () => {
    db.profileRow = { monthly_living_cost: null, emergency_months: 3 };
    expect(await fetchRbProfile('user-1')).toEqual({ emergency_months: 3, legacy_monthly_living_cost: null });
  });

  it('行が無ければ既定値（6か月）', async () => {
    db.profileError = { code: 'PGRST116' };
    expect(await fetchRbProfile('user-1')).toEqual({ emergency_months: 6, legacy_monthly_living_cost: null });
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
