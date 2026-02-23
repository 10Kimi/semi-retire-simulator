import type { AssessmentResult } from '../../types/assessment';
import { getRiskLevelByKey, getLimitingFactorMessage, RISK_LEVELS } from '../../logic/riskLevels';

interface Props {
  result: AssessmentResult;
}

export default function ResultSummary({ result }: Props) {
  const riskLevel = getRiskLevelByKey(result.riskLevel);
  const limitingMessage = getLimitingFactorMessage(result.limitingFactor, riskLevel.label);

  return (
    <div className="text-center">
      {/* Risk Level Badge */}
      <div className={`inline-block px-6 py-3 rounded-full ${riskLevel.color} ${riskLevel.textColor} mb-4`}>
        <span className="text-2xl font-bold">{riskLevel.label}</span>
      </div>

      {/* Score */}
      <div className="text-sm text-gray-600 mb-4">
        最終スコア: <span className="text-lg font-bold text-gray-800">{result.finalScore}</span> / 100
      </div>

      {/* 5-level gauge */}
      <div className="flex items-stretch h-8 rounded-full overflow-hidden mb-2 max-w-md mx-auto">
        {RISK_LEVELS.map((level) => {
          const width = level.scoreMax - level.scoreMin + 1;
          const isActive = level.level === result.riskLevel;
          return (
            <div
              key={level.level}
              className={`relative flex items-center justify-center text-xs font-medium transition-all ${
                isActive
                  ? `${level.color} ${level.textColor} ring-2 ring-offset-1 ring-gray-400`
                  : 'bg-gray-100 text-gray-400'
              }`}
              style={{ width: `${width}%` }}
            >
              {isActive && <span className="hidden md:inline">{level.label}</span>}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-xs text-gray-400 max-w-md mx-auto mb-6 px-1">
        <span>保守的</span>
        <span>攻撃的</span>
      </div>

      {/* Expected Return highlight */}
      <div className="bg-blue-50 rounded-xl p-4 mb-4 max-w-md mx-auto">
        <div className="text-sm text-blue-700">推奨期待リターン</div>
        <div className="text-3xl font-bold text-blue-800">{result.portfolio.expectedReturn}%</div>
        <div className="text-xs text-blue-600">年率</div>
      </div>

      {/* Capacity vs Tolerance */}
      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500">リスク能力 (Capacity)</div>
          <div className="text-xl font-bold text-gray-800">{result.capacityResult.totalScore}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500">リスク許容度 (Tolerance)</div>
          <div className="text-xl font-bold text-gray-800">{result.toleranceResult.totalScore}</div>
        </div>
      </div>

      {/* Limiting factor message */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800 max-w-md mx-auto">
        {limitingMessage}
      </div>
    </div>
  );
}
