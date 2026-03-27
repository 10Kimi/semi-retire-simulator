import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import RiskProgressBar from '../components/riskSimple/RiskProgressBar';
import RiskQuestionStep from '../components/riskSimple/RiskQuestionStep';
import RiskSectionTransition from '../components/riskSimple/RiskSectionTransition';
import RiskAuthGate from '../components/riskSimple/RiskAuthGate';
import {
  loadAnswersFromStorage,
  clearAnswersStorage,
} from '../components/riskSimple/RiskAuthGate';
import RiskResultDisplay from '../components/riskSimple/RiskResultDisplay';
import {
  RISK_SIMPLE_QUESTIONS,
  CAPACITY_QUESTIONS,
  TOTAL_QUESTIONS,
} from '../logic/riskSimpleQuestions';
import { calculateRiskSimpleResult } from '../logic/riskSimpleScoring';
import { saveRiskSimpleResult } from '../lib/riskSimpleDb';
import { useAuth } from '../contexts/AuthContext';
import type { RiskAnswer, RiskSimpleResult } from '../types/riskSimple';

type Phase = 'questions' | 'section_transition' | 'auth_gate' | 'result';

export default function RiskSimplePage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [phase, setPhase] = useState<Phase>('questions');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(RiskAnswer | null)[]>(
    () => new Array(TOTAL_QUESTIONS).fill(null)
  );
  const [result, setResult] = useState<RiskSimpleResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);

  const currentQuestion = RISK_SIMPLE_QUESTIONS[questionIndex];
  const selectedAnswer = answers[questionIndex];

  // マジックリンクから着地: ?show_result=1 + ログイン済み + localStorageに回答あり → 即結果表示
  useEffect(() => {
    if (authLoading || restored) return;
    if (searchParams.get('show_result') !== '1') return;
    if (!user) return;

    const saved = loadAnswersFromStorage();
    if (saved && saved.length === TOTAL_QUESTIONS) {
      setRestored(true);
      const res = calculateRiskSimpleResult(saved);
      setResult(res);
      setPhase('result');

      // DB保存
      setSaving(true);
      saveRiskSimpleResult(
        user.id,
        res.capacityScore,
        res.toleranceScore,
        res.finalLevel,
        saved
      ).then(() => {
        setSaving(false);
        clearAnswersStorage();
      });

      // URLからクエリパラメータを除去
      setSearchParams({}, { replace: true });
    }
  }, [authLoading, user, searchParams, restored, setSearchParams]);

  const showResult = useCallback(
    async (validAnswers: RiskAnswer[]) => {
      const res = calculateRiskSimpleResult(validAnswers);
      setResult(res);
      setPhase('result');

      // Save to DB if logged in
      if (user) {
        setSaving(true);
        await saveRiskSimpleResult(
          user.id,
          res.capacityScore,
          res.toleranceScore,
          res.finalLevel,
          validAnswers
        );
        setSaving(false);
      }
    },
    [user]
  );

  const handleSelect = useCallback(
    (index: number, value: number) => {
      setAnswers((prev) => {
        const next = [...prev];
        next[questionIndex] = {
          questionId: currentQuestion.id,
          selectedIndex: index,
          value,
        };
        return next;
      });
    },
    [questionIndex, currentQuestion]
  );

  const handleNext = useCallback(() => {
    if (!answers[questionIndex]) return;

    const nextIndex = questionIndex + 1;

    // Finished all questions
    if (nextIndex >= TOTAL_QUESTIONS) {
      const validAnswers = answers.filter((a): a is RiskAnswer => a !== null);

      if (user) {
        showResult(validAnswers);
      } else {
        setPhase('auth_gate');
      }
      return;
    }

    // Section transition: Capacity → Tolerance
    if (
      questionIndex < CAPACITY_QUESTIONS.length &&
      nextIndex >= CAPACITY_QUESTIONS.length
    ) {
      setQuestionIndex(nextIndex);
      setPhase('section_transition');
      return;
    }

    setQuestionIndex(nextIndex);
  }, [questionIndex, answers, user, showResult]);

  const handleBack = useCallback(() => {
    if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1);
      setPhase('questions');
    }
  }, [questionIndex]);

  const handleSectionContinue = useCallback(() => {
    setPhase('questions');
  }, []);

  const handleAuthenticated = useCallback(() => {
    const validAnswers = answers.filter((a): a is RiskAnswer => a !== null);
    showResult(validAnswers);
  }, [answers, showResult]);

  const handleRetry = useCallback(() => {
    setPhase('questions');
    setQuestionIndex(0);
    setAnswers(new Array(TOTAL_QUESTIONS).fill(null));
    setResult(null);
    setRestored(false);
  }, []);

  // マジックリンク着地中のローディング
  if (authLoading && searchParams.get('show_result') === '1') {
    return (
      <Layout>
        <main className="max-w-lg mx-auto px-4 py-20 text-center">
          <p className="text-sm text-gray-500">ログインを確認中...</p>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="max-w-lg mx-auto px-4 py-6 md:py-10">
        {/* Header */}
        {phase !== 'result' && (
          <div className="text-center mb-6">
            <h1 className="text-lg md:text-xl font-bold text-gray-800 mb-1">
              リスク許容度診断
            </h1>
            <p className="text-xs text-gray-500">
              約3〜5分 ・ 全{TOTAL_QUESTIONS}問
            </p>
          </div>
        )}

        {/* Progress bar (questions phase only) */}
        {(phase === 'questions' || phase === 'section_transition') && (
          <RiskProgressBar
            current={questionIndex + 1}
            total={TOTAL_QUESTIONS}
          />
        )}

        {/* Section label */}
        {phase === 'questions' && (
          <div className="mb-4">
            <span
              className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                currentQuestion.section === 'capacity'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-purple-100 text-purple-700'
              }`}
            >
              {currentQuestion.section === 'capacity'
                ? '投資余力'
                : '投資許容度'}
            </span>
          </div>
        )}

        {/* Main content */}
        {phase === 'questions' && (
          <RiskQuestionStep
            key={currentQuestion.id}
            question={currentQuestion}
            selectedIndex={selectedAnswer?.selectedIndex ?? null}
            onSelect={handleSelect}
            onNext={handleNext}
            onBack={handleBack}
            isFirst={questionIndex === 0}
          />
        )}

        {phase === 'section_transition' && (
          <RiskSectionTransition onContinue={handleSectionContinue} />
        )}

        {phase === 'auth_gate' && (
          <RiskAuthGate
            answers={answers.filter((a): a is RiskAnswer => a !== null)}
            onAuthenticated={handleAuthenticated}
          />
        )}

        {phase === 'result' && result && (
          <>
            {saving && (
              <p className="text-center text-xs text-gray-400 mb-4">
                結果を保存中...
              </p>
            )}
            <RiskResultDisplay result={result} onRetry={handleRetry} />
          </>
        )}
      </main>
    </Layout>
  );
}
