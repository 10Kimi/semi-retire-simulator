// /rb の金額をブラウザ（localStorage）に持つ（D-065、FI_project #109）。
// 残高（資産クラス別の金額）と月の生活費はサーバーに送らない。同じ端末・同じブラウザでだけ、次に開いたとき入力欄に戻る。
// Supabase クライアントを持たない純粋な関数だけにして、テストから直接呼べるようにする（/ma の localAmounts.ts と同じ形）。
import { ASSET_CLASSES } from './types';
import type { Holdings } from './types';
import { readVersioned, upgradeData, type ReadResult, type Upgrade, type VersionedStorage } from '../storage/versioned';

/** ブラウザに持つ /rb の金額 */
export interface RbLocalAmounts {
  /** 資産クラス別の残高（円）。最後に「次へ」か MF 取り込みで確定したもの */
  holdings: Holdings | null;
  /** holdings を保存した日（日本時間 YYYY-MM-DD） */
  holdingsDate: string | null;
  /** 月の生活費（円）。未入力は null */
  monthlyLivingCost: number | null;
}

export type AmountStorage = VersionedStorage;

/**
 * 保存する形の版。上げるときは RB_AMOUNT_UPGRADES に前の版からの変換を足し、引き継ぎのテストを付ける（#135）。
 * 版は保存の名前にも入る。上げると前の名前を読まなくなるので、変換が無いと利用者には「入力が消えた」に見える
 */
const VERSION = 1;

/** 版 n の金額を版 n+1 にする変換（今は無い。版を上げるときに足す。テストからも足す） */
export const RB_AMOUNT_UPGRADES: Record<number, Upgrade> = {};

export function rbStorageKey(userId: string): string {
  return rbStorageKeyFor(VERSION, userId);
}

/** 版ごとの保存の名前（アカウントごとに分ける、D-074） */
export function rbStorageKeyFor(version: number, userId: string): string {
  return `fi.rb.amounts.v${version}.${userId}`;
}

function readLocal(storage: AmountStorage, userId: string): ReadResult {
  return readVersioned(
    storage, (v) => rbStorageKeyFor(v, userId), VERSION, RB_AMOUNT_UPGRADES, (json) => parseRbJson(json) !== null,
  );
}

export function emptyRbAmounts(): RbLocalAmounts {
  return { holdings: null, holdingsDate: null, monthlyLivingCost: null };
}

const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** 保存された値を読む（古い版の名前にあれば引き継ぐ）。無い・壊れている・形が違うときは null */
export function loadRbAmounts(storage: AmountStorage, userId: string): RbLocalAmounts | null {
  const r = readLocal(storage, userId);
  return r.status === 'ok' && r.raw ? parseRbJson(r.raw) : null;
}

/** 保存した文字列を読む（古い版なら引き継いで読む）。壊れている・引き継げない版のときは null */
function parseRbJson(raw: string): RbLocalAmounts | null {
  try {
    const up = upgradeData(JSON.parse(raw), VERSION, RB_AMOUNT_UPGRADES);
    if (!up.ok) return null;
    const v = up.data as Partial<RbLocalAmounts>;
    let holdings: Holdings | null = null;
    if (v.holdings && typeof v.holdings === 'object') {
      holdings = {};
      for (const ac of ASSET_CLASSES) {
        const n = (v.holdings as Record<string, unknown>)[ac.key];
        holdings[ac.key] = isAmount(n) ? n : 0;
      }
    }
    return {
      holdings,
      holdingsDate: holdings && typeof v.holdingsDate === 'string' ? v.holdingsDate : null,
      monthlyLivingCost: isAmount(v.monthlyLivingCost) ? v.monthlyLivingCost : null,
    };
  } catch {
    return null;
  }
}

/**
 * 一部だけ変えて保存し、読み直して同じ値が取れたら true（容量超過・プライベートブラウズなどで保存できなければ false）。
 * 今の値が読めないとき（壊れている・引き継げない版・古い版を引き継げなかった）は、空で上書きせずに false（データを残す、#135）
 */
export function patchRbAmounts(storage: AmountStorage, userId: string, patch: Partial<RbLocalAmounts>): boolean {
  const r = readLocal(storage, userId);
  if (r.status !== 'ok') return false;
  let cur = emptyRbAmounts();
  if (r.raw) {
    const parsed = parseRbJson(r.raw);
    if (!parsed) return false;
    cur = parsed;
  }
  const next: RbLocalAmounts = { ...cur, ...patch };
  try {
    const json = JSON.stringify({ version: VERSION, ...next });
    storage.setItem(rbStorageKey(userId), json);
    return storage.getItem(rbStorageKey(userId)) === json;
  } catch {
    return false;
  }
}

/** 残高を保存する（資産クラスの一覧にあるものだけ。負の値・数でない値は 0） */
export function saveLocalHoldings(storage: AmountStorage, userId: string, holdings: Holdings, date: string): boolean {
  const clean: Holdings = {};
  for (const ac of ASSET_CLASSES) {
    const n = holdings[ac.key];
    clean[ac.key] = isAmount(n) ? n : 0;
  }
  return patchRbAmounts(storage, userId, { holdings: clean, holdingsDate: date });
}

/** 月の生活費を保存する（0・未入力は null） */
export function saveLocalLivingCost(storage: AmountStorage, userId: string, cost: number | null): boolean {
  return patchRbAmounts(storage, userId, { monthlyLivingCost: cost && cost > 0 ? cost : null });
}

/**
 * 開いたときに、サーバーに残っている生活費（#109 より前に保存したもの）をどう扱うかを決める。
 * - サーバーに無い → ブラウザの値
 * - サーバーにあり、ブラウザに無い → サーバーの値をブラウザへ移す。保存できたらサーバーの値を消す。保存できなければ消さない
 * - 両方にある → ブラウザの値を使い（上書きしない）、サーバーの値を消す
 */
export function planLivingCostMove(
  serverCost: number | null, localCost: number | null,
): { use: number | null; saveToLocal: number | null; clearServer: boolean } {
  if (serverCost == null) return { use: localCost, saveToLocal: null, clearServer: false };
  if (localCost != null || serverCost <= 0) return { use: localCost, saveToLocal: null, clearServer: true };
  return { use: serverCost, saveToLocal: serverCost, clearServer: true };
}

/** ブラウザの localStorage（使えない環境では null） */
export function browserStorage(): AmountStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}
