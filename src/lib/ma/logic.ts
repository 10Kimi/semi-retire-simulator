import type { ValuationResult, AllocationResult, UserMaSettings, MarketMode } from './types';

const AC_US_RATIO = 0.666;
const AC_OTHER_RATIO = 0.334;

// --- バリュエーション判定（index.htmlから移植） ---

export function getCapeMultiplier(cape: number, ma5y: number | null): ValuationResult {
  // 歴史的バブル級の絶対水準チェック
  if (cape > 42) {
    return { multiplier: 0.5, label: '歴史的バブル級', color: '#dc2626', level: 'extreme', note: 'ITバブル超え（2000年: 44.2）' };
  }
  if (cape > 38) {
    return { multiplier: 0.75, label: '要警戒水準', color: '#f87171', level: 'very-high', note: '過去2回のみ（1929, 2000, 2021）' };
  }

  // 相対評価ロジック
  if (!ma5y || ma5y === 0) {
    if (cape > 35) return { multiplier: 0.5, label: 'かなり割高', color: '#f87171', level: 'very-high' };
    if (cape > 30) return { multiplier: 0.75, label: '割高', color: '#fbbf24', level: 'high' };
    if (cape > 20) return { multiplier: 1.0, label: '適正', color: '#4ade80', level: 'normal' };
    if (cape > 15) return { multiplier: 1.25, label: '割安', color: '#4a9eff', level: 'low' };
    return { multiplier: 1.5, label: 'かなり割安', color: '#a78bfa', level: 'very-low' };
  }

  const deviation = ((cape - ma5y) / ma5y) * 100;
  if (deviation > 20) return { multiplier: 0.5, label: 'かなり割高', color: '#f87171', deviation, level: 'very-high' };
  if (deviation > 10) return { multiplier: 0.75, label: '割高', color: '#fbbf24', deviation, level: 'high' };
  if (deviation > -10) return { multiplier: 1.0, label: '適正', color: '#4ade80', deviation, level: 'normal' };
  if (deviation > -20) return { multiplier: 1.25, label: '割安', color: '#4a9eff', deviation, level: 'low' };
  return { multiplier: 1.5, label: 'かなり割安', color: '#a78bfa', deviation, level: 'very-low' };
}

export function getPbrMultiplier(pbr: number): ValuationResult {
  if (pbr >= 1.8) return { multiplier: 0.75, label: '割高', color: '#fbbf24' };
  if (pbr >= 1.2) return { multiplier: 1.0, label: '適正', color: '#4ade80' };
  if (pbr >= 1.0) return { multiplier: 1.25, label: '割安', color: '#4a9eff' };
  return { multiplier: 1.5, label: '大バーゲン', color: '#a78bfa' };
}

export function getGsrMultiplier(gsr: number): ValuationResult {
  if (gsr >= 90) return { multiplier: 0.5, label: '極端に割高', color: '#f87171' };
  if (gsr >= 75) return { multiplier: 0.75, label: '割高', color: '#fbbf24' };
  if (gsr >= 50) return { multiplier: 1.0, label: '適正', color: '#4ade80' };
  if (gsr >= 40) return { multiplier: 1.25, label: '割安', color: '#4a9eff' };
  return { multiplier: 1.5, label: '大バーゲン', color: '#a78bfa' };
}

// --- モード補正 ---

function applyModeCorrection(multiplier: number, mode: MarketMode): number {
  if (mode === 'bullish') return Math.min(1.5, multiplier + 0.25);
  if (mode === 'cautious') return Math.max(0.5, multiplier - 0.25);
  return multiplier;
}

// --- 待機資金投入判定 ---

function getReserveDeployment(capeLevel: string | undefined, currentReserve: number): number {
  if (capeLevel === 'low') return Math.round(currentReserve * 0.25 / 10000) * 10000;
  if (capeLevel === 'very-low') return Math.round(currentReserve * 0.5 / 10000) * 10000;
  return 0;
}

// --- メイン計算 ---

export function calculateAllocation(
  cape: number,
  pbr: number,
  gsr: number,
  momentumUS: boolean,
  momentumJP: boolean,
  momentumGold: boolean,
  cape5yMA: number | null,
  settings: UserMaSettings,
  mode: MarketMode,
): AllocationResult {
  const capeResult = getCapeMultiplier(cape, cape5yMA);
  const pbrResult = getPbrMultiplier(pbr);
  const gsrResult = getGsrMultiplier(gsr);

  // モード補正はACとゴールドの変動枠にのみ適用
  const correctedCapeMultiplier = applyModeCorrection(capeResult.multiplier, mode);
  const correctedPbrMultiplier = applyModeCorrection(pbrResult.multiplier, mode);
  const correctedGsrMultiplier = applyModeCorrection(gsrResult.multiplier, mode);

  const usMultiplier = correctedCapeMultiplier * (momentumUS ? 1.0 : 0.5);
  const jpMultiplier = correctedPbrMultiplier * (momentumJP ? 1.0 : 0.5);
  const goldMultiplier = correctedGsrMultiplier * (momentumGold ? 1.0 : 0.5);
  const acMultiplier = (AC_US_RATIO * usMultiplier) + (AC_OTHER_RATIO * 1.0);

  const acAmountBase = Math.round(settings.tokutei_ac_base * acMultiplier / 10000) * 10000;
  const goldAmountBase = Math.round(settings.tokutei_gold_base * goldMultiplier / 10000) * 10000;
  const fixedAmount = settings.nisa_tsumitate + settings.nisa_growth + settings.tokutei_bond;

  const baseInvest = fixedAmount + acAmountBase + goldAmountBase;
  const monthlyReserve = Math.max(0, settings.monthly_budget - baseInvest);

  const reserveDeployment = getReserveDeployment(capeResult.level, settings.reserve_balance);
  const acAmountFinal = acAmountBase + reserveDeployment;
  const totalInvest = fixedAmount + acAmountFinal + goldAmountBase;
  const newReserveBalance = settings.reserve_balance + monthlyReserve - reserveDeployment;

  return {
    acAmount: acAmountFinal,
    goldAmount: goldAmountBase,
    monthlyReserve,
    reserveDeployment,
    totalInvest,
    newReserveBalance,
    details: { capeResult, pbrResult, gsrResult, usMultiplier, jpMultiplier, goldMultiplier, acMultiplier },
  };
}

export function formatCurrency(amount: number): string {
  return '¥' + amount.toLocaleString('ja-JP');
}
