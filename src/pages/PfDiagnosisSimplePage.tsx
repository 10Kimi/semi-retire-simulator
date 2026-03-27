import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { ASSET_CLASSES } from '../logic/portfolioAllocation';
import { RISK_LEVEL_DEFS, getRiskLevelDef } from '../logic/riskSimpleScoring';
import {
  calculatePfDiagnosis,
  analyzePfGap,
  type PfHoldings,
  type PfDiagnosisResult,
  type PfGapResult,
} from '../logic/pfSimple';
import { loadAssetClassParams, buildMarketDataFromParams } from '../lib/assetClassParamsDb';
import { loadLatestRiskSimple } from '../lib/riskSimpleDb';
import { useAuth } from '../contexts/AuthContext';

type Phase = 'input' | 'result';

// 資産クラスをカテゴリで分類
const CATEGORIES = [
  { label: '株式', keys: ['japan_equity', 'us_equity', 'developed_equity', 'emerging_equity'] },
  { label: '債券', keys: ['japan_bond', 'developed_bond', 'emerging_bond'] },
  { label: 'REIT', keys: ['japan_reit', 'developed_reit'] },
  { label: 'その他', keys: ['gold', 'cash'] },
];

export default function PfDiagnosisSimplePage() {
  const { user } = useAuth();

  const [holdings, setHoldings] = useState<PfHoldings>(() => {
    const init: PfHoldings = {};
    for (const ac of ASSET_CLASSES) init[ac.key] = 0;
    return init;
  });
  const [phase, setPhase] = useState<Phase>('input');
  const [diagResult, setDiagResult] = useState<PfDiagnosisResult | null>(null);
  const [gapResult, setGapResult] = useState<PfGapResult | null>(null);
  const [assessmentLevel, setAssessmentLevel] = useState<number | null>(null);
  const [marketData, setMarketData] = useState<{
    assetReturns: Record<string, number>;
    assetRisks: Record<string, number>;
    correlationMatrix: Record<string, Record<string, number>>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMonthlyNotice, setShowMonthlyNotice] = useState(false);

  // 初期読み込み: リスク診断スコア + 市場データ
  useEffect(() => {
    async function init() {
      // リスク診断スコアを読み込み
      if (user) {
        const latest = await loadLatestRiskSimple(user.id);
        if (latest) {
          setAssessmentLevel(latest.final_level);
        }
      }

      // 市場データを読み込み
      const params = await loadAssetClassParams();
      if (params && params.length > 0) {
        setMarketData(buildMarketDataFromParams(params));
      }

      setLoading(false);
    }
    init();
  }, [user]);

  const handleInputChange = useCallback((key: string, value: string) => {
    const num = value === '' ? 0 : parseFloat(value);
    if (isNaN(num) || num < 0) return;
    setHoldings(prev => ({ ...prev, [key]: num }));
  }, []);

  const totalAmount = ASSET_CLASSES.reduce((sum, ac) => sum + (holdings[ac.key] ?? 0), 0);

  const handleCalculate = useCallback(() => {
    const result = calculatePfDiagnosis(
      holdings,
      marketData?.assetReturns,
      marketData?.assetRisks,
      marketData?.correlationMatrix,
    );
    setDiagResult(result);

    if (assessmentLevel !== null) {
      setGapResult(analyzePfGap(result.riskLevel, assessmentLevel));
    }

    setPhase('result');
  }, [holdings, marketData, assessmentLevel]);

  const handleRetry = useCallback(() => {
    setPhase('input');
    setDiagResult(null);
    setGapResult(null);
  }, []);

  if (loading) {
    return (
      <Layout>
        <main className="max-w-2xl mx-auto px-4 py-10 text-center">
          <p className="text-sm text-gray-500">データを読み込み中...</p>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="max-w-2xl mx-auto px-4 py-6 md:py-10">
        {phase === 'input' && (
          <div className="animate-fade-in">
            <div className="text-center mb-6">
              <h1 className="text-lg md:text-xl font-bold text-gray-800 mb-1">
                ポートフォリオ診断
              </h1>
              <p className="text-xs text-gray-500">
                現在の保有資産を入力して、ポートフォリオのリスクレベルを診断します
              </p>
            </div>

            {/* リスク診断スコア表示 */}
            {assessmentLevel !== null && (
              <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-xs text-blue-600 mb-1">あなたのリスク許容度（簡易診断結果）</p>
                <p className="text-sm font-bold text-blue-800">
                  レベル {assessmentLevel} — {getRiskLevelDef(assessmentLevel).name}
                </p>
              </div>
            )}
            {assessmentLevel === null && (
              <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-500">
                  リスク診断がまだ完了していません。先に
                  <a href="/risk" className="text-blue-600 hover:text-blue-800 font-medium"> リスク診断 </a>
                  を行うと、ギャップ分析が表示されます。
                </p>
              </div>
            )}

            {/* 資産入力フォーム */}
            <div className="space-y-6">
              {CATEGORIES.map(cat => (
                <div key={cat.label}>
                  <h3 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-1">
                    {cat.label}
                  </h3>
                  <div className="space-y-2">
                    {cat.keys.map(key => {
                      const ac = ASSET_CLASSES.find(a => a.key === key);
                      if (!ac) return null;
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <label className="text-xs text-gray-600 w-44 shrink-0">
                            {ac.label}
                          </label>
                          <div className="flex-1 flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={holdings[key] || ''}
                              onChange={e => handleInputChange(key, e.target.value)}
                              placeholder="0"
                              className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-right min-h-[44px]"
                            />
                            <span className="text-xs text-gray-400 shrink-0">万円</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 合計 + 計算ボタン */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-bold text-gray-700">合計</span>
                <span className="text-lg font-bold text-gray-800">
                  {totalAmount.toLocaleString()} 万円
                </span>
              </div>
              <button
                onClick={handleCalculate}
                disabled={totalAmount === 0}
                className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
              >
                診断する
              </button>
            </div>
          </div>
        )}

        {phase === 'result' && diagResult && (
          <div className="animate-fade-in space-y-6">
            {/* メインレベル表示 */}
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">あなたのポートフォリオ</p>
              <div className={`inline-flex items-center gap-3 px-6 py-4 rounded-xl ${diagResult.riskLevelDef.color}`}>
                <span className={`text-3xl font-bold ${diagResult.riskLevelDef.textColor}`}>
                  レベル {diagResult.riskLevel}
                </span>
                <span className={`text-lg font-semibold ${diagResult.riskLevelDef.textColor}`}>
                  {diagResult.riskLevelDef.name}
                </span>
              </div>
            </div>

            {/* 計算結果 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">計算結果</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">期待リターン</p>
                  <p className="text-xl font-bold text-gray-800">{diagResult.expectedReturn}%</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">ボラティリティ</p>
                  <p className="text-xl font-bold text-gray-800">{diagResult.volatility}%</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">合計資産</p>
                  <p className="text-xl font-bold text-gray-800">{diagResult.totalAmount.toLocaleString()}<span className="text-sm">万円</span></p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">リスクレベル</p>
                  <p className="text-xl font-bold text-gray-800">{diagResult.riskLevel} / 7</p>
                </div>
              </div>
            </div>

            {/* ギャップ分析 */}
            {gapResult && (
              <div className={`rounded-xl border p-5 ${
                gapResult.gapType === 'match'
                  ? 'bg-green-50 border-green-200'
                  : gapResult.gapType === 'pf_higher'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
              }`}>
                <h3 className="text-sm font-bold text-gray-800 mb-3">
                  リスク許容度とのギャップ
                </h3>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 text-center">
                    <p className="text-xs text-gray-500 mb-1">ポートフォリオ</p>
                    <p className="text-lg font-bold text-gray-800">レベル {gapResult.pfLevel}</p>
                    <p className="text-xs text-gray-400">{getRiskLevelDef(gapResult.pfLevel).name}</p>
                  </div>
                  <div className="flex items-center text-gray-300 text-lg">vs</div>
                  <div className="flex-1 text-center">
                    <p className="text-xs text-gray-500 mb-1">リスク許容度</p>
                    <p className="text-lg font-bold text-gray-800">レベル {gapResult.assessmentLevel}</p>
                    <p className="text-xs text-gray-400">{getRiskLevelDef(gapResult.assessmentLevel).name}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{gapResult.message}</p>
              </div>
            )}

            {/* 7段階レベル一覧 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">リスクレベル一覧</h3>
              <div className="space-y-1.5">
                {RISK_LEVEL_DEFS.map(def => {
                  const isPf = def.level === diagResult.riskLevel;
                  const isAssessment = def.level === assessmentLevel;
                  return (
                    <div
                      key={def.level}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${
                        isPf ? `${def.color} ${def.textColor} font-semibold` : 'text-gray-500'
                      }`}
                    >
                      <span className="w-5 text-center font-mono">{def.level}</span>
                      <span className="w-20">{def.name}</span>
                      <span className="text-gray-400">{def.volatility}</span>
                      <span className="ml-auto flex gap-2">
                        {isPf && <span className="text-xs font-bold">PF</span>}
                        {isAssessment && <span className="text-xs font-bold text-blue-600">許容度</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 月次最適化導線 */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-5 text-center">
              <h3 className="text-sm font-bold text-blue-800 mb-2">
                月次最適化ツールで精度高く管理する
              </h3>
              <p className="text-xs text-blue-600 mb-4">
                CAPE・PBR・モメンタムを加味した毎月の積立配分の最適化ツールです。
              </p>
              <button
                onClick={() => setShowMonthlyNotice(true)}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
              >
                月次最適化ツールを試す
              </button>
              {showMonthlyNotice && (
                <p className="mt-3 text-xs text-blue-700 bg-blue-100 rounded-lg px-4 py-2">
                  月次最適化ツールは近日公開予定です。公開時にメールでお知らせします。
                </p>
              )}
            </div>

            {/* 免責 */}
            <p className="text-xs text-gray-400 text-center">
              ※ 本結果は過去の市場データに基づく計算結果であり、将来のリターンを保証するものではありません。
            </p>

            {/* やり直し */}
            <div className="text-center">
              <button
                onClick={handleRetry}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                入力をやり直す
              </button>
            </div>
          </div>
        )}
      </main>
    </Layout>
  );
}
