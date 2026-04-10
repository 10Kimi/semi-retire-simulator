import { ASSET_CLASSES } from './types';
import type { AssetClassKey, Holdings, TargetAllocation, DeviationItem, AdjustmentItem, PeriodRebalanceResult } from './types';

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

  // 各クラスの不足額・超過額を計算
  const classData = ASSET_CLASSES.map(ac => {
    const targetAmount = total * (target[ac.key] || 0) / 100;
    const current = holdings[ac.key] || 0;
    const diff = targetAmount - current;
    return { key: ac.key, label: ac.label, diff };
  });

  const totalDeficit = classData.reduce((s, d) => s + Math.max(0, d.diff), 0);
  const totalSurplus = classData.reduce((s, d) => s + Math.max(0, -d.diff), 0);

  if (totalDeficit <= 0) {
    return {
      sellItems: [], monthlyItems: [], totalDeficit: 0, totalSurplus,
      requiredSellAmount: 0, months: 0, monthlyAmount: inputMonthly ?? 0,
    };
  }

  let months: number;
  let monthlyAmount: number;
  let requiredSellAmount: number;

  if (inputMonthly != null && inputMonths != null) {
    // 両方指定（期間指定モード: 期間と積立額が確定）
    months = inputMonths;
    monthlyAmount = inputMonthly;
    const totalAccumulation = monthlyAmount * months;
    requiredSellAmount = Math.max(0, totalDeficit - totalAccumulation);
  } else if (inputMonths != null) {
    // 期間指定 → 積立だけで足りるか計算、足りなければ売却
    months = inputMonths;
    // まず売却なしで必要な積立額を計算
    monthlyAmount = Math.ceil(totalDeficit / months);
    // 超過額を売却に回せば積立額を減らせる
    const sellable = Math.min(totalSurplus, totalDeficit);
    const deficitAfterSell = totalDeficit - sellable;
    if (deficitAfterSell > 0) {
      monthlyAmount = Math.ceil(deficitAfterSell / months);
    } else {
      monthlyAmount = 0;
    }
    const totalAccumulation = monthlyAmount * months;
    requiredSellAmount = Math.max(0, totalDeficit - totalAccumulation);
  } else {
    // 積立額指定 → 期間を計算（売却なし、期間が伸びるだけ）
    monthlyAmount = inputMonthly!;
    months = Math.ceil(totalDeficit / monthlyAmount);
    requiredSellAmount = 0;
  }

  // 売却アイテム（超過クラスから大きい順）
  const sellItems: AdjustmentItem[] = [];
  if (requiredSellAmount > 0) {
    const surplusClasses = classData
      .filter(d => d.diff < 0)
      .sort((a, b) => a.diff - b.diff); // 超過が大きい順

    let remaining = requiredSellAmount;
    for (const cls of surplusClasses) {
      if (remaining <= 0) break;
      const sellAmount = Math.min(remaining, Math.abs(cls.diff));
      sellItems.push({
        key: cls.key as AssetClassKey,
        label: cls.label,
        amount: -Math.round(sellAmount),
      });
      remaining -= sellAmount;
    }
  }

  // 毎月の積立配分（不足クラスに按分）
  const deficitClasses = classData.filter(d => d.diff > 0);
  const deficitTotal = deficitClasses.reduce((s, d) => s + d.diff, 0);

  const monthlyItems: AdjustmentItem[] = deficitTotal > 0
    ? deficitClasses.map(d => ({
        key: d.key as AssetClassKey,
        label: d.label,
        amount: Math.round(monthlyAmount * (d.diff / deficitTotal)),
      })).filter(i => i.amount > 0)
    : [];

  return {
    sellItems, monthlyItems, totalDeficit, totalSurplus,
    requiredSellAmount, months, monthlyAmount,
  };
}

/** 通貨フォーマット */
export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = '¥' + abs.toLocaleString('ja-JP');
  return amount < 0 ? '-' + formatted : formatted;
}
