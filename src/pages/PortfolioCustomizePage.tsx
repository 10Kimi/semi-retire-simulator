import { useState, useCallback, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useIsPremium } from '../hooks/useIsPremium';
import InviteCodeModal from '../components/InviteCodeModal';
import AllocationDisclaimer from '../components/AllocationDisclaimer';
import { ASSET_CLASSES, MODEL_ALLOCATIONS, MODEL_META } from '../lib/rb/types';
import { FALLBACK_ASSET_RETURNS, FALLBACK_ASSET_RISKS, FALLBACK_CORRELATION_MATRIX } from '../logic/portfolioDiagnosis';
import { classifyRiskLevel7 } from '../logic/pfSimple';
import { getRiskLevelDef } from '../logic/riskSimpleScoring';
import { loadLatestRiskSimple } from '../lib/riskSimpleDb';

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
  const { isPremium, loading: premiumLoading, refresh } = useIsPremium();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userLevel, setUserLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    loadLatestRiskSimple(user.id).then(data => {
      if (data?.final_level) setUserLevel(data.final_level);
    });
  }, [user]);

  const baseLevel = userLevel ?? 4;

  // 配分state（各スライダーは独立）
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);

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

  const availableToAdd = ASSET_CLASSES.filter(ac => !activeKeys.includes(ac.key));
  const volLimit = VOL_UPPER[baseLevel] ?? 100;

  if (premiumLoading) {
    return (
      <Layout>
        <main className="max-w-lg mx-auto px-4 py-20 text-center">
          <p className="text-sm text-gray-500">読み込み中...</p>
        </main>
      </Layout>
    );
  }

  if (!isPremium) {
    return (
      <Layout>
        <main className="max-w-lg mx-auto px-4 py-10">
          <div className="text-center space-y-6">
            <h1 className="text-xl font-bold text-gray-800">ポートフォリオ カスタマイズ</h1>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-8">
              <div className="text-4xl mb-4">🔒</div>
              <p className="text-sm text-gray-700 mb-2">この機能は有料プランでご利用いただけます</p>
              <p className="text-xs text-gray-500 mb-6">アセット配分をカスタマイズし、リスク・リターンをシミュレーションできます</p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
              >
                招待コードをお持ちの方はこちら
              </button>
            </div>
          </div>
          {showInviteModal && (
            <InviteCodeModal
              onSuccess={() => { setShowInviteModal(false); refresh(); }}
              onClose={() => setShowInviteModal(false)}
            />
          )}
        </main>
      </Layout>
    );
  }

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
            <h3 className="text-sm font-bold text-gray-800 mb-4">アセット配分（%）</h3>
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

          <AllocationDisclaimer variant="light" />

          <p className="text-xs text-gray-400 text-center">
            この配分は計算上の参考値です。投資判断はご自身でご確認ください。
          </p>
        </div>
      </main>
    </Layout>
  );
}
