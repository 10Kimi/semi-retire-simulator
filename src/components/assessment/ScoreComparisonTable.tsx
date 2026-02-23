import type { AssessmentResult, RiskLevel, PortfolioPreset } from '../../types/assessment';
import { RISK_LEVELS } from '../../logic/riskLevels';
import { PORTFOLIO_PRESETS } from '../../logic/portfolioAllocation';

interface Props {
  result: AssessmentResult;
  presets?: Record<RiskLevel, PortfolioPreset>;
}

function getColumnForScore(score: number): number {
  for (let i = 0; i < RISK_LEVELS.length; i++) {
    if (score >= RISK_LEVELS[i].scoreMin && score <= RISK_LEVELS[i].scoreMax) {
      return i;
    }
  }
  return 0;
}

function ScoreRow({
  label,
  score,
  activeColumn,
}: {
  label: string;
  score: number;
  activeColumn: number;
}) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 px-2 text-sm text-gray-700 font-medium whitespace-nowrap">{label}</td>
      <td className="py-2 px-2 text-sm text-gray-800 font-bold text-center">{score}</td>
      {RISK_LEVELS.map((level, i) => (
        <td key={level.level} className="py-2 px-2 text-center">
          {i === activeColumn && (
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${level.color} ${level.textColor}`}>
              ★
            </span>
          )}
        </td>
      ))}
    </tr>
  );
}

export default function ScoreComparisonTable({ result, presets }: Props) {
  const allPresets = presets ?? PORTFOLIO_PRESETS;
  const capacityCol = getColumnForScore(result.capacityResult.totalScore);
  const toleranceCol = getColumnForScore(result.toleranceResult.totalScore);
  const finalCol = getColumnForScore(result.finalScore);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs md:text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="py-2 px-2 text-left text-gray-600 font-medium"></th>
            <th className="py-2 px-2 text-center text-gray-600 font-medium">あなた</th>
            {RISK_LEVELS.map((level) => (
              <th key={level.level} className="py-2 px-2 text-center text-gray-600 font-medium whitespace-nowrap">
                {level.label}
                <div className="text-xs text-gray-400 font-normal">
                  ({level.scoreMin}-{level.scoreMax})
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <ScoreRow label="Risk Capacity" score={result.capacityResult.totalScore} activeColumn={capacityCol} />
          <ScoreRow label="Risk Tolerance" score={result.toleranceResult.totalScore} activeColumn={toleranceCol} />
          <tr className="border-b border-gray-200 bg-gray-50">
            <td className="py-2 px-2 text-sm text-gray-800 font-bold whitespace-nowrap">最終スコア</td>
            <td className="py-2 px-2 text-sm text-gray-800 font-bold text-center">{result.finalScore}</td>
            {RISK_LEVELS.map((level, i) => (
              <td key={level.level} className="py-2 px-2 text-center">
                {i === finalCol && (
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${level.color} ${level.textColor}`}>
                    ★
                  </span>
                )}
              </td>
            ))}
          </tr>

          {/* Expected Return row */}
          <tr className="border-b border-gray-100">
            <td className="py-2 px-2 text-xs text-gray-500">期待リターン</td>
            <td className="py-2 px-2 text-xs text-gray-800 font-bold text-center">
              {result.portfolio.expectedReturn}%
            </td>
            {RISK_LEVELS.map((level) => {
              const preset = allPresets[level.level];
              return (
                <td key={level.level} className="py-2 px-2 text-xs text-gray-500 text-center">
                  {preset.expectedReturn}%
                </td>
              );
            })}
          </tr>

          {/* Volatility row */}
          <tr className="border-b border-gray-100">
            <td className="py-2 px-2 text-xs text-gray-500">ボラティリティ</td>
            <td className="py-2 px-2 text-xs text-gray-800 font-bold text-center">
              {result.portfolio.expectedVolatility}%
            </td>
            {RISK_LEVELS.map((level) => {
              const preset = allPresets[level.level];
              return (
                <td key={level.level} className="py-2 px-2 text-xs text-gray-500 text-center">
                  {preset.expectedVolatility}%
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
