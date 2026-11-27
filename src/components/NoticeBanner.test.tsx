import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NoticeBanner, { parseNotice } from './NoticeBanner';

describe('parseNotice（お知らせのファイル、FI_project #136）', () => {
  it('message に文があれば返す', () => {
    expect(parseNotice('{"message":"12/3 の夜にメンテナンスします"}')).toBe('12/3 の夜にメンテナンスします');
  });

  it('空のときは何も出さない', () => {
    expect(parseNotice('{"message":""}')).toBeNull();
    expect(parseNotice('{"message":"   "}')).toBeNull();
    expect(parseNotice('{}')).toBeNull();
    expect(parseNotice('')).toBeNull();
  });

  it('壊れているときは何も出さない', () => {
    expect(parseNotice('{"message":')).toBeNull();
    expect(parseNotice('null')).toBeNull();
    expect(parseNotice('{"message":123}')).toBeNull();
  });

  it('ファイルが無い（rewrites で index.html が返る）ときは何も出さない', () => {
    expect(parseNotice('<!doctype html><html><body></body></html>')).toBeNull();
  });

  it('読み終える前の最初の描画では帯を出さない', () => {
    expect(renderToStaticMarkup(<NoticeBanner />)).toBe('');
  });
});
