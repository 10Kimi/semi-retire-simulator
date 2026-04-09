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
  gold?: MomentumItem;
}

export interface MomentumItem {
  above_ma: boolean;
  last_price?: number;
  ma10?: number;
  label: string;
}

export interface UserMaSettings {
  user_id: string;
  monthly_budget: number;
  nisa_tsumitate: number;
  nisa_growth: number;
  tokutei_bond: number;
  tokutei_ac_base: number;
  tokutei_gold_base: number;
  reserve_balance: number;
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
  acAmount: number;
  goldAmount: number;
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
    goldMultiplier: number;
    acMultiplier: number;
  };
}

export const DEFAULT_SETTINGS: Omit<UserMaSettings, 'user_id'> = {
  monthly_budget: 1000000,
  nisa_tsumitate: 100000,
  nisa_growth: 200000,
  tokutei_bond: 20000,
  tokutei_ac_base: 500000,
  tokutei_gold_base: 180000,
  reserve_balance: 0,
};
