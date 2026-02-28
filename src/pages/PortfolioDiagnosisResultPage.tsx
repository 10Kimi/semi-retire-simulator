import { useLocation, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import AllocationChart from '../components/assessment/AllocationChart';
import { getRiskLevelByKey } from '../logic/riskLevels';
import type { DiagnosisNavigationState } from '../types/portfolioDiagnosis';

export default function PortfolioDiagnosisResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as DiagnosisNavigationState | null;

  // state が無い場合（直接アクセス・ブラウザリロード）は入力ページへ
  if (!state) {
    navigate('/portfolio-diagnosis', { replace: true });
    return null;
  }

  const { diagnosisResult, gapAnalysis, improvements, assessedPortfolioAllocations } = state;
  const riskInfo = getRiskLevelByKey(diagnosisResult.riskLevelKey);

  return (
    <Layout>
      <main className="max-w-3xl mx-auto px-3 py-4 md:px-4 md:py-6 space-y-5">
        {/* タイトル */}
        <h2 className="text-lg font-bold text-gray-800 text-center">ポートフォリオ診断結果</h2>

        {/* 1. メトリクスカード（3つ横並び） */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <div className="text-xs text-gray-500">期待リターン</div>
            <div className="text-xl font-bold text-gray-800 mt-1">{diagnosisResult.expectedReturn}%</div>
            <div className="text-xs text-gray-400">年率</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <div className="text-xs text-gray-500">ボラティリティ</div>
            <div className="text-xl font-bold text-gray-800 mt-1">{diagnosisResult.volatility}%</div>
            <div className="text-xs text-gray-400">年率</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <div className="text-xs text-gray-500">リスクレベル</div>
            <div className="text-xl font-bold text-gray-800 mt-1">{diagnosisResult.riskLevelNumber}</div>
            <div className={`text-xs font-medium mt-0.5 inline-block px-2 py-0.5 rounded ${riskInfo.color} ${riskInfo.textColor}`}>
              {riskInfo.label}
            </div>
          </div>
        </div>

        {/* 2. ギャップバナー */}
        <GapBanner gapAnalysis={gapAnalysis} />

        {/* 3. 現在の資産配分 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-base font-bold text-gray-800 mb-4">
            {gapAnalysis.hasAssessment && assessedPortfolioAllocations
              ? '現在のポートフォリオ vs 推奨ポートフォリオ'
              : '現在の資産配分'}
          </h3>

          {gapAnalysis.hasAssessment && assessedPortfolioAllocations ? (
            // 診断済み: 並べたドーナツチャート
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-600 text-center mb-2">現在のPF</div>
                <AllocationChart allocations={diagnosisResult.allocations} />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600 text-center mb-2">推奨PF</div>
                <AllocationChart allocations={assessedPortfolioAllocations} />
              </div>
            </div>
          ) : (
            // 未診断: 単一チャート
            <AllocationChart allocations={diagnosisResult.allocations} />
          )}

          {/* 配分テーブル */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-600 font-medium">資産クラス</th>
                  <th className="text-right py-2 text-gray-600 font-medium">配分比率</th>
                  <th className="text-right py-2 text-gray-600 font-medium">保有額</th>
                </tr>
              </thead>
              <tbody>
                {diagnosisResult.allocations
                  .filter((a) => a.percentage > 0)
                  .map((a) => (
                    <tr key={a.key} className="border-b border-gray-100">
                      <td className="py-2 text-gray-700">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: a.color }}
                          />
                          {a.label}
                        </div>
                      </td>
                      <td className="py-2 text-right text-gray-800 font-medium">{a.percentage}%</td>
                      <td className="py-2 text-right text-gray-600">
                        {(diagnosisResult.holdingAmounts[a.key] ?? 0).toLocaleString()} 万円
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. 比較テーブル（診断済みユーザーのみ） */}
        {gapAnalysis.hasAssessment && assessedPortfolioAllocations && improvements.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-base font-bold text-gray-800 mb-4">改善提案</h3>
            <p className="text-sm text-gray-600 mb-3">
              推奨ポートフォリオに近づけるための調整（総資産: {diagnosisResult.totalAmount.toLocaleString()} 万円）
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-gray-600 font-medium">資産クラス</th>
                    <th className="text-right py-2 text-gray-600 font-medium">現在</th>
                    <th className="text-right py-2 text-gray-600 font-medium">推奨</th>
                    <th className="text-right py-2 text-gray-600 font-medium">調整額</th>
                  </tr>
                </thead>
                <tbody>
                  {improvements.map((item) => {
                    const isLargeGap = Math.abs(item.targetPercent - item.currentPercent) >= 10;
                    const isBuy = item.differenceAmount > 0;
                    return (
                      <tr
                        key={item.assetKey}
                        className={`border-b border-gray-100 ${isLargeGap ? 'bg-yellow-50' : ''}`}
                      >
                        <td className="py-2 text-gray-700">{item.assetLabel}</td>
                        <td className="py-2 text-right text-gray-600">{item.currentPercent}%</td>
                        <td className="py-2 text-right text-gray-600">{item.targetPercent}%</td>
                        <td className={`py-2 text-right font-medium ${isBuy ? 'text-green-600' : 'text-red-600'}`}>
                          {isBuy ? '+' : ''}{item.differenceAmount.toLocaleString()} 万円
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 売却・購入のサマリー */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs text-red-600 font-medium">売却推奨</div>
                <div className="text-sm text-red-800 mt-1">
                  {improvements
                    .filter((i) => i.differenceAmount < 0)
                    .map((i) => `${i.assetLabel} ${Math.abs(i.differenceAmount).toLocaleString()}万円`)
                    .join('、') || 'なし'}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs text-green-600 font-medium">購入推奨</div>
                <div className="text-sm text-green-800 mt-1">
                  {improvements
                    .filter((i) => i.differenceAmount > 0)
                    .map((i) => `${i.assetLabel} ${i.differenceAmount.toLocaleString()}万円`)
                    .join('、') || 'なし'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. 未診断ユーザーへの誘導 */}
        {!gapAnalysis.hasAssessment && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
            <p className="text-sm text-blue-800 font-medium">
              リスク許容度診断を完了すると、あなたのPFが適切かどうかを判定できます。
            </p>
            <Link
              to="/assessment"
              className="inline-block mt-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-5 py-2 transition-colors"
            >
              リスク許容度診断を受ける
            </Link>
          </div>
        )}

        {/* 6. 戻るリンク */}
        <div className="text-center">
          <Link
            to="/portfolio-diagnosis"
            className="text-sm text-blue-600 hover:text-blue-800 underline py-2 inline-block"
          >
            入力画面に戻る
          </Link>
        </div>

        {/* 注意事項 */}
        <div className="text-xs text-gray-400 text-center pb-6">
          ※ 本診断結果は参考情報です。投資判断はご自身の責任で行ってください。
        </div>
      </main>
    </Layout>
  );
}

// ── ギャップバナーコンポーネント ──

function GapBanner({ gapAnalysis }: { gapAnalysis: DiagnosisNavigationState['gapAnalysis'] }) {
  if (!gapAnalysis.hasAssessment) {
    return null; // 未診断の場合はバナーなし（別途誘導UIで対応）
  }

  if (gapAnalysis.gapDirection === 'match') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <p className="text-sm text-green-800 font-medium">
          あなたのポートフォリオはリスク許容度と一致しています。
        </p>
        <p className="text-xs text-green-600 mt-1">
          リスクレベル {gapAnalysis.portfolioRiskLevelNumber}（{gapAnalysis.portfolioRiskLevelLabel}）
        </p>
      </div>
    );
  }

  if (gapAnalysis.gapDirection === 'over') {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
        <p className="text-sm text-orange-800 font-medium">{gapAnalysis.message}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-orange-700">
          <span>現在のPF: レベル{gapAnalysis.portfolioRiskLevelNumber}（{gapAnalysis.portfolioRiskLevelLabel}）</span>
          <span>→</span>
          <span>リスク許容度: レベル{gapAnalysis.assessedRiskLevelNumber}（{gapAnalysis.assessedRiskLevelLabel}）</span>
        </div>
      </div>
    );
  }

  // under
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
      <p className="text-sm text-blue-800 font-medium">{gapAnalysis.message}</p>
      <div className="flex items-center gap-4 mt-2 text-xs text-blue-700">
        <span>現在のPF: レベル{gapAnalysis.portfolioRiskLevelNumber}（{gapAnalysis.portfolioRiskLevelLabel}）</span>
        <span>→</span>
        <span>リスク許容度: レベル{gapAnalysis.assessedRiskLevelNumber}（{gapAnalysis.assessedRiskLevelLabel}）</span>
      </div>
    </div>
  );
}
