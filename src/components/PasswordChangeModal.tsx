import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onClose: () => void;
}

/**
 * ログイン中のユーザーがパスワードを変更するモーダル。
 *
 * リセットメール経由でしか変更できなかったため、リカバリリンクでログインした人が
 * 「ログインはできたがパスワードは分からない」状態のまま、もう一度メールを
 * 発行し直す往復が発生していた（2026-08-03 追加）。
 *
 * 現在のパスワードは要求しない。上記のリカバリ直後のケースでは本人が
 * 現在のパスワードを知らないため、要求すると変更できなくなる。
 */
export default function PasswordChangeModal({ onClose }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('パスワードが一致しません');
      return;
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上にしてください');
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2">パスワードの変更</h2>

        {done ? (
          <>
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-4">
              パスワードを変更しました。次回のログインから新しいパスワードを使ってください。
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 md:py-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 min-h-[44px]"
            >
              閉じる
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4">
              新しいパスワードを設定します。有料プランの状態は変わりません。
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-700 mb-1">新しいパスワード</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  autoFocus
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="6文字以上"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">新しいパスワード（確認）</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 py-3 md:py-2 text-sm text-gray-500 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 min-h-[44px]"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 md:py-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
                >
                  {saving ? '変更中...' : '変更する'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
