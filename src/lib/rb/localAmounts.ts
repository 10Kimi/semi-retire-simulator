// /rb の金額をブラウザ（localStorage）に持つ（D-065、FI_project #109）。
// 残高（資産クラス別の金額）と月の生活費はサーバーに送らない。同じ端末・同じブラウザでだけ、次に開いたとき入力欄に戻る。
// Supabase クライアントを持たない純粋な関数だけにして、テストから直接呼べるようにする（/ma の localAmounts.ts と同じ形）。
import { ASSET_CLASSES } from './types';
import type { Holdings } from './types';

/** ブラウザに持つ /rb の金額 */
export interface RbLocalAmounts {
  /** 資産クラス別の残高（円）。最後に「次へ」か MF 取り込みで確定したもの */
  holdings: Holdings | null;
  /** holdings を保存した日（日本時間 YYYY-MM-DD） */
  holdingsDate: string | null;
  /** 月の生活費（円）。未入力は null */
  monthlyLivingCost: number | null;
}

export type AmountStorage = Pick<Storage, 'getItem' | 'setItem'>;

const VERSION = 1;

export function rbStorageKey(userId: string): string {
  return `fi.rb.amounts.v${VERSION}.${userId}`;
}

export function emptyRbAmounts(): RbLocalAmounts {
  return { holdings: null, holdingsDate: null, monthlyLivingCost: null };
}

const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** 保存された値を読む。無い・壊れている・形が違うときは null */
export function loadRbAmounts(storage: AmountStorage, userId: string): RbLocalAmounts | null {
  let raw: string | null;
  try {
    raw = storage.getItem(rbStorageKey(userId));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<RbLocalAmounts> & { version?: number };
    if (!v || v.version !== VERSION) return null;
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

/** 一部だけ変えて保存し、読み直して同じ値が取れたら true（容量超過・プライベートブラウズなどで保存できなければ false） */
export function patchRbAmounts(storage: AmountStorage, userId: string, patch: Partial<RbLocalAmounts>): boolean {
  const next: RbLocalAmounts = { ...(loadRbAmounts(storage, userId) ?? emptyRbAmounts()), ...patch };
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
