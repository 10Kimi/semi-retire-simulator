import { afterEach, describe, expect, it } from 'vitest';
import {
  MA_AMOUNT_UPGRADES, amountsToJson, defaultAmounts, loadLocalAmounts, loadLocalRaw, saveLocalAmounts, saveLocalRaw,
  storageKey, storageKeyFor, type AmountStorage, type MaAmounts,
} from './localAmounts';

// 版の引き継ぎ（FI_project #135）。今の版は 1。架空の v0 は月の予算を budget という名前で持っていたことにする
const USER = 'u1';

class MemoryStorage implements AmountStorage {
  map = new Map<string, string>();
  failSet = false;
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.failSet) throw new Error('QuotaExceededError'); this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

const amounts: MaAmounts = {
  ...defaultAmounts(),
  monthly_budget: 123_456,
  reserve_balance: 789_012,
  reserve_month: '2026-11',
  reserve_month_base: 700_000,
};

function v0Raw(): string {
  const { monthly_budget, ...rest } = amounts;
  return JSON.stringify({ version: 0, saved_at: '2026-11-01T00:00:00.000Z', base: '2026-10-31T00:00:00.000Z', budget: monthly_budget, ...rest });
}

function addFakeV0() {
  MA_AMOUNT_UPGRADES[0] = ({ budget, ...rest }) => ({ ...rest, monthly_budget: budget });
}

afterEach(() => { delete MA_AMOUNT_UPGRADES[0]; });

describe('今の版（v1）のデータは変わらず読める', () => {
  it('保存した文字列がそのまま読め、金額も同じ', () => {
    const s = new MemoryStorage();
    expect(saveLocalAmounts(s, USER, amounts)).toBe(true);
    const raw = s.map.get(storageKey(USER))!;
    expect(storageKey(USER)).toBe(`fi.ma.amounts.v1.${USER}`);
    expect(JSON.parse(raw).version).toBe(1);
    expect(loadLocalRaw(s, USER)).toBe(raw);
    expect(loadLocalAmounts(s, USER)).toEqual(amounts);
  });

  it('引き継ぎの変換があっても、v1 の文字列は1文字も変えない', () => {
    const s = new MemoryStorage();
    const raw = amountsToJson(amounts, '2026-11-20T00:00:00.000Z', 'base-x');
    s.map.set(storageKey(USER), raw);
    addFakeV0();
    expect(loadLocalRaw(s, USER)).toBe(raw);
    expect(loadLocalAmounts(s, USER)).toEqual(amounts);
    expect(saveLocalRaw(s, USER, raw)).toBe(true);
    expect(s.map.get(storageKey(USER))).toBe(raw);
  });

  it('引き継げない版（変換が無い v0・新しすぎる v2）は読まず、消さない', () => {
    const s = new MemoryStorage();
    s.map.set(storageKeyFor(0, USER), v0Raw());
    expect(loadLocalAmounts(s, USER)).toBeNull();
    expect(s.map.get(storageKeyFor(0, USER))).toBe(v0Raw());
    s.map.set(storageKey(USER), JSON.stringify({ ...JSON.parse(amountsToJson(amounts)), version: 2 }));
    expect(loadLocalAmounts(s, USER)).toBeNull();
  });
});

describe('前の版（架空の v0）から引き継ぐ', () => {
  it('古い名前の v0 を引き継いで v1 の名前に保存し、古い名前を消す（saved_at・base も残す）', () => {
    const s = new MemoryStorage();
    s.map.set(storageKeyFor(0, USER), v0Raw());
    addFakeV0();
    expect(loadLocalAmounts(s, USER)).toEqual(amounts);
    const saved = JSON.parse(s.map.get(storageKey(USER))!);
    expect(saved.version).toBe(1);
    expect(saved.monthly_budget).toBe(123_456);
    expect(saved.budget).toBeUndefined();
    expect(saved.saved_at).toBe('2026-11-01T00:00:00.000Z');
    expect(saved.base).toBe('2026-10-31T00:00:00.000Z');
    expect(s.map.has(storageKeyFor(0, USER))).toBe(false);
  });

  it('引き継ぎで保存に失敗したら、古いデータは残る', () => {
    const s = new MemoryStorage();
    s.map.set(storageKeyFor(0, USER), v0Raw());
    addFakeV0();
    s.failSet = true;
    expect(loadLocalAmounts(s, USER)).toBeNull();
    expect(s.map.get(storageKeyFor(0, USER))).toBe(v0Raw());
    expect(s.map.has(storageKey(USER))).toBe(false);
    // 次に保存できるようになれば引き継げる
    s.failSet = false;
    expect(loadLocalAmounts(s, USER)).toEqual(amounts);
  });

  it('サーバーの暗号文から戻した v0 の文字列は、v1 にしてから保存する', () => {
    const s = new MemoryStorage();
    addFakeV0();
    expect(saveLocalRaw(s, USER, v0Raw())).toBe(true);
    expect(JSON.parse(s.map.get(storageKey(USER))!).version).toBe(1);
    expect(loadLocalAmounts(s, USER)).toEqual(amounts);
  });
});
