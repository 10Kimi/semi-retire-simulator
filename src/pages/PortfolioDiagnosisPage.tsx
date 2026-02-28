import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { ASSET_CLASSES } from '../logic/portfolioAllocation';
import { fetchPortfolioForRiskLevel } from '../logic/portfolioAllocation';
import {
  buildDiagnosisResult,
  analyzeGap,
  calculateImprovements,
  FALLBACK_ASSET_RETURNS,
  FALLBACK_ASSET_RISKS,
  FALLBACK_CORRELATION_MATRIX,
} from '../logic/portfolioDiagnosis';
import { loadMarketDataForDiagnosis, loadLatestAssessment } from '../lib/assessmentDb';
import type { RiskLevel, AssetAllocation } from '../types/assessment';
import type { HoldingAmounts, DiagnosisNavigationState } from '../types/portfolioDiagnosis';

// 初期値: 全資産クラス0万円
function createEmptyHoldings(): HoldingAmounts {
  const h: HoldingAmounts = {};
  for (const ac of ASSET_CLASSES) h[ac.key] = 0;
  return h;
}

export default function PortfolioDiagnosisPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [holdings, setHoldings] = useState<HoldingAmounts>(createEmptyHoldings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 合計金額をリアルタイム計算
  const totalAmount = useMemo(
    () => ASSET_CLASSES.reduce((sum, ac) => sum + (holdings[ac.key] ?? 0), 0),
    [holdings],
  );

  // 各資産クラスの配分%をリアルタイム計算
  const percentages = useMemo(() => {
    const pct: Record<string, number> = {};
    for (const ac of ASSET_CLASSES) {
      pct[ac.key] = totalAmount > 0
        ? Math.round(((holdings[ac.key] ?? 0) / totalAmount) * 1000) / 10
        : 0;
    }
    return pct;
  }, [holdings, totalAmount]);

  // 金額入力ハンドラ
  const handleAmountChange = (key: string, value: string) => {
    const num = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    setHoldings((prev) => ({ ...prev, [key]: num }));
  };

  // 診断実行
  const handleDiagnose = async () => {
    if (totalAmount === 0) {
      setError('少なくとも1つの資産クラスに金額を入力してください。');
      return;
    }
    if (!user) return;

    setError(null);
    setLoading(true);

    try {
      // 1. market_data を取得（フォールバックあり）
      const marketData = await loadMarketDataForDiagnosis();
      const assetReturns = marketData?.assetReturns ?? FALLBACK_ASSET_RETURNS;
      const assetRisks = marketData?.assetRisks ?? FALLBACK_ASSET_RISKS;
      const correlationMatrix = marketData?.correlationMatrix ?? FALLBACK_CORRELATION_MATRIX;

      // 2. PF統計を計算
      const diagnosisResult = buildDiagnosisResult(holdings, assetReturns, assetRisks, correlationMatrix);

      // 3. 既存のリスク診断結果を取得
      const assessment = await loadLatestAssessment(user.id);
      const assessedRiskLevelKey = assessment?.risk_level as RiskLevel | undefined;

      // 4. ギャップ分析
      const gapAnalysis = analyzeGap(diagnosisResult, assessedRiskLevelKey ?? null);

      // 5. 改善提案の算出（診断済みの場合のみ）
      let improvements: DiagnosisNavigationState['improvements'] = [];
      let assessedPortfolioAllocations: AssetAllocation[] | null = null;

      if (assessedRiskLevelKey) {
        const recommendedPF = await fetchPortfolioForRiskLevel(assessedRiskLevelKey);
        const recMap: Record<string, number> = {};
        for (const a of recommendedPF.allocations) {
          recMap[a.key] = a.percentage;
        }
        improvements = calculateImprovements(holdings, diagnosisResult.totalAmount, recMap);
        assessedPortfolioAllocations = recommendedPF.allocations;
      }

      // 6. 結果ページへ遷移
      const navState: DiagnosisNavigationState = {
        diagnosisResult,
        gapAnalysis,
        improvements,
        assessedPortfolioAllocations,
      };
      navigate('/portfolio-diagnosis/result', { state: navState });
    } catch (e) {
      console.error('Diagnosis failed:', e);
      setError('診断中にエラーが発生しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <main className="max-w-3xl mx-auto px-3 py-4 md:px-4 md:py-6 space-y-4">
        {/* ヘッダー */}
        <div>
          <h2 className="text-lg font-bold text-gray-800">ポートフォリオ診断</h2>
          <p className="text-sm text-gray-500 mt-1">
            現在保有中の資産配分を入力して、リスク量を診断します。
          </p>
        </div>

        {/* 入力フォーム */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-3">資産クラス別 保有金額</h3>

          <div className="space-y-2">
            {ASSET_CLASSES.map((ac) => {
              const val = holdings[ac.key] ?? 0;
              const pct = percentages[ac.key] ?? 0;
              const isZero = val === 0;

              return (
                <div
                  key={ac.key}
                  className={`flex items-center gap-2 md:gap-3 py-1.5 ${isZero ? 'opacity-50' : ''}`}
                >
                  {/* 色スウォッチ + ラベル */}
                  <div className="flex items-center gap-2 w-48 md:w-56 shrink-0">
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: ac.color }}
                    />
                    <span className="text-sm text-gray-700 truncate">{ac.label}</span>
                  </div>

                  {/* 金額入力 */}
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={val === 0 ? '' : val}
                      placeholder="0"
                      onChange={(e) => handleAmountChange(ac.key, e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <span className="text-xs text-gray-500 shrink-0">万円</span>
                  </div>

                  {/* 配分% */}
                  <div className="w-14 text-right shrink-0">
                    <span className={`text-xs ${isZero ? 'text-gray-400' : 'text-gray-600 font-medium'}`}>
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 合計表示 */}
          <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">合計</span>
            <span className="text-lg font-bold text-gray-900">
              {totalAmount.toLocaleString()} 万円
            </span>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 診断ボタン */}
        <button
          onClick={handleDiagnose}
          disabled={loading || totalAmount === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg py-3 text-sm transition-colors"
        >
          {loading ? '計算中...' : '診断する'}
        </button>

        {/* 注意事項 */}
        <p className="text-xs text-gray-400 text-center">
          ※ 金額は概算で構いません。期待リターン・リスクはGPIFの前提値をベースに算出しています。
        </p>
      </main>
    </Layout>
  );
}
