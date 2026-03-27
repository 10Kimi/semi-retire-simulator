import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  onAuthenticated: () => void;
}

export default function RiskAuthGate({ onAuthenticated }: Props) {
  const { signUp, signIn } = useAuth();
  const [tab, setTab] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signUp(email, password);
    if (error) {
      setError(error.message);
    } else {
      setRegistered(true);
    }
    setLoading(false);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
    } else {
      onAuthenticated();
    }
    setLoading(false);
  };

  if (registered) {
    return (
      <div className="text-center py-8 animate-fade-in">
        <div className="text-4xl mb-4">
          <span role="img" aria-label="mail">✉️</span>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">確認メールを送信しました</h2>
        <p className="text-sm text-gray-600 mb-6">
          メール内のリンクをクリックして登録を完了してください。<br />
          完了後、こちらに戻って「ログイン」してください。
        </p>
        <button
          onClick={() => {
            setRegistered(false);
            setTab('login');
            setError('');
          }}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          ログインに戻る
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
          メールアドレスを登録すると、結果が保存され、いつでも見返すことができます。
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setTab('register'); setError(''); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === 'register'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700 bg-gray-50'
            }`}
          >
            新規登録
          </button>
          <button
            onClick={() => { setTab('login'); setError(''); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === 'login'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700 bg-gray-50'
            }`}
          >
            ログイン
          </button>
        </div>

        <div className="p-6">
          <form
            onSubmit={tab === 'register' ? handleRegister : handleLogin}
            className="space-y-4"
          >
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
            <div>
              <label className="block text-sm text-gray-700 mb-1">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              {tab === 'register' && (
                <p className="text-xs text-gray-400 mt-1">6文字以上</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded py-3 md:py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
            >
              {loading
                ? (tab === 'register' ? '登録中...' : 'ログイン中...')
                : (tab === 'register' ? '無料で登録して結果を見る' : 'ログインして結果を見る')
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
