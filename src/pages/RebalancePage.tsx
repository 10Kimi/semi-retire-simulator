import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserStatusBar from '../components/UserStatusBar';
import { ASSET_CLASSES, MODEL_ALLOCATIONS } from '../lib/rb/types';
import type { Holdings, TargetAllocation, DeviationItem, AdjustmentMode } from '../lib/rb/types';
import { calculateDeviation, calculateAddAdjustment, calculateSellAdjustment, getTotalAssets, formatCurrency } from '../lib/rb/logic';
import { fetchTargetAllocation, saveTargetAllocation, fetchLatestSnapshot, saveSnapshot } from '../lib/rb/db';

type Step = 'input' | 'target' | 'result';

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
  const [expandedHint, setExpandedHint] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) { setLoading(false); return; }

      const [savedTarget, snapshot] = await Promise.all([
        fetchTargetAllocation(user.id),
        fetchLatestSnapshot(user.id),
      ]);

      if (savedTarget) {
        setTarget(savedTarget);
        setHasExistingTarget(true);
      }
      if (snapshot) {
        setHoldings(snapshot.holdings);
      }
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

  const totalAssets = getTotalAssets(holdings);

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

  const applyPreset = (riskLevel: number) => {
    const preset = MODEL_ALLOCATIONS[riskLevel];
    if (preset) setTarget({ ...preset });
  };

  const goToTarget = async () => {
    // スナップショット保存
    if (user) await saveSnapshot(user.id, holdings);
    if (hasExistingTarget) {
      // 既に目標配分設定済み → 結果へ直接
      goToResult();
    } else {
      setStep('target');
    }
  };

  const goToResult = async () => {
    if (user) await saveTargetAllocation(user.id, target);
    setHasExistingTarget(true);
    setDeviation(calculateDeviation(holdings, target));
    setStep('result');
  };

  const adjustmentItems = adjustMode === 'add'
    ? calculateAddAdjustment(holdings, target, parseInt(monthlyAmount.replace(/[^0-9]/g, '')) || 0)
    : calculateSellAdjustment(holdings, target);

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
            { key: 'input', label: '残高入力' },
            { key: 'target', label: '目標配分' },
            { key: 'result', label: '乖離・調整' },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-slate-700" />}
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                step === s.key
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'bg-slate-800 text-slate-500'
              }`}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* STEP 1: 残高入力 */}
        {step === 'input' && (
          <>
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

              <div className="border-t border-slate-700 mt-4 pt-4 flex justify-between">
                <span className="text-slate-400">合計</span>
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
              <div className="grid grid-cols-5 gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(lv => (
                  <button
                    key={lv}
                    onClick={() => applyPreset(lv)}
                    className="py-2 rounded-xl text-sm font-medium bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition-colors"
                  >
                    <div>Lv{lv}</div>
                    <div className="text-xs opacity-70 mt-0.5">
                      {lv === 1 ? '保守' : lv === 2 ? 'やや保守' : lv === 3 ? '中立' : lv === 4 ? 'やや積極' : '積極'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

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

              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setAdjustMode('add')}
                  className={`py-3 rounded-xl text-sm font-medium transition-all ${
                    adjustMode === 'add'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  積立追加モード
                </button>
                <button
                  onClick={() => setAdjustMode('sell')}
                  className={`py-3 rounded-xl text-sm font-medium transition-all ${
                    adjustMode === 'sell'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  売却ありモード
                </button>
              </div>

              {adjustMode === 'add' && (
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
              )}

              {adjustmentItems.length > 0 && (
                <div className="space-y-2">
                  {adjustmentItems.map(item => (
                    <div key={item.key} className="bg-slate-800 rounded-lg px-4 py-3 flex justify-between items-center">
                      <span className="text-sm">{item.label}</span>
                      <span className={`text-sm font-medium ${item.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {item.amount > 0 ? `${formatCurrency(item.amount)} 追加` : `${formatCurrency(item.amount)} 売却`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {adjustMode === 'add' && !monthlyAmount && (
                <p className="text-xs text-slate-500 text-center py-4">積立予定額を入力すると計算結果を表示します</p>
              )}

              {adjustMode === 'sell' && adjustmentItems.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">調整不要です</p>
              )}
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

            <div className="text-center py-4 text-slate-500 text-xs">
              ※ 本ツールの出力は計算結果の表示であり、投資の目安としてご利用ください
            </div>
          </>
        )}
      </div>
    </div>
  );
}
