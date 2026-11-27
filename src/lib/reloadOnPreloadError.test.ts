import { describe, it, expect } from 'vitest';
import { shouldReload } from './reloadOnPreloadError';

describe('shouldReload（読み込みの失敗で再読み込みするか、FI_project #136）', () => {
  const now = 1_000_000_000;
  it('まだ再読み込みしていなければする', () => {
    expect(shouldReload(null, now)).toBe(true);
    expect(shouldReload('壊れた値', now)).toBe(true);
  });
  it('直近（60秒以内）に再読み込みしていれば繰り返さない', () => {
    expect(shouldReload(String(now - 10_000), now)).toBe(false);
  });
  it('60秒より前なら、もう一度してよい', () => {
    expect(shouldReload(String(now - 61_000), now)).toBe(true);
  });
});
