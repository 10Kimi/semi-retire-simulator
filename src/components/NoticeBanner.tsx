import { useEffect, useState } from 'react';

// お知らせ帯（FI_project #136）。public/notice.json の message に文があれば画面の上に出す。
// 無い・空・壊れている（rewrites で index.html が返るときを含む）なら何も出さない
export function parseNotice(text: string): string | null {
  try {
    const data: unknown = JSON.parse(text);
    if (typeof data !== 'object' || data === null) return null;
    const message = (data as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() !== '' ? message.trim() : null;
  } catch {
    return null;
  }
}

export default function NoticeBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // 古いお知らせがキャッシュに残らないよう、毎回取り直す
    fetch(`/notice.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.text() : ''))
      .then((text) => setMessage(parseNotice(text)))
      .catch(() => setMessage(null));
  }, []);

  if (!message) return null;
  return (
    <div role="status" className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-900">
      {message}
    </div>
  );
}
