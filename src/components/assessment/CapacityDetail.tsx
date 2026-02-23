import { useState } from 'react';
import type { CapacityResult } from '../../types/assessment';

interface Props {
  capacityResult: CapacityResult;
}

export default function CapacityDetail({ capacityResult }: Props) {
  const [open, setOpen] = useState(false);
  const { subScores, cashFlowDetail } = capacityResult;

  const items = [
    subScores.timeHorizon,
    subScores.portfolioRatio,
    subScores.cashFlow,
    subScores.incomeStability,
    subScores.emergencyFund,
  ];

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        type="button"
        className="w-full px-4 py-3 text-left font-semibold text-sm bg-gray-50 hover:bg-gray-100 rounded-t-lg flex justify-between items-center min-h-[44px]"
        onClick={() => setOpen(!open)}
      >
        <span>
          Capacity内訳（リスク能力）:{' '}
          <span className="text-blue-600">{capacityResult.totalScore}点</span> / 100点
        </span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          {/* Score bars */}
          {items.map((item) => (
            <div key={item.key}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-700">{item.label}</span>
                <span className="text-gray-800 font-medium">
                  {item.score} / {item.maxScore}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(item.score / item.maxScore) * 100}%` }}
                />
              </div>
            </div>
          ))}

          {/* Cash Flow Detail */}
          {cashFlowDetail.totalFutureExpenses > 0 && (
            <div className="mt-4 border-t border-gray-200 pt-3">
              <h4 className="text-xs font-semibold text-gray-600 mb-2">キャッシュフロー計算内訳</h4>
              <div className="space-y-1 text-xs text-gray-600">
                {cashFlowDetail.educationCostTotal > 0 && (
                  <div className="flex justify-between">
                    <span>教育費（インフレ調整後）</span>
                    <span>{cashFlowDetail.educationCostTotal.toLocaleString()}万円</span>
                  </div>
                )}
                {cashFlowDetail.caregivingCostTotal > 0 && (
                  <div className="flex justify-between">
                    <span>介護費（インフレ調整後）</span>
                    <span>{cashFlowDetail.caregivingCostTotal.toLocaleString()}万円</span>
                  </div>
                )}
                {cashFlowDetail.housingLoanTotal > 0 && (
                  <div className="flex justify-between">
                    <span>住宅ローン残高</span>
                    <span>{cashFlowDetail.housingLoanTotal.toLocaleString()}万円</span>
                  </div>
                )}
                {cashFlowDetail.otherEventsTotal > 0 && (
                  <div className="flex justify-between">
                    <span>その他</span>
                    <span>{cashFlowDetail.otherEventsTotal.toLocaleString()}万円</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t border-gray-200 pt-1">
                  <span>将来支出合計</span>
                  <span>{cashFlowDetail.totalFutureExpenses.toLocaleString()}万円</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>現在資産に対する比率</span>
                  <span>{(cashFlowDetail.expenseRatio * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
