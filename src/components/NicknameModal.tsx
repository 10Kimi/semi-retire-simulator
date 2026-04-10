import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onDone: () => void;
}

export default function NicknameModal({ onDone }: Props) {
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nickname.trim()) return;
    setSaving(true);
    await supabase.auth.updateUser({
      data: { full_name: nickname.trim() },
    });
    setSaving(false);
    onDone();
  };

  const handleSkip = async () => {
    setSaving(true);
    await supabase.auth.updateUser({
      data: { nickname_skipped: true },
    });
    setSaving(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2">
          どのようにお呼びすればいいですか？
        </h2>
        <p className="text-xs text-gray-500 mb-4">任意です。スキップもできます。</p>

        <input
          type="text"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          placeholder="例: きみ"
          maxLength={30}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4 focus:border-blue-500 focus:outline-none"
          autoFocus
        />

        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            disabled={saving}
            className="flex-1 py-3 md:py-2 text-sm text-gray-500 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 min-h-[44px]"
          >
            スキップ
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !nickname.trim()}
            className="flex-1 py-3 md:py-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
          >
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}
