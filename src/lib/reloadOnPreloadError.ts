// 新しい版を出したあと、開いたままの古い画面で読み込みに失敗したら1回だけ自動で再読み込みする（FI_project #136）。
// 直近に再読み込みしたばかりなら繰り返さず、例外をそのまま出す（ErrorBoundary の受け皿に任せる）
const KEY = 'reloadedOnPreloadErrorAt';
const WINDOW_MS = 60_000;

export function shouldReload(lastReloadAt: string | null, now: number): boolean {
  const last = Number(lastReloadAt);
  return !Number.isFinite(last) || last <= 0 || now - last > WINDOW_MS;
}

export function installReloadOnPreloadError() {
  window.addEventListener('vite:preloadError', (event) => {
    let last: string | null = null;
    try {
      last = sessionStorage.getItem(KEY);
    } catch {
      return; // 記録できないときは自動で再読み込みしない（繰り返しを防げないため）
    }
    const now = Date.now();
    if (!shouldReload(last, now)) return;
    sessionStorage.setItem(KEY, String(now));
    event.preventDefault();
    window.location.reload();
  });
}
