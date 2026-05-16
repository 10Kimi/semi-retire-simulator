import type {
  ValuationResult,
  AllocationResult,
  UserMaSettings,
  MarketMode,
  MaAssetClass,
  MaSlot,
} from './types';

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
  if (capeLevel === 'low') return Math.round((currentReserve * 0.25) / 10000) * 10000;
  if (capeLevel === 'very-low') return Math.round((currentReserve * 0.5) / 10000) * 10000;
  return 0;
}

// --- スロット単位の乗数ルックアップ ---

interface MultiplierSet {
  us: number;
  jp: number;
  em: number;
  gold: number;
}

/**
 * 資産クラスに対応する乗数を返す。
 * Q3 案B: us / jp / em / gold には mode 補正を適用、bond / none には適用しない。
 */
function getSlotMultiplier(ac: MaAssetClass, m: MultiplierSet, mode: MarketMode): number {
  switch (ac) {
    case 'us':
      return applyModeCorrection(m.us, mode);
    case 'jp':
      return applyModeCorrection(m.jp, mode);
    case 'em':
      return applyModeCorrection(m.em, mode);
    case 'gold':
      return applyModeCorrection(m.gold, mode);
    case 'bond':
    case 'none':
      return 1.0;
  }
}

// --- メイン計算 ---

export function calculateAllocation(
  cape: number,
  pbr: number,
  gsr: number,
  momentumUS: boolean,
  momentumJP: boolean,
  momentumEM: boolean,
  momentumGold: boolean,
  cape5yMA: number | null,
  settings: UserMaSettings,
  mode: MarketMode,
): AllocationResult {
  const capeResult = getCapeMultiplier(cape, cape5yMA);
  const pbrResult = getPbrMultiplier(pbr);
  const gsrResult = getGsrMultiplier(gsr);

  // ベース乗数（mode 補正前）
  const usBase = capeResult.multiplier * (momentumUS ? 1.0 : 0.5);
  const jpBase = pbrResult.multiplier * (momentumJP ? 1.0 : 0.5);
  const emBase = momentumEM ? 1.0 : 0.5; // バリュエーション無し、モメンタムのみ
  const goldBase = gsrResult.multiplier * (momentumGold ? 1.0 : 0.5);

  const slots: MaSlot[] = [
    settings.slot1,
    settings.slot2,
    settings.slot3,
    settings.slot4,
    settings.slot5,
  ];

  // 各スロットの最終投資額を 1 万円単位に丸めて算出
  const perSlotAmount = slots.map((slot) => {
    const multiplier = getSlotMultiplier(slot.asset_class, { us: usBase, jp: jpBase, em: emBase, gold: goldBase }, mode);
    return Math.round((slot.amount * multiplier) / 10000) * 10000;
  });

  const baseInvest = perSlotAmount.reduce((sum, v) => sum + v, 0);
  const monthlyReserve = Math.max(0, settings.monthly_budget - baseInvest);

  // 待機資金投入: 最初に asset_class='us' のスロットに加算（'us' スロットがなければ 0）
  const firstUsIdx = slots.findIndex((s) => s.asset_class === 'us');
  const reserveDeployment =
    firstUsIdx >= 0 ? getReserveDeployment(capeResult.level, settings.reserve_balance) : 0;
  if (reserveDeployment > 0) {
    perSlotAmount[firstUsIdx] += reserveDeployment;
  }

  const totalInvest = perSlotAmount.reduce((sum, v) => sum + v, 0);
  const newReserveBalance = settings.reserve_balance + monthlyReserve - reserveDeployment;

  return {
    perSlotAmount,
    monthlyReserve,
    reserveDeployment,
    totalInvest,
    newReserveBalance,
    details: {
      capeResult,
      pbrResult,
      gsrResult,
      usMultiplier: applyModeCorrection(usBase, mode),
      jpMultiplier: applyModeCorrection(jpBase, mode),
      emMultiplier: applyModeCorrection(emBase, mode),
      goldMultiplier: applyModeCorrection(goldBase, mode),
    },
  };
}

export function formatCurrency(amount: number): string {
  return '¥' + amount.toLocaleString('ja-JP');
}
