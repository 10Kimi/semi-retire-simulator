import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from './types';
import { settingsToRow } from './settingsRow';

const USER = 'user-1';
const existingRow = { ...settingsToRow(USER, DEFAULT_SETTINGS), monthly_budget: 123456 };

const db = vi.hoisted(() => ({
  selects: [] as unknown[],
  upsertResult: { data: null as unknown, error: null as unknown },
  upsertCalls: [] as { row: unknown; options: unknown }[],
  insertCalls: 0,
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => db.selects.shift() }),
      }),
      insert: () => { db.insertCalls += 1; throw new Error('insert は使わない'); },
      upsert: (row: unknown, options: unknown) => {
        db.upsertCalls.push({ row, options });
        return { select: () => ({ maybeSingle: async () => db.upsertResult }) };
      },
    }),
  },
}));

import { fetchUserSettings } from './db';

const NOT_FOUND = { data: null, error: { code: 'PGRST116' } };

describe('fetchUserSettings の初回作成', () => {
  beforeEach(() => {
    db.selects = [];
    db.upsertResult = { data: null, error: null };
    db.upsertCalls = [];
    db.insertCalls = 0;
  });

  it('行があれば作成せず、その行を返す', async () => {
    db.selects = [{ data: existingRow, error: null }];
    const s = await fetchUserSettings(USER);
    expect(s.monthly_budget).toBe(123456);
    expect(db.upsertCalls).toHaveLength(0);
  });

  it('行が無ければ既定値で作成する', async () => {
    db.selects = [NOT_FOUND];
    db.upsertResult = { data: settingsToRow(USER, DEFAULT_SETTINGS), error: null };
    const s = await fetchUserSettings(USER);
    expect(s.monthly_budget).toBe(DEFAULT_SETTINGS.monthly_budget);
    expect(db.upsertCalls).toHaveLength(1);
  });

  it('既存の行を上書きしない（重複は無視する指定で作成する）', async () => {
    db.selects = [NOT_FOUND];
    db.upsertResult = { data: settingsToRow(USER, DEFAULT_SETTINGS), error: null };
    await fetchUserSettings(USER);
    expect(db.upsertCalls[0].options).toEqual({ onConflict: 'user_id', ignoreDuplicates: true });
    expect(db.insertCalls).toBe(0);
  });

  it('同時に作られて重複したら、読み直して既存の行を返す', async () => {
    db.selects = [NOT_FOUND, { data: existingRow, error: null }];
    db.upsertResult = { data: null, error: null };
    const s = await fetchUserSettings(USER);
    expect(s.monthly_budget).toBe(123456);
  });
});
