// /ma の金額の暗号文（案B、FI_project #117）：保存・読み戻し・パスフレーズ違い・リセット・オーナーの行・端末をまたいだとき
// サーバーは1行だけを持つメモリの表で、条件つきの更新（eq・is）をそのとおりに当てる
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type CrashRecord } from './types';
import { settingsToRow, AMOUNT_COLUMNS } from './settingsRow';
import {
  amountsToJson, baseOf, defaultAmounts, loadLocalAmounts, loadLocalRaw, sameTime, storageKey, type AmountStorage, type MaAmounts,
} from './localAmounts';
import { newKdfParams, VaultError } from '../vault/vault';
import { vaultErrorText } from './vaultAmounts';

const USER = 'user-1';

const db = vi.hoisted(() => ({
  server: null as Record<string, unknown> | null,
  updateCalls: [] as Record<string, unknown>[],
  updateError: null as unknown,
  selectError: null as unknown,
}));

vi.mock('../supabase', async () => {
  const { sameTime: same } = await import('./localAmounts');
  type Cond = { col: string; val: unknown; op: 'eq' | 'is' };
  const matches = (conds: Cond[]) =>
    !!db.server &&
    conds.every(({ col, val, op }) => {
      const cur = db.server![col] ?? null;
      if (op === 'is') return cur === null;
      if (col === 'vault_saved_at') return same(cur as string | null, val as string | null);
      return cur === val;
    });
  return {
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () =>
              db.selectError
                ? { data: null, error: db.selectError }
                : db.server
                  ? { data: { ...db.server }, error: null }
                  : { data: null, error: { code: 'PGRST116' } },
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          db.updateCalls.push(patch);
          const conds: Cond[] = [];
          const apply = () => {
            if (db.updateError) return { data: null, error: db.updateError };
            const ok = matches(conds);
            if (ok) Object.assign(db.server!, patch);
            return { data: ok ? [{ user_id: USER }] : [], error: null };
          };
          const b = {
            eq: (col: string, val: unknown) => (conds.push({ col, val, op: 'eq' }), b),
            is: (col: string) => (conds.push({ col, val: null, op: 'is' }), b),
            select: async () => apply(),
            then: (resolve: (v: unknown) => void) => resolve({ error: apply().error }),
          };
          return b;
        },
      }),
    },
  };
});

import {
  checkVaultUnchanged, loadUserSettingsWithVault, pushVault, resetVault, setupVault, unlockVault, updateReserveBalance, updateSettings,
} from './db';

// テストでは鍵を作る回数を減らす（本番は 200万回）。unlockVault は確かめ用の値に入った回数を使うので同じく速い
const FAST_KDF = () => ({ ...newKdfParams(), iterations: 1000 });
const PASS = 'Abc123';

function memoryStorage(): AmountStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); } };
}

/** オーナー以外の行（金額は null、045 のあと） */
function userRow(owner = false): Record<string, unknown> {
  return {
    ...settingsToRow(USER, DEFAULT_SETTINGS),
    ...Object.fromEntries(AMOUNT_COLUMNS.map((c) => [c, owner ? 0 : null])),
    keep_amounts_on_server: owner,
    amounts_vault: null,
    vault_verifier: null,
    vault_saved_at: null,
  };
}

const crash: CrashRecord = {
  current: { athValue: 6144.15, athDate: '2026-10-28', triggered: [20], baseReserve: 900_000 },
  month: '2026-11',
  monthBase: null,
};
const amounts: MaAmounts = {
  ...defaultAmounts(),
  monthly_budget: 187_654,
  reserve_balance: 600_000,
  reserve_month: '2026-11',
  reserve_month_base: 900_000,
  crash_state: crash,
};

function putLocal(storage: AmountStorage, a: MaAmounts, savedAt: string, base: string | null = null) {
  storage.setItem(storageKey(USER), amountsToJson(a, savedAt, base));
}

/** 端末 A でパスフレーズを設定する */
async function setupOn(storage: AmountStorage) {
  const r = await setupVault(USER, PASS, storage, FAST_KDF());
  if (!('key' in r)) throw new Error(`setup: ${JSON.stringify(r)}`);
  return r;
}

const vaultOf = () => ({
  amounts_vault: (db.server!.amounts_vault as string) ?? null,
  vault_verifier: (db.server!.vault_verifier as string) ?? null,
  vault_saved_at: (db.server!.vault_saved_at as string) ?? null,
});

/** 送った値に金額の平文が入っていないか（列としても、文字列の中にも） */
function expectNoPlainAmounts(patch: Record<string, unknown>) {
  expect(AMOUNT_COLUMNS.filter((c) => c in patch)).toEqual([]);
  expect(JSON.stringify(patch)).not.toContain('187654');
  expect(JSON.stringify(patch)).not.toContain('600000');
}

/** 別の時刻に保存したことにする（同じミリ秒にならないように） */
let clock = Date.parse('2026-11-19T00:00:00.000Z');
beforeEach(() => {
  db.server = userRow();
  db.updateCalls = [];
  db.updateError = null;
  db.selectError = null;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime((clock += 60_000));
});
const tick = () => vi.setSystemTime((clock += 60_000));

describe('パスフレーズの設定', () => {
  it('条件を満たさないと足りない条件を返し、サーバーに書かない', async () => {
    expect(await setupVault(USER, 'abc123', memoryStorage(), FAST_KDF())).toEqual({ issues: ['no-upper'] });
    expect(db.updateCalls).toEqual([]);
  });

  it('確かめ用の値・暗号文・時刻だけをサーバーに置き、金額の平文は送らない。この端末の base がサーバーの版になる', async () => {
    const a = memoryStorage();
    putLocal(a, amounts, '2026-11-19T01:00:00.000Z');
    await setupOn(a);
    expect(db.server!.vault_verifier).toBeTruthy();
    expect(db.server!.vault_saved_at).toBe('2026-11-19T01:00:00.000Z');
    expect(baseOf(loadLocalRaw(a, USER))).toBe('2026-11-19T01:00:00.000Z');
    expectNoPlainAmounts(db.updateCalls.at(-1)!);
  });

  it('この端末に値が無ければ既定値を保存してから暗号化する', async () => {
    const a = memoryStorage();
    await setupOn(a);
    expect(loadLocalAmounts(a, USER)).toEqual(defaultAmounts());
  });

  it('ほかの端末で設定済みなら上書きせず already-set（中2）', async () => {
    await setupOn(memoryStorage());
    const before = { ...db.server };
    tick();
    expect(await setupVault(USER, 'Xyz789', memoryStorage(), FAST_KDF())).toEqual({ error: 'already-set' });
    expect(db.server).toEqual(before);
  });

  it('行を読めなかったときは none ではなく unavailable（設定の画面を出さない、中2）', async () => {
    db.selectError = { message: 'network' };
    expect((await loadUserSettingsWithVault(USER, memoryStorage())).status).toBe('unavailable');
  });
});

describe('localStorage が空のとき、サーバーの暗号文から戻る', () => {
  it('別の端末：状態は restore-needed、パスフレーズで crash_state まで戻り、次からは locked', async () => {
    const a = memoryStorage();
    putLocal(a, amounts, '2026-11-19T01:00:00.000Z');
    await setupOn(a);

    const b = memoryStorage();
    const loaded = await loadUserSettingsWithVault(USER, b);
    expect(loaded.status).toBe('restore-needed');

    const r = await unlockVault(USER, PASS, loaded.vault, b);
    expect(r).toMatchObject({ restored: true, discarded: false });
    expect(loadLocalAmounts(b, USER)).toEqual(amounts);
    expect(typeof loadLocalAmounts(b, USER)?.crash_state?.current?.athDate).toBe('string');
    expect((await loadUserSettingsWithVault(USER, b)).status).toBe('locked');
  });

  it('パスフレーズが違うと戻らず、決まった表示になる', async () => {
    const a = memoryStorage();
    putLocal(a, amounts, '2026-11-19T01:00:00.000Z');
    await setupOn(a);
    const b = memoryStorage();
    const p = unlockVault(USER, 'Xyz789', vaultOf(), b);
    await expect(p).rejects.toBeInstanceOf(VaultError);
    await expect(p).rejects.toMatchObject({ code: 'wrong-passphrase' });
    expect(vaultErrorText(await p.catch((e) => e))).toBe('パスフレーズが違います');
    expect(loadLocalRaw(b, USER)).toBeNull();
  });
});

describe('端末をまたいだとき（古い値でサーバーの新しい暗号文を上書きしない、高1）', () => {
  it('開いたままの2つのタブで交互に保存：あとのタブの保存はぶつかり、サーバーは先のタブの値のまま', async () => {
    // PC と スマホが同じ版にそろっている
    const pc = memoryStorage();
    putLocal(pc, amounts, '2026-11-19T01:00:00.000Z');
    const { key, verifier } = await setupOn(pc);
    const phone = memoryStorage();
    await unlockVault(USER, PASS, vaultOf(), phone);

    // スマホで −20% の投資実行（待機資金が減り、段階が確定）
    tick();
    const after = { ...crash, current: { ...crash.current!, triggered: [20, 30] } };
    expect(await updateReserveBalance(USER, 300_000, '2026-11', 900_000, after, false, phone)).toBe(true);
    expect(await pushVault(USER, key, verifier, phone)).toBe('ok');
    const phoneVersion = db.server!.vault_saved_at;

    // PC の開いたままのタブ（古い値）で予算を直す。時刻は新しくなるが、サーバーには書けない
    tick();
    expect(await updateSettings(USER, { monthly_budget: 200_000 }, false, pc)).toBe(true);
    expect(await pushVault(USER, key, verifier, pc)).toBe('conflict');
    expect(db.server!.vault_saved_at).toBe(phoneVersion);

    // PC は次に開くと restore-needed、戻すとスマホの値（PC で変えた分は捨てたと知らせる）
    expect((await loadUserSettingsWithVault(USER, pc)).status).toBe('restore-needed');
    const r = await unlockVault(USER, PASS, vaultOf(), pc);
    expect(r).toMatchObject({ restored: true, discarded: true });
    expect(loadLocalAmounts(pc, USER)?.reserve_balance).toBe(300_000);
    expect(loadLocalAmounts(pc, USER)?.crash_state?.current?.triggered).toEqual([20, 30]);
  });

  it('投資実行の直前の確かめ：ほかの端末が保存していれば changed（鍵が無くても分かる）', async () => {
    const pc = memoryStorage();
    putLocal(pc, amounts, '2026-11-19T01:00:00.000Z');
    const { key, verifier } = await setupOn(pc);
    expect(await checkVaultUnchanged(USER, pc)).toBe('same');

    const phone = memoryStorage();
    await unlockVault(USER, PASS, vaultOf(), phone);
    tick();
    await updateSettings(USER, { monthly_budget: 1 }, false, phone);
    expect(await pushVault(USER, key, verifier, phone)).toBe('ok');
    expect(await checkVaultUnchanged(USER, pc)).toBe('changed');
  });

  it('端末の時計がずれていても、時刻の大小ではなく版で比べる', async () => {
    const pc = memoryStorage();
    putLocal(pc, amounts, '2026-11-19T01:00:00.000Z');
    await setupOn(pc);
    // サーバーの版より「未来」の時刻で、別の版（base が違う）を持つ端末
    const future = memoryStorage();
    putLocal(future, { ...amounts, reserve_balance: 1 }, '2099-01-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z');
    expect((await loadUserSettingsWithVault(USER, future)).status).toBe('restore-needed');
  });

  it('時刻を持たない古い保存（#117 より前）も、暗号文があれば restore-needed', async () => {
    const a = memoryStorage();
    putLocal(a, amounts, '2026-11-19T02:00:00.000Z');
    await setupOn(a);
    const old = memoryStorage();
    old.setItem(storageKey(USER), JSON.stringify({ version: 1, ...amounts }));
    expect((await loadUserSettingsWithVault(USER, old)).status).toBe('restore-needed');
  });

  it('鍵が無いあいだに変えた値は locked のまま。サーバーが変わっていなければ、パスフレーズを入れたときにサーバーに置く', async () => {
    const a = memoryStorage();
    putLocal(a, amounts, '2026-11-19T02:00:00.000Z');
    await setupOn(a);
    tick();
    await updateSettings(USER, { monthly_budget: 200_000 }, false, a); // 鍵なし＝ブラウザだけ
    expect(db.updateCalls).toHaveLength(1); // 設定のときの1回だけ
    expect((await loadUserSettingsWithVault(USER, a)).status).toBe('locked');

    const r = await unlockVault(USER, PASS, vaultOf(), a);
    expect(r).toMatchObject({ restored: false, push: 'ok' });
    expect(sameTime(db.server!.vault_saved_at as string, baseOf(loadLocalRaw(a, USER)))).toBe(true);
  });

  it('ほかの端末でリセットして設定し直したあと、古い鍵の端末は書けない（中3）', async () => {
    const a = memoryStorage();
    putLocal(a, amounts, '2026-11-19T02:00:00.000Z');
    const old = await setupOn(a);
    expect(await resetVault(USER, memoryStorage())).toBe(true);
    tick();
    await setupVault(USER, 'Xyz789', memoryStorage(), FAST_KDF());
    const now = { ...db.server };
    // 端末 a の base も合わせてしまっても、確かめ用の値が違うので通らない
    putLocal(a, amounts, new Date().toISOString(), db.server!.vault_saved_at as string);
    expect(await pushVault(USER, old.key, old.verifier, a)).toBe('conflict');
    expect(db.server).toEqual(now);
  });
});

describe('保存するとき', () => {
  it('pushVault：ブラウザの値を暗号化してサーバーに置く（平文は送らない）', async () => {
    const a = memoryStorage();
    putLocal(a, amounts, '2026-11-19T01:00:00.000Z');
    const { key, verifier } = await setupOn(a);
    tick();
    await updateSettings(USER, { monthly_budget: 187_654 }, false, a);
    db.updateCalls = [];
    expect(await pushVault(USER, key, verifier, a)).toBe('ok');
    expect(db.updateCalls).toHaveLength(1);
    expect(db.updateCalls[0].amounts_vault).toBeTruthy();
    expectNoPlainAmounts(db.updateCalls[0]);
  });

  it('updateSettings は今までどおりブラウザだけ（サーバーに書かない）', async () => {
    expect(await updateSettings(USER, { monthly_budget: 187_654 }, false, memoryStorage())).toBe(true);
    expect(db.updateCalls).toEqual([]);
  });

  it('サーバーへの保存に失敗したら error（ぶつかったのとは分けて返す）', async () => {
    const a = memoryStorage();
    const { key, verifier } = await setupOn(a);
    db.updateError = { message: 'network' };
    expect(await pushVault(USER, key, verifier, a)).toBe('error');
  });
});

describe('リセット', () => {
  it('暗号文・確かめ用の値・時刻を null にし、そのあとは none', async () => {
    const a = memoryStorage();
    await setupOn(a);
    expect(await resetVault(USER, a)).toBe(true);
    expect(db.updateCalls.at(-1)).toEqual({ amounts_vault: null, vault_verifier: null, vault_saved_at: null });
    expect((await loadUserSettingsWithVault(USER, a)).status).toBe('none');
    expect(baseOf(loadLocalRaw(a, USER))).toBeNull();
  });
});

describe('ほかの端末でリセットされたあと（再レビューの指摘・中1）', () => {
  it('この端末の投資実行の確かめは same（止まらない）、開くと none で古い版の印は消える', async () => {
    const b = memoryStorage();
    putLocal(b, amounts, '2026-11-19T01:00:00.000Z');
    await setupOn(b);
    expect(baseOf(loadLocalRaw(b, USER))).not.toBeNull();
    expect(await resetVault(USER, memoryStorage())).toBe(true); // 端末 A でリセット

    expect(await checkVaultUnchanged(USER, b)).toBe('same');
    expect((await loadUserSettingsWithVault(USER, b)).status).toBe('none');
    expect(baseOf(loadLocalRaw(b, USER))).toBeNull();
    expect(loadLocalAmounts(b, USER)).toEqual(amounts); // 金額はそのまま
  });
});

describe('オーナー本人の行（目印あり）', () => {
  it('状態は owner で、暗号文があっても使わない', async () => {
    db.server = { ...userRow(true), vault_verifier: 'x', amounts_vault: 'y' };
    expect((await loadUserSettingsWithVault(USER, memoryStorage())).status).toBe('owner');
  });

  it('保存は平文の列だけ（暗号化の処理を通らない）', async () => {
    db.server = userRow(true);
    expect(await updateSettings(USER, { monthly_budget: 5 }, true, memoryStorage())).toBe(true);
    expect(db.updateCalls).toEqual([{ monthly_budget: 5 }]);
    expect(await updateReserveBalance(USER, 1, '2026-11', 1, undefined, true, memoryStorage())).toBe(true);
    expect(db.updateCalls[1]).not.toHaveProperty('amounts_vault');
  });
});
