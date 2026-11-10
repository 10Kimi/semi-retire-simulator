import { beforeEach, describe, expect, it, vi } from 'vitest';

// fund_master_requests・fund_master の中身と、insert された行を持つだけの簡単な偽物
const db = vi.hoisted(() => ({
  requests: [] as { user_id: string; ticker: string; status: string }[],
  master: [] as { ticker: string }[],
  inserted: [] as { table: string; row: Record<string, unknown> }[],
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const filters: Record<string, string> = {};
      const rows = () => (table === 'fund_master' ? db.master : db.requests) as Record<string, unknown>[];
      const q = {
        select: () => q,
        eq: (k: string, v: string) => { filters[k] = v; return q; },
        limit: async () => ({ data: rows().filter(r => Object.entries(filters).every(([k, v]) => r[k] === v)), error: null }),
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: rows().filter(r => Object.entries(filters).every(([k, v]) => r[k] === v)), error: null }),
        insert: async (row: Record<string, unknown>) => { db.inserted.push({ table, row }); return { error: null }; },
      };
      return q;
    },
  },
}));

import { fetchSubmittedRequestTickers, fundRequestBadge, submitFundRequest } from './db';

beforeEach(() => {
  db.requests = [];
  db.master = [];
  db.inserted = [];
});

describe('登録リクエストの審査待ち（#38）', () => {
  it('Yahoo で確かめられないまま送ると pending_review になり、fund_master には入れない', async () => {
    const r = await submitFundRequest('u', 'eMAXIS Slim 新興国株式インデックス', 'eMAXIS Slim 新興国株式インデックス', 'emerging_equity', true);
    expect(r).toEqual({ status: 'pending_review' });
    expect(db.inserted.map(i => i.table)).toEqual(['fund_master_requests']);
    expect(db.inserted[0].row.status).toBe('pending_review');
  });

  it('同じ銘柄を審査待ちのまま送り直したら pending_review を返す（登録済みと見せない）', async () => {
    db.requests = [{ user_id: 'u', ticker: 'X', status: 'pending_review' }];
    expect(await submitFundRequest('u', 'X', 'X', 'japan_equity')).toEqual({ status: 'pending_review' });
    db.requests = [{ user_id: 'u', ticker: 'X', status: 'approved' }];
    expect(await submitFundRequest('u', 'X', 'X', 'japan_equity')).toEqual({ status: 'already_sent' });
  });

  it('送信済みの一覧から審査待ちを分けて返す', async () => {
    db.requests = [
      { user_id: 'u', ticker: 'A', status: 'pending_review' },
      { user_id: 'u', ticker: 'B', status: 'approved' },
    ];
    const s = await fetchSubmittedRequestTickers('u');
    expect([...s.all].sort()).toEqual(['A', 'B']);
    expect([...s.pending]).toEqual(['A']);
  });

  it('表示：審査待ちは「審査中」、承認済みは「登録済み」、未送信は出さない', () => {
    const requested = new Set(['A', 'B']);
    const pending = new Set(['A']);
    expect(fundRequestBadge('A', requested, pending)).toBe('送信しました（審査中）');
    expect(fundRequestBadge('B', requested, pending)).toBe('登録済み');
    expect(fundRequestBadge('C', requested, pending)).toBeNull();
  });
});
