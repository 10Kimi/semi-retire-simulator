import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { redeemInviteCode } from '../lib/inviteDb';

interface Props {
  onSuccess: () => void;
  onClose: () => void;
}

export default function InviteCodeModal({ onSuccess, onClose }: Props) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!user || !code.trim()) return;
    setLoading(true);
    setMessage('');

    const result = await redeemInviteCode(user.id, code);
    setMessage(result.message);
    setSuccess(result.success);
    setLoading(false);

    if (result.success) {
      setTimeout(() => onSuccess(), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2">招待コードを入力</h2>
        <p className="text-xs text-gray-500 mb-4">招待コードをお持ちの方は入力してください。</p>

        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="例: FIRE-XXXX-XXXX"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3 focus:border-blue-500 focus:outline-none"
          autoFocus
          disabled={success}
        />

        {message && (
          <p className={`text-sm mb-3 ${success ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 md:py-2 text-sm text-gray-500 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 min-h-[44px]"
          >
            閉じる
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !code.trim() || success}
            className="flex-1 py-3 md:py-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
          >
            {loading ? '認証中...' : '認証'}
          </button>
        </div>
      </div>
    </div>
  );
}
