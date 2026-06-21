import { useState, useCallback, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import AllocationDisclaimer from '../components/AllocationDisclaimer';
import { ASSET_CLASSES, MODEL_ALLOCATIONS, MODEL_META } from '../lib/rb/types';
import { FALLBACK_ASSET_RETURNS, FALLBACK_ASSET_RISKS, FALLBACK_CORRELATION_MATRIX } from '../logic/portfolioDiagnosis';
import { classifyRiskLevel7 } from '../logic/pfSimple';
import { getRiskLevelDef } from '../logic/riskScoring';
import { loadLatestRisk } from '../lib/riskDb';
import { runMonteCarlo } from '../logic/monteCarlo';
import type { MonteCarloResult } from '../logic/monteCarlo';

const RISK_FREE_RATE = 0.5;

const VOL_UPPER: Record<number, number> = {
  1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 20, 7: 100,
};

function calcVolatility(weights: Record<string, number>): number {
  const keys = ASSET_CLASSES.map(ac => ac.key);
  let variance = 0;
  for (const ki of keys) {
    for (const kj of keys) {
      const wi = weights[ki] ?? 0;
      const wj = weights[kj] ?? 0;
      const si = (FALLBACK_ASSET_RISKS[ki] ?? 0) / 100;
      const sj = (FALLBACK_ASSET_RISKS[kj] ?? 0) / 100;
      const rho = FALLBACK_CORRELATION_MATRIX[ki]?.[kj] ?? (ki === kj ? 1 : 0);
      variance += wi * wj * si * sj * rho;
    }
  }
  return Math.round(Math.sqrt(Math.max(variance, 0)) * 100 * 10) / 10;
}

function calcExpectedReturn(weights: Record<string, number>): number {
  let ret = 0;
  for (const ac of ASSET_CLASSES) {
    ret += (weights[ac.key] ?? 0) * (FALLBACK_ASSET_RETURNS[ac.key] ?? 0);
  }
  return Math.round(ret * 10) / 10;
}

interface AnalysisResult {
  riskLevel: number;
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  overLimit: boolean;
}

export default function PortfolioCustomizePage() {
  const { user } = useAuth();
  const [userLevel, setUserLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    loadLatestRisk(user.id).then(data => {
      if (data?.final_level) setUserLevel(data.final_level);
    });
  }, [user]);

  const baseLevel = userLevel ?? 4;

  // 配分state（各スライダーは独立）
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // モンテカルロ
  const [mcInitialAsset, setMcInitialAsset] = useState('');
  const [mcMonthly, setMcMonthly] = useState('');
  const [mcYears, setMcYears] = useState('');
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [mcRunning, setMcRunning] = useState(false);

  useEffect(() => {
    const base = MODEL_ALLOCATIONS[baseLevel] ?? MODEL_ALLOCATIONS[4];
    const init: Record<string, number> = {};
    const keys: string[] = [];
    ASSET_CLASSES.forEach(ac => {
      init[ac.key] = base[ac.key] ?? 0;
      if ((base[ac.key] ?? 0) > 0) keys.push(ac.key);
    });
    setAlloc(init);
    setActiveKeys(keys);
    setResult(null);
  }, [baseLevel]);

  const totalPercent = ASSET_CLASSES.reduce((s, ac) => s + (alloc[ac.key] ?? 0), 0);
  const isValid = Math.abs(totalPercent - 100) < 0.01;

  const handleSlider = useCallback((key: string, newVal: number) => {
    setAlloc(prev => ({ ...prev, [key]: newVal }));
    setResult(null); // 変更時に結果をクリア
  }, []);

  const addAsset = useCallback((key: string) => {
    setActiveKeys(prev => [...prev, key]);
    setAlloc(prev => ({ ...prev, [key]: 0 }));
    setResult(null);
  }, []);

  const removeAsset = useCallback((key: string) => {
    setActiveKeys(prev => prev.filter(k => k !== key));
    setAlloc(prev => ({ ...prev, [key]: 0 }));
    setResult(null);
  }, []);

  const handleAnalyze = useCallback(() => {
    const weights: Record<string, number> = {};
    ASSET_CLASSES.forEach(ac => { weights[ac.key] = (alloc[ac.key] ?? 0) / 100; });

    const volatility = calcVolatility(weights);
    const expectedReturn = calcExpectedReturn(weights);
    const riskLevel = classifyRiskLevel7(volatility);
    const sharpeRatio = volatility > 0
      ? Math.round((expectedReturn - RISK_FREE_RATE) / volatility * 100) / 100
      : 0;
    const volLimit = VOL_UPPER[baseLevel] ?? 100;

    setResult({ riskLevel, expectedReturn, volatility, sharpeRatio, overLimit: volatility > volLimit });
  }, [alloc, baseLevel]);

  // 初期配分（リスクレベル別モデル配分）に戻す
  const handleReset = useCallback(() => {
    const base = MODEL_ALLOCATIONS[baseLevel] ?? MODEL_ALLOCATIONS[4];
    const newAlloc: Record<string, number> = {};
    const newKeys: string[] = [];
    ASSET_CLASSES.forEach(ac => {
      newAlloc[ac.key] = base[ac.key] ?? 0;
      if ((base[ac.key] ?? 0) > 0) newKeys.push(ac.key);
    });
    setAlloc(newAlloc);
    setActiveKeys(newKeys);
    setResult(null);
    setMcResult(null);
  }, [baseLevel]);

  const handleRunMonteCarlo = useCallback(() => {
    if (!result) return;
    const initial = parseInt(mcInitialAsset) || 0;
    const monthly = parseInt(mcMonthly) || 0;
    const years = parseInt(mcYears) || 0;
    if (initial <= 0 || years <= 0) return;
    setMcRunning(true);
    // 非同期的に実行（UIブロック回避）
    setTimeout(() => {
      const mc = runMonteCarlo(initial, monthly, years, result.expectedReturn, result.volatility);
      setMcResult(mc);
      setMcRunning(false);
    }, 10);
  }, [result, mcInitialAsset, mcMonthly, mcYears]);

  const availableToAdd = ASSET_CLASSES.filter(ac => !activeKeys.includes(ac.key));
  const volLimit = VOL_UPPER[baseLevel] ?? 100;

  return (
    <Layout>
      <main className="max-w-lg mx-auto px-4 py-6 md:py-10">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-800 mb-1">ポートフォリオ カスタマイズ</h1>
          {userLevel && (
            <p className="text-xs text-gray-500">
              Lv{userLevel} {MODEL_META[userLevel]?.name} をベースに調整
            </p>
          )}
        </div>

        <div className="space-y-6">
          {/* スライダー */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">アセット配分（%）</h3>
              <button
                onClick={handleReset}
                className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
              >
                初期配分に戻す
              </button>
            </div>
            <div className="space-y-4">
              {activeKeys.map(key => {
                const ac = ASSET_CLASSES.find(a => a.key === key);
                if (!ac) return null;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">{ac.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 w-8 text-right">{alloc[key]}%</span>
                        <button
                          onClick={() => removeAsset(key)}
                          className="text-gray-400 hover:text-red-500 text-xs"
                          title="削除"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={alloc[key]}
                      onChange={e => handleSlider(key, Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                );
              })}
            </div>

            {availableToAdd.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">＋ アセットを追加</p>
                <div className="flex flex-wrap gap-2">
                  {availableToAdd.map(ac => (
                    <button
                      key={ac.key}
                      onClick={() => addAsset(ac.key)}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-blue-50 hover:text-blue-600"
                    >
                      {ac.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 合計 + 分析ボタン */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className={`flex justify-between text-sm ${isValid ? 'text-gray-800' : 'text-red-500'}`}>
                <span>合計</span>
                <span className="font-bold">{totalPercent}%</span>
              </div>
              {!isValid && (
                <p className="text-xs text-red-500 mt-1">合計: {totalPercent}%（100%になるよう調整してください）</p>
              )}
              <button
                onClick={handleAnalyze}
                disabled={!isValid}
                className="w-full mt-3 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed min-h-[44px]"
              >
                分析する
              </button>
            </div>
          </div>

          {/* 分析結果（ボタン押下後のみ表示） */}
          {result && (
            <div className={`bg-white rounded-xl border ${result.overLimit ? 'border-red-300' : 'border-gray-200'} p-5`}>
              {/* 警告/OK アラート */}
              {result.overLimit ? (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
                  <p className="text-sm text-red-700">
                    ⚠️ このポートフォリオのリスクはあなたの許容度（Lv{baseLevel}・上限{volLimit}%）を超えています。長期投資ポートフォリオとしては不適切です。
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
                  <p className="text-sm text-green-700">
                    ✅ このポートフォリオはあなたのリスク許容度の範囲内です。
                  </p>
                </div>
              )}

              <h3 className="text-sm font-bold text-gray-800 mb-3">シミュレーション結果（計算上の参考値）</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">リスクレベル</span>
                  <span className="font-medium text-gray-800">
                    Lv{result.riskLevel} {getRiskLevelDef(result.riskLevel).name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">期待リターン</span>
                  <span className="font-medium text-gray-800">{result.expectedReturn}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">ボラティリティ</span>
                  <span className={`font-medium ${result.overLimit ? 'text-red-600' : 'text-gray-800'}`}>
                    {result.volatility}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">シャープレシオ</span>
                  <span className="font-medium text-gray-800">{result.sharpeRatio}</span>
                </div>
              </div>
            </div>
          )}

          {/* モンテカルロシミュレーション（分析結果がある場合のみ） */}
          {result && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">将来資産シミュレーション（モンテカルロ法）</h3>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">現在の金融資産（万円）</label>
                  <input
                    type="number"
                    value={mcInitialAsset}
                    onChange={e => { setMcInitialAsset(e.target.value); setMcResult(null); }}
                    placeholder="例: 10000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">毎月の積立額（万円）</label>
                  <input
                    type="number"
                    value={mcMonthly}
                    onChange={e => { setMcMonthly(e.target.value); setMcResult(null); }}
                    placeholder="例: 50"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">積立期間（年）</label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={mcYears}
                    onChange={e => { setMcYears(e.target.value); setMcResult(null); }}
                    placeholder="例: 20"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleRunMonteCarlo}
                  disabled={mcRunning || !(parseInt(mcInitialAsset) > 0) || !(parseInt(mcYears) > 0)}
                  className="w-full py-3 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {mcRunning ? '計算中...' : 'シミュレーション実行'}
                </button>
              </div>

              {/* モンテカルロ結果 */}
              {mcResult && (() => {
                const initial = parseInt(mcInitialAsset) || 0;
                const monthly = parseInt(mcMonthly) || 0;
                const years = parseInt(mcYears) || 1;
                const totalPrincipal = initial + monthly * 12 * years;

                const scenarioRow = (label: string, value: number, bgColor: string, textColor: string, boldColor: string) => {
                  const profit = value - totalPrincipal;
                  const cagr = totalPrincipal > 0 ? (Math.pow(value / totalPrincipal, 1 / years) - 1) * 100 : 0;
                  return (
                    <div className={`${bgColor} rounded-lg px-4 py-2.5`}>
                      <div className="flex justify-between text-sm">
                        <span className={textColor}>{label}</span>
                        <span className={`font-bold ${boldColor}`}>{value.toLocaleString()}万円</span>
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span className={textColor}>利益{profit >= 0 ? '+' : ''}{profit.toLocaleString()}万円</span>
                        <span className={textColor}>CAGR {cagr.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="space-y-4">
                    {/* 投資元本合計 */}
                    <div className="flex justify-between text-sm bg-gray-100 rounded-lg px-4 py-2.5">
                      <span className="text-gray-600">投資元本合計</span>
                      <span className="font-bold text-gray-800">{totalPrincipal.toLocaleString()}万円</span>
                    </div>

                    {/* ヒストグラム */}
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={mcResult.histogram} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="bin"
                          tick={{ fill: '#6b7280', fontSize: 10 }}
                          tickFormatter={v => `${Math.round(v / 10000)}億`}
                        />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          formatter={(value: number | undefined) => [`${value ?? 0}回`, '試行回数']}
                          labelFormatter={v => `${Number(v).toLocaleString()}万円〜`}
                        />
                        <ReferenceLine x={mcResult.median} stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 4" label={{ value: '中央値', fill: '#8b5cf6', fontSize: 10, position: 'top' }} />
                        <Bar dataKey="count" fill="#a78bfa" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>

                    {/* 3シナリオ */}
                    <div className="space-y-2">
                      {scenarioRow('悲観シナリオ（下位25%）', mcResult.percentile25, 'bg-blue-50', 'text-blue-700', 'text-blue-800')}
                      {scenarioRow('中央値', mcResult.median, 'bg-purple-50', 'text-purple-700', 'text-purple-800')}
                      {scenarioRow('楽観シナリオ（上位75%）', mcResult.percentile75, 'bg-green-50', 'text-green-700', 'text-green-800')}
                    </div>
                  </div>
                );
              })()}

              <p className="text-xs text-gray-400 mt-4">
                このシミュレーションは過去データに基づく計算上の参考値です。将来の運用成果を保証するものではありません。
              </p>
            </div>
          )}

          <AllocationDisclaimer variant="light" />

          <p className="text-xs text-gray-400 text-center">
            この配分は計算上の参考値です。投資判断はご自身でご確認ください。
          </p>
        </div>
      </main>
    </Layout>
  );
}
