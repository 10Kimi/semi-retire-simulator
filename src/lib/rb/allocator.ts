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
}

/**
 * MF銘柄リストをfund_masterに照合してアセットクラスに按分
 */
export function allocateHoldings(
  holdings: MfHolding[],
  fundMaster: FundMasterEntry[],
): AllocatedHolding[] {
  return holdings.map(h => {
    // 合計セクション（預金・債券・年金）の自動振り分け
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

  // [diag2] revert予定 — 年金合計問題、ループ各イテレーション内部の動作を追跡
  // 集計: us_equity に寄与する全 delta を記録 + 年金は前後値も詳細記録
  const usDeltas: Array<{ name: string; section: string; delta: number; runningSum: number }> = [];
  console.log('[diag2/summarize/start]', {
    inputCount: allocated.length,
    inputClassified: allocated.filter(a => a.matched).length,
    inputPensionRaw: allocated
      .filter(a => a.holding.section === '年金')
      .map(a => ({
        name: a.holding.name,
        matched: a.matched,
        allocations: a.allocations,
        manualClass: a.manualClass,
      })),
  });

  for (const item of allocated) {
    const beforeUs = result['us_equity'];

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

    const afterUs = result['us_equity'];
    if (afterUs !== beforeUs) {
      usDeltas.push({
        name: item.holding.name.slice(0, 40),
        section: item.holding.section,
        delta: afterUs - beforeUs,
        runningSum: afterUs,
      });
    }
    if (item.holding.section === '年金') {
      console.log('[diag2/summarize/pension-iter]', {
        name: item.holding.name,
        matched: item.matched,
        allocations: item.allocations,
        manualClass: item.manualClass,
        us_before: beforeUs,
        us_after: afterUs,
        deltaApplied: afterUs - beforeUs,
      });
    }
  }

  console.log('[diag2/summarize/end]', {
    final_us_equity: result['us_equity'],
    totalUsDelta_count: usDeltas.length,
    pensionDeltas: usDeltas.filter(d => d.section === '年金'),
    allUsDeltas: usDeltas,
  });

  return result;
}
