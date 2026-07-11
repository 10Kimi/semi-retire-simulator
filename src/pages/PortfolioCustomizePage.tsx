import { useState, useCallback, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import AllocationDisclaimer from '../components/AllocationDisclaimer';
import { ASSET_CLASSES, MODEL_ALLOCATIONS, MODEL_META } from '../lib/rb/types';
import type { AssetClassKey } from '../lib/rb/types';
import { FALLBACK_ASSET_RETURNS, FALLBACK_ASSET_RISKS, FALLBACK_CORRELATION_MATRIX } from '../logic/portfolioDiagnosis';
import { classifyRiskLevel7 } from '../logic/pfSimple';
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

// weights（合計1）から分析結果を算出する
function computeResult(weights: Record<string, number>, baseLevel: number): AnalysisResult {
  const volatility = calcVolatility(weights);
  const expectedReturn = calcExpectedReturn(weights);
  const riskLevel = classifyRiskLevel7(volatility);
  const sharpeRatio = volatility > 0
    ? Math.round((expectedReturn - RISK_FREE_RATE) / volatility * 100) / 100
    : 0;
  const volLimit = VOL_UPPER[baseLevel] ?? 100;
  return { riskLevel, expectedReturn, volatility, sharpeRatio, overLimit: volatility > volLimit };
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

  // 入力モード（% or 金額）と金額state（万円）
  const [inputMode, setInputMode] = useState<'percent' | 'amount'>('percent');
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  // 保有中のPF（＝ユーザーの実際の持ち分）の金額スナップショット。編集可能なデータとして保持し、
  // 「最適配分にする」で入力欄が最適に置き換わっても保持され、カードに常時表示・「修正」で入力欄に復元できる。
  const [heldAmounts, setHeldAmounts] = useState<Record<string, number> | null>(null);
  // 入力欄が「保有PFの入力/修正」を表しているか（true）／「最適配分の試行」を表しているか（false）。
  const [editingHeld, setEditingHeld] = useState(true);
  // 最適配分を入力欄に読み込んだ後にユーザーが金額をいじったか（左列ラベル「調整後」判定用）。
  const [adjustedOptimal, setAdjustedOptimal] = useState(false);

  // モンテカルロ
  const [mcInitialAsset, setMcInitialAsset] = useState('');
  const [mcMonthly, setMcMonthly] = useState('');
  const [mcYears, setMcYears] = useState('');
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [mcOptimalResult, setMcOptimalResult] = useState<MonteCarloResult | null>(null);
  const [mcRunning, setMcRunning] = useState(false);

  // 最適配分（モデル配分）の指標。現PFと同じ計算関数で算出し、同一基準で比較する。
  const optimal = useMemo(() => {
    const base = MODEL_ALLOCATIONS[baseLevel] ?? MODEL_ALLOCATIONS[4];
    const w: Record<string, number> = {};
    ASSET_CLASSES.forEach(ac => { w[ac.key] = (base[ac.key] ?? 0) / 100; });
    const expectedReturn = calcExpectedReturn(w);
    const volatility = calcVolatility(w);
    const sharpeRatio = volatility > 0
      ? Math.round((expectedReturn - RISK_FREE_RATE) / volatility * 100) / 100
      : 0;
    return { name: MODEL_META[baseLevel]?.name ?? '', expectedReturn, volatility, sharpeRatio };
  }, [baseLevel]);

  // 保有中のPF の集計（金額→合計・weights・分析結果）。カード表示と比較の基準に使う。
  const heldInfo = useMemo(() => {
    if (!heldAmounts) return null;
    const total = ASSET_CLASSES.reduce((s, ac) => s + (heldAmounts[ac.key] ?? 0), 0);
    if (total <= 0) return null;
    const weights: Record<string, number> = {};
    ASSET_CLASSES.forEach(ac => { weights[ac.key] = (heldAmounts[ac.key] ?? 0) / total; });
    return { total, weights, result: computeResult(weights, baseLevel) };
  }, [heldAmounts, baseLevel]);

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
    setHeldAmounts(null);
    setEditingHeld(true);
    setAdjustedOptimal(false);
    setResult(null);
  }, [baseLevel]);

  const totalPercent = ASSET_CLASSES.reduce((s, ac) => s + (alloc[ac.key] ?? 0), 0);
  const totalAmount = ASSET_CLASSES.reduce((s, ac) => s + (amounts[ac.key] ?? 0), 0);
  const isValid = inputMode === 'percent' ? Math.abs(totalPercent - 100) < 0.01 : totalAmount > 0;
  const derivedPercent = (key: string) => (totalAmount > 0 ? Math.round(((amounts[key] ?? 0) / totalAmount) * 1000) / 10 : 0);

  const handleSlider = useCallback((key: string, newVal: number) => {
    setAlloc(prev => ({ ...prev, [key]: newVal }));
    setResult(null); // 変更時に結果をクリア
  }, []);

  const handleAmount = useCallback((key: string, newVal: number) => {
    setAmounts(prev => ({ ...prev, [key]: newVal }));
    // 最適配分の試行中（!editingHeld）に編集したら「調整後」へ。保有PF編集中は保有PFの修正。
    if (!editingHeld) setAdjustedOptimal(true);
    setResult(null);
  }, [editingHeld]);

  const addAsset = useCallback((key: string) => {
    setActiveKeys(prev => [...prev, key]);
    setAlloc(prev => ({ ...prev, [key]: 0 }));
    setAmounts(prev => ({ ...prev, [key]: 0 }));
    if (!editingHeld) setAdjustedOptimal(true);
    setResult(null);
  }, [editingHeld]);

  const removeAsset = useCallback((key: string) => {
    setActiveKeys(prev => prev.filter(k => k !== key));
    setAlloc(prev => ({ ...prev, [key]: 0 }));
    setAmounts(prev => ({ ...prev, [key]: 0 }));
    if (!editingHeld) setAdjustedOptimal(true);
    setResult(null);
  }, [editingHeld]);

  const handleAnalyze = useCallback(() => {
    const total = ASSET_CLASSES.reduce((s, ac) => s + (amounts[ac.key] ?? 0), 0);
    const weights: Record<string, number> = {};
    if (inputMode === 'amount') {
      if (editingHeld && total > 0) {
        // 入力欄＝保有PF → 保有PFとして確定/更新し、保有PF vs 最適 を比較（＝日常のデータ修正）
        setHeldAmounts({ ...amounts });
        ASSET_CLASSES.forEach(ac => { weights[ac.key] = (amounts[ac.key] ?? 0) / total; });
        setMcInitialAsset(String(total));
        setMcResult(null);
      } else if (!editingHeld && !adjustedOptimal && heldInfo) {
        // 最適配分にした直後（未調整）→ 保有PF（スナップショット）で比較
        Object.assign(weights, heldInfo.weights);
        setMcInitialAsset(String(heldInfo.total));
        setMcResult(null);
      } else if (total > 0) {
        // 調整後の入力値で比較
        ASSET_CLASSES.forEach(ac => { weights[ac.key] = (amounts[ac.key] ?? 0) / total; });
        setMcInitialAsset(String(total));
        setMcResult(null);
      } else {
        return;
      }
    } else {
      ASSET_CLASSES.forEach(ac => { weights[ac.key] = (alloc[ac.key] ?? 0) / 100; });
    }

    setResult(computeResult(weights, baseLevel));
  }, [alloc, amounts, inputMode, baseLevel, editingHeld, adjustedOptimal, heldInfo]);

  // 最適配分（リスクレベル別モデル配分）に戻す
  const handleReset = useCallback(() => {
    const base = MODEL_ALLOCATIONS[baseLevel] ?? MODEL_ALLOCATIONS[4];
    const newKeys: AssetClassKey[] = [];
    ASSET_CLASSES.forEach(ac => {
      if ((base[ac.key] ?? 0) > 0) newKeys.push(ac.key);
    });

    // 金額モードで保有総額が入っている場合は、その合計額を維持したまま最適配分（％）で金額を
    // 再割り当てする（モードは金額のまま、入力欄は試行用の最適に置換）。
    const total = ASSET_CLASSES.reduce((s, ac) => s + (amounts[ac.key] ?? 0), 0);
    if (inputMode === 'amount' && total > 0) {
      // 入力欄が保有PFを表しているとき（editingHeld）だけ保有PFを確定/更新する。
      // 「最適配分に戻す」の2度押し（!editingHeld）では撮り直さない＝保有PFすり替わりバグの根治。
      const capturedHeld = editingHeld ? { ...amounts } : heldAmounts;
      const ref = editingHeld
        ? (() => {
            const w: Record<string, number> = {};
            ASSET_CLASSES.forEach(ac => { w[ac.key] = (amounts[ac.key] ?? 0) / total; });
            return { total, weights: w };
          })()
        : heldInfo;
      const heldTotal = ref ? ref.total : total;

      const newAmounts: Record<string, number> = {};
      ASSET_CLASSES.forEach(ac => {
        newAmounts[ac.key] = Math.round((heldTotal * (base[ac.key] ?? 0)) / 100);
      });
      // 丸め誤差を最大配分アセットで吸収し、合計を保有総額に厳密一致させる
      const rounded = ASSET_CLASSES.reduce((s, ac) => s + (newAmounts[ac.key] ?? 0), 0);
      const diff = heldTotal - rounded;
      if (diff !== 0 && newKeys.length > 0) {
        const maxKey = newKeys.reduce((a, b) => ((base[b] ?? 0) > (base[a] ?? 0) ? b : a));
        newAmounts[maxKey] = (newAmounts[maxKey] ?? 0) + diff;
      }
      setHeldAmounts(capturedHeld);
      setAmounts(newAmounts);
      setActiveKeys(newKeys);
      setEditingHeld(false);       // 入力欄は最適の試行に切替（ボタンは「最適配分に戻す」）
      setAdjustedOptimal(false);
      // 比較は「保有PF vs 最適」を即表示
      if (ref) {
        setResult(computeResult(ref.weights, baseLevel));
        setMcInitialAsset(String(ref.total));
      }
      setMcResult(null);
      return;
    }

    // ％モード（または金額未入力）は従来どおりモデル配分（％）へ戻す
    const newAlloc: Record<string, number> = {};
    ASSET_CLASSES.forEach(ac => {
      newAlloc[ac.key] = base[ac.key] ?? 0;
    });
    setAlloc(newAlloc);
    setActiveKeys(newKeys);
    setAmounts({});
    setInputMode('percent');
    setHeldAmounts(null);
    setEditingHeld(true);
    setAdjustedOptimal(false);
    setResult(null);
    setMcResult(null);
  }, [baseLevel, inputMode, amounts, editingHeld, heldAmounts, heldInfo]);

  // カードの「修正」：保有PFを入力欄に復元して編集可能に戻す（＝将来のデータ修正）
  const handleEditHeld = useCallback(() => {
    if (!heldAmounts) return;
    const keys = ASSET_CLASSES.filter(ac => (heldAmounts[ac.key] ?? 0) > 0).map(ac => ac.key);
    if (!keys.includes('cash')) keys.unshift('cash');
    setAmounts({ ...heldAmounts });
    setActiveKeys(keys);
    setInputMode('amount');
    setEditingHeld(true);
    setAdjustedOptimal(false);
    setResult(null);
    setMcResult(null);
  }, [heldAmounts]);

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
      const mcOpt = runMonteCarlo(initial, monthly, years, optimal.expectedReturn, optimal.volatility);
      setMcResult(mc);
      setMcOptimalResult(mcOpt);
      setMcRunning(false);
    }, 10);
  }, [result, mcInitialAsset, mcMonthly, mcYears, optimal]);

  const availableToAdd = ASSET_CLASSES.filter(ac => !activeKeys.includes(ac.key));
  const volLimit = VOL_UPPER[baseLevel] ?? 100;

  // 比較対象（左列）がちょうど最適配分と同値か。この場合は比較の意味がないため表の代わりに注記を出す
  // （％モードで初期モデル配分のまま分析した場合など。金額モードで保有PFを比較中は通常ここには入らない）。
  const isAtOptimal = !!result
    && result.riskLevel === baseLevel
    && result.expectedReturn === optimal.expectedReturn
    && result.volatility === optimal.volatility
    && result.sharpeRatio === optimal.sharpeRatio;

  // 比較表の左列ラベル。金額モードでは保有PFか調整後かを出し分ける。
  const currentLabel = inputMode === 'amount'
    ? (adjustedOptimal ? '調整後' : '保有中のPF')
    : '今の配分';

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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">
                アセット配分（{inputMode === 'percent' ? '%' : '金額'}）
              </h3>
              <button
                onClick={handleReset}
                className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
              >
                {inputMode === 'amount' && editingHeld ? '最適配分にする' : '最適配分に戻す'}
              </button>
            </div>
            {/* % / 金額 トグル */}
            <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 text-xs">
              <button
                onClick={() => { setInputMode('percent'); setResult(null); }}
                className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${inputMode === 'percent' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
              >
                ％で調整（モデル配分から）
              </button>
              <button
                onClick={() => {
                  setInputMode('amount');
                  setEditingHeld(true);
                  setAdjustedOptimal(false);
                  setResult(null);
                  if (heldAmounts) {
                    // 金額モード＝自分の保有PF。既存の保有PFがあれば入力欄に復元する
                    const keys = ASSET_CLASSES.filter(ac => (heldAmounts[ac.key] ?? 0) > 0).map(ac => ac.key);
                    if (!keys.includes('cash')) keys.unshift('cash');
                    setAmounts({ ...heldAmounts });
                    setActiveKeys(keys);
                  } else {
                    setActiveKeys(prev => (prev.includes('cash') ? prev : ['cash', ...prev]));
                  }
                }}
                className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${inputMode === 'amount' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
              >
                金額で入力（今の保有額）
              </button>
            </div>
            {inputMode === 'amount' && (
              <p className="text-xs text-gray-500 mb-3 -mt-1">
                ※ 緊急避難資金は除き、投資用に置いている「余剰現金」も現金として入力してください（入れないとリスクが過大に計算されます）。
              </p>
            )}
            <div className="space-y-4">
              {activeKeys.map(key => {
                const ac = ASSET_CLASSES.find(a => a.key === key);
                if (!ac) return null;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">{ac.label}</span>
                      <div className="flex items-center gap-2">
                        {inputMode === 'percent' ? (
                          <span className="font-medium text-gray-800 w-8 text-right">{alloc[key]}%</span>
                        ) : (
                          <span className="text-gray-400 w-12 text-right">{derivedPercent(key)}%</span>
                        )}
                        <button
                          onClick={() => removeAsset(key)}
                          className="text-gray-400 hover:text-red-500 text-xs"
                          title="削除"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {inputMode === 'percent' ? (
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={alloc[key]}
                        onChange={e => handleSlider(key, Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={amounts[key] || ''}
                          onChange={e => handleAmount(key, Number(e.target.value))}
                          placeholder="例: 500"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-xs text-gray-500 shrink-0">万円</span>
                      </div>
                    )}
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
                {inputMode === 'percent' && availableToAdd.some(ac => ac.key === 'cash') && (
                  <p className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1.5 mt-3">
                    💡 リスクを抑えたい場合は「現金」を加えると全体のリスクが下がります（緊急避難資金とは別に）。
                  </p>
                )}
              </div>
            )}

            {/* 合計 + 分析ボタン */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className={`flex justify-between text-sm ${isValid ? 'text-gray-800' : 'text-red-500'}`}>
                <span>合計</span>
                <span className="font-bold">
                  {inputMode === 'percent' ? `${totalPercent}%` : `${totalAmount.toLocaleString()}万円`}
                </span>
              </div>
              {inputMode === 'percent' && !isValid && (
                <p className="text-xs text-red-500 mt-1">合計: {totalPercent}%（100%になるよう調整してください）</p>
              )}
              {inputMode === 'amount' && !isValid && (
                <p className="text-xs text-red-500 mt-1">保有額を入力してください</p>
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

          {/* 保有中のPF カード（最適配分にして入力欄が最適に化けている間、保有PFを常時明示） */}
          {heldInfo && !editingHeld && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-800">📌 保有中のPF（比較の基準）</h3>
                <button
                  onClick={handleEditHeld}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  ✏️ 修正
                </button>
              </div>
              <div className="space-y-1">
                {ASSET_CLASSES.filter(ac => (heldAmounts?.[ac.key] ?? 0) > 0).map(ac => (
                  <div key={ac.key} className="flex justify-between text-xs">
                    <span className="text-gray-500">{ac.label}</span>
                    <span className="text-gray-800">{(heldAmounts?.[ac.key] ?? 0).toLocaleString()}万円</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-100">
                <span className="text-gray-600">合計</span>
                <span className="font-bold text-gray-800">
                  {heldInfo.total.toLocaleString()}万円 ・ Lv{heldInfo.result.riskLevel}（ボラ{heldInfo.result.volatility}%）
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                「最適配分にする」で上の入力欄は最適配分に置き換わりますが、これがあなたの保有PFです。書き換えるには「✏️ 修正」を押してください。
              </p>
            </div>
          )}

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

              <h3 className="text-sm font-bold text-gray-800 mb-1">シミュレーション結果（計算上の参考値）</h3>
              <p className="text-xs text-gray-400 mb-3">
                「最適配分」＝ あなたのリスク許容度（Lv{baseLevel}{optimal.name ? ` ${optimal.name}` : ''}）に対するモデル配分
              </p>
              {isAtOptimal ? (
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-purple-700">
                    現在ちょうど最適配分になっています。金額を調整して「分析する」を押すと、最適配分との差分が表示されます。
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2.5 text-sm items-center">
                  <span></span>
                  <span className="text-xs font-medium text-gray-500 text-right">{currentLabel}</span>
                  <span className="text-xs font-medium text-purple-600 text-right">最適配分</span>

                  <span className="text-gray-500">リスクレベル</span>
                  <span className="font-medium text-gray-800 text-right">Lv{result.riskLevel}</span>
                  <span className="font-medium text-purple-700 text-right">Lv{baseLevel}</span>

                  <span className="text-gray-500">期待リターン</span>
                  <span className="font-medium text-gray-800 text-right">{result.expectedReturn}%</span>
                  <span className="font-medium text-purple-700 text-right">{optimal.expectedReturn}%</span>

                  <span className="text-gray-500">ボラティリティ</span>
                  <span className={`font-medium text-right ${result.overLimit ? 'text-red-600' : 'text-gray-800'}`}>{result.volatility}%</span>
                  <span className="font-medium text-purple-700 text-right">{optimal.volatility}%</span>

                  <span className="text-gray-500">シャープレシオ</span>
                  <span className="font-medium text-gray-800 text-right">{result.sharpeRatio}</span>
                  <span className="font-medium text-purple-700 text-right">{optimal.sharpeRatio}</span>
                </div>
              )}
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

                    {/* 最適配分で運用した場合との比較（今の配分＝最適のときは同値になるため非表示） */}
                    {mcOptimalResult && !isAtOptimal && (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-600 mb-2">
                          最適配分（Lv{baseLevel}）で同じ条件で運用した場合との比較
                        </p>
                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 text-xs items-center">
                          <span></span>
                          <span className="font-medium text-gray-500 text-right">{currentLabel}</span>
                          <span className="font-medium text-purple-600 text-right">最適配分</span>

                          <span className="text-gray-500">悲観（下位25%）</span>
                          <span className="text-gray-800 text-right">{mcResult.percentile25.toLocaleString()}万円</span>
                          <span className="text-purple-700 text-right">{mcOptimalResult.percentile25.toLocaleString()}万円</span>

                          <span className="text-gray-500">中央値</span>
                          <span className="text-gray-800 text-right">{mcResult.median.toLocaleString()}万円</span>
                          <span className="text-purple-700 text-right">{mcOptimalResult.median.toLocaleString()}万円</span>

                          <span className="text-gray-500">楽観（上位75%）</span>
                          <span className="text-gray-800 text-right">{mcResult.percentile75.toLocaleString()}万円</span>
                          <span className="text-purple-700 text-right">{mcOptimalResult.percentile75.toLocaleString()}万円</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          中央値の差：{mcOptimalResult.median - mcResult.median >= 0 ? '+' : ''}{(mcOptimalResult.median - mcResult.median).toLocaleString()}万円（最適配分 − {currentLabel}）
                        </p>
                      </div>
                    )}
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
