import type { RiskLevel, AssetAllocation, PortfolioPreset, MarketDataInfo } from '../types/assessment';
import { loadCurrentMarketData } from '../lib/assessmentDb';
import { ASSET_CLASSES as RB_ASSET_CLASSES } from '../lib/rb/types';
import type { AssetClassKey } from '../lib/rb/types';

// 資産クラスの定義（キー・ラベル・順番）は src/lib/rb/types.ts の13クラスを参照する。
// ここではチャート用の色だけを持つ。
const ASSET_COLORS: Record<AssetClassKey, string> = {
  cash:             '#6b7280',
  japan_equity:     '#ef4444',
  us_equity:        '#3b82f6',
  developed_equity: '#8b5cf6',
  emerging_equity:  '#f97316',
  japan_bond:       '#06b6d4',
  developed_bond:   '#14b8a6',
  emerging_bond:    '#eab308',
  japan_reit:       '#ec4899',
  developed_reit:   '#a855f7',
  emerging_reit:    '#d946ef',
  commodity:        '#84cc16',
  gold:             '#f59e0b',
};

export const ASSET_CLASSES: { key: AssetClassKey; label: string; color: string }[] =
  RB_ASSET_CLASSES.map(ac => ({ key: ac.key, label: ac.label, color: ASSET_COLORS[ac.key] }));

function makeAllocations(percentages: Record<string, number>): AssetAllocation[] {
  return ASSET_CLASSES.map((ac) => ({
    key: ac.key,
    label: ac.label,
    percentage: percentages[ac.key] ?? 0,
    color: ac.color,
  }));
}

// ── Fallback Presets (ハードコード値、market_data テーブルが空の場合に使用) ──

const FALLBACK_PRESETS: Record<RiskLevel, PortfolioPreset> = {
  conservative: {
    riskLevel: 'conservative',
    allocations: makeAllocations({
      japan_equity: 5, us_equity: 5, developed_equity: 3, emerging_equity: 2,
      japan_bond: 35, developed_bond: 20, emerging_bond: 3,
      japan_reit: 3, developed_reit: 2, gold: 7, cash: 15,
    }),
    expectedReturn: 3.0,
    expectedVolatility: 6.0,
  },
  moderately_conservative: {
    riskLevel: 'moderately_conservative',
    allocations: makeAllocations({
      japan_equity: 8, us_equity: 12, developed_equity: 5, emerging_equity: 3,
      japan_bond: 25, developed_bond: 18, emerging_bond: 4,
      japan_reit: 4, developed_reit: 3, gold: 8, cash: 10,
    }),
    expectedReturn: 4.0,
    expectedVolatility: 9.0,
  },
  balanced: {
    riskLevel: 'balanced',
    allocations: makeAllocations({
      japan_equity: 12, us_equity: 20, developed_equity: 8, emerging_equity: 5,
      japan_bond: 15, developed_bond: 12, emerging_bond: 5,
      japan_reit: 5, developed_reit: 4, gold: 7, cash: 7,
    }),
    expectedReturn: 5.2,
    expectedVolatility: 12.0,
  },
  moderately_aggressive: {
    riskLevel: 'moderately_aggressive',
    allocations: makeAllocations({
      japan_equity: 15, us_equity: 28, developed_equity: 10, emerging_equity: 8,
      japan_bond: 8, developed_bond: 7, emerging_bond: 5,
      japan_reit: 5, developed_reit: 4, gold: 5, cash: 5,
    }),
    expectedReturn: 6.0,
    expectedVolatility: 15.0,
  },
  aggressive: {
    riskLevel: 'aggressive',
    allocations: makeAllocations({
      japan_equity: 18, us_equity: 35, developed_equity: 12, emerging_equity: 10,
      japan_bond: 3, developed_bond: 3, emerging_bond: 4,
      japan_reit: 4, developed_reit: 3, gold: 3, cash: 5,
    }),
    expectedReturn: 7.0,
    expectedVolatility: 18.0,
  },
};

// Keep sync version for backward compatibility (returns fallback)
export function getPortfolioForRiskLevel(level: RiskLevel): PortfolioPreset {
  return FALLBACK_PRESETS[level];
}

// For ScoreComparisonTable fallback
export const PORTFOLIO_PRESETS = FALLBACK_PRESETS;

// ── Async Fetch from Supabase ──

interface OptimalAllocationData {
  allocation: Record<string, number>;
  expected_return: number;
  volatility: number;
}

// Cache to avoid repeated DB calls within the same session
let cachedPresets: Record<RiskLevel, PortfolioPreset> | null = null;
let cachedDataInfo: MarketDataInfo | null = null;

function buildPresetFromDb(
  level: RiskLevel,
  data: OptimalAllocationData,
  dataInfo: MarketDataInfo,
): PortfolioPreset {
  return {
    riskLevel: level,
    allocations: makeAllocations(data.allocation),
    expectedReturn: data.expected_return,
    expectedVolatility: data.volatility,
    dataInfo,
  };
}

async function loadAndCacheMarketData(): Promise<boolean> {
  if (cachedPresets) return true;

  const record = await loadCurrentMarketData();
  if (!record) return false;

  try {
    const allocations = typeof record.optimal_allocations === 'string'
      ? JSON.parse(record.optimal_allocations)
      : record.optimal_allocations;

    const dataInfo: MarketDataInfo = {
      calculatedAt: record.calculated_at,
      dataPeriod: record.data_period,
    };
    cachedDataInfo = dataInfo;

    const presets: Partial<Record<RiskLevel, PortfolioPreset>> = {};
    const levels: RiskLevel[] = [
      'conservative', 'moderately_conservative', 'balanced',
      'moderately_aggressive', 'aggressive',
    ];

    for (const level of levels) {
      const levelData = allocations[level] as OptimalAllocationData | undefined;
      if (levelData) {
        presets[level] = buildPresetFromDb(level, levelData, dataInfo);
      }
    }

    // Only use DB data if all 5 levels are present
    if (Object.keys(presets).length === 5) {
      cachedPresets = presets as Record<RiskLevel, PortfolioPreset>;
      return true;
    }
  } catch (e) {
    console.error('Failed to parse market_data:', e);
  }

  return false;
}

/**
 * Fetch portfolio for a specific risk level from Supabase.
 * Falls back to hardcoded values if DB is empty or fails.
 */
export async function fetchPortfolioForRiskLevel(level: RiskLevel): Promise<PortfolioPreset> {
  const loaded = await loadAndCacheMarketData();
  if (loaded && cachedPresets) {
    return cachedPresets[level];
  }
  return FALLBACK_PRESETS[level];
}

/**
 * Fetch all 5 portfolio presets (for ScoreComparisonTable).
 * Falls back to hardcoded values if DB is empty or fails.
 */
export async function fetchAllPortfolioPresets(): Promise<{
  presets: Record<RiskLevel, PortfolioPreset>;
  dataInfo: MarketDataInfo | null;
}> {
  const loaded = await loadAndCacheMarketData();
  if (loaded && cachedPresets) {
    return { presets: cachedPresets, dataInfo: cachedDataInfo };
  }
  return { presets: FALLBACK_PRESETS, dataInfo: null };
}
