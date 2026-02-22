import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  onSwitchToLogin: () => void;
}

export default function ResetPassword({ onSwitchToLogin }: Props) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <h2 className="text-lg font-bold text-gray-800 mb-2">メールを送信しました</h2>
          <p className="text-sm text-gray-600 mb-4">
            パスワードリセット用のリンクを送信しました。メールをご確認ください。
          </p>
          <button onClick={onSwitchToLogin} className="text-sm text-blue-600 hover:text-blue-800">
            ログインに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-lg font-bold text-gray-800 mb-1">パスワードリセット</h1>
        <p className="text-xs text-gray-500 mb-6">登録済みのメールアドレスを入力してください</p>

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
            className="w-full bg-blue-600 text-white rounded py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '送信中...' : 'リセットリンクを送信'}
          </button>
        </form>

        <p className="mt-4 text-center">
          <button onClick={onSwitchToLogin} className="text-xs text-blue-600 hover:text-blue-800">
            ログインに戻る
          </button>
        </p>
      </div>
    </div>
  );
}
