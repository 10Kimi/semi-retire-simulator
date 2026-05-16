export interface Indicators {
  id: string;
  fetched_at: string;
  cape: number | null;
  cape_history: CapeHistoryEntry[];
  topix_pbr: number | null;
  gold_silver_ratio: number | null;
  gold_price: number | null;
  silver_price: number | null;
  momentum: MomentumData;
}

export interface CapeHistoryEntry {
  date: string;
  cape: number;
}

export interface MomentumData {
  us?: MomentumItem;
  jp?: MomentumItem;
  em?: MomentumItem;
  gold?: MomentumItem;
}

export interface MomentumItem {
  above_ma: boolean;
  last_price?: number;
  ma10?: number;
  label: string;
}

/**
 * スロット 1 つの構成
 * - amount: 月次予算からこのスロットに割り当てる金額（円）
 * - fund_name: 銘柄名のメモ（表示用、計算には使用しない）
 * - asset_class: バリュエーション/モメンタムの乗数をどのクラスで計算するか
 */
export type MaAssetClass = 'us' | 'jp' | 'em' | 'gold' | 'bond' | 'none';

export const MA_ASSET_CLASS_OPTIONS: { value: MaAssetClass; label: string }[] = [
  { value: 'none', label: '補正なし（固定）' },
  { value: 'us', label: '米国株（CAPE）' },
  { value: 'jp', label: '日本株（PBR）' },
  { value: 'em', label: '新興国株（モメンタム）' },
  { value: 'gold', label: 'ゴールド（GSR）' },
  { value: 'bond', label: '債券' },
];

export interface MaSlot {
  amount: number;
  fund_name: string;
  asset_class: MaAssetClass;
}

export interface UserMaSettings {
  user_id: string;
  monthly_budget: number;
  reserve_balance: number;
  slot1: MaSlot;
  slot2: MaSlot;
  slot3: MaSlot;
  slot4: MaSlot;
  slot5: MaSlot;
}

export type MarketMode = 'bullish' | 'neutral' | 'cautious';

export interface ValuationResult {
  multiplier: number;
  label: string;
  color: string;
  level?: string;
  deviation?: number;
  note?: string;
}

export interface AllocationResult {
  /** スロット 1〜5 の最終投資額（円）。インデックス順 = slot1, slot2, ..., slot5 */
  perSlotAmount: number[];
  monthlyReserve: number;
  reserveDeployment: number;
  totalInvest: number;
  newReserveBalance: number;
  details: {
    capeResult: ValuationResult;
    pbrResult: ValuationResult;
    gsrResult: ValuationResult;
    usMultiplier: number;
    jpMultiplier: number;
    emMultiplier: number;
    goldMultiplier: number;
  };
}

/**
 * 初回ユーザー作成時のデフォルト設定。
 * 旧 schema からの移行直後と同じ意味合いを概ね保つよう、
 * slot3='us' / slot4='gold' / slot5='bond' を default に。
 */
export const DEFAULT_SETTINGS: Omit<UserMaSettings, 'user_id'> = {
  monthly_budget: 1000000,
  reserve_balance: 0,
  slot1: { amount: 100000, fund_name: '', asset_class: 'none' },
  slot2: { amount: 200000, fund_name: '', asset_class: 'none' },
  slot3: { amount: 500000, fund_name: '', asset_class: 'us' },
  slot4: { amount: 180000, fund_name: '', asset_class: 'gold' },
  slot5: { amount: 20000, fund_name: '', asset_class: 'bond' },
};

/** スロット表示用のラベル定義（UI で参照） */
export const SLOT_LABELS: Record<'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5', string> = {
  slot1: 'NISA 積立枠',
  slot2: 'NISA 成長枠',
  slot3: '特定口座 1',
  slot4: '特定口座 2',
  slot5: '特定口座 3',
};
