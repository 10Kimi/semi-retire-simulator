import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import RiskProgressBar from '../components/risk/RiskProgressBar';
import RiskQuestionStep from '../components/risk/RiskQuestionStep';
import RiskSectionTransition from '../components/risk/RiskSectionTransition';
import RiskAuthGate from '../components/risk/RiskAuthGate';
import {
  loadAnswersFromStorage,
  clearAnswersStorage,
} from '../components/risk/RiskAuthGate';
import RiskResultDisplay from '../components/risk/RiskResultDisplay';
import NicknameModal from '../components/NicknameModal';
import {
  RISK_DETAIL_QUESTIONS,
  DETAIL_CAPACITY_QUESTIONS,
  DETAIL_TOTAL_QUESTIONS,
} from '../logic/riskDetailQuestions';
import { calculateDetailResult } from '../logic/riskDetailScoring';
import { saveRiskResult, loadLatestRisk } from '../lib/riskDb';
import { useAuth } from '../contexts/AuthContext';
import type { RiskAnswer, RiskResult } from '../types/risk';
import { SEOHead } from '../components/seo/SEOHead';
import { JsonLd } from '../components/seo/JsonLd';
import { softwareApplicationSchema } from '../lib/seo/schemas';

type Phase =
  | 'loading'
  | 'simple_only_redirect'
  | 'questions'
  | 'section_transition'
  | 'auth_gate'
  | 'result';

const TOTAL_QUESTIONS = DETAIL_TOTAL_QUESTIONS;
const CAPACITY_COUNT = DETAIL_CAPACITY_QUESTIONS.length;

export default function RiskPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [phase, setPhase] = useState<Phase>('loading');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(RiskAnswer | null)[]>(
    () => new Array(TOTAL_QUESTIONS).fill(null)
  );
  const [result, setResult] = useState<RiskResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);

  const currentQuestion = RISK_DETAIL_QUESTIONS[questionIndex];
  const selectedAnswer = answers[questionIndex];

  // 初期判定: ログイン済みで過去 version='simple' のみのユーザーは強制リダイレクト画面に遷移
  // マジックリンク復元中（show_result=1）は別 useEffect で処理するため、ここではスキップ
  useEffect(() => {
    if (authLoading) return;
    if (phase !== 'loading') return;
    if (searchParams.get('show_result') === '1' && user) return;

    if (!user) {
      setPhase('questions');
      return;
    }

    let cancelled = false;
    loadLatestRisk(user.id)
      .then((data) => {
        if (cancelled) return;
        if (data && data.version === 'simple') {
          setPhase('simple_only_redirect');
        } else {
          setPhase('questions');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPhase('questions');
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, phase, searchParams]);

  // マジックリンクから着地（?show_result=1）
  useEffect(() => {
    if (authLoading || restored) return;
    if (searchParams.get('show_result') !== '1') return;
    if (!user) return;

    const saved = loadAnswersFromStorage();
    if (saved && saved.length === TOTAL_QUESTIONS) {
      setRestored(true);
      const res = calculateDetailResult(saved);
      setResult(res);
      setPhase('result');
      if (!user.user_metadata?.full_name && !user.user_metadata?.nickname_skipped) {
        setShowNicknameModal(true);
      }

      setSaving(true);
      saveRiskResult(
        user.id, res.capacityScore, res.toleranceScore, res.finalLevel, saved, 'detail'
      ).then(() => {
        setSaving(false);
        clearAnswersStorage();
      });

      setSearchParams({}, { replace: true });
    } else {
      // 復元データ無効（localStorage 空 / 長さ不一致 / 別ブラウザ着地など）
      // URL から show_result を消し、初期判定 useEffect の通常フロー
      // （loadLatestRisk → simple_only_redirect or questions）に委ねる
      setRestored(true);
      setSearchParams({}, { replace: true });
    }
  }, [authLoading, user, searchParams, restored, setSearchParams]);

  const showResult = useCallback(
    async (validAnswers: RiskAnswer[]) => {
      const res = calculateDetailResult(validAnswers);
      setResult(res);
      setPhase('result');
      if (user && !user.user_metadata?.full_name && !user.user_metadata?.nickname_skipped) {
        setShowNicknameModal(true);
      }

      if (user) {
        setSaving(true);
        await saveRiskResult(
          user.id, res.capacityScore, res.toleranceScore, res.finalLevel, validAnswers, 'detail'
        );
        setSaving(false);
      }
    },
    [user]
  );

  const startDiagnosis = useCallback(() => {
    setAnswers(new Array(TOTAL_QUESTIONS).fill(null));
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

    if (nextIndex >= TOTAL_QUESTIONS) {
      const validAnswers = answers.filter((a): a is RiskAnswer => a !== null);
      if (user) {
        showResult(validAnswers);
      } else {
        setPhase('auth_gate');
      }
      return;
    }

    if (questionIndex < CAPACITY_COUNT && nextIndex >= CAPACITY_COUNT) {
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
    setQuestionIndex(0);
    setAnswers(new Array(TOTAL_QUESTIONS).fill(null));
    setResult(null);
    setRestored(false);
    setPhase('questions');
  }, []);

  if (authLoading && searchParams.get('show_result') === '1') {
    return (
      <>
        <SEOHead
          title="リスク許容度診断｜20問で資産運用の適正レベルを判定"
          description="Risk Capacity（財務体力）とRisk Tolerance（心理耐性）の両軸で、あなたに合ったリスクレベル（1〜7）を算出します。米国大学の学術調査ベースで日本向けに設計した20問・約8〜10分。"
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
        title="リスク許容度診断｜20問で資産運用の適正レベルを判定"
        description="Risk Capacity（財務体力）とRisk Tolerance（心理耐性）の両軸で、あなたに合ったリスクレベル（1〜7）を算出します。米国大学の学術調査ベースで日本向けに設計した20問・約8〜10分。"
        canonical="/risk"
      />
      <JsonLd
        data={softwareApplicationSchema({
          name: 'リスク許容度診断',
          description:
            '20問の質問で投資家としてのリスク許容度（1〜7のレベル）を判定する診断ツール。米国大学の学術調査ベースで日本向けに設計。',
          url: '/risk',
        })}
      />
    <Layout>
      <main className="max-w-lg mx-auto px-4 py-6 md:py-10">
        {/* 初期判定中 */}
        {phase === 'loading' && (
          <p className="text-center text-sm text-gray-500 py-20">読み込み中...</p>
        )}

        {/* 過去 simple のみユーザー向け案内（強制リダイレクト UX） */}
        {phase === 'simple_only_redirect' && (
          <div className="space-y-6 py-8">
            <h1 className="text-lg md:text-xl font-bold text-gray-800">
              詳細診断（20問）に統一しています
            </h1>
            <div className="text-sm text-gray-700 leading-loose space-y-4">
              <p>以前、簡易診断を受けていただきありがとうございます。</p>
              <p>
                サイトのリニューアルに伴い、現在は詳細診断（20問・米国大学の学術調査ベース）に統一しました。
              </p>
              <p>
                過去の簡易診断結果は保管されません。お手数ですが、改めて詳細診断をお受けください。
              </p>
            </div>
            <button
              onClick={startDiagnosis}
              className="w-full bg-blue-600 text-white text-sm font-semibold rounded-lg py-3 md:py-2.5 hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              詳細診断を始める →
            </button>
          </div>
        )}

        {/* Header */}
        {phase !== 'result' && phase !== 'loading' && phase !== 'simple_only_redirect' && (
          <div className="text-center mb-6">
            <h1 className="text-lg md:text-xl font-bold text-gray-800 mb-1">
              リスク許容度診断
            </h1>
            <p className="text-xs text-gray-500">
              約8〜10分 ・ 全{TOTAL_QUESTIONS}問
            </p>
          </div>
        )}

        {/* Progress bar */}
        {(phase === 'questions' || phase === 'section_transition') && (
          <RiskProgressBar current={questionIndex + 1} total={TOTAL_QUESTIONS} />
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
