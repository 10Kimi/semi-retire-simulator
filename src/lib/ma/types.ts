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
  ideco_amount: number;               // 月次予算に含めた iDeCo/401k の掛金。配分対象外（表示と控除のみ）
  ideco_fund_name: string;            // iDeCo/401k の銘柄メモ（任意・計算には使わない）
  reserve_balance: number;
  reserve_month: string | null;       // 待機資金を最後に更新した月 'YYYY-MM'（同月は上書き）
  reserve_month_base: number | null;  // その月に入る前の待機残高（同月再実行時の計算基点）
  jp_index: JpIndex;
  nikkei_pbr_anchor: number | null;   // 日経225 PBR 近似推定の基準PBR
  nikkei_price_anchor: number | null; // 基準を取った時の日経225株価
  slot1: MaSlot;
  slot2: MaSlot;
  slot3: MaSlot;
  slot4: MaSlot;
  slot5: MaSlot;
  slot6: MaSlot;
  slot7: MaSlot;
}

export type MarketMode = 'bullish' | 'neutral' | 'cautious';

/** 日本株の判定に使う指数（TOPIX or 日経225）。PBRの水準が異なるため閾値も切り替える */
export type JpIndex = 'topix' | 'nikkei';

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
// 初期値は全額 0。運営者個人の設定が既定値として他ユーザーに出ないようにする
// （資産クラスのプリセットのみ、特定口座の使い方の例として残す）。
export const DEFAULT_SETTINGS: Omit<UserMaSettings, 'user_id'> = {
  monthly_budget: 0,
  ideco_amount: 0,
  ideco_fund_name: '',
  reserve_balance: 0,
  reserve_month: null,
  reserve_month_base: null,
  jp_index: 'topix',
  nikkei_pbr_anchor: null,
  nikkei_price_anchor: null,
  slot1: { amount: 0, fund_name: '', asset_class: 'none' },
  slot2: { amount: 0, fund_name: '', asset_class: 'none' },
  slot3: { amount: 0, fund_name: '', asset_class: 'us' },
  slot4: { amount: 0, fund_name: '', asset_class: 'gold' },
  slot5: { amount: 0, fund_name: '', asset_class: 'bond' },
  slot6: { amount: 0, fund_name: '', asset_class: 'none' },
  slot7: { amount: 0, fund_name: '', asset_class: 'none' },
};

/** スロット表示用のラベル定義（UI で参照） */
export const SLOT_LABELS: Record<
  'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6' | 'slot7', string
> = {
  slot1: 'NISA 積立枠',
  slot2: 'NISA 成長枠',
  slot3: '特定口座 1',
  slot4: '特定口座 2',
  slot5: '特定口座 3',
  slot6: '特定口座 4',
  slot7: '特定口座 5',
};
