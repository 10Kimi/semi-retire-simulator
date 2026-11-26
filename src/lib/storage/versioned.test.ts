import { describe, expect, it } from 'vitest';
import { readVersioned, upgradableVersions, upgradeData, upgradeJson, type Upgrades, type VersionedStorage } from './versioned';

// 架空の版：v0 { version: 0, amount } → v1 { version: 1, yen } → v2 { version: 2, yen, memo }
const UPGRADES: Upgrades = {
  0: ({ amount, ...rest }) => ({ ...rest, yen: amount }),
  1: (d) => ({ ...d, memo: '' }),
};
const keyOf = (v: number) => `test.v${v}.u1`;
const isV2 = (json: string) => {
  const v = JSON.parse(json) as { version?: unknown; yen?: unknown };
  return v.version === 2 && typeof v.yen === 'number';
};

class MemoryStorage implements VersionedStorage {
  map = new Map<string, string>();
  failSet = false;
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.failSet) throw new Error('QuotaExceededError'); this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

describe('upgradeData：版ごとの変換を順に当てる', () => {
  it('v0 から v2 まで順に変換し、版の番号も上げる', () => {
    expect(upgradeData({ version: 0, amount: 100, saved_at: 'x' }, 2, UPGRADES)).toEqual({
      ok: true, from: 0, data: { version: 2, yen: 100, memo: '', saved_at: 'x' },
    });
  });

  it('今の版はそのまま', () => {
    expect(upgradeData({ version: 2, yen: 1, memo: 'a' }, 2, UPGRADES)).toEqual({ ok: true, from: 2, data: { version: 2, yen: 1, memo: 'a' } });
  });

  it('新しすぎる版・変換が欠けている版は unsupported-version、形が違えば malformed', () => {
    expect(upgradeData({ version: 3 }, 2, UPGRADES)).toEqual({ ok: false, reason: 'unsupported-version' });
    expect(upgradeData({ version: 0 }, 2, { 1: UPGRADES[1] })).toEqual({ ok: false, reason: 'unsupported-version' });
    expect(upgradeData(null, 2, UPGRADES)).toEqual({ ok: false, reason: 'malformed' });
    expect(upgradeData([], 2, UPGRADES)).toEqual({ ok: false, reason: 'malformed' });
    expect(upgradeData({ yen: 1 }, 2, UPGRADES)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('引き継げる版の一覧は新しい順。途中が欠けたらそこまで', () => {
    expect(upgradableVersions(2, UPGRADES)).toEqual([1, 0]);
    expect(upgradableVersions(2, { 0: UPGRADES[0] })).toEqual([]);
    expect(upgradableVersions(1, {})).toEqual([]);
  });
});

describe('readVersioned：古い名前のデータを引き継ぐ', () => {
  it('古い名前の v0 を引き継いで今の名前に保存し、古い名前を消す', () => {
    const s = new MemoryStorage();
    s.map.set(keyOf(0), JSON.stringify({ version: 0, amount: 500 }));
    const r = readVersioned(s, keyOf, 2, UPGRADES, isV2);
    expect(r.status).toBe('ok');
    const raw = (r as { raw: string }).raw;
    expect(JSON.parse(raw)).toEqual({ version: 2, yen: 500, memo: '' });
    expect(s.map.get(keyOf(2))).toBe(raw);
    expect(s.map.has(keyOf(0))).toBe(false);
  });

  it('新しい方の古い名前を先に使う', () => {
    const s = new MemoryStorage();
    s.map.set(keyOf(0), JSON.stringify({ version: 0, amount: 1 }));
    s.map.set(keyOf(1), JSON.stringify({ version: 1, yen: 2 }));
    const r = readVersioned(s, keyOf, 2, UPGRADES, isV2);
    expect(JSON.parse((r as { raw: string }).raw).yen).toBe(2);
    expect(s.map.has(keyOf(1))).toBe(false);
    expect(s.map.has(keyOf(0))).toBe(true); // 使わなかった古い名前は触らない
  });

  it('保存に失敗したら古いデータは残し、blocked を返す', () => {
    const s = new MemoryStorage();
    const old = JSON.stringify({ version: 0, amount: 500 });
    s.map.set(keyOf(0), old);
    s.failSet = true;
    expect(readVersioned(s, keyOf, 2, UPGRADES, isV2)).toEqual({ status: 'blocked' });
    expect(s.map.get(keyOf(0))).toBe(old);
    expect(s.map.has(keyOf(2))).toBe(false);
  });

  it('変換したあとの形が合わなければ保存せず、古いデータを残す', () => {
    const s = new MemoryStorage();
    const old = JSON.stringify({ version: 0, amount: 'abc' });
    s.map.set(keyOf(0), old);
    expect(readVersioned(s, keyOf, 2, UPGRADES, isV2)).toEqual({ status: 'blocked' });
    expect(s.map.get(keyOf(0))).toBe(old);
  });

  it('今の名前にあれば、古い名前は見ない', () => {
    const s = new MemoryStorage();
    s.map.set(keyOf(2), 'now');
    s.map.set(keyOf(0), JSON.stringify({ version: 0, amount: 1 }));
    expect(readVersioned(s, keyOf, 2, UPGRADES, isV2)).toEqual({ status: 'ok', raw: 'now' });
    expect(s.map.has(keyOf(0))).toBe(true);
  });

  it('古い名前の壊れたデータは消さずに残す', () => {
    const s = new MemoryStorage();
    s.map.set(keyOf(0), '{not json');
    expect(readVersioned(s, keyOf, 2, UPGRADES, isV2)).toEqual({ status: 'ok', raw: null });
    expect(s.map.get(keyOf(0))).toBe('{not json');
  });

  it('removeItem の無いストレージでも引き継げる', () => {
    const map = new Map<string, string>([[keyOf(1), JSON.stringify({ version: 1, yen: 3 })]]);
    const s: VersionedStorage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); } };
    expect(JSON.parse((readVersioned(s, keyOf, 2, UPGRADES, isV2) as { raw: string }).raw).yen).toBe(3);
  });

  it('読めないストレージは error', () => {
    const s: VersionedStorage = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => {} };
    expect(readVersioned(s, keyOf, 2, UPGRADES, isV2)).toEqual({ status: 'error' });
  });
});

describe('upgradeJson', () => {
  it('今の版の文字列は1文字も変えない', () => {
    const raw = '{"version":2,"yen":1,  "memo":"a"}';
    expect(upgradeJson(raw, 2, UPGRADES)).toBe(raw);
  });

  it('古い版は今の版の形にする。壊れている・引き継げない版は null', () => {
    expect(JSON.parse(upgradeJson('{"version":0,"amount":7}', 2, UPGRADES)!)).toEqual({ version: 2, yen: 7, memo: '' });
    expect(upgradeJson('{not json', 2, UPGRADES)).toBeNull();
    expect(upgradeJson('{"version":9}', 2, UPGRADES)).toBeNull();
  });
});
