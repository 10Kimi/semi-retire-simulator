import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from './types';
import { settingsToRow, AMOUNT_COLUMNS } from './settingsRow';
import { loadLocalAmounts, saveLocalAmounts, defaultAmounts, storageKey, type AmountStorage } from './localAmounts';

const USER = 'user-1';
const existingRow = { ...settingsToRow(USER, DEFAULT_SETTINGS), monthly_budget: 123456 };

const db = vi.hoisted(() => ({
  selects: [] as unknown[],
  upsertResult: { data: null as unknown, error: null as unknown },
  upsertCalls: [] as { row: unknown; options: unknown }[],
  updateCalls: [] as Record<string, unknown>[],
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
      update: (patch: Record<string, unknown>) => {
        db.updateCalls.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  },
}));

import { fetchUserSettings, loadUserSettings, updateSettings, updateReserveBalance } from './db';

const NOT_FOUND = { data: null, error: { code: 'PGRST116' } };

function memoryStorage(): AmountStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); } };
}

/** setItem で例外を投げる（容量超過・プライベートブラウズ） */
const brokenStorage: AmountStorage = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };

/** サーバーへ送った値に金額の列が（null 以外で）入っていないか */
function amountKeysWritten(patch: Record<string, unknown>): string[] {
  return AMOUNT_COLUMNS.filter((c) => c in patch && patch[c] !== null);
}

const nullAmountRow = {
  ...settingsToRow(USER, DEFAULT_SETTINGS),
  ...Object.fromEntries(AMOUNT_COLUMNS.map((c) => [c, null])),
  slot1_fund_name: '架空ファンドA',
  keep_amounts_on_server: false,
};

beforeEach(() => {
  db.selects = [];
  db.upsertResult = { data: null, error: null };
  db.upsertCalls = [];
  db.updateCalls = [];
  db.insertCalls = 0;
});

describe('fetchUserSettings の初回作成', () => {
  it('行があれば作成せず、その行を返す', async () => {
    db.selects = [{ data: existingRow, error: null }];
    const s = await fetchUserSettings(USER);
    expect(s.monthly_budget).toBe(123456);
    expect(db.upsertCalls).toHaveLength(0);
  });

  it('行が無ければ既定値で作成する（金額の列は送らない）', async () => {
    db.selects = [NOT_FOUND];
    db.upsertResult = { data: nullAmountRow, error: null };
    const s = await fetchUserSettings(USER);
    expect(s.monthly_budget).toBe(0);
    expect(db.upsertCalls).toHaveLength(1);
    const sent = db.upsertCalls[0].row as Record<string, unknown>;
    for (const c of AMOUNT_COLUMNS) expect(sent).not.toHaveProperty(c);
    expect(sent.slot5_asset_class).toBe('us'); // 金額以外の既定値は送る
  });

  it('既存の行を上書きしない（重複は無視する指定で作成する）', async () => {
    db.selects = [NOT_FOUND];
    db.upsertResult = { data: nullAmountRow, error: null };
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

describe('loadUserSettings：サーバーの金額をブラウザへ移す（D-065）', () => {
  it('サーバーに金額があり、ブラウザに無い → ブラウザへ移してからサーバーの金額を消す', async () => {
    const row = { ...existingRow, slot2_amount: 50000, reserve_balance: 300000, keep_amounts_on_server: false };
    db.selects = [{ data: row, error: null }];
    const st = memoryStorage();
    const s = await loadUserSettings(USER, st);
    expect(s.monthly_budget).toBe(123456);
    expect(s.slot2.amount).toBe(50000);
    const local = loadLocalAmounts(st, USER);
    expect(local?.monthly_budget).toBe(123456);
    expect(local?.reserve_balance).toBe(300000);
    expect(local?.slot_amounts.slot2).toBe(50000);
    expect(db.updateCalls).toHaveLength(1);
    for (const c of AMOUNT_COLUMNS) expect(db.updateCalls[0][c]).toBeNull();
    // 銘柄名などは消さない
    expect(db.updateCalls[0]).not.toHaveProperty('slot1_fund_name');
  });

  it('ブラウザに保存できなければ、サーバーの金額は消さない（表示はサーバーの値）', async () => {
    db.selects = [{ data: { ...existingRow, keep_amounts_on_server: false }, error: null }];
    const s = await loadUserSettings(USER, brokenStorage);
    expect(s.monthly_budget).toBe(123456);
    expect(db.updateCalls).toHaveLength(0);
  });

  it('ストレージが使えないブラウザでも、サーバーの金額は消さない', async () => {
    db.selects = [{ data: { ...existingRow, keep_amounts_on_server: false }, error: null }];
    await loadUserSettings(USER, null);
    expect(db.updateCalls).toHaveLength(0);
  });

  it('サーバーの金額が全部 null → ブラウザの値を使い、サーバーには書かない。銘柄名はサーバーの値', async () => {
    db.selects = [{ data: nullAmountRow, error: null }];
    const st = memoryStorage();
    saveLocalAmounts(st, USER, { ...defaultAmounts(), monthly_budget: 400000, slot_amounts: { ...defaultAmounts().slot_amounts, slot1: 100000 } });
    const s = await loadUserSettings(USER, st);
    expect(s.monthly_budget).toBe(400000);
    expect(s.slot1.amount).toBe(100000);
    expect(s.slot1.fund_name).toBe('架空ファンドA');
    expect(db.updateCalls).toHaveLength(0);
  });

  it('両方にある → ブラウザの値を上書きせず、サーバーの金額を消す', async () => {
    db.selects = [{ data: { ...existingRow, keep_amounts_on_server: false }, error: null }];
    const st = memoryStorage();
    saveLocalAmounts(st, USER, { ...defaultAmounts(), monthly_budget: 777000 });
    const s = await loadUserSettings(USER, st);
    expect(s.monthly_budget).toBe(777000);
    expect(loadLocalAmounts(st, USER)?.monthly_budget).toBe(777000);
    expect(db.updateCalls).toHaveLength(1);
  });

  it('オーナー本人の行（目印あり）はサーバーの金額をそのまま使い、移さず消さない', async () => {
    db.selects = [{ data: { ...existingRow, keep_amounts_on_server: true }, error: null }];
    const st = memoryStorage();
    const s = await loadUserSettings(USER, st);
    expect(s.amounts_on_server).toBe(true);
    expect(s.monthly_budget).toBe(123456);
    expect(st.map.size).toBe(0);
    expect(db.updateCalls).toHaveLength(0);
  });
});

describe('loadUserSettings：例外のケース', () => {
  it('オーナーの行（目印あり）でサーバーが全部 null・ブラウザに値がある → ブラウザの値をサーバーへ書き戻す（目印を付ける前に開いた場合の戻し道）', async () => {
    db.selects = [{ data: { ...nullAmountRow, keep_amounts_on_server: true }, error: null }];
    const st = memoryStorage();
    saveLocalAmounts(st, USER, { ...defaultAmounts(), monthly_budget: 500000, reserve_balance: 80000 });
    const s = await loadUserSettings(USER, st);
    expect(s.monthly_budget).toBe(500000);
    expect(db.updateCalls).toHaveLength(1);
    expect(db.updateCalls[0].monthly_budget).toBe(500000);
    expect(db.updateCalls[0].reserve_balance).toBe(80000);
    expect(db.updateCalls[0].slot1_amount).toBe(0);
  });

  it('サーバーに金額が一部だけ（予算は null、積立2だけ）→ null の列は既定値で埋めて移す', async () => {
    db.selects = [{ data: { ...nullAmountRow, slot2_amount: 50000 }, error: null }];
    const st = memoryStorage();
    const s = await loadUserSettings(USER, st);
    expect(s.monthly_budget).toBe(0);
    expect(s.slot2.amount).toBe(50000);
    expect(loadLocalAmounts(st, USER)?.slot_amounts.slot2).toBe(50000);
    expect(db.updateCalls).toHaveLength(1);
  });

  it('保存できたかを返す（ブラウザに保存できなければ false）', async () => {
    expect(await updateSettings(USER, { monthly_budget: 1 }, false, brokenStorage)).toBe(false);
    expect(await updateReserveBalance(USER, 1, '2026-11', 0, undefined, false, brokenStorage)).toBe(false);
    expect(await updateSettings(USER, { monthly_budget: 1 }, false, memoryStorage())).toBe(true);
    expect(db.updateCalls).toHaveLength(0);
  });
});

describe('金額はサーバーに書かれない（目印の無い行）', () => {
  it('月次予算・積立額・待機資金はブラウザにだけ保存する', async () => {
    const st = memoryStorage();
    await updateSettings(USER, { monthly_budget: 250000 }, false, st);
    await updateSettings(USER, { slot: 'slot3', field: 'amount', value: 30000 }, false, st);
    await updateSettings(USER, { reserve_balance: 90000 }, false, st);
    expect(db.updateCalls).toHaveLength(0);
    const local = loadLocalAmounts(st, USER);
    expect(local?.monthly_budget).toBe(250000);
    expect(local?.slot_amounts.slot3).toBe(30000);
    expect(local?.reserve_balance).toBe(90000);
  });

  it('銘柄名・口座・資産クラス・日本株の指数・PBR の基準はサーバーに保存する（金額は含まない）', async () => {
    const st = memoryStorage();
    await updateSettings(USER, { slot: 'slot1', field: 'fund_name', value: '架空ファンドB' }, false, st);
    await updateSettings(USER, { slot: 'slot1', field: 'account', value: 'nisa_growth' }, false, st);
    await updateSettings(USER, { slot: 'slot1', field: 'asset_class', value: 'us' }, false, st);
    await updateSettings(USER, { jp_index: 'nikkei' }, false, st);
    await updateSettings(USER, { nikkei_pbr_anchor: 1.4, nikkei_price_anchor: 40000 }, false, st);
    expect(db.updateCalls).toEqual([
      { slot1_fund_name: '架空ファンドB' },
      { slot1_account: 'nisa_growth' },
      { slot1_asset_class: 'us' },
      { jp_index: 'nikkei' },
      { nikkei_pbr_anchor: 1.4, nikkei_price_anchor: 40000 },
    ]);
    for (const p of db.updateCalls) expect(amountKeysWritten(p)).toEqual([]);
    expect(st.map.size).toBe(0);
  });

  it('投資実行（待機資金と暴落ルールの段階）はブラウザにだけ保存する', async () => {
    const st = memoryStorage();
    const crash = { current: { athValue: 6000, athDate: '2026-10-01', triggered: [20], baseReserve: 600000 }, month: '2026-11', monthBase: null };
    await updateReserveBalance(USER, 420000, '2026-11', 600000, crash, false, st);
    expect(db.updateCalls).toHaveLength(0);
    const local = loadLocalAmounts(st, USER);
    expect(local?.reserve_balance).toBe(420000);
    expect(local?.reserve_month).toBe('2026-11');
    expect(local?.reserve_month_base).toBe(600000);
    expect(local?.crash_state?.current?.baseReserve).toBe(600000);
  });

  it('暴落ルールを判定しなかった月は、ブラウザの暴落ルールの状態を変えない', async () => {
    const st = memoryStorage();
    const crash = { current: null, month: '2026-10', monthBase: null };
    saveLocalAmounts(st, USER, { ...defaultAmounts(), crash_state: crash });
    await updateReserveBalance(USER, 1000, '2026-11', 0, undefined, false, st);
    expect(loadLocalAmounts(st, USER)?.crash_state).toEqual(crash);
  });

  it('オーナー本人の行（目印あり）は従来どおりサーバーへ', async () => {
    await updateSettings(USER, { monthly_budget: 250000 }, true, memoryStorage());
    await updateReserveBalance(USER, 420000, '2026-11', 600000, undefined, true, memoryStorage());
    expect(db.updateCalls).toEqual([
      { monthly_budget: 250000 },
      { reserve_balance: 420000, reserve_month: '2026-11', reserve_month_base: 600000 },
    ]);
  });
});

describe('ブラウザの保存の形', () => {
  it('ユーザーごとに別のキー', () => {
    expect(storageKey('a')).not.toBe(storageKey('b'));
  });

  it('壊れた値は読まない（既定値から始まる）', () => {
    const st = memoryStorage();
    st.setItem(storageKey(USER), '{not json');
    expect(loadLocalAmounts(st, USER)).toBeNull();
    st.setItem(storageKey(USER), JSON.stringify({ version: 999, monthly_budget: 1, reserve_balance: 0 }));
    expect(loadLocalAmounts(st, USER)).toBeNull();
  });
});
