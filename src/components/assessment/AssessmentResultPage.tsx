import { useEffect, useState } from 'react';
import { useAssessment } from '../../contexts/AssessmentContext';
import { fetchAllPortfolioPresets } from '../../logic/portfolioAllocation';
import type { RiskLevel, PortfolioPreset, MarketDataInfo } from '../../types/assessment';
import ResultSummary from './ResultSummary';
import AllocationChart from './AllocationChart';
import AllocationTable from './AllocationTable';
import SimulatorLink from './SimulatorLink';
import ScoreComparisonTable from './ScoreComparisonTable';
import CapacityDetail from './CapacityDetail';
import ToleranceDetail from './ToleranceDetail';

export default function AssessmentResultPage() {
  const { state, reset } = useAssessment();
  const { result } = state;
  const [allPresets, setAllPresets] = useState<Record<RiskLevel, PortfolioPreset> | null>(null);
  const [dataInfo, setDataInfo] = useState<MarketDataInfo | null>(null);

  useEffect(() => {
    fetchAllPortfolioPresets().then(({ presets, dataInfo: info }) => {
      setAllPresets(presets);
      setDataInfo(info);
    });
  }, []);

  if (!result) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 6.1 Main Result */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4 text-center">診断結果</h2>
        <ResultSummary result={result} />
      </div>

      {/* 6.2 Portfolio Allocation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">推奨ポートフォリオ配分</h2>
        <AllocationChart allocations={result.portfolio.allocations} />
        <div className="mt-4">
          <AllocationTable portfolio={result.portfolio} dataInfo={dataInfo} />
        </div>
      </div>

      {/* 6.3 Simulator Link */}
      <SimulatorLink expectedReturn={result.portfolio.expectedReturn} />

      {/* 6.4 Score Comparison Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">詳細スコア対照表</h2>
        <ScoreComparisonTable result={result} presets={allPresets ?? undefined} />
      </div>

      {/* 6.5 & 6.6 Drill-downs */}
      <CapacityDetail capacityResult={result.capacityResult} />
      <ToleranceDetail toleranceResult={result.toleranceResult} />

      {/* Re-assess button */}
      <div className="text-center">
        <button
          onClick={reset}
          className="text-sm text-blue-600 hover:text-blue-800 underline py-2"
        >
          もう一度診断する
        </button>
      </div>

      {/* GPIF Disclaimer */}
      <div className="text-xs text-gray-400 text-center leading-relaxed">
        ※ 期待リターンはGPIF（年金積立金管理運用独立行政法人）の第5期中期目標期間（2025-2029年度）における基本ポートフォリオ策定時の前提値をベースにしています。リスク（標準偏差）と相関係数は過去の市場データから算出しています。
      </div>

      {/* 6.7 Disclaimer Footer */}
      <div className="text-xs text-gray-400 text-center pb-6">
        ※ 本診断結果は参考情報です。投資判断はご自身の責任で行ってください。
      </div>
    </div>
  );
}
