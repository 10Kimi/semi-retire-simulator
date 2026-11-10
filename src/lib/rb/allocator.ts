import type { MfHolding } from './mfParser';
import type { Holdings } from './types';
import { ASSET_CLASSES } from './types';

/** fund_masterから取得した1レコード */
export interface FundMasterEntry {
  ticker: string;
  fund_name: string | null;
  asset_class: string;
  ratio: number;
}

/** 按分結果の1銘柄分 */
export interface AllocatedHolding {
  holding: MfHolding;
  allocations: { assetClass: string; amount: number }[];
  matched: boolean; // fund_masterにマッチしたか
  manualClass?: string; // 手動振り分け先（未分類→ユーザー選択後にセット）
  excluded?: true; // 暗号資産として配分の計算の対象外（cash に入れない）
}

/**
 * MF銘柄リストをfund_masterに照合してアセットクラスに按分
 */
export function allocateHoldings(
  holdings: MfHolding[],
  fundMaster: FundMasterEntry[],
): AllocatedHolding[] {
  return holdings.map(h => {
    // 暗号資産は値動きが大きいため配分の計算の対象外（未分類にも出さない）
    if (h.crypto) {
      return { holding: h, allocations: [], matched: true, excluded: true };
    }
    // 預金・債券は fund_master を見ずに自動で振り分ける（年金は fund_master で照合）
    if (h.section === '預金・現金・暗号資産') {
      return {
        holding: h,
        allocations: [{ assetClass: 'cash', amount: h.amount }],
        matched: true,
      };
    }
    if (h.section === '債券') {
      return {
        holding: h,
        allocations: [{ assetClass: 'developed_bond', amount: h.amount }],
        matched: true,
      };
    }

    // fund_master照合: 1. 銘柄名完全一致 → 2. ticker完全一致
    let entries = fundMaster.filter(fm => fm.ticker === h.name);
    if (entries.length === 0 && h.ticker) {
      entries = fundMaster.filter(fm => fm.ticker === h.ticker);
    }

    if (entries.length > 0) {
      const allocations = entries.map(e => ({
        assetClass: e.asset_class,
        amount: Math.round(h.amount * e.ratio),
      }));
      return { holding: h, allocations, matched: true };
    }

    // 未分類（年金含む）
    return { holding: h, allocations: [], matched: false };
  });
}

/**
 * AllocatedHolding[] からアセットクラス別合計 Holdings を生成
 */
export function summarizeAllocations(allocated: AllocatedHolding[]): Holdings {
  const result: Holdings = {};
  ASSET_CLASSES.forEach(ac => { result[ac.key] = 0; });

  for (const item of allocated) {
    if (item.excluded) continue;
    if (item.matched && item.allocations.length > 0) {
      for (const alloc of item.allocations) {
        if (alloc.assetClass in result) {
          result[alloc.assetClass] += alloc.amount;
        }
      }
    } else if (item.manualClass && item.manualClass !== 'exclude') {
      // 手動振り分け済み
      if (item.manualClass in result) {
        result[item.manualClass] += item.holding.amount;
      }
    }
    // manualClass === 'exclude' or undefined → 含めない
  }

  return result;
}

/** 暗号資産として対象外にした行の合計（円） */
export function sumExcludedCrypto(allocated: AllocatedHolding[]): number {
  return allocated.filter(a => a.excluded).reduce((s, a) => s + a.holding.amount, 0);
}
