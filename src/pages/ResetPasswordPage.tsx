import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';

/**
 * パスワード再設定ページ（/reset-password）
 *
 * リセットメールのリンク先。implicit フローなので URL ハッシュに
 * access_token / type=recovery が付いて戻り、detectSessionInUrl が
 * セッションを張る（PASSWORD_RECOVERY イベント）。
 * そのセッションで updateUser({ password }) を実行して再設定する。
 *
 * これが無かったため、リンクを踏んでもトップのログイン画面に戻され、
 * 永久にループしていた（2026-08-03 修正）。
 */

type Phase = 'checking' | 'ready' | 'invalid' | 'done';

export default function ResetPasswordPage() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let settled = false;

    // リカバリ用セッションが張られたら入力可能にする
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        settled = true;
        setPhase('ready');
      }
    });

    // すでにセッションがある場合（イベントを取り逃した場合の保険）
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        settled = true;
        setPhase('ready');
      }
    });

    // URL にリンク自体のエラーが載っているケース（期限切れ・使用済み）
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const linkError = hash.get('error_description') || query.get('error_description');
    if (linkError) {
      settled = true;
      setPhase('invalid');
      setError(linkError);
    }

    // トークンの取り込みは非同期。少し待っても駄目なら無効扱い
    const timer = setTimeout(() => {
      if (!settled) setPhase('invalid');
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

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
    setPhase('done');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-lg font-bold text-gray-800 mb-1">パスワードの再設定</h1>
        <p className="text-xs text-gray-500 mb-6">Semi-Retire Simulator</p>

        {phase === 'checking' && (
          <p className="text-sm text-gray-500">リンクを確認しています...</p>
        )}

        {phase === 'invalid' && (
          <div className="space-y-4">
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error || 'このリンクは無効か、有効期限が切れています。'}
            </div>
            <p className="text-xs text-gray-600">
              お手数ですが、ログイン画面の「パスワードを忘れた方」からもう一度お試しください。
              リンクは発行から一定時間で失効し、一度使うと再利用できません。
            </p>
            <a
              href="/"
              className="block w-full bg-blue-600 text-white rounded py-3 md:py-2 text-sm font-semibold text-center hover:bg-blue-700 min-h-[44px]"
            >
              ログイン画面へ
            </a>
          </div>
        )}

        {phase === 'ready' && (
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
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
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
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 text-white rounded py-3 md:py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
            >
              {saving ? '変更中...' : 'パスワードを変更する'}
            </button>
          </form>
        )}

        {phase === 'done' && (
          <div className="space-y-4">
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              パスワードを変更しました。
            </div>
            <a
              href="/"
              className="block w-full bg-blue-600 text-white rounded py-3 md:py-2 text-sm font-semibold text-center hover:bg-blue-700 min-h-[44px]"
            >
              ツールへ進む
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
