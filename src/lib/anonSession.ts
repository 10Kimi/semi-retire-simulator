/**
 * 匿名セッションID（UUID v4）の発行・取得
 *
 * SEO 計測用。ブラウザの localStorage に保存して同一ブラウザの再訪問を識別する。
 * 個人特定情報は含まない（純粋な UUID v4 のみ）。
 * ユーザーが localStorage を削除すれば ID もリセットされる。
 */

const STORAGE_KEY = 'fire_anon_session_id';

/**
 * 匿名セッションIDを取得する。
 * localStorage に保存されていれば再利用、無ければ新規発行して保存する。
 *
 * localStorage が利用不可（プライベートブラウジング等）の場合は
 * 揮発IDを返す（ページリロードで変わる）。
 */
export function getAnonSessionId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * リファラーのホスト名のみを抽出する（クエリ文字列・パスは含まない）。
 * 検索クエリ漏洩防止のため、フルURLではなくホスト名のみ保存する設計。
 *
 * 同一オリジン（自サイト内遷移）は null を返し、外部流入のみ記録する。
 */
export function getReferrerHost(): string | null {
  if (typeof document === 'undefined') return null;
  const ref = document.referrer;
  if (!ref) return null;
  try {
    const url = new URL(ref);
    if (url.hostname === window.location.hostname) return null;
    return url.hostname;
  } catch {
    return null;
  }
}
