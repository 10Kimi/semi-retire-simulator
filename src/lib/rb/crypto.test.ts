import { describe, it, expect } from 'vitest';
import { isCryptoHolding } from './crypto';

describe('isCryptoHolding', () => {
  it('交換業者名は全角・空白・大文字小文字の違いがあっても一致する', () => {
    expect(isCryptoHolding('日本円', 'bitFlyer')).toBe(true);
    expect(isCryptoHolding('日本円', 'ＢＩＴＦＬＹＥＲ')).toBe(true);
    expect(isCryptoHolding('日本円', 'bit flyer')).toBe(true);
    expect(isCryptoHolding('日本円', 'SBIVCトレード')).toBe(true);
    expect(isCryptoHolding('日本円', 'ＧＭＯ コイン')).toBe(true);
    expect(isCryptoHolding('日本円', 'binance japan')).toBe(true);
    expect(isCryptoHolding('日本円', 'LINE　BITMAX')).toBe(true);
  });

  it('カタカナの通貨名は名前に含まれていれば一致', () => {
    expect(isCryptoHolding('ビットコイン', '架空ウォレット')).toBe(true);
    expect(isCryptoHolding('イーサ リアム', '')).toBe(true);
    expect(isCryptoHolding('リップル残高', '')).toBe(true);
  });

  it('英字の通貨名は前後が英字でないときだけ一致', () => {
    expect(isCryptoHolding('BTC', '')).toBe(true);
    expect(isCryptoHolding('BTC/JPY', '')).toBe(true);
    expect(isCryptoHolding('ビットコイン(BTC)', '')).toBe(true);
    expect(isCryptoHolding('ｘｒｐ', '')).toBe(true);
    expect(isCryptoHolding('ABC ETH', '')).toBe(true);
    expect(isCryptoHolding('ETHICAL', '')).toBe(false);
    expect(isCryptoHolding('サンプルBTCX口座', '')).toBe(false);
  });

  it('普通の銀行預金・カードは一致しない', () => {
    expect(isCryptoHolding('サンプル銀行 普通預金', 'サンプル銀行')).toBe(false);
    expect(isCryptoHolding('サンプルカード 未払い分', 'サンプルカード')).toBe(false);
    expect(isCryptoHolding('楽天銀行 普通預金', '楽天銀行')).toBe(false);
    expect(isCryptoHolding('', '')).toBe(false);
  });
});
