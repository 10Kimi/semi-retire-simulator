import { ASSET_CLASSES } from '../lib/rb/types';
import { FALLBACK_ASSET_RETURNS, FALLBACK_ASSET_RISKS, FALLBACK_CORRELATION_MATRIX } from './portfolioDiagnosis';
import { classifyRiskLevel7 } from './pfSimple';

export const RISK_FREE_RATE = 0.5;

export const VOL_UPPER: Record<number, number> = {
  1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 16, 7: 100,   // 2026-11-02: Lv6上限 16.5→16（2026-08-12: 20→16.5）
};

// 資産パラメータ（ボラ・期待リターン・相関）。/pf と同じく asset_class_params（DB）を優先し、
// 取得失敗時のみフォールバック定数に落ちる。%表記の値をそのまま保持する。
export interface MarketParams {
  risks: Record<string, number>;
  returns: Record<string, number>;
  corr: Record<string, Record<string, number>>;
}

export const FALLBACK_MARKET: MarketParams = {
  risks: FALLBACK_ASSET_RISKS,
  returns: FALLBACK_ASSET_RETURNS,
  corr: FALLBACK_CORRELATION_MATRIX,
};

export function calcVolatility(weights: Record<string, number>, market: MarketParams): number {
  const keys = ASSET_CLASSES.map(ac => ac.key);
  let variance = 0;
  for (const ki of keys) {
    for (const kj of keys) {
      const wi = weights[ki] ?? 0;
      const wj = weights[kj] ?? 0;
      const si = (market.risks[ki] ?? 0) / 100;
      const sj = (market.risks[kj] ?? 0) / 100;
      const rho = market.corr[ki]?.[kj] ?? (ki === kj ? 1 : 0);
      variance += wi * wj * si * sj * rho;
    }
  }
  return Math.round(Math.sqrt(Math.max(variance, 0)) * 100 * 10) / 10;
}

export function calcExpectedReturn(weights: Record<string, number>, market: MarketParams): number {
  let ret = 0;
  for (const ac of ASSET_CLASSES) {
    ret += (weights[ac.key] ?? 0) * (market.returns[ac.key] ?? 0);
  }
  return Math.round(ret * 10) / 10;
}

export interface AnalysisResult {
  riskLevel: number;
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  overLimit: boolean;
}

// weights（合計1）から分析結果を算出する
export function computeResult(weights: Record<string, number>, baseLevel: number, market: MarketParams): AnalysisResult {
  const volatility = calcVolatility(weights, market);
  const expectedReturn = calcExpectedReturn(weights, market);
  const riskLevel = classifyRiskLevel7(volatility);
  const sharpeRatio = volatility > 0
    ? Math.round((expectedReturn - RISK_FREE_RATE) / volatility * 100) / 100
    : 0;
  const volLimit = VOL_UPPER[baseLevel] ?? 100;
  return { riskLevel, expectedReturn, volatility, sharpeRatio, overLimit: volatility > volLimit };
}
