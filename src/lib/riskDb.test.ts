import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  result: { data: null as { id: string } | null, error: null as unknown },
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => db.result }) }),
    }),
  },
}));

import { saveRiskResult } from './riskDb';

describe('saveRiskResult', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('保存できたら id を返す', async () => {
    db.result = { data: { id: 'row-1' }, error: null };
    expect(await saveRiskResult('user-1', 3, 4, 3, [])).toBe('row-1');
  });

  it('失敗したら null を返す', async () => {
    db.result = { data: null, error: { message: 'failed' } };
    expect(await saveRiskResult('user-1', 3, 4, 3, [])).toBeNull();
  });
});
