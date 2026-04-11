import type { RiskSimpleResult } from '../../types/riskSimple';
import { RISK_LEVEL_DEFS, getRiskLevelDef } from '../../logic/riskSimpleScoring';
import { MODEL_ALLOCATIONS, MODEL_META, ASSET_CLASSES } from '../../lib/rb/types';
import AllocationDisclaimer from '../AllocationDisclaimer';
import AllocationSlider from './AllocationSlider';

interface Props {
  result: RiskSimpleResult;
  onRetry: () => void;
  onSwitchToDetail?: () => void;
}

function LevelBar({ level, label }: { level: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-20 text-right shrink-0">{label}</span>
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${(level / 7) * 100}%` }}
        />
      </div>
      <span className="text-sm font-bold text-gray-800 w-6 text-center">{level}</span>
    </div>
  );
}

export default function RiskResultDisplay({ result, onRetry, onSwitchToDetail }: Props) {
  const { capacityScore, toleranceScore, finalLevel, gapMessage, levelDef } = result;

  return (
    <div className="animate-fade-in space-y-6">
      {/* メインレベル表示 */}
      <div className="text-center">
        <p className="text-xs text-gray-500 mb-2">あなたのリスク許容度</p>
        <div className={`inline-flex items-center gap-3 px-6 py-4 rounded-xl ${levelDef.color}`}>
          <span className={`text-3xl font-bold ${levelDef.textColor}`}>
            レベル {finalLevel}
          </span>
          <span className={`text-lg font-semibold ${levelDef.textColor}`}>
            {levelDef.name}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          ボラティリティ目安: {levelDef.volatility}
        </p>
      </div>

      {/* スコア内訳 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-4">スコア内訳</h3>
        <div className="space-y-3">
          <LevelBar level={capacityScore} label="投資余力" />
          <LevelBar level={toleranceScore} label="投資許容度" />
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20 text-right shrink-0">最終レベル</span>
            <span className="text-xs text-gray-400">= min({capacityScore}, {toleranceScore})</span>
            <span className="ml-auto text-sm font-bold text-gray-800">{finalLevel}</span>
          </div>
        </div>
      </div>

      {/* ギャップメッセージ */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <p className="text-sm text-gray-700 leading-relaxed">{gapMessage}</p>
      </div>

      {/* 7段階レベル一覧 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-3">リスクレベル一覧</h3>
        <div className="space-y-1.5">
          {RISK_LEVEL_DEFS.map((def) => {
            const isActive = def.level === finalLevel;
            return (
              <div
                key={def.level}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${
                  isActive
                    ? `${def.color} ${def.textColor} font-semibold`
                    : 'text-gray-500'
                }`}
              >
                <span className="w-5 text-center font-mono">{def.level}</span>
                <span className="w-20">{def.name}</span>
                <span className="text-gray-400">{def.volatility}</span>
                {isActive && (
                  <span className="ml-auto text-xs font-bold">← あなた</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* モデル配分 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-3">
          Lv{finalLevel} {levelDef.name} のモデル配分（計算上の参考値）
        </h3>
        <div className="space-y-1.5 mb-3">
          {ASSET_CLASSES
            .filter(ac => (MODEL_ALLOCATIONS[finalLevel]?.[ac.key] ?? 0) > 0)
            .map(ac => (
              <div key={ac.key} className="flex justify-between text-sm px-2 py-1.5 bg-gray-50 rounded">
                <span className="text-gray-700">{ac.label}</span>
                <span className="font-medium text-gray-800">{MODEL_ALLOCATIONS[finalLevel][ac.key]}%</span>
              </div>
            ))}
        </div>
        {MODEL_META[finalLevel] && (
          <div className="flex gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
            <span>期待リターン: {MODEL_META[finalLevel].expectedReturn}%</span>
            <span>リスク: {MODEL_META[finalLevel].volatility}%</span>
          </div>
        )}
      </div>

      <AllocationSlider finalLevel={finalLevel} />

      <AllocationDisclaimer variant="light" />

      {/* Capacity vs Tolerance 詳細 */}
      {result.gapType !== 'balanced' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">
            {result.gapType === 'capacity_higher'
              ? '投資余力 > 投資許容度'
              : '投資許容度 > 投資余力'}
          </h3>
          <div className="flex gap-4">
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1">投資余力</p>
              <p className="text-lg font-bold text-gray-800">{capacityScore}</p>
              <p className="text-xs text-gray-400">
                {getRiskLevelDef(capacityScore).name}
              </p>
            </div>
            <div className="flex items-center text-gray-300 text-lg">vs</div>
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1">投資許容度</p>
              <p className="text-lg font-bold text-gray-800">{toleranceScore}</p>
              <p className="text-xs text-gray-400">
                {getRiskLevelDef(toleranceScore).name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 詳細版への導線（簡易版の場合のみ） */}
      {onSwitchToDetail && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-5 text-center">
          <h3 className="text-sm font-bold text-blue-800 mb-2">
            より精度の高い診断はこちら
          </h3>
          <p className="text-xs text-blue-600 mb-4">
            米国大学の学術調査に基づく20問の詳細版診断で、<br />
            より正確なリスク許容度を判定します。
          </p>
          <button
            onClick={onSwitchToDetail}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
          >
            詳細版を試す
          </button>
        </div>
      )}

      {/* やり直し */}
      <div className="text-center">
        <button
          onClick={onRetry}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          もう一度診断する
        </button>
      </div>
    </div>
  );
}
