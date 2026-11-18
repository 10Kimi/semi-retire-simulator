// /ma の金額をブラウザ（localStorage）に持つ（D-065、FI_project #111）。
// 利用者の金額はサーバーに置かない。オーナー本人の行（keep_amounts_on_server）だけは従来どおりサーバーに置く。
// Supabase クライアントを持たない純粋な関数だけにして、テストから直接呼べるようにする。
import type { CrashRecord, SlotKey, UserMaSettings } from './types';
import { DEFAULT_SETTINGS, SLOT_KEYS } from './types';
import { AMOUNT_COLUMNS, type AmountColumn, type UserMaSettingsRow } from './settingsRow';

/** ブラウザに持つ金額と待機資金の状態 */
export interface MaAmounts {
  monthly_budget: number;
  reserve_balance: number;
  reserve_month: string | null;
  reserve_month_base: number | null;
  crash_state: CrashRecord | null;
  slot_amounts: Record<SlotKey, number>;
}

export type AmountStorage = Pick<Storage, 'getItem' | 'setItem'>;

const VERSION = 1;

export function storageKey(userId: string): string {
  return `fi.ma.amounts.v${VERSION}.${userId}`;
}

export function defaultAmounts(): MaAmounts {
  return extractAmounts({ user_id: '', ...DEFAULT_SETTINGS });
}

export function extractAmounts(s: UserMaSettings): MaAmounts {
  const slot_amounts = {} as Record<SlotKey, number>;
  for (const k of SLOT_KEYS) slot_amounts[k] = s[k].amount;
  return {
    monthly_budget: s.monthly_budget,
    reserve_balance: s.reserve_balance,
    reserve_month: s.reserve_month,
    reserve_month_base: s.reserve_month_base,
    crash_state: s.crash_state,
    slot_amounts,
  };
}

export function mergeAmounts(s: UserMaSettings, a: MaAmounts): UserMaSettings {
  const merged: UserMaSettings = {
    ...s,
    monthly_budget: a.monthly_budget,
    reserve_balance: a.reserve_balance,
    reserve_month: a.reserve_month,
    reserve_month_base: a.reserve_month_base,
    crash_state: a.crash_state,
  };
  for (const k of SLOT_KEYS) merged[k] = { ...s[k], amount: a.slot_amounts[k] };
  return merged;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 保存された値を読む。無い・壊れている・形が違うときは null */
export function loadLocalAmounts(storage: AmountStorage, userId: string): MaAmounts | null {
  let raw: string | null;
  try {
    raw = storage.getItem(storageKey(userId));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<MaAmounts> & { version?: number };
    if (v.version !== VERSION || !isNum(v.monthly_budget) || !isNum(v.reserve_balance)) return null;
    const slot_amounts = {} as Record<SlotKey, number>;
    for (const k of SLOT_KEYS) {
      const n = v.slot_amounts?.[k];
      slot_amounts[k] = isNum(n) ? n : 0;
    }
    return {
      monthly_budget: v.monthly_budget,
      reserve_balance: v.reserve_balance,
      reserve_month: typeof v.reserve_month === 'string' ? v.reserve_month : null,
      reserve_month_base: isNum(v.reserve_month_base) ? v.reserve_month_base : null,
      crash_state: v.crash_state && typeof v.crash_state === 'object' ? v.crash_state : null,
      slot_amounts,
    };
  } catch {
    return null;
  }
}

/** 保存して、読み直して同じ値が取れたら true（容量超過・プライベートブラウズなどで保存できなければ false） */
export function saveLocalAmounts(storage: AmountStorage, userId: string, a: MaAmounts): boolean {
  try {
    const json = JSON.stringify({ version: VERSION, ...a });
    storage.setItem(storageKey(userId), json);
    return storage.getItem(storageKey(userId)) === json;
  } catch {
    return false;
  }
}

/** 一部だけ変える（無ければ既定値から） */
export function patchLocalAmounts(
  storage: AmountStorage, userId: string, patch: Partial<Omit<MaAmounts, 'slot_amounts'>> & { slot_amounts?: Partial<Record<SlotKey, number>> },
): boolean {
  const cur = loadLocalAmounts(storage, userId) ?? defaultAmounts();
  const { slot_amounts, ...rest } = patch;
  return saveLocalAmounts(storage, userId, {
    ...cur,
    ...rest,
    slot_amounts: { ...cur.slot_amounts, ...(slot_amounts ?? {}) },
  });
}

/** 行に金額が1つでも残っていれば、その金額（null の列は既定値で埋める）。全部 null なら null */
export function rowAmounts(row: UserMaSettingsRow): MaAmounts | null {
  const r = row as unknown as Record<AmountColumn, unknown>;
  if (AMOUNT_COLUMNS.every((c) => r[c] == null)) return null;
  const d = defaultAmounts();
  const slot_amounts = {} as Record<SlotKey, number>;
  for (const k of SLOT_KEYS) slot_amounts[k] = row[`${k}_amount`] ?? d.slot_amounts[k];
  return {
    monthly_budget: row.monthly_budget ?? d.monthly_budget,
    reserve_balance: row.reserve_balance ?? d.reserve_balance,
    reserve_month: row.reserve_month ?? null,
    reserve_month_base: row.reserve_month_base ?? null,
    crash_state: row.crash_state ?? null,
    slot_amounts,
  };
}

/** サーバーの金額の列を消す更新の中身（全部 null） */
export function nullAmountsPatch(): Record<AmountColumn, null> {
  return Object.fromEntries(AMOUNT_COLUMNS.map((c) => [c, null])) as Record<AmountColumn, null>;
}

/** 金額を行の列の形に（オーナー本人の行へ書き戻すときだけ使う） */
export function amountsToRowPatch(a: MaAmounts): Record<AmountColumn, unknown> {
  const out: Record<string, unknown> = {
    monthly_budget: a.monthly_budget,
    reserve_balance: a.reserve_balance,
    reserve_month: a.reserve_month,
    reserve_month_base: a.reserve_month_base,
    crash_state: a.crash_state,
  };
  for (const k of SLOT_KEYS) out[`${k}_amount`] = a.slot_amounts[k];
  return out as Record<AmountColumn, unknown>;
}

/** サーバーへ送る行から金額の列を除く（新しい行を作るとき） */
export function withoutAmounts(row: UserMaSettingsRow): Omit<UserMaSettingsRow, AmountColumn> {
  const out: Record<string, unknown> = { ...row };
  for (const c of AMOUNT_COLUMNS) delete out[c];
  return out as Omit<UserMaSettingsRow, AmountColumn>;
}

/**
 * 画面を開いたときに、サーバーとブラウザのどちらの金額を使うかと、サーバーの金額を消すかを決める。
 * - サーバーに金額が無い → ブラウザの値（無ければ既定値）
 * - サーバーに金額があり、ブラウザに無い → サーバーの値をブラウザへ移す。保存できたらサーバーの金額を消す。保存できなければ消さない
 * - 両方にある → ブラウザの値を使い（上書きしない）、サーバーの金額を消す
 */
export function planAmountMove(
  serverAmounts: MaAmounts | null, localAmounts: MaAmounts | null,
): { use: MaAmounts; saveToLocal: MaAmounts | null; clearServer: boolean } {
  if (!serverAmounts) return { use: localAmounts ?? defaultAmounts(), saveToLocal: null, clearServer: false };
  if (localAmounts) return { use: localAmounts, saveToLocal: null, clearServer: true };
  return { use: serverAmounts, saveToLocal: serverAmounts, clearServer: true };
}
