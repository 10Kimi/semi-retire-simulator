import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  onSwitchToRegister: () => void;
  onSwitchToReset: () => void;
}

export default function LoginForm({ onSwitchToRegister, onSwitchToReset }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-lg font-bold text-gray-800 mb-1">ログイン</h1>
        <p className="text-xs text-gray-500 mb-6">Semi-Retire Simulator</p>

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
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          <button onClick={onSwitchToReset} className="text-xs text-blue-600 hover:text-blue-800 block mx-auto">
            パスワードを忘れた方
          </button>
          <p className="text-xs text-gray-500">
            アカウントをお持ちでない方{' '}
            <button onClick={onSwitchToRegister} className="text-blue-600 hover:text-blue-800">
              新規登録
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
