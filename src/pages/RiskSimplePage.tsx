import { useState, useCallback, useEffect, useMemo } from 'react';
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
import NicknameModal from '../components/NicknameModal';
import {
  RISK_SIMPLE_QUESTIONS,
  CAPACITY_QUESTIONS,
  TOTAL_QUESTIONS,
} from '../logic/riskSimpleQuestions';
import {
  RISK_DETAIL_QUESTIONS,
  DETAIL_CAPACITY_QUESTIONS,
  DETAIL_TOTAL_QUESTIONS,
} from '../logic/riskDetailQuestions';
import { calculateRiskSimpleResult } from '../logic/riskSimpleScoring';
import { calculateDetailResult } from '../logic/riskDetailScoring';
import { saveRiskSimpleResult } from '../lib/riskSimpleDb';
import { useAuth } from '../contexts/AuthContext';
import type { RiskAnswer, RiskSimpleResult } from '../types/riskSimple';
import { SEOHead } from '../components/seo/SEOHead';
import { JsonLd } from '../components/seo/JsonLd';
import { softwareApplicationSchema } from '../lib/seo/schemas';

type Phase = 'version_select' | 'questions' | 'section_transition' | 'auth_gate' | 'result';
type DiagVersion = 'simple' | 'detail';

export default function RiskSimplePage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [version, setVersion] = useState<DiagVersion>('simple');
  const [phase, setPhase] = useState<Phase>('version_select');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(RiskAnswer | null)[]>(
    () => new Array(TOTAL_QUESTIONS).fill(null)
  );
  const [result, setResult] = useState<RiskSimpleResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);

  // 現在のバージョンに応じた質問セット
  const questions = useMemo(
    () => version === 'detail' ? RISK_DETAIL_QUESTIONS : RISK_SIMPLE_QUESTIONS,
    [version]
  );
  const capacityCount = useMemo(
    () => version === 'detail' ? DETAIL_CAPACITY_QUESTIONS.length : CAPACITY_QUESTIONS.length,
    [version]
  );
  const totalQuestions = useMemo(
    () => version === 'detail' ? DETAIL_TOTAL_QUESTIONS : TOTAL_QUESTIONS,
    [version]
  );
  const currentQuestion = questions[questionIndex];
  const selectedAnswer = answers[questionIndex];

  const calcResult = useCallback((validAnswers: RiskAnswer[]) => {
    return version === 'detail'
      ? calculateDetailResult(validAnswers)
      : calculateRiskSimpleResult(validAnswers);
  }, [version]);

  // マジックリンクから着地
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
      if (!user.user_metadata?.full_name && !user.user_metadata?.nickname_skipped) {
        setShowNicknameModal(true);
      }

      setSaving(true);
      saveRiskSimpleResult(
        user.id, res.capacityScore, res.toleranceScore, res.finalLevel, saved, 'simple'
      ).then(() => {
        setSaving(false);
        clearAnswersStorage();
      });

      setSearchParams({}, { replace: true });
    }
  }, [authLoading, user, searchParams, restored, setSearchParams]);

  const showResult = useCallback(
    async (validAnswers: RiskAnswer[]) => {
      const res = calcResult(validAnswers);
      setResult(res);
      setPhase('result');
      if (user && !user.user_metadata?.full_name && !user.user_metadata?.nickname_skipped) {
        setShowNicknameModal(true);
      }

      if (user) {
        setSaving(true);
        await saveRiskSimpleResult(
          user.id, res.capacityScore, res.toleranceScore, res.finalLevel, validAnswers, version
        );
        setSaving(false);
      }
    },
    [user, calcResult, version]
  );

  const startDiagnosis = useCallback((v: DiagVersion) => {
    setVersion(v);
    const total = v === 'detail' ? DETAIL_TOTAL_QUESTIONS : TOTAL_QUESTIONS;
    setAnswers(new Array(total).fill(null));
    setQuestionIndex(0);
    setPhase('questions');
  }, []);

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

    if (nextIndex >= totalQuestions) {
      const validAnswers = answers.filter((a): a is RiskAnswer => a !== null);
      if (user) {
        showResult(validAnswers);
      } else {
        setPhase('auth_gate');
      }
      return;
    }

    if (questionIndex < capacityCount && nextIndex >= capacityCount) {
      setQuestionIndex(nextIndex);
      setPhase('section_transition');
      return;
    }

    setQuestionIndex(nextIndex);
  }, [questionIndex, answers, user, showResult, totalQuestions, capacityCount]);

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
    setPhase('version_select');
    setQuestionIndex(0);
    setAnswers(new Array(TOTAL_QUESTIONS).fill(null));
    setResult(null);
    setRestored(false);
  }, []);

  const handleSwitchToDetail = useCallback(() => {
    startDiagnosis('detail');
  }, [startDiagnosis]);

  if (authLoading && searchParams.get('show_result') === '1') {
    return (
      <>
        <SEOHead
          title="リスク許容度診断｜11問で資産運用の適正レベルを判定"
          description="Risk Capacity（財務体力）とRisk Tolerance（心理耐性）の両軸で、あなたに合ったリスクレベル（1〜7）を算出します。無料・約3〜5分。"
          canonical="/risk"
        />
      <Layout>
        <main className="max-w-lg mx-auto px-4 py-20 text-center">
          <p className="text-sm text-gray-500">ログインを確認中...</p>
        </main>
      </Layout>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="リスク許容度診断｜11問で資産運用の適正レベルを判定"
        description="Risk Capacity（財務体力）とRisk Tolerance（心理耐性）の両軸で、あなたに合ったリスクレベル（1〜7）を算出します。無料・約3〜5分。"
        canonical="/risk"
      />
      <JsonLd
        data={softwareApplicationSchema({
          name: 'リスク許容度診断',
          description:
            '11問の質問で投資家としてのリスク許容度（1〜7のレベル）を判定する診断ツール。',
          url: '/risk',
        })}
      />
    <Layout>
      <main className="max-w-lg mx-auto px-4 py-6 md:py-10">
        {/* バージョン選択 */}
        {phase === 'version_select' && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-lg md:text-xl font-bold text-gray-800 mb-2">
                リスク許容度を診断します
              </h1>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => startDiagnosis('simple')}
                className="w-full text-left bg-white rounded-xl border-2 border-blue-200 p-5 hover:border-blue-400 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">簡易診断（約3〜5分）</p>
                    <p className="text-xs text-gray-500 mt-0.5">まずざっくり確認したい方向け</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => startDiagnosis('detail')}
                className="w-full text-left bg-white rounded-xl border-2 border-gray-200 p-5 hover:border-purple-400 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-400" />
                  <div>
                    <p className="text-sm font-bold text-gray-800">詳細診断（約8〜10分）</p>
                    <p className="text-xs text-gray-500 mt-0.5">より正確に把握したい方向け</p>
                    <p className="text-xs text-purple-600 mt-0.5">※米国大学の学術調査をベースに日本向けに設計</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        {phase !== 'result' && phase !== 'version_select' && (
          <div className="text-center mb-6">
            <h1 className="text-lg md:text-xl font-bold text-gray-800 mb-1">
              リスク許容度診断{version === 'detail' ? '（詳細版）' : ''}
            </h1>
            <p className="text-xs text-gray-500">
              {version === 'detail' ? '約8〜10分' : '約3〜5分'} ・ 全{totalQuestions}問
            </p>
          </div>
        )}

        {/* Progress bar */}
        {(phase === 'questions' || phase === 'section_transition') && (
          <RiskProgressBar current={questionIndex + 1} total={totalQuestions} />
        )}

        {/* Section label */}
        {phase === 'questions' && currentQuestion && (
          <div className="mb-4">
            <span
              className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                currentQuestion.section === 'capacity'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-purple-100 text-purple-700'
              }`}
            >
              {currentQuestion.section === 'capacity' ? '投資余力' : '投資許容度'}
            </span>
          </div>
        )}

        {/* Questions */}
        {phase === 'questions' && currentQuestion && (
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
            <RiskResultDisplay
              result={result}
              onRetry={handleRetry}
              onSwitchToDetail={version === 'simple' ? handleSwitchToDetail : undefined}
            />
            {showNicknameModal && (
              <NicknameModal onDone={() => setShowNicknameModal(false)} />
            )}
          </>
        )}
      </main>
    </Layout>
    </>
  );
}
