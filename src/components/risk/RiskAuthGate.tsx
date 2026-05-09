import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { RiskAnswer } from '../../types/risk';

const STORAGE_KEY = 'risk_simple_answers';

/** 回答データをlocalStorageに保存（OTP送信前に呼ぶ） */
export function saveAnswersToStorage(answers: RiskAnswer[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  } catch { /* quota exceeded etc. — ignore */ }
}

/** localStorageから回答データを復元（マジックリンク着地時に呼ぶ） */
export function loadAnswersFromStorage(): RiskAnswer[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RiskAnswer[];
  } catch {
    return null;
  }
}

/** 復元後にクリーンアップ */
export function clearAnswersStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

interface Props {
  answers: RiskAnswer[];
  onAuthenticated: () => void;
}

export default function RiskAuthGate({ answers, onAuthenticated }: Props) {
  const { user, signInWithOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // 既にログイン済みならすぐ結果表示へ
  if (user) {
    onAuthenticated();
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 回答をlocalStorageに保存してからOTP送信
    saveAnswersToStorage(answers);

    const { error } = await signInWithOtp(email, '/risk?show_result=1');
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="text-center py-8 animate-fade-in">
        <div className="text-4xl mb-4">
          <span role="img" aria-label="mail">✉️</span>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">
          ログインリンクを送信しました
        </h2>
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium">{email}</span> にメールを送信しました。
        </p>
        <p className="text-sm text-gray-600 mb-6">
          メール内のリンクをクリックすると、診断結果が表示されます。<br />
          届かない場合は迷惑メールフォルダもご確認ください。
        </p>
        <button
          onClick={() => {
            setSent(false);
            setError('');
          }}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          メールアドレスを変更する
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">
          <span role="img" aria-label="lock">🔐</span>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">
          診断結果を見るには登録が必要です
        </h2>
        <p className="text-xs text-gray-500">
          メールアドレスを入力すると、ログインリンクが届きます。<br />
          パスワードの設定は不要です。
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="email@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded py-3 md:py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
          >
            {loading ? '送信中...' : 'ログインリンクを送信'}
          </button>
        </form>
      </div>
    </div>
  );
}
