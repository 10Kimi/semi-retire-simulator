import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserStatusBar from '../components/UserStatusBar';
import { ASSET_CLASSES, MODEL_ALLOCATIONS, MODEL_META } from '../lib/rb/types';
import type { Holdings, TargetAllocation, DeviationItem, AdjustmentItem, AdjustmentMode } from '../lib/rb/types';
import { calculateDeviation, calculateAddAdjustment, calculateSellAdjustment, estimateMonthsToRebalance, calculateEmergencyFund, applyEmergencyFund, calculatePeriodByAmount, calculatePeriodByMonths, simulateMonthly, getTotalAssets, formatCurrency, formatThousands } from '../lib/rb/logic';
import { fetchTargetAllocation, saveTargetAllocation, fetchLatestSnapshot, saveSnapshot, fetchRbProfile, saveRbProfile } from '../lib/rb/db';
import { loadLatestRisk } from '../lib/riskDb';
import MfImportFlow from '../components/rb/MfImportFlow';
import AllocationDisclaimer from '../components/AllocationDisclaimer';
import { supabase } from '../lib/supabase';
import MonthlyProjection from '../components/rb/MonthlyProjection';

type Step = 'input' | 'import' | 'target' | 'result';

function AdjustmentList({ items }: { items: AdjustmentItem[] }) {
  return (
    <div className="space-y-2">
      {items.map(item => {
        const isCash = item.key === 'cash';
        let actionLabel: string;
        if (isCash) {
          actionLabel = item.amount > 0 ? '積み増し' : '投資に回す';
        } else {
          actionLabel = item.amount > 0 ? '追加' : '売却';
        }
        return (
          <div key={item.key} className="bg-slate-800 rounded-lg px-4 py-3 flex justify-between items-center">
            <span className="text-sm">{item.label}</span>
            <span className={`text-sm font-medium ${item.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatThousands(item.amount)} {actionLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 売却が発生するときだけ出す口座順の注記。
 * このツールは資産クラスの金額しか持たないため「どの口座で売るか」は計算できない。
 * 判断の型（実践4-1 の原則）だけを渡して、口座別の実作業はワークシート側に寄せる。
 */
function SellAccountNote() {
  return (
    <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg px-4 py-3">
      <p className="text-sm text-amber-300 mb-1">どの口座で売るか</p>
      <p className="text-xs text-amber-400/80 leading-relaxed">
        ① iDeCo・401k内のスイッチング（非課税）→ ② NISA（非課税・枠は翌年復活）→ ③ 特定口座（課税）の順に検討してください。
        特定口座で売ると含み益に約20%課税されます。口座をまたいで大きく動かすときは、口座別リバランス・ワークシートを使ってください。
      </p>
    </div>
  );
}

const SEVERITY_COLORS: Record<DeviationItem['severity'], string> = {
  ok: 'text-slate-400',
  minor: 'text-blue-400',
  warning: 'text-orange-400',
  danger: 'text-red-400',
};

const SEVERITY_BG: Record<DeviationItem['severity'], string> = {
  ok: 'bg-slate-800',
  minor: 'bg-blue-900/30 border border-blue-500/30',
  warning: 'bg-orange-900/30 border border-orange-500/30',
  danger: 'bg-red-900/30 border border-red-500/30',
};

export default function RebalancePage() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('input');
  const [loading, setLoading] = useState(true);
  const [optimalLoading, setOptimalLoading] = useState(false);
  const [userRiskLevel, setUserRiskLevel] = useState<number>(4);

  // 残高入力
  const [holdings, setHoldings] = useState<Holdings>(() => {
    const h: Holdings = {};
    ASSET_CLASSES.forEach(ac => { h[ac.key] = 0; });
    return h;
  });

  // 目標配分
  const [target, setTarget] = useState<TargetAllocation>(() => {
    const t: TargetAllocation = {};
    ASSET_CLASSES.forEach(ac => { t[ac.key] = 0; });
    return t;
  });
  const [hasExistingTarget, setHasExistingTarget] = useState(false);

  // 乖離・調整結果
  const [deviation, setDeviation] = useState<DeviationItem[]>([]);
  const [adjustMode, setAdjustMode] = useState<AdjustmentMode>('add');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [periodMonthlyAmount, setPeriodMonthlyAmount] = useState('');
  const [periodMonths, setPeriodMonths] = useState('');
  const [periodLastChanged, setPeriodLastChanged] = useState<'amount' | 'months'>('amount');
  const [expandedHint, setExpandedHint] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [showTargetUpdateBanner, setShowTargetUpdateBanner] = useState(false);

  // 緊急資金設定
  const [monthlyLivingCost, setMonthlyLivingCost] = useState<string>('');
  const [emergencyMonths, setEmergencyMonths] = useState<number>(6);

  useEffect(() => {
    const load = async () => {
      if (!user) { setLoading(false); return; }

      const [savedTarget, snapshot, profile, riskData] = await Promise.all([
        fetchTargetAllocation(user.id),
        fetchLatestSnapshot(user.id),
        fetchRbProfile(user.id),
        loadLatestRisk(user.id),
      ]);
      if (riskData?.final_level) setUserRiskLevel(riskData.final_level);

      if (savedTarget) {
        setTarget(savedTarget);
        setHasExistingTarget(true);
        // 旧モデル配分の検知: 現在のモデル配分と一致するか確認
        const matchesAnyPreset = Object.keys(MODEL_ALLOCATIONS).some(lv => {
          const preset = MODEL_ALLOCATIONS[Number(lv)];
          return ASSET_CLASSES.every(ac =>
            Math.abs((savedTarget[ac.key] || 0) - (preset[ac.key] || 0)) < 0.01
          );
        });
        if (!matchesAnyPreset) {
          setShowTargetUpdateBanner(true);
        }
      }
      if (snapshot) {
        setHoldings(snapshot.holdings);
      }
      if (profile.monthly_living_cost != null) {
        setMonthlyLivingCost(String(profile.monthly_living_cost));
      }
      setEmergencyMonths(profile.emergency_months);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p className="text-slate-400">読み込み中...</p>
      </div>
    );
  }

  const livingCostNum = parseInt(monthlyLivingCost.replace(/[^0-9]/g, '')) || 0;
  const cashAmount = holdings['cash'] || 0;
  const emergency = calculateEmergencyFund(cashAmount, livingCostNum || null, emergencyMonths);
  const investableHoldings = applyEmergencyFund(holdings, livingCostNum || null, emergencyMonths);
  const totalAssets = getTotalAssets(investableHoldings);

  const handleHoldingChange = (key: string, value: string) => {
    const num = parseInt(value.replace(/[^0-9]/g, '')) || 0;
    setHoldings(prev => ({ ...prev, [key]: num }));
  };

  const handleTargetChange = (key: string, value: string) => {
    const num = parseFloat(value) || 0;
    setTarget(prev => ({ ...prev, [key]: num }));
  };

  const targetSum = ASSET_CLASSES.reduce((sum, ac) => sum + (target[ac.key] || 0), 0);
  const targetValid = Math.abs(targetSum - 100) < 0.01;

  const loadOptimalPF = async () => {
    setOptimalLoading(true);
    const { data } = await supabase
      .from('optimal_portfolios')
      .select('allocations')
      .eq('risk_level', userRiskLevel)
      .single();

    if (data?.allocations) {
      const optimal = data.allocations as Record<string, number>;
      const newTarget: TargetAllocation = {};
      ASSET_CLASSES.forEach(ac => { newTarget[ac.key] = optimal[ac.key] ?? 0; });
      setTarget(newTarget);
      setSelectedPreset(null);
    }
    setOptimalLoading(false);
  };

  const applyPreset = (riskLevel: number) => {
    const preset = MODEL_ALLOCATIONS[riskLevel];
    if (preset) {
      setTarget({ ...preset });
      setSelectedPreset(riskLevel);
    }
  };

  const goToTarget = async () => {
    if (user) {
      await Promise.all([
        saveSnapshot(user.id, holdings),
        saveRbProfile(user.id, { monthly_living_cost: livingCostNum || null, emergency_months: emergencyMonths }),
      ]);
    }
    if (hasExistingTarget) {
      goToResult();
    } else {
      setStep('target');
    }
  };

  const goToResult = async () => {
    if (user) {
      await Promise.all([
        saveTargetAllocation(user.id, target),
        saveRbProfile(user.id, { monthly_living_cost: livingCostNum || null, emergency_months: emergencyMonths }),
      ]);
    }
    setHasExistingTarget(true);
    setDeviation(calculateDeviation(investableHoldings, target));
    setStep('result');
  };

  const adjustmentItems = adjustMode === 'add'
    ? calculateAddAdjustment(investableHoldings, target, parseInt(monthlyAmount.replace(/[^0-9]/g, '')) || 0)
    : calculateSellAdjustment(investableHoldings, target);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              リバランス計算
            </h1>
            <p className="text-slate-400 text-sm mt-1">ポートフォリオ乖離チェック</p>
          </div>
          <UserStatusBar variant="dark" />
        </div>

        {/* ステップインジケーター */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { key: 'input' as Step, label: '残高入力' },
            { key: 'target' as Step, label: '目標配分' },
            { key: 'result' as Step, label: '乖離・調整' },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-slate-700" />}
              <button
                onClick={() => {
                  if (s.key === 'result' && hasExistingTarget) {
                    setDeviation(calculateDeviation(investableHoldings, target));
                  }
                  setStep(s.key === 'input' ? 'input' : s.key);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                step === s.key || (step === 'import' && s.key === 'input')
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'bg-slate-800 text-slate-500 hover:text-slate-300'
              }`}>
                {s.label}
              </button>
            </div>
          ))}
        </div>

        {/* MFエクセル取り込み */}
        {step === 'import' && (
          <MfImportFlow
            onImportComplete={(imported) => {
              setHoldings(imported);
              setStep('input');
            }}
            onCancel={() => setStep('input')}
          />
        )}

        {/* STEP 1: 残高入力 */}
        {step === 'input' && (
          <>
            {/* 目標配分更新バナー */}
            {showTargetUpdateBanner && (
              <div className="bg-amber-900/30 border border-amber-500/50 rounded-2xl p-4 mb-4">
                <p className="text-sm text-amber-200 mb-2">モデル配分が更新されました。目標配分を再設定してください。</p>
                <button
                  onClick={() => { setShowTargetUpdateBanner(false); setStep('target'); }}
                  className="text-xs text-amber-400 hover:text-amber-300 underline"
                >
                  目標配分を再設定する
                </button>
              </div>
            )}

            {/* MFインポートボタン */}
            <button
              onClick={() => setStep('import')}
              className="w-full py-3 mb-4 bg-slate-800 border border-slate-700 rounded-2xl text-sm text-slate-300 hover:bg-slate-700 flex items-center justify-center gap-2"
            >
              <span>📁</span> MoneyForwardのExcelから取り込む
            </button>

            <div className="bg-slate-900 rounded-2xl p-4 mb-4">
              <h2 className="text-sm text-slate-400 mb-4">アセットクラス別 保有額（円）</h2>
              <div className="space-y-3">
                {ASSET_CLASSES.map(ac => (
                  <div key={ac.key}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-sm">{ac.label}</label>
                        <button
                          onClick={() => setExpandedHint(expandedHint === ac.key ? null : ac.key)}
                          className="text-xs text-slate-500 hover:text-slate-300"
                        >
                          ?
                        </button>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        defaultValue={holdings[ac.key] ? holdings[ac.key].toLocaleString() : ''}
                        key={`${ac.key}-${holdings[ac.key]}`}
                        onBlur={e => handleHoldingChange(ac.key, e.target.value)}
                        placeholder="0"
                        className="w-40 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    {expandedHint === ac.key && (
                      <p className="text-xs text-slate-500 mt-1 ml-1">{ac.hint}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* 緊急資金設定 */}
              <div className="border-t border-slate-700 mt-4 pt-4">
                <h3 className="text-xs text-slate-400 mb-3">緊急資金の設定（リバランス計算から除外）</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm">毎月の生活費（税込）</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={monthlyLivingCost}
                      onChange={e => setMonthlyLivingCost(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="例: 300,000"
                      className="w-40 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">緊急避難枠</label>
                    <select
                      value={emergencyMonths}
                      onChange={e => setEmergencyMonths(Number(e.target.value))}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      <option value={3}>3ヶ月</option>
                      <option value={6}>6ヶ月</option>
                      <option value={12}>12ヶ月</option>
                      <option value={24}>24ヶ月</option>
                    </select>
                  </div>
                  {livingCostNum > 0 && (
                    <div className="bg-slate-800/50 rounded-lg p-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">緊急資金</span>
                        <span className="text-orange-400">{formatCurrency(emergency.emergencyFund)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">投資可能な現金</span>
                        <span className="text-emerald-400 font-medium">{formatCurrency(emergency.investableCash)}</span>
                      </div>
                      {cashAmount < emergency.emergencyFund && (
                        <p className="text-xs text-red-400 mt-1">緊急資金が現金保有額を超えています</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-700 mt-4 pt-4 flex justify-between">
                <span className="text-slate-400">投資可能資産 合計</span>
                <span className="text-lg font-bold text-emerald-400">{formatCurrency(totalAssets)}</span>
              </div>
            </div>

            <button
              onClick={goToTarget}
              disabled={totalAssets === 0}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl font-bold text-lg mb-4 hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {hasExistingTarget ? '乖離を計算' : '目標配分を設定'}
            </button>

            {hasExistingTarget && (
              <button
                onClick={() => setStep('target')}
                className="w-full py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm text-slate-400 hover:bg-slate-700"
              >
                目標配分を編集
              </button>
            )}
          </>
        )}

        {/* STEP 2: 目標配分設定 */}
        {step === 'target' && (
          <>
            <div className="bg-slate-900 rounded-2xl p-4 mb-4">
              <h2 className="text-sm text-slate-400 mb-4">モデル配分プリセット（計算上の参考値）</h2>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[1, 2, 3, 4, 5, 6, 7].map(lv => {
                  const meta = MODEL_META[lv];
                  return (
                    <button
                      key={lv}
                      onClick={() => applyPreset(lv)}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                        selectedPreset === lv
                          ? 'bg-emerald-600 text-white border border-emerald-500'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <div>Lv{lv}</div>
                      <div className="text-xs opacity-70 mt-0.5">{meta.name}</div>
                    </button>
                  );
                })}
              </div>

              {selectedPreset && (
                <div className="bg-slate-800/50 rounded-lg p-3 mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">期待リターン（計算上の目安）</span>
                    <span className="text-emerald-400 font-medium">{MODEL_META[selectedPreset].expectedReturn}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">ボラティリティ</span>
                    <span className="text-orange-400 font-medium">{MODEL_META[selectedPreset].volatility}%</span>
                  </div>
                </div>
              )}

              <AllocationDisclaimer variant="dark" />
            </div>

            <button
              onClick={loadOptimalPF}
              disabled={optimalLoading}
              className="w-full py-3 mb-4 bg-purple-900/30 border border-purple-500/50 rounded-2xl text-sm text-purple-300 hover:bg-purple-900/50 transition-colors disabled:opacity-50"
            >
              {optimalLoading ? '読込中...' : '理論上の最適PFを読み込む'}
            </button>

            <div className="bg-slate-900 rounded-2xl p-4 mb-4">
              <h2 className="text-sm text-slate-400 mb-4">目標比率（%）</h2>
              <div className="space-y-3">
                {ASSET_CLASSES.map(ac => (
                  <div key={ac.key} className="flex items-center justify-between">
                    <label className="text-sm">{ac.label}</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={target[ac.key] || ''}
                        onChange={e => handleTargetChange(ac.key, e.target.value)}
                        className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="text-slate-500 text-sm">%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`border-t border-slate-700 mt-4 pt-4 flex justify-between ${targetValid ? '' : 'text-red-400'}`}>
                <span>合計</span>
                <span className="font-bold">{targetSum.toFixed(1)}%</span>
              </div>
              {!targetValid && (
                <p className="text-xs text-red-400 mt-1 text-right">合計を100%にしてください</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('input')}
                className="flex-1 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm text-slate-400 hover:bg-slate-700"
              >
                戻る
              </button>
              <button
                onClick={goToResult}
                disabled={!targetValid}
                className="flex-[2] py-4 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                乖離を計算
              </button>
            </div>
          </>
        )}

        {/* STEP 3: 乖離表示 + 調整計算 */}
        {step === 'result' && (
          <>
            {/* 乖離サマリー */}
            <div className="bg-slate-900 rounded-2xl p-4 mb-4">
              <h2 className="text-sm text-slate-400 mb-1">総資産</h2>
              <p className="text-2xl font-bold text-emerald-400 mb-4">{formatCurrency(totalAssets)}</p>

              <h2 className="text-sm text-slate-400 mb-3">アセットクラス別 乖離</h2>
              <div className="space-y-2">
                {deviation.map(d => (
                  <div key={d.key} className={`rounded-lg px-4 py-3 ${SEVERITY_BG[d.severity]}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{d.label}</span>
                      <span className="text-sm">{formatCurrency(d.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex gap-3">
                        <span className="text-slate-500">現在 {d.currentRatio.toFixed(1)}%</span>
                        <span className="text-slate-500">目標 {d.targetRatio.toFixed(1)}%</span>
                      </div>
                      <span className={`font-medium ${SEVERITY_COLORS[d.severity]}`}>
                        {d.deviationRatio >= 0 ? '+' : ''}{d.deviationRatio.toFixed(1)}%
                      </span>
                    </div>
                    {/* バー表示 */}
                    <div className="mt-2 flex gap-1 h-2">
                      <div
                        className="bg-emerald-500/60 rounded-sm"
                        style={{ width: `${Math.min(d.currentRatio, 100)}%` }}
                      />
                      <div
                        className="bg-slate-600/40 rounded-sm border border-dashed border-slate-500"
                        style={{ width: `${Math.max(0, d.targetRatio - d.currentRatio)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 調整計算 */}
            <div className="bg-slate-900 rounded-2xl p-4 mb-4">
              <h2 className="text-sm text-slate-400 mb-3">調整計算</h2>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {([
                  { key: 'add' as AdjustmentMode, label: '積立のみ' },
                  { key: 'sell' as AdjustmentMode, label: '売却あり' },
                  { key: 'period' as AdjustmentMode, label: '期間指定' },
                ]).map(m => (
                  <button
                    key={m.key}
                    onClick={() => setAdjustMode(m.key)}
                    className={`py-3 rounded-xl text-sm font-medium transition-all ${
                      adjustMode === m.key
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* 積立のみモード */}
              {adjustMode === 'add' && (
                <>
                  <div className="mb-4">
                    <label className="text-sm text-slate-400 mb-2 block">今月の積立予定額（円）</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={monthlyAmount}
                      onChange={e => setMonthlyAmount(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="例: 500,000"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-lg focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {adjustmentItems.length > 0 && (
                    <AdjustmentList items={adjustmentItems} />
                  )}

                  {monthlyAmount && (() => {
                    const months = estimateMonthsToRebalance(investableHoldings, target, parseInt(monthlyAmount.replace(/[^0-9]/g, '')) || 0);
                    if (months === 0) return <p className="text-xs text-emerald-400 text-center py-3">目標配分に到達しています</p>;
                    if (months != null) return (
                      <div className="bg-slate-800/50 rounded-lg px-4 py-3 mt-3 text-center">
                        <p className="text-sm text-slate-300">
                          このペースで約 <span className="text-emerald-400 font-bold text-lg">{months}</span> ヶ月後にリバランス完了（計算上の目安）
                        </p>
                      </div>
                    );
                    return null;
                  })()}

                  {!monthlyAmount && (
                    <p className="text-xs text-slate-500 text-center py-4">積立予定額を入力すると計算結果を表示します</p>
                  )}
                </>
              )}

              {/* 売却ありモード */}
              {adjustMode === 'sell' && (
                <>
                  {adjustmentItems.length > 0
                    ? <AdjustmentList items={adjustmentItems} />
                    : <p className="text-xs text-slate-500 text-center py-4">調整不要です</p>
                  }
                  {adjustmentItems.some(i => i.amount < 0) && (
                    <div className="mt-4"><SellAccountNote /></div>
                  )}
                </>
              )}

              {/* 期間指定モード */}
              {adjustMode === 'period' && (() => {
                const pMonthly = parseInt(periodMonthlyAmount.replace(/[^0-9]/g, '')) || 0;
                const pMonths = parseInt(periodMonths.replace(/[^0-9]/g, '')) || 0;
                const periodResult = periodLastChanged === 'amount' && pMonthly > 0
                  ? calculatePeriodByAmount(investableHoldings, target, pMonthly)
                  : periodLastChanged === 'months' && pMonths > 0
                    ? calculatePeriodByMonths(investableHoldings, target, pMonths)
                    : null;

                const completionDate = periodResult && periodResult.months > 0
                  ? (() => {
                      const d = new Date();
                      d.setMonth(d.getMonth() + periodResult.months);
                      return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
                    })()
                  : null;

                return (
                  <>
                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">毎月の積立予定額（円）</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={periodMonthlyAmount}
                          onChange={e => {
                            setPeriodMonthlyAmount(e.target.value.replace(/[^0-9]/g, ''));
                            setPeriodLastChanged('amount');
                          }}
                          placeholder="例: 500,000"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-lg focus:border-emerald-500 focus:outline-none"
                        />
                        {periodLastChanged === 'amount' && periodResult && periodResult.months > 0 && (
                          <p className="text-xs text-slate-400 mt-1">→ 完了まで約 {periodResult.months} ヶ月</p>
                        )}
                      </div>
                      <div className="text-center text-slate-600 text-xs">または</div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1 block">完了希望期間（ヶ月）</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={periodMonths}
                          onChange={e => {
                            setPeriodMonths(e.target.value.replace(/[^0-9]/g, ''));
                            setPeriodLastChanged('months');
                          }}
                          placeholder="例: 12"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-lg focus:border-emerald-500 focus:outline-none"
                        />
                        {periodLastChanged === 'months' && periodResult && periodResult.months > 0 && (
                          <div className="mt-2 space-y-1">
                            {periodResult.monthlyAmount > 0
                              ? <p className="text-xs text-slate-300">→ 毎月 {formatThousands(periodResult.monthlyAmount)} の追加積立が必要です</p>
                              : <p className="text-xs text-emerald-400">→ 売却資金と現金の取り崩しでリバランス完了できます（追加積立不要）</p>
                            }
                            <div className="text-xs text-slate-500 space-y-0.5 pl-2">
                              <p>毎月の操作合計：{formatThousands(periodResult.monthlyTotal)}</p>
                              {periodResult.monthlySellContribution > 0 && (
                                <p>  売却資金の充当：{formatThousands(periodResult.monthlySellContribution)}</p>
                              )}
                              {periodResult.monthlyCashContribution > 0 && (
                                <p>  現金の取り崩し：{formatThousands(periodResult.monthlyCashContribution)}</p>
                              )}
                              <p>  追加積立：{periodResult.monthlyAmount > 0 ? formatThousands(periodResult.monthlyAmount) : '不要'}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {periodResult && periodResult.months === 0 && (
                      <p className="text-xs text-emerald-400 text-center py-3">目標配分に到達しています</p>
                    )}

                    {periodResult && periodResult.months > 0 && (() => {
                      const snapshots = simulateMonthly(investableHoldings, target, periodResult);
                      const month1 = snapshots[0];
                      const sellOps: AdjustmentItem[] = month1.operations
                        .filter(o => o.operationAmount < 0)
                        .sort((a, b) => a.operationAmount - b.operationAmount)
                        .map(o => ({ key: o.key, label: o.label, amount: o.operationAmount }));
                      const buyOps: AdjustmentItem[] = month1.operations
                        .filter(o => o.operationAmount > 0)
                        .sort((a, b) => b.operationAmount - a.operationAmount)
                        .map(o => ({ key: o.key, label: o.label, amount: o.operationAmount }));

                      return (
                        <div className="space-y-4">
                          <h4 className="text-sm text-slate-300 font-medium">今月の操作（計算上の目安）</h4>

                          {sellOps.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-xs text-red-400 mb-2">売却（毎月・分散）</p>
                              <AdjustmentList items={sellOps} />
                              <SellAccountNote />
                            </div>
                          )}

                          {buyOps.length > 0 && (
                            <div>
                              <p className="text-xs text-emerald-400 mb-2">積立（毎月）</p>
                              <AdjustmentList items={buyOps} />
                            </div>
                          )}

                          <div className="bg-slate-800/50 rounded-lg px-4 py-3 text-center">
                            <p className="text-sm text-slate-300">
                              完了予定：<span className="text-emerald-400 font-bold">{periodResult.months}ヶ月後</span>
                              {completionDate && <span className="text-slate-500">（{completionDate}）</span>}
                            </p>
                          </div>

                          {periodResult.months > 3 && (
                            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg px-4 py-3">
                              <p className="text-sm text-blue-300 mb-1">📊 月次投資アドバイザーについて</p>
                              <p className="text-xs text-blue-400/70">リバランス期間中は /rb の計画を優先してください。完了後、/ma の月次最適化が有効になります。</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {periodResult && periodResult.months > 0 && (
                      <MonthlyProjection
                        holdings={investableHoldings}
                        target={target}
                        periodResult={periodResult}
                      />
                    )}

                    {!periodResult && (
                      <p className="text-xs text-slate-500 text-center py-4">積立額または完了期間を入力すると計算結果を表示します</p>
                    )}
                  </>
                );
              })()}
            </div>

            {/* ナビゲーション */}
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setStep('input')}
                className="flex-1 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm text-slate-400 hover:bg-slate-700"
              >
                残高を修正
              </button>
              <button
                onClick={() => setStep('target')}
                className="flex-1 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm text-slate-400 hover:bg-slate-700"
              >
                目標配分を編集
              </button>
            </div>

            <div className="mb-4">
              <AllocationDisclaimer variant="dark" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
