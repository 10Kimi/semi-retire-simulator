import type { SimulationResult } from '../types';

interface Props {
  result: SimulationResult;
}

function formatYen(value: number): string {
  if (Math.abs(value) >= 100000000) {
    return (value / 100000000).toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + '億円';
  }
  return (value / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 0 }) + '万円';
}

export default function ResultSummary({ result }: Props) {
  const {
    assetsAtRetirement,
    requiredAssets,
    surplus,
    additionalMonthly,
    scorePercent,
    message,
    depletionAge,
  } = result;

  return (
    <div className="space-y-4">
      {depletionAge !== null && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-3">
          <div className="text-sm font-bold text-red-700">
            {depletionAge}歳で資産が枯渇します
          </div>
          <div className="text-xs text-red-600 mt-1">
            生活費の見直し、追加収入、またはリタイア時期の延期を検討してください。
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-xs text-blue-600 font-medium">リタイア時形成資産</div>
          <div className="text-base md:text-lg font-bold text-blue-800">{formatYen(assetsAtRetirement)}</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3">
          <div className="text-xs text-amber-600 font-medium">必要資産(現在価値)</div>
          <div className="text-base md:text-lg font-bold text-amber-800">{formatYen(requiredAssets)}</div>
        </div>
      </div>

      <div className={`rounded-lg p-3 ${surplus >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
        <div className={`text-xs font-medium ${surplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {surplus >= 0 ? '余裕額' : '不足額'}
        </div>
        <div className={`text-base md:text-lg font-bold ${surplus >= 0 ? 'text-green-800' : 'text-red-800'}`}>
          {formatYen(Math.abs(surplus))}
        </div>
      </div>

      {surplus < 0 && (
        <div className="bg-orange-50 rounded-lg p-3">
          <div className="text-xs text-orange-600 font-medium">毎月の追加投資必要額</div>
          <div className="text-base md:text-lg font-bold text-orange-800">
            {formatYen(additionalMonthly)}/月
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
        <div className="text-sm text-gray-600 mb-1">達成度スコア</div>
        <div className="text-2xl md:text-3xl font-bold mb-1">
          <span className={
            scorePercent >= 100 ? 'text-green-600' :
            scorePercent >= 80 ? 'text-yellow-600' :
            'text-red-600'
          }>
            {scorePercent.toFixed(1)}%
          </span>
        </div>
        <div className="text-sm text-gray-700">{message}</div>
      </div>
    </div>
  );
}
