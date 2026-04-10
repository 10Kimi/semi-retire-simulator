import { ASSET_CLASSES } from './types';
import type { AssetClassKey, Holdings, TargetAllocation, DeviationItem, AdjustmentItem, PeriodRebalanceResult, MonthlySnapshot } from './types';

/** 緊急資金を計算して投資可能な現金を返す */
export function calculateEmergencyFund(
  cashAmount: number,
  monthlyLivingCost: number | null,
  emergencyMonths: number,
): { emergencyFund: number; investableCash: number } {
  if (!monthlyLivingCost || monthlyLivingCost <= 0) {
    return { emergencyFund: 0, investableCash: cashAmount };
  }
  const emergencyFund = monthlyLivingCost * emergencyMonths;
  const investableCash = Math.max(0, cashAmount - emergencyFund);
  return { emergencyFund, investableCash };
}

/** holdingsの現金を投資可能額に置き換えたコピーを返す */
export function applyEmergencyFund(
  holdings: Holdings,
  monthlyLivingCost: number | null,
  emergencyMonths: number,
): Holdings {
  const cashAmount = holdings['cash'] || 0;
  const { investableCash } = calculateEmergencyFund(cashAmount, monthlyLivingCost, emergencyMonths);
  return { ...holdings, cash: investableCash };
}

/** 乖離の色分け基準（仕様書 §5-2） */
function getSeverity(absDeviation: number): DeviationItem['severity'] {
  if (absDeviation < 2) return 'ok';
  if (absDeviation < 5) return 'minor';
  if (absDeviation < 10) return 'warning';
  return 'danger';
}

/** 総資産額を算出 */
export function getTotalAssets(holdings: Holdings): number {
  return ASSET_CLASSES.reduce((sum, ac) => sum + (holdings[ac.key] || 0), 0);
}

/** 乖離計算（仕様書 §4-1） */
export function calculateDeviation(
  holdings: Holdings,
  target: TargetAllocation,
): DeviationItem[] {
  const total = getTotalAssets(holdings);
  if (total === 0) {
    return ASSET_CLASSES.map(ac => ({
      key: ac.key,
      label: ac.label,
      amount: 0,
      currentRatio: 0,
      targetRatio: target[ac.key] || 0,
      deviationRatio: -(target[ac.key] || 0),
      deviationAmount: 0,
      severity: 'ok' as const,
    }));
  }

  return ASSET_CLASSES.map(ac => {
    const amount = holdings[ac.key] || 0;
    const currentRatio = (amount / total) * 100;
    const targetRatio = target[ac.key] || 0;
    const deviationRatio = currentRatio - targetRatio;
    const deviationAmount = (deviationRatio / 100) * total;
    return {
      key: ac.key,
      label: ac.label,
      amount,
      currentRatio,
      targetRatio,
      deviationRatio,
      deviationAmount,
      severity: getSeverity(Math.abs(deviationRatio)),
    };
  });
}

/** 積立追加モードでリバランス完了までの推定月数を計算 */
export function estimateMonthsToRebalance(
  holdings: Holdings,
  target: TargetAllocation,
  monthlyAmount: number,
): number | null {
  if (monthlyAmount <= 0) return null;
  const total = getTotalAssets(holdings);
  // 不足額の合計（目標比率に対して足りない分）
  const totalDeficit = ASSET_CLASSES.reduce((sum, ac) => {
    const targetAmount = total * (target[ac.key] || 0) / 100;
    const current = holdings[ac.key] || 0;
    return sum + Math.max(0, targetAmount - current);
  }, 0);
  if (totalDeficit <= 0) return 0;
  return Math.ceil(totalDeficit / monthlyAmount);
}

/** 調整計算 — 積立追加モード（仕様書 §4-2） */
export function calculateAddAdjustment(
  holdings: Holdings,
  target: TargetAllocation,
  monthlyAmount: number,
): AdjustmentItem[] {
  const total = getTotalAssets(holdings);
  const newTotal = total + monthlyAmount;

  // 各クラスの不足額（0以上）を算出
  const raw = ASSET_CLASSES.map(ac => {
    const targetAmount = newTotal * (target[ac.key] || 0) / 100;
    const current = holdings[ac.key] || 0;
    const deficit = Math.max(0, targetAmount - current);
    return { key: ac.key, label: ac.label, deficit };
  });

  const totalDeficit = raw.reduce((sum, r) => sum + r.deficit, 0);

  // 不足額合計が積立額以下ならそのまま、超えるなら比例縮小
  const scale = totalDeficit > 0 && totalDeficit > monthlyAmount
    ? monthlyAmount / totalDeficit
    : 1;

  const items = raw
    .map(r => ({
      key: r.key as AssetClassKey,
      label: r.label,
      amount: Math.floor(r.deficit * scale),
    }))
    .filter(r => r.amount > 0);

  // 丸め誤差で合計が積立額を超えないよう調整
  const allocated = items.reduce((s, r) => s + r.amount, 0);
  const remainder = monthlyAmount - allocated;
  if (remainder > 0 && items.length > 0) {
    items[0].amount += remainder;
  }

  return items;
}

/** 調整計算 — 売却ありモード（仕様書 §4-3） */
export function calculateSellAdjustment(
  holdings: Holdings,
  target: TargetAllocation,
): AdjustmentItem[] {
  const total = getTotalAssets(holdings);
  if (total === 0) return [];

  return ASSET_CLASSES
    .map(ac => {
      const targetAmount = total * (target[ac.key] || 0) / 100;
      const current = holdings[ac.key] || 0;
      const diff = Math.round(targetAmount - current);
      return { key: ac.key as AssetClassKey, label: ac.label, amount: diff };
    })
    .filter(r => r.amount !== 0);
}

/** 期間指定リバランス — 毎月積立額から完了期間を計算 */
export function calculatePeriodByAmount(
  holdings: Holdings,
  target: TargetAllocation,
  monthlyAmount: number,
): PeriodRebalanceResult | null {
  if (monthlyAmount <= 0) return null;
  return buildPeriodResult(holdings, target, monthlyAmount, null);
}

/** 期間指定リバランス — 完了期間から必要積立額を計算 */
export function calculatePeriodByMonths(
  holdings: Holdings,
  target: TargetAllocation,
  months: number,
): PeriodRebalanceResult | null {
  if (months <= 0) return null;
  return buildPeriodResult(holdings, target, null, months);
}

function buildPeriodResult(
  holdings: Holdings,
  target: TargetAllocation,
  inputMonthly: number | null,
  inputMonths: number | null,
): PeriodRebalanceResult {
  const total = getTotalAssets(holdings);

  // Step2: 目標金額
  const targetAmounts: Record<string, number> = {};
  ASSET_CLASSES.forEach(ac => {
    targetAmounts[ac.key] = total * (target[ac.key] || 0) / 100;
  });

  // Step3: 超過・不足を分離（現金は売却リストに出さない）
  const excessMap: Record<string, number> = {};   // 売却額
  const shortfallMap: Record<string, number> = {}; // 不足額

  for (const ac of ASSET_CLASSES) {
    const current = holdings[ac.key] || 0;
    const tgt = targetAmounts[ac.key] || 0;
    const diff = current - tgt;
    if (ac.key === 'cash') {
      // 現金超過は内部計算のみ（売却リストに出さない）
      if (diff > 0) excessMap['cash'] = diff;
    } else if (diff > 0) {
      excessMap[ac.key] = diff;
    } else if (diff < 0) {
      shortfallMap[ac.key] = Math.abs(diff);
    }
  }

  // Step4: 売却総額（現金除く）+ 現金余剰で不足を賄えるか
  const totalSellNonCash = Object.entries(excessMap)
    .filter(([k]) => k !== 'cash')
    .reduce((s, [, v]) => s + v, 0);
  const cashSurplus = excessMap['cash'] || 0;
  const totalShortfall = Object.values(shortfallMap).reduce((a, b) => a + b, 0);
  const totalSurplus = totalSellNonCash + cashSurplus;

  if (totalShortfall <= 0 && totalSellNonCash <= 0) {
    return {
      sellItems: [], monthlyItems: [],
      totalDeficit: 0, totalSurplus,
      requiredSellAmount: 0, months: 0, monthlyAmount: inputMonthly ?? 0,
    };
  }

  // Step5: 売却アイテム（現金除く超過クラス、超過額の大きい順）
  const sellItems: AdjustmentItem[] = Object.entries(excessMap)
    .filter(([k]) => k !== 'cash')
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => {
      const ac = ASSET_CLASSES.find(a => a.key === k)!;
      return { key: k as AssetClassKey, label: ac.label, amount: -Math.round(v) };
    });

  const requiredSellAmount = sellItems.reduce((s, i) => s + Math.abs(i.amount), 0);

  // 売却 + 現金余剰で埋められない不足額
  const remainingShortfall = Math.max(0, totalShortfall - totalSurplus);

  let months: number;
  let monthlyAmount: number;

  if (remainingShortfall <= 0) {
    months = 1;
    monthlyAmount = 0;
  } else if (inputMonthly != null) {
    monthlyAmount = inputMonthly;
    months = Math.ceil(remainingShortfall / monthlyAmount);
  } else if (inputMonths != null) {
    months = inputMonths;
    monthlyAmount = Math.ceil(remainingShortfall / months);
  } else {
    months = 0;
    monthlyAmount = 0;
  }

  // 毎月の積立配分（不足クラスに按分）
  const monthlyItems: AdjustmentItem[] = [];
  if (monthlyAmount > 0 && totalShortfall > 0) {
    for (const [k, deficit] of Object.entries(shortfallMap)) {
      const ac = ASSET_CLASSES.find(a => a.key === k)!;
      const alloc = Math.round(monthlyAmount * (deficit / totalShortfall));
      if (alloc > 0) {
        monthlyItems.push({ key: k as AssetClassKey, label: ac.label, amount: alloc });
      }
    }
  }

  return {
    sellItems, monthlyItems,
    totalDeficit: totalShortfall, totalSurplus,
    requiredSellAmount, months, monthlyAmount,
  };
}

/** 月次リバランスシミュレーション */
export function simulateMonthly(
  holdings: Holdings,
  target: TargetAllocation,
  periodResult: PeriodRebalanceResult,
): MonthlySnapshot[] {
  const total = getTotalAssets(holdings);
  const targetAmounts: Record<string, number> = {};
  ASSET_CLASSES.forEach(ac => {
    targetAmounts[ac.key] = total * (target[ac.key] || 0) / 100;
  });

  // 超過マップ（現金含む、内部計算用）
  const excessMap: Record<string, number> = {};
  for (const ac of ASSET_CLASSES) {
    const diff = (holdings[ac.key] || 0) - (targetAmounts[ac.key] || 0);
    if (diff > 0) excessMap[ac.key] = diff;
  }

  // 売却マップ（現金除く）
  const sellMap: Record<string, number> = {};
  for (const item of periodResult.sellItems) {
    sellMap[item.key] = Math.abs(item.amount);
  }

  const cashSurplus = excessMap['cash'] || 0;
  const months = Math.max(periodResult.months, 1);
  const snapshots: MonthlySnapshot[] = [];

  // 各クラスの額をコピー
  const amounts: Record<string, number> = {};
  ASSET_CLASSES.forEach(ac => { amounts[ac.key] = holdings[ac.key] || 0; });

  for (let month = 1; month <= months; month++) {
    const monthOps: Record<string, number> = {};

    if (month === 1) {
      // 初月: 売却（現金除く超過クラス）を実行
      for (const [key, sellAmt] of Object.entries(sellMap)) {
        amounts[key] = Math.max(0, amounts[key] - sellAmt);
        monthOps[key] = (monthOps[key] || 0) - sellAmt;
      }

      // 初月: 売却資金 + 現金余剰を不足クラスに配分
      const firstMonthFund = Object.values(sellMap).reduce((s, v) => s + v, 0) + cashSurplus;
      if (firstMonthFund > 0) {
        // 現金を減らす（余剰分を投資に回す）
        if (cashSurplus > 0) {
          amounts['cash'] -= cashSurplus;
          monthOps['cash'] = (monthOps['cash'] || 0) - cashSurplus;
        }

        // 不足クラスに按分
        const shortfalls: { key: string; deficit: number }[] = [];
        for (const ac of ASSET_CLASSES) {
          const deficit = Math.max(0, (targetAmounts[ac.key] || 0) - amounts[ac.key]);
          if (deficit > 0) shortfalls.push({ key: ac.key, deficit });
        }
        const totalSF = shortfalls.reduce((s, d) => s + d.deficit, 0);
        if (totalSF > 0) {
          const allocFund = Math.min(firstMonthFund, totalSF);
          for (const sf of shortfalls) {
            const alloc = Math.round(allocFund * (sf.deficit / totalSF));
            amounts[sf.key] += alloc;
            monthOps[sf.key] = (monthOps[sf.key] || 0) + alloc;
          }
        }
      }
    }

    // 毎月: 積立を不足クラスにリアルタイム按分
    if (periodResult.monthlyAmount > 0) {
      const shortfalls: { key: string; deficit: number }[] = [];
      for (const ac of ASSET_CLASSES) {
        const deficit = Math.max(0, (targetAmounts[ac.key] || 0) - amounts[ac.key]);
        if (deficit > 0) shortfalls.push({ key: ac.key, deficit });
      }
      const totalSF = shortfalls.reduce((s, d) => s + d.deficit, 0);
      if (totalSF > 0) {
        for (const sf of shortfalls) {
          const alloc = Math.round(periodResult.monthlyAmount * (sf.deficit / totalSF));
          amounts[sf.key] += alloc;
          monthOps[sf.key] = (monthOps[sf.key] || 0) + alloc;
        }
      }
    }

    // 月末スナップショット
    const monthTotal = ASSET_CLASSES.reduce((s, ac) => s + (amounts[ac.key] || 0), 0);
    const ops: MonthlySnapshot['operations'] = ASSET_CLASSES.map(ac => {
      const targetRatio = target[ac.key] || 0;
      const ratio = monthTotal > 0 ? (amounts[ac.key] || 0) / monthTotal * 100 : 0;
      return {
        key: ac.key,
        label: ac.label,
        operationAmount: Math.round(monthOps[ac.key] || 0),
        ratio: Math.round(ratio * 10) / 10,
        reachedTarget: Math.abs(ratio - targetRatio) < 1,
      };
    });

    snapshots.push({ month, operations: ops, totalAssets: monthTotal });
  }

  return snapshots;
}

/** 金額を万円単位でフォーマット */
export function formatMan(amount: number): string {
  const man = Math.round(amount / 10000);
  if (man === 0) return '−';
  return (man > 0 ? '+' : '') + man + '万';
}

/** 通貨フォーマット */
export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = '¥' + abs.toLocaleString('ja-JP');
  return amount < 0 ? '-' + formatted : formatted;
}
