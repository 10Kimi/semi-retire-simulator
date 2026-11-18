import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadRbAmounts,
  patchRbAmounts,
  planLivingCostMove,
  rbStorageKey,
  saveLocalHoldings,
  saveLocalLivingCost,
  type AmountStorage,
} from './localAmounts';
import { ASSET_CLASSES } from './types';

class MemoryStorage implements AmountStorage {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

class BrokenStorage implements AmountStorage {
  getItem(): string | null { return null; }
  setItem(): void { throw new Error('QuotaExceededError'); }
}

let s: MemoryStorage;
beforeEach(() => { s = new MemoryStorage(); });

describe('残高をブラウザに保存・復元する', () => {
  it('保存した残高と日付が戻る。一覧に無いクラスは 0', () => {
    expect(saveLocalHoldings(s, 'u1', { us_equity: 1_000_000, gold: 50_000 }, '2026-11-18')).toBe(true);
    const got = loadRbAmounts(s, 'u1')!;
    expect(got.holdingsDate).toBe('2026-11-18');
    expect(got.holdings!.us_equity).toBe(1_000_000);
    expect(got.holdings!.gold).toBe(50_000);
    expect(Object.keys(got.holdings!)).toHaveLength(ASSET_CLASSES.length);
    expect(got.holdings!.japan_equity).toBe(0);
  });

  it('最後に保存した回だけが残る（0 にしたクラスは 0 で戻る）', () => {
    saveLocalHoldings(s, 'u1', { us_equity: 100, gold: 50 }, '2026-11-01');
    saveLocalHoldings(s, 'u1', { us_equity: 200, gold: 0 }, '2026-11-18');
    const got = loadRbAmounts(s, 'u1')!;
    expect(got.holdings!.us_equity).toBe(200);
    expect(got.holdings!.gold).toBe(0);
    expect(got.holdingsDate).toBe('2026-11-18');
  });

  it('負の値・数でない値は 0 にする', () => {
    saveLocalHoldings(s, 'u1', { us_equity: -5, gold: Number.NaN }, '2026-11-18');
    const got = loadRbAmounts(s, 'u1')!;
    expect(got.holdings!.us_equity).toBe(0);
    expect(got.holdings!.gold).toBe(0);
  });

  it('利用者ごとに分ける', () => {
    saveLocalHoldings(s, 'u1', { us_equity: 100 }, '2026-11-18');
    expect(loadRbAmounts(s, 'u2')).toBeNull();
  });

  it('残高を保存しても生活費は消えない（逆も）', () => {
    saveLocalLivingCost(s, 'u1', 300_000);
    saveLocalHoldings(s, 'u1', { us_equity: 100 }, '2026-11-18');
    expect(loadRbAmounts(s, 'u1')!.monthlyLivingCost).toBe(300_000);
    saveLocalLivingCost(s, 'u1', 250_000);
    expect(loadRbAmounts(s, 'u1')!.holdings!.us_equity).toBe(100);
  });
});

describe('生活費をブラウザに保存する', () => {
  it('0・null は未入力（null）', () => {
    saveLocalLivingCost(s, 'u1', 0);
    expect(loadRbAmounts(s, 'u1')!.monthlyLivingCost).toBeNull();
    saveLocalLivingCost(s, 'u1', 300_000);
    saveLocalLivingCost(s, 'u1', null);
    expect(loadRbAmounts(s, 'u1')!.monthlyLivingCost).toBeNull();
  });
});

describe('読み込みの守り', () => {
  it('無い・壊れている・版が違うときは null', () => {
    expect(loadRbAmounts(s, 'u1')).toBeNull();
    s.setItem(rbStorageKey('u1'), '{not json');
    expect(loadRbAmounts(s, 'u1')).toBeNull();
    s.setItem(rbStorageKey('u1'), JSON.stringify({ version: 99, holdings: { us_equity: 1 } }));
    expect(loadRbAmounts(s, 'u1')).toBeNull();
  });

  it('残高が無ければ日付も null', () => {
    s.setItem(rbStorageKey('u1'), JSON.stringify({ version: 1, holdings: null, holdingsDate: '2026-11-18', monthlyLivingCost: 1 }));
    expect(loadRbAmounts(s, 'u1')).toEqual({ holdings: null, holdingsDate: null, monthlyLivingCost: 1 });
  });

  it('保存できない環境（容量超過・プライベートブラウズ）では false', () => {
    const b = new BrokenStorage();
    expect(saveLocalHoldings(b, 'u1', { us_equity: 100 }, '2026-11-18')).toBe(false);
    expect(saveLocalLivingCost(b, 'u1', 1)).toBe(false);
    expect(patchRbAmounts(b, 'u1', {})).toBe(false);
  });
});

describe('サーバーに残っている生活費の移し替え（planLivingCostMove）', () => {
  it('サーバーに無い → ブラウザの値、サーバーは触らない', () => {
    expect(planLivingCostMove(null, 200_000)).toEqual({ use: 200_000, saveToLocal: null, clearServer: false });
    expect(planLivingCostMove(null, null)).toEqual({ use: null, saveToLocal: null, clearServer: false });
  });

  it('サーバーにだけある → ブラウザへ移してサーバーを消す', () => {
    expect(planLivingCostMove(300_000, null)).toEqual({ use: 300_000, saveToLocal: 300_000, clearServer: true });
  });

  it('両方にある → ブラウザの値を使い、サーバーを消す', () => {
    expect(planLivingCostMove(300_000, 250_000)).toEqual({ use: 250_000, saveToLocal: null, clearServer: true });
  });

  it('サーバーの値が 0 → 移さずにサーバーを消す', () => {
    expect(planLivingCostMove(0, null)).toEqual({ use: null, saveToLocal: null, clearServer: true });
  });
});
