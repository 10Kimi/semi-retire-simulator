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

/** 戻す目安（乖離ポイント）の選択肢と既定値 */
export const REBALANCE_THRESHOLDS = [5, 10] as const;
export const DEFAULT_REBALANCE_THRESHOLD = 5;

/** |乖離| が戻す目安「以上」か（小数の誤差で 4.9999999 になる場合も含める） */
export function isOverThreshold(deviationRatio: number, threshold: number): boolean {
  return Math.abs(deviationRatio) >= threshold - 1e-9;
}

/** 戻す目安以上の資産クラスの数 */
export function countOverThreshold(items: DeviationItem[], threshold: number): number {
  return items.filter(d => isOverThreshold(d.deviationRatio, threshold)).length;
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

/**
 * 積立のみモード — 売らずに目標配分に着くまでの月数（FI_project #76）。
 * n か月後の総資産 T＋M×n の目標額が、目標より多い現金以外の資産クラスの今の額に追いつく最小の n。
 * 現金は取り崩して不足の資産クラスへ回せるので月数を縛らない。毎月の配分は calculatePeriod(holdings, target, n, M)。
 * 返り値：月数（目標どおりなら0）／M≤0 なら null／現金以外で目標0%なのに保有があれば { unreachable: 資産クラス名 }
 */
export function estimateMonthsToRebalance(
  holdings: Holdings,
  target: TargetAllocation,
  monthlyAmount: number,
): number | null | { unreachable: string[] } {
  if (monthlyAmount <= 0) return null;
  const total = getTotalAssets(holdings);
  if (total <= 0) return 1;  // 保有0：今月の積立を目標配分どおりに買えば終わる（#76 レビュー）
  const onTarget = ASSET_CLASSES.every(ac =>
    Math.abs((holdings[ac.key] || 0) - total * (target[ac.key] || 0) / 100) < 1);
  if (onTarget) return 0;

  const unreachable = ASSET_CLASSES
    .filter(ac => ac.key !== 'cash' && (target[ac.key] || 0) <= 0 && (holdings[ac.key] || 0) > 0)
    .map(ac => ac.label);
  if (unreachable.length > 0) return { unreachable };

  let months = 1;
  for (const ac of ASSET_CLASSES) {
    if (ac.key === 'cash') continue;
    const w = (target[ac.key] || 0) / 100;
    const current = holdings[ac.key] || 0;
    if (w <= 0) continue;
    // current ≤ w×(T＋M×n) ⇔ n ≥ (current/w − T)/M
    months = Math.max(months, Math.ceil((current / w - total) / monthlyAmount - 1e-9));
  }
  return months;
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

/** 1円未満は0とみなす（浮動小数の誤差で売り買いが出ないように） */
const ZERO_EPS = 0.5;

interface PeriodPlan {
  months: number;
  monthly: number;
  endTotal: number;
  sell: Record<string, number>;   // 現金以外の売却総額
  buy: Record<string, number>;    // 現金以外の買い総額
  cashWithdraw: number;           // 現金の取り崩し総額
  cashDeposit: number;            // 現金に残す総額
}

/** 期間指定の計画（丸めない値）。N か月後の総資産 E = T + M×N の目標額に、毎月同じ額で近づける */
function buildPeriodPlan(
  holdings: Holdings,
  target: TargetAllocation,
  months: number,
  monthly: number,
): PeriodPlan {
  const endTotal = getTotalAssets(holdings) + monthly * months;
  const sell: Record<string, number> = {};
  const buy: Record<string, number> = {};
  let cashWithdraw = 0;
  let cashDeposit = 0;
  for (const ac of ASSET_CLASSES) {
    const diff = (holdings[ac.key] || 0) - endTotal * (target[ac.key] || 0) / 100;
    if (ac.key === 'cash') {
      if (diff > ZERO_EPS) cashWithdraw = diff;
      else if (diff < -ZERO_EPS) cashDeposit = -diff;
    } else if (diff > ZERO_EPS) {
      sell[ac.key] = diff;
    } else if (diff < -ZERO_EPS) {
      buy[ac.key] = -diff;
    }
  }
  return { months, monthly, endTotal, sell, buy, cashWithdraw, cashDeposit };
}

function toItems(map: Record<string, number>, sign: 1 | -1, divisor: number): AdjustmentItem[] {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => {
      const ac = ASSET_CLASSES.find(a => a.key === k)!;
      return { key: k as AssetClassKey, label: ac.label, amount: sign * Math.round(v / divisor) };
    })
    .filter(i => i.amount !== 0);
}

const sumValues = (m: Record<string, number>) => Object.values(m).reduce((s, v) => s + v, 0);

/**
 * 期間指定リバランス — 完了期間 N か月と毎月の積立額 M から、毎月の売り買いを計算。
 * いつもの積立を先に不足の資産クラスへ回し、足りない分だけを売る（E = T + M×N の目標額に N か月で着く）。
 */
export function calculatePeriod(
  holdings: Holdings,
  target: TargetAllocation,
  months: number,
  monthly: number,
): PeriodRebalanceResult | null {
  if (months <= 0) return null;
  const M = Math.max(0, monthly);
  const plan = buildPeriodPlan(holdings, target, months, M);

  const requiredSellAmount = sumValues(plan.sell);
  const totalDeficit = sumValues(plan.buy);
  const nothingToDo = M === 0 && requiredSellAmount === 0 && totalDeficit === 0
    && plan.cashWithdraw === 0 && plan.cashDeposit === 0;
  const N = nothingToDo ? 0 : months;

  const monthlySellContribution = N > 0 ? Math.round(requiredSellAmount / N) : 0;
  const monthlyCashContribution = N > 0 ? Math.round(plan.cashWithdraw / N) : 0;

  return {
    sellItems: toItems(plan.sell, -1, 1),
    monthlyItems: N > 0 ? toItems(plan.buy, 1, N) : [],
    totalDeficit,
    totalSurplus: requiredSellAmount + plan.cashWithdraw,
    requiredSellAmount,
    cashSurplus: plan.cashWithdraw,
    months: N,
    monthlyAmount: M,
    monthlySellContribution,
    monthlyCashContribution,
    monthlyTotal: monthlySellContribution + monthlyCashContribution + M,
    endTotal: plan.endTotal,
    cashDeposit: plan.cashDeposit,
    monthlyCashDeposit: N > 0 ? Math.round(plan.cashDeposit / N) : 0,
  };
}

/** 期間指定リバランス — 毎月の積立なし（M＝0） */
export function calculatePeriodByMonths(
  holdings: Holdings,
  target: TargetAllocation,
  months: number,
): PeriodRebalanceResult | null {
  return calculatePeriod(holdings, target, months, 0);
}

/** 月次リバランスシミュレーション（毎月同じ額を売り買いし、N か月目の末に E×目標配分 に着く） */
export function simulateMonthly(
  holdings: Holdings,
  target: TargetAllocation,
  periodResult: PeriodRebalanceResult,
): MonthlySnapshot[] {
  const months = Math.max(periodResult.months, 1);
  const plan = buildPeriodPlan(holdings, target, months, Math.max(0, periodResult.monthlyAmount));

  // 毎月の増減（丸めない値）
  const monthlyDelta: Record<string, number> = {};
  for (const ac of ASSET_CLASSES) {
    if (ac.key === 'cash') {
      monthlyDelta[ac.key] = (plan.cashDeposit - plan.cashWithdraw) / months;
    } else {
      monthlyDelta[ac.key] = ((plan.buy[ac.key] || 0) - (plan.sell[ac.key] || 0)) / months;
    }
  }

  const snapshots: MonthlySnapshot[] = [];
  for (let month = 1; month <= months; month++) {
    const amounts: Record<string, number> = {};
    for (const ac of ASSET_CLASSES) {
      amounts[ac.key] = (holdings[ac.key] || 0) + month * monthlyDelta[ac.key];
    }
    const monthTotal = ASSET_CLASSES.reduce((s, ac) => s + amounts[ac.key], 0);

    // 現金は操作欄に出さない
    const ops: MonthlySnapshot['operations'] = ASSET_CLASSES
      .filter(ac => ac.key !== 'cash')
      .map(ac => {
        const targetRatio = target[ac.key] || 0;
        const ratio = monthTotal > 0 ? amounts[ac.key] / monthTotal * 100 : 0;
        return {
          key: ac.key,
          label: ac.label,
          operationAmount: Math.round(monthlyDelta[ac.key]),
          ratio: Math.round(ratio * 10) / 10,
          reachedTarget: Math.abs(ratio - targetRatio) < 1,
        };
      });

    snapshots.push({ month, operations: ops, totalAssets: Math.round(monthTotal) });
  }

  return snapshots;
}

/** 金額を千円単位に丸めてフォーマット（操作欄用） */
export function formatThousands(amount: number): string {
  const rounded = Math.round(amount / 1000) * 1000;
  if (rounded === 0) return '−';
  const abs = Math.abs(rounded);
  const formatted = '¥' + abs.toLocaleString('ja-JP');
  return (rounded > 0 ? '+' : '-') + formatted;
}

/** 通貨フォーマット */
export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = '¥' + abs.toLocaleString('ja-JP');
  return amount < 0 ? '-' + formatted : formatted;
}
