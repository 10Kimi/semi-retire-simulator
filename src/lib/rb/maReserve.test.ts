// 期待値は検算役が実装を見ずに出したもの（FI_project #118、ケース G〜L）
import { describe, expect, it } from 'vitest';
import { defaultAmounts, saveLocalAmounts, setLocalBase, type AmountStorage } from '../ma/localAmounts';
import { pickMaReserve } from './maReserve';

const USER = 'u1';
function storageWith(reserve: number | null): AmountStorage {
  const map = new Map<string, string>();
  const s: AmountStorage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); } };
  if (reserve != null) saveLocalAmounts(s, USER, { ...defaultAmounts(), reserve_balance: reserve });
  return s;
}

describe('pickMaReserve（/rb が別枠にする /ma の待機資金）', () => {
  it.each([
    ['G 目印あり・サーバーの値を採る', { keep_amounts_on_server: true, reserve_balance: 420_000 }, 99_000, 420_000, 'server'],
    ['H 目印なしの行の値は使わない', { keep_amounts_on_server: false, reserve_balance: 420_000 }, 99_000, 99_000, 'browser'],
    ['I 目印なし・ブラウザの値なし', { keep_amounts_on_server: false, reserve_balance: 420_000 }, null, 0, 'none'],
    ['J 行もブラウザの値もない', null, null, 0, 'none'],
    ['K 目印ありでもサーバーが null ならブラウザ', { keep_amounts_on_server: true, reserve_balance: null }, 50_000, 50_000, 'browser'],
    ['L 数値の文字列を数値として読む', { keep_amounts_on_server: true, reserve_balance: '420000' }, null, 420_000, 'server'],
  ] as const)('%s', (_, row, local, amount, source) => {
    expect(pickMaReserve(row, storageWith(local), USER)).toEqual({ amount, source });
  });

  it('ブラウザの値が 0 なら 0・browser（読めないとは扱わない）', () => {
    expect(pickMaReserve(null, storageWith(0), USER)).toEqual({ amount: 0, source: 'browser' });
  });

  it('ストレージが使えないときは none', () => {
    expect(pickMaReserve(null, null, USER)).toEqual({ amount: 0, source: 'none' });
  });
});

describe('レビュー役の指摘で足したもの（#118）', () => {
  it('サーバーの値が負なら 0・server', () => {
    expect(pickMaReserve({ keep_amounts_on_server: true, reserve_balance: -1 }, storageWith(null), USER)).toEqual({ amount: 0, source: 'server' });
  });

  it('ほかの端末で /ma を保存したあと（版がこの端末の base と違う）なら browser-stale、値はこの端末のもの', () => {
    const s = storageWith(99_000); // base は null
    expect(pickMaReserve({ keep_amounts_on_server: false, reserve_balance: null, vault_saved_at: '2026-11-19T00:00:00Z' }, s, USER))
      .toEqual({ amount: 99_000, source: 'browser-stale' });
  });

  it('版がそろっていれば browser', () => {
    const s = storageWith(99_000);
    setLocalBase(s, USER, '2026-11-19T00:00:00Z');
    expect(pickMaReserve({ keep_amounts_on_server: false, reserve_balance: null, vault_saved_at: '2026-11-19T00:00:00.000Z' }, s, USER))
      .toEqual({ amount: 99_000, source: 'browser' });
  });

  it('サーバーを読めず、この端末にも値が無ければ unavailable', () => {
    expect(pickMaReserve(null, storageWith(null), USER, true)).toEqual({ amount: 0, source: 'unavailable' });
  });

  it('サーバーを読めなくても、この端末に値があれば browser', () => {
    expect(pickMaReserve(null, storageWith(30_000), USER, true)).toEqual({ amount: 30_000, source: 'browser' });
  });
});

describe('台帳の残高を優先する（#140）', () => {
  it('本人の行で台帳の残高があれば、reserve_balance より台帳を採る', () => {
    expect(pickMaReserve({ keep_amounts_on_server: true, reserve_balance: 420_000, ledger_balance: 433_323 }, storageWith(99_000), USER))
      .toEqual({ amount: 433_323, source: 'server' });
  });

  it('台帳の残高が 0 でも台帳を採る（null とは扱いが違う）', () => {
    expect(pickMaReserve({ keep_amounts_on_server: true, reserve_balance: 420_000, ledger_balance: 0 }, storageWith(null), USER))
      .toEqual({ amount: 0, source: 'server' });
  });

  it('台帳が空・読めない（null）なら今どおり reserve_balance', () => {
    expect(pickMaReserve({ keep_amounts_on_server: true, reserve_balance: 420_000, ledger_balance: null }, storageWith(null), USER))
      .toEqual({ amount: 420_000, source: 'server' });
  });

  it('目印なしの行は台帳の値があっても使わない', () => {
    expect(pickMaReserve({ keep_amounts_on_server: false, reserve_balance: null, ledger_balance: 433_323 }, storageWith(99_000), USER))
      .toEqual({ amount: 99_000, source: 'browser' });
  });
});
