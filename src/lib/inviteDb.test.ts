import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
  calls: [] as { fn: string; args: unknown }[],
  fromCalled: false,
}));

vi.mock('./supabase', () => ({
  supabase: {
    rpc: async (fn: string, args: unknown) => {
      db.calls.push({ fn, args });
      return db.result;
    },
    from: () => {
      db.fromCalled = true;
      throw new Error('テーブルを直接触らない');
    },
  },
}));

import { redeemInviteCode } from './inviteDb';

describe('redeemInviteCode', () => {
  beforeEach(() => {
    db.result = { data: null, error: null };
    db.calls = [];
    db.fromCalled = false;
  });

  it('サーバー側の関数だけを呼び、コードの前後の空白を除いて渡す', async () => {
    db.result = { data: 'ok', error: null };
    const r = await redeemInviteCode('  ABC123 ');
    expect(r).toEqual({ success: true, message: '有料プランが有効になりました' });
    expect(db.calls).toEqual([{ fn: 'redeem_invite_code', args: { p_code: 'ABC123' } }]);
    expect(db.fromCalled).toBe(false);
  });

  it.each([
    ['not_found', 'このコードは存在しません'],
    ['used', 'このコードは既に使用されています'],
    ['unauthenticated', 'コードの適用に失敗しました'],
  ])('関数の結果 %s は失敗として伝える', async (status, message) => {
    db.result = { data: status, error: null };
    expect(await redeemInviteCode('X')).toEqual({ success: false, message });
  });

  it('関数の呼び出しが失敗したら失敗として伝える', async () => {
    db.result = { data: null, error: { message: 'boom' } };
    expect(await redeemInviteCode('X')).toEqual({ success: false, message: 'コードの適用に失敗しました' });
  });
});
