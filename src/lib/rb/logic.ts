import { ASSET_CLASSES } from './types';
import type { AssetClassKey, Holdings, TargetAllocation, DeviationItem, AdjustmentItem } from './types';

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

/** 通貨フォーマット */
export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = '¥' + abs.toLocaleString('ja-JP');
  return amount < 0 ? '-' + formatted : formatted;
}
