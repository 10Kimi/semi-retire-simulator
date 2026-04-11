export interface MonteCarloResult {
  histogram: { bin: number; count: number }[];
  median: number;
  percentile25: number;
  percentile75: number;
}

/** Box-Muller法で標準正規分布の乱数を生成 */
function boxMuller(): number {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * モンテカルロシミュレーション
 * @param initialAsset 現在の金融資産（万円）
 * @param monthlyContribution 毎月の積立額（万円）
 * @param years 積立期間（年）
 * @param expectedReturn 期待リターン（%、例: 6.7）
 * @param volatility ボラティリティ（%、例: 12.1）
 * @param trials 試行回数（デフォルト1000）
 */
export function runMonteCarlo(
  initialAsset: number,
  monthlyContribution: number,
  years: number,
  expectedReturn: number,
  volatility: number,
  trials: number = 1000,
): MonteCarloResult {
  const mu = expectedReturn / 100;   // %→小数
  const sigma = volatility / 100;    // %→小数
  const annualContribution = monthlyContribution * 12;

  const finalAssets: number[] = [];

  for (let t = 0; t < trials; t++) {
    let asset = initialAsset;
    for (let y = 0; y < years; y++) {
      const r = mu + sigma * boxMuller();
      asset = (asset + annualContribution) * (1 + r);
    }
    finalAssets.push(Math.max(0, Math.round(asset)));
  }

  // ソート
  finalAssets.sort((a, b) => a - b);

  // パーセンタイル
  const percentile = (p: number) => finalAssets[Math.floor(finalAssets.length * p)];
  const median = percentile(0.5);
  const percentile25 = percentile(0.25);
  const percentile75 = percentile(0.75);

  // ヒストグラム（20ビン）
  const min = finalAssets[0];
  const max = finalAssets[finalAssets.length - 1];
  const binCount = 20;
  const binWidth = Math.max(1, Math.ceil((max - min) / binCount));

  const histogram: { bin: number; count: number }[] = [];
  for (let i = 0; i < binCount; i++) {
    const binStart = min + i * binWidth;
    histogram.push({ bin: binStart, count: 0 });
  }

  for (const val of finalAssets) {
    const idx = Math.min(binCount - 1, Math.floor((val - min) / binWidth));
    histogram[idx].count++;
  }

  return { histogram, median, percentile25, percentile75 };
}
