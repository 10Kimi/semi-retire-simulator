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

  // 目標金額
  const targetAmounts: Record<string, number> = {};
  ASSET_CLASSES.forEach(ac => {
    targetAmounts[ac.key] = total * (target[ac.key] || 0) / 100;
  });

  // 超過・不足を分離（現金は売却リストに出さない）
  const sellPlan: Record<string, number> = {};  // 売却総額（期間で分散する）
  const shortfallMap: Record<string, number> = {};
  let cashSurplus = 0;

  for (const ac of ASSET_CLASSES) {
    const current = holdings[ac.key] || 0;
    const tgt = targetAmounts[ac.key] || 0;
    const diff = current - tgt;
    if (ac.key === 'cash') {
      if (diff > 0) cashSurplus = diff;
    } else if (diff > 0) {
      sellPlan[ac.key] = diff;
    } else if (diff < 0) {
      shortfallMap[ac.key] = Math.abs(diff);
    }
  }

  const totalSellNonCash = Object.values(sellPlan).reduce((s, v) => s + v, 0);
  const totalShortfall = Object.values(shortfallMap).reduce((a, b) => a + b, 0);
  const totalSurplus = totalSellNonCash + cashSurplus;

  if (totalShortfall <= 0 && totalSellNonCash <= 0) {
    return {
      sellItems: [], monthlyItems: [],
      totalDeficit: 0, totalSurplus,
      requiredSellAmount: 0, cashSurplus: 0,
      months: 0, monthlyAmount: inputMonthly ?? 0,
      monthlySellContribution: 0, monthlyCashContribution: 0, monthlyTotal: 0,
    };
  }

  // 売却アイテム（現金除く、期間全体の総額として表示）
  const sellItems: AdjustmentItem[] = Object.entries(sellPlan)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => {
      const ac = ASSET_CLASSES.find(a => a.key === k)!;
      return { key: k as AssetClassKey, label: ac.label, amount: -Math.round(v) };
    });

  const requiredSellAmount = totalSellNonCash;

  // 売却+現金余剰で埋められない不足額 → 積立が必要
  const remainingShortfall = Math.max(0, totalShortfall - totalSurplus);

  let months: number;
  let monthlyAmount: number;

  if (inputMonthly != null) {
    monthlyAmount = inputMonthly;
    months = remainingShortfall > 0 ? Math.ceil(remainingShortfall / monthlyAmount) : (inputMonths ?? 12);
  } else if (inputMonths != null) {
    months = inputMonths;
    monthlyAmount = remainingShortfall > 0 ? Math.ceil(remainingShortfall / months) : 0;
  } else {
    months = 12;
    monthlyAmount = 0;
  }

  // 毎月の積立配分（初期表示用、実際のシミュレーションでは動的按分）
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

  const monthlySellContribution = months > 0 ? Math.round(requiredSellAmount / months) : 0;
  const monthlyCashContribution = months > 0 ? Math.round(cashSurplus / months) : 0;
  const monthlyTotal = monthlySellContribution + monthlyCashContribution + monthlyAmount;

  return {
    sellItems, monthlyItems,
    totalDeficit: totalShortfall, totalSurplus,
    requiredSellAmount, cashSurplus,
    months, monthlyAmount,
    monthlySellContribution, monthlyCashContribution, monthlyTotal,
  };
}

/** 月次リバランスシミュレーション（売却を期間全体に分散） */
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

  const months = Math.max(periodResult.months, 1);

  // 毎月の売却額（総額 ÷ 期間で分散）
  const monthlySellMap: Record<string, number> = {};
  for (const item of periodResult.sellItems) {
    monthlySellMap[item.key] = Math.abs(item.amount) / months;
  }

  // 現金余剰も期間で分散して積立原資に加算
  const cashCurrent = holdings['cash'] || 0;
  const cashTarget = targetAmounts['cash'] || 0;
  const cashSurplus = Math.max(0, cashCurrent - cashTarget);
  const monthlyCashContribution = cashSurplus / months;

  const snapshots: MonthlySnapshot[] = [];
  const amounts: Record<string, number> = {};
  ASSET_CLASSES.forEach(ac => { amounts[ac.key] = holdings[ac.key] || 0; });

  for (let month = 1; month <= months; month++) {
    const monthOps: Record<string, number> = {};

    // 1. 超過クラスを (超過額 ÷ months) ずつ売却
    let monthSellTotal = 0;
    for (const [key, monthlySell] of Object.entries(monthlySellMap)) {
      const sell = Math.round(monthlySell);
      amounts[key] = Math.max(0, amounts[key] - sell);
      monthOps[key] = -sell;
      monthSellTotal += sell;
    }

    // 2. 現金から毎月の取り崩し（操作欄には出さない、内部で減算のみ）
    const cashContrib = Math.round(monthlyCashContribution);
    if (cashContrib > 0) {
      amounts['cash'] = Math.max(0, amounts['cash'] - cashContrib);
    }

    // 3. 今月の積立原資 = 月次積立額 + 今月の売却総額 + 現金取り崩し
    const monthlySource = periodResult.monthlyAmount + monthSellTotal + cashContrib;

    // 4. 不足クラスに按分して積立
    if (monthlySource > 0) {
      const shortfalls: { key: string; deficit: number }[] = [];
      for (const ac of ASSET_CLASSES) {
        const deficit = Math.max(0, (targetAmounts[ac.key] || 0) - amounts[ac.key]);
        if (deficit > 0) shortfalls.push({ key: ac.key, deficit });
      }
      const totalSF = shortfalls.reduce((s, d) => s + d.deficit, 0);
      if (totalSF > 0) {
        for (const sf of shortfalls) {
          const alloc = Math.round(monthlySource * (sf.deficit / totalSF));
          amounts[sf.key] += alloc;
          monthOps[sf.key] = (monthOps[sf.key] || 0) + alloc;
        }
      }
    }

    // 月末スナップショット（現金は操作欄に出さない）
    const monthTotal = ASSET_CLASSES.reduce((s, ac) => s + (amounts[ac.key] || 0), 0);
    const ops: MonthlySnapshot['operations'] = ASSET_CLASSES
      .filter(ac => ac.key !== 'cash')
      .map(ac => {
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
