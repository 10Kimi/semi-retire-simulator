import { useState } from 'react';
import { RISK_LEVEL_DEFS, getRiskLevelDef } from '../../logic/riskScoring';
import type { PfDiagnosisResult, PfGapResult } from '../../logic/pfSimple';
import RiskExcessWarning from '../risk/RiskExcessWarning';
import { RISK_TIER_DEFS, levelToTier, analyzePfTierGap } from '../../logic/riskTiers';

/**
 * /pf の画面のうち、有料かどうかで出し分ける部分（FI_project #101、D-062）。
 * 無料は3段階、有料（is_premium）は7段階。計算・保存は7段階のまま（ページ側）。
 * 有料かどうかを読み込んでいる間は、ページ側でどちらも出さない（tierView）。
 */

export function PfAssessmentBadge({ assessmentLevel, isPremium }: { assessmentLevel: number; isPremium: boolean }) {
  return (
    <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
      <p className="text-xs text-blue-600 mb-1">あなたのリスク許容度</p>
      <p className="text-sm font-bold text-blue-800">
        {isPremium
          ? `レベル ${assessmentLevel} — ${getRiskLevelDef(assessmentLevel).name}`
          : levelToTier(assessmentLevel).name}
      </p>
    </div>
  );
}

interface PfResultViewProps {
  diagResult: PfDiagnosisResult;
  gapResult: PfGapResult | null;
  assessmentLevel: number | null;
  isPremium: boolean;
  onRetry: () => void;
}

export function PfResultView({ diagResult, gapResult, assessmentLevel, isPremium, onRetry }: PfResultViewProps) {
  const [showMonthlyNotice, setShowMonthlyNotice] = useState(false);

  // 無料の画面のズレの判定は3段階どうし
  const tierGap = gapResult ? analyzePfTierGap(gapResult.pfLevel, gapResult.assessmentLevel) : null;
  const shownGapType = isPremium ? gapResult?.gapType : tierGap?.gapType;
  const shownGapMessage = isPremium ? gapResult?.message : tierGap?.message;
  const pfTier = levelToTier(diagResult.riskLevel);

  return (
    <div className="animate-fade-in space-y-6">
      {/* メインレベル表示 */}
      <div className="text-center">
        <p className="text-xs text-gray-500 mb-2">あなたのポートフォリオ</p>
        {isPremium ? (
          <div className={`inline-flex items-center gap-3 px-6 py-4 rounded-xl ${diagResult.riskLevelDef.color}`}>
            <span className={`text-3xl font-bold ${diagResult.riskLevelDef.textColor}`}>
              レベル {diagResult.riskLevel}
            </span>
            <span className={`text-lg font-semibold ${diagResult.riskLevelDef.textColor}`}>
              {diagResult.riskLevelDef.name}
            </span>
          </div>
        ) : (
          <div className={`inline-flex items-center gap-3 px-6 py-4 rounded-xl ${pfTier.color}`}>
            <span className={`text-3xl font-bold ${pfTier.textColor}`}>
              {pfTier.name}
            </span>
          </div>
        )}
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
            <p className="text-xs text-gray-500 mb-1">{isPremium ? 'リスクレベル' : '段階'}</p>
            <p className="text-xl font-bold text-gray-800">
              {isPremium ? `${diagResult.riskLevel} / 7` : pfTier.name}
            </p>
          </div>
        </div>
      </div>

      {/* ギャップ分析 */}
      {gapResult && (
        <div className={`rounded-xl border p-5 ${
          shownGapType === 'match'
            ? 'bg-green-50 border-green-200'
            : shownGapType === 'pf_higher'
              ? 'bg-red-50 border-red-200'
              : 'bg-yellow-50 border-yellow-200'
        }`}>
          <h3 className="text-sm font-bold text-gray-800 mb-3">
            リスク許容度とのギャップ
          </h3>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1">ポートフォリオ</p>
              {isPremium ? (
                <>
                  <p className="text-lg font-bold text-gray-800">レベル {gapResult.pfLevel}</p>
                  <p className="text-xs text-gray-400">{getRiskLevelDef(gapResult.pfLevel).name}</p>
                </>
              ) : (
                <p className="text-lg font-bold text-gray-800">{tierGap?.pfTier.name}</p>
              )}
            </div>
            <div className="flex items-center text-gray-300 text-lg">vs</div>
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1">リスク許容度</p>
              {isPremium ? (
                <>
                  <p className="text-lg font-bold text-gray-800">レベル {gapResult.assessmentLevel}</p>
                  <p className="text-xs text-gray-400">{getRiskLevelDef(gapResult.assessmentLevel).name}</p>
                </>
              ) : (
                <p className="text-lg font-bold text-gray-800">{tierGap?.assessmentTier.name}</p>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{shownGapMessage}</p>
          {!isPremium && shownGapType === 'pf_higher' && (
            <p className="text-xs text-gray-500 leading-relaxed mt-3">
              暴落のときにどれくらいの金額が動くかの目安は、有料のプログラムで扱います。
            </p>
          )}
        </div>
      )}

      {/* 合っている / 保守的すぎる場合: PFカスタマイズ導線 */}
      {gapResult && (shownGapType === 'match' || shownGapType === 'pf_lower') && (
        <div className={`rounded-xl border p-5 text-center ${
          shownGapType === 'match'
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            {shownGapType === 'match'
              ? '同じレベルの中でも、配分を最適化することで期待リターンを高めたり、ボラティリティを下げたりできます。'
              : 'リスク許容度に見合った、もう少しリターンを狙える配分に最適化できます。'}
          </p>
          <a
            href="/portfolio"
            className="inline-block px-8 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            ポートフォリオを最適化する
          </a>
        </div>
      )}

      {/* リスク超過警告 */}
      {/* 無料では出さない（7段階のスライダーで金額を出す細かい中身のため、FI_project #101） */}
      {isPremium && gapResult && gapResult.gapType === 'pf_higher' && (
        <RiskExcessWarning
          totalAmount={diagResult.totalAmount}
          pfLevel={gapResult.pfLevel}
          assessmentLevel={gapResult.assessmentLevel}
        />
      )}

      {/* 3段階の一覧（無料） */}
      {!isPremium && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">リスクの3つの段階</h3>
          <div className="space-y-1.5">
            {RISK_TIER_DEFS.map(def => {
              const isPf = def.key === pfTier.key;
              const isAssessment = assessmentLevel !== null && def.key === levelToTier(assessmentLevel).key;
              return (
                <div
                  key={def.key}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${
                    isPf ? `${def.color} ${def.textColor} font-semibold` : 'text-gray-500'
                  }`}
                >
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
      )}

      {/* 7段階レベル一覧（有料） */}
      {isPremium && (
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
      )}

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
          onClick={onRetry}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          入力をやり直す
        </button>
      </div>
    </div>
  );
}
