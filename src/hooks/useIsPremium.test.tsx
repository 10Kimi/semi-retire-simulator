import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// 最初の描画（読み終える前）で「無料・読み込み済み」を返さないこと（FI_project #101）
const auth = { user: { id: 'u1' } as { id: string } | null, loading: false };
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => auth,
}));
vi.mock('../lib/supabase', () => ({
  supabase: {},
}));

import { useIsPremium } from './useIsPremium';

function Probe() {
  const { isPremium, loading } = useIsPremium();
  return <span>{`premium=${isPremium} loading=${loading}`}</span>;
}

describe('useIsPremium の最初の描画', () => {
  it('ログイン済みでも、読み終えるまでは loading', () => {
    auth.user = { id: 'u1' };
    auth.loading = false;
    expect(renderToStaticMarkup(<Probe />)).toContain('premium=false loading=true');
  });

  it('ログインの確認中も loading', () => {
    auth.user = null;
    auth.loading = true;
    expect(renderToStaticMarkup(<Probe />)).toContain('loading=true');
  });
});
