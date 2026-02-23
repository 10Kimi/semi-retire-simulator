import type { PortfolioPreset, MarketDataInfo } from '../../types/assessment';

interface Props {
  portfolio: PortfolioPreset;
  dataInfo?: MarketDataInfo | null;
}

export default function AllocationTable({ portfolio, dataInfo }: Props) {
  const nonZero = portfolio.allocations.filter((a) => a.percentage > 0);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-gray-600 font-medium">資産クラス</th>
              <th className="text-right py-2 text-gray-600 font-medium">配分比率</th>
            </tr>
          </thead>
          <tbody>
            {nonZero.map((a) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500">期待リターン</div>
          <div className="text-lg font-bold text-gray-800">{portfolio.expectedReturn}%</div>
          <div className="text-xs text-gray-400">年率</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500">ボラティリティ</div>
          <div className="text-lg font-bold text-gray-800">{portfolio.expectedVolatility}%</div>
          <div className="text-xs text-gray-400">年率</div>
        </div>
      </div>

      {dataInfo && (
        <div className="mt-3 text-xs text-gray-400 text-center leading-relaxed">
          期待リターン: GPIF第5期（2025-2029年度）基準 / リスク・相関: 市場データ {dataInfo.dataPeriod} / 最終計算日: {dataInfo.calculatedAt}
        </div>
      )}
    </div>
  );
}
