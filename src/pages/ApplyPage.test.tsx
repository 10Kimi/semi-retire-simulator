import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../components/Layout', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import ApplyPage from './ApplyPage';

describe('ApplyPage（同意のページ、FI_project #146）', () => {
  it('最初は同意が外れていて、「次へ」は押せない', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ApplyPage />
      </MemoryRouter>,
    );
    expect(html).toContain('利用規約に同意する');
    expect(html).toMatch(/<input[^>]*type="checkbox"(?![^>]*checked)/);
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).not.toContain('仮の行き先');
  });

  it('要点に返金・提供時期・投資助言ではないこと・全文へのリンクがある', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ApplyPage />
      </MemoryRouter>,
    );
    expect(html).toContain('返金');
    expect(html).toContain('2027年2月1日');
    expect(html).toContain('投資助言ではありません');
    expect(html).toContain('href="/terms"');
  });
});
