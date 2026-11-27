import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ErrorBoundary from './ErrorBoundary';

// renderToStaticMarkup は例外の受け皿を動かさないので、React が呼ぶ順（getDerivedStateFromError → render）をなぞる（FI_project #136）
function renderAfterChildThrows() {
  const boundary = new ErrorBoundary({ children: <p>中身</p> });
  boundary.state = ErrorBoundary.getDerivedStateFromError();
  return renderToStaticMarkup(<>{boundary.render()}</>);
}

describe('ErrorBoundary', () => {
  it('例外が無ければ子をそのまま出す', () => {
    expect(renderToStaticMarkup(<ErrorBoundary><p>中身</p></ErrorBoundary>)).toBe('<p>中身</p>');
  });

  it('子が例外を出したら、真っ白にせず受け皿と再読み込みのボタンを出す', () => {
    const html = renderAfterChildThrows();
    expect(html).toContain('問題が起きました');
    expect(html).toContain('ページを再読み込み');
    expect(html).not.toContain('中身');
  });
});
