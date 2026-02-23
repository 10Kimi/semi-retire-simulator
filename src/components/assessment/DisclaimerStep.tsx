import { useState, useEffect } from 'react';
import { useAssessment } from '../../contexts/AssessmentContext';
import { useAuth } from '../../contexts/AuthContext';
import { hasUserConsented, saveConsent } from '../../lib/assessmentDb';

export default function DisclaimerStep() {
  const { setConsented, setStep } = useAssessment();
  const { user } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if user already consented
  useEffect(() => {
    if (!user) return;
    hasUserConsented(user.id).then((consented) => {
      if (consented) {
        setConsented(true);
        setStep(1);
      }
      setChecking(false);
    });
  }, [user, setConsented, setStep]);

  const handleAgree = async () => {
    if (user) {
      await saveConsent(user.id);
    }
    setConsented(true);
    setStep(1);
  };

  if (checking) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">
          リスク許容度診断をご利用いただく前に
        </h2>

        <div className="bg-gray-50 rounded-lg p-5 mb-6 space-y-4 text-sm text-gray-700 leading-relaxed">
          <p>本診断について以下をご理解・ご了承ください。</p>

          <div className="space-y-3">
            <p>
              <span className="font-semibold">■</span>{' '}
              本診断は情報提供を目的としており、投資勧誘・投資助言を目的としたものではありません。
            </p>
            <p>
              <span className="font-semibold">■</span>{' '}
              推奨ポートフォリオ配分および期待リターンは、過去の市場データに基づく統計的な算出結果であり、将来のリターンを保証するものではありません。
            </p>
            <p>
              <span className="font-semibold">■</span>{' '}
              投資にはリスクが伴い、元本を割り込む可能性があります。投資の最終判断はご自身の責任で行ってください。
            </p>
            <p>
              <span className="font-semibold">■</span>{' '}
              本診断の結果は、ご入力いただいた情報に基づく簡易的な評価です。個別の財務状況に応じた詳細な判断が必要な場合は、ファイナンシャルプランナー等の専門家にご相談ください。
            </p>
            <p>
              <span className="font-semibold">■</span>{' '}
              入力データはアカウントに紐づけて保存されます。
            </p>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer mb-4 p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 font-medium">上記の内容を理解し、同意します</span>
        </label>

        <button
          onClick={handleAgree}
          disabled={!agreed}
          className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors min-h-[44px] ${
            agreed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          同意して診断を開始する
        </button>
      </div>
    </div>
  );
}
