import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

// 3つの画面状態：フォーム表示 / 登録完了（確認メール送信済み） / パスワードリセット
type View = 'form' | 'registered' | 'reset' | 'resetSent';

export default function AuthGatePage() {
  const { signUp, signIn, resetPassword } = useAuth();

  // タブ: 「新規登録」か「ログイン」
  const [tab, setTab] = useState<'register' | 'login'>('register');
  const [view, setView] = useState<View>('form');

  // フォーム入力
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- 新規登録 ---
  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signUp(email, password);
    if (error) {
      setError(error.message);
    } else {
      setView('registered');
    }
    setLoading(false);
  };

  // --- ログイン ---
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
    }
    // ログイン成功時は AuthContext が user を更新 → App.tsx が自動でシミュレーターを表示
    setLoading(false);
  };

  // --- パスワードリセット ---
  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      setError(error.message);
    } else {
      setView('resetSent');
    }
    setLoading(false);
  };

  // 登録完了画面（確認メール送信済み）
  if (view === 'registered') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">✉️</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">確認メールを送信しました</h2>
          <p className="text-sm text-gray-600 mb-6">
            メール内のリンクをクリックして登録を完了してください。<br />
            メールが届かない場合は、迷惑メールフォルダもご確認ください。
          </p>
          <button
            onClick={() => {
              setView('form');
              setTab('login');
              setError('');
            }}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            ログインに戻る
          </button>
        </div>
      </div>
    );
  }

  // パスワードリセットメール送信済み画面
  if (view === 'resetSent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">📧</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">メールを送信しました</h2>
          <p className="text-sm text-gray-600 mb-6">
            パスワードリセット用のリンクを送信しました。メールをご確認ください。
          </p>
          <button
            onClick={() => {
              setView('form');
              setTab('login');
              setError('');
            }}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            ログインに戻る
          </button>
        </div>
      </div>
    );
  }

  // パスワードリセット画面
  if (view === 'reset') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-1">パスワードリセット</h2>
          <p className="text-xs text-gray-500 mb-6">登録済みのメールアドレスを入力してください</p>

          <form onSubmit={handleReset} className="space-y-4">
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
              {loading ? '送信中...' : 'リセットリンクを送信'}
            </button>
          </form>

          <p className="mt-4 text-center">
            <button
              onClick={() => {
                setView('form');
                setError('');
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              ログインに戻る
            </button>
          </p>
        </div>
      </div>
    );
  }

  // --- メイン画面：マーケティングコピー + タブ切り替えフォーム ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        {/* マーケティングコピー */}
        <div className="text-center mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-3">
            セミリタイア資産シミュレーター
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            いくらあれば辞められるか、何歳で届くか。<br />
            NISA・iDeCo・課税口座・現金の4資産クラスに対応した<br className="hidden sm:inline" />
            100歳までの資産推移シミュレーションが無料で使えます。
          </p>
          <p className="text-sm text-gray-500 mt-3">
            メールアドレスを登録してご利用ください。
          </p>
        </div>

        {/* フォームカード */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* タブ切り替え */}
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

          {/* フォーム本体 */}
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
                  : (tab === 'register' ? '無料で登録する' : 'ログイン')
                }
              </button>
            </form>

            {/* ログインタブのときだけパスワードリセットリンクを表示 */}
            {tab === 'login' && (
              <p className="mt-4 text-center">
                <button
                  onClick={() => {
                    setView('reset');
                    setError('');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  パスワードを忘れた方
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
