import { useState } from 'react';
import { useAssessment } from '../../contexts/AssessmentContext';
import { useAuth } from '../../contexts/AuthContext';
import { TOLERANCE_QUESTIONS, calculateTolerance } from '../../logic/calculateTolerance';
import { calculateCapacity } from '../../logic/calculateCapacity';
import { calculateFinalScore, determineLimitingFactor, getRiskLevel } from '../../logic/riskLevels';
import { fetchPortfolioForRiskLevel } from '../../logic/portfolioAllocation';
import { saveAssessment } from '../../lib/assessmentDb';
import { RadioGroup } from './FormFields';
import StepProgress from './StepProgress';
import type { ToleranceAnswer, AssessmentResult } from '../../types/assessment';

export default function StepRiskTolerance() {
  const { state, setToleranceAnswers, setResult, setStep } = useAssessment();
  const { user } = useAuth();
  const { toleranceAnswers, basicInput, financialInput, lifeEventInput } = state;
  const [saving, setSaving] = useState(false);

  const handleSelect = (questionId: number, optionIndex: number, score: number) => {
    const existing = toleranceAnswers.filter((a) => a.questionId !== questionId);
    const updated: ToleranceAnswer[] = [
      ...existing,
      { questionId, selectedIndex: optionIndex, score },
    ];
    setToleranceAnswers(updated);
  };

  const getAnswer = (questionId: number): number | null => {
    const answer = toleranceAnswers.find((a) => a.questionId === questionId);
    return answer ? answer.selectedIndex : null;
  };

  const allAnswered = TOLERANCE_QUESTIONS.every(
    (q) => toleranceAnswers.some((a) => a.questionId === q.id),
  );

  const handleComplete = async () => {
    setSaving(true);

    // Calculate all scores
    const capacityResult = calculateCapacity(basicInput, financialInput, lifeEventInput);
    const toleranceResult = calculateTolerance(toleranceAnswers);

    const finalScore = calculateFinalScore(capacityResult.totalScore, toleranceResult.totalScore);
    const limitingFactor = determineLimitingFactor(capacityResult.totalScore, toleranceResult.totalScore);
    const riskLevelInfo = getRiskLevel(finalScore);
    const portfolio = await fetchPortfolioForRiskLevel(riskLevelInfo.level);

    const result: AssessmentResult = {
      capacityResult,
      toleranceResult,
      finalScore,
      riskLevel: riskLevelInfo.level,
      limitingFactor,
      portfolio,
    };

    // Save to Supabase (fire-and-forget, don't block on error)
    if (user) {
      await saveAssessment(
        user.id,
        basicInput,
        financialInput,
        lifeEventInput,
        toleranceAnswers,
        result,
      ).catch((err) => console.error('Failed to save assessment:', err));
    }

    setResult(result);
    setSaving(false);
    setStep(5);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <StepProgress currentStep={4} />

      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-1">Step 4: リスク許容度テスト</h2>
          <p className="text-xs text-gray-500 mb-6">投資に対する考え方について、最も近いものを選んでください。</p>
        </div>

        {TOLERANCE_QUESTIONS.map((q, qIndex) => (
          <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              問{qIndex + 1}. {q.question}
            </h3>
            <RadioGroup
              options={q.options.map((opt) => ({ label: opt.label }))}
              selectedIndex={getAnswer(q.id)}
              onChange={(index) => handleSelect(q.id, index, q.options[index].score)}
            />
          </div>
        ))}

        <div className="flex gap-3">
          <button
            onClick={() => setStep(3)}
            className="flex-1 py-3 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 min-h-[44px]"
          >
            戻る
          </button>
          <button
            onClick={handleComplete}
            disabled={!allAnswered || saving}
            className={`flex-1 py-3 rounded-lg text-sm font-semibold min-h-[44px] ${
              allAnswered && !saving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? '計算中...' : '結果を見る'}
          </button>
        </div>
      </div>
    </div>
  );
}
