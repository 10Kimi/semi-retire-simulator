import { describe, it, expect } from 'vitest';
import { getCapeMultiplier, getPbrMultiplier, getGsrMultiplier } from './logic';

describe('getCapeMultiplier', () => {
  // 絶対水準チェック
  it('CAPE > 42 → 0.5x 歴史的バブル級', () => {
    const r = getCapeMultiplier(43, 35);
    expect(r.multiplier).toBe(0.5);
    expect(r.level).toBe('extreme');
  });

  it('CAPE = 42 → 5年MAで相対評価（絶対水準チェック対象外）', () => {
    const r = getCapeMultiplier(42, 35);
    expect(r.multiplier).not.toBe(0.5); // >42 ではないので extreme にならない
  });

  it('CAPE > 38 かつ ≤ 42 → 0.75x 要警戒', () => {
    const r = getCapeMultiplier(39, 35);
    expect(r.multiplier).toBe(0.75);
    expect(r.level).toBe('very-high');
  });

  it('CAPE = 38 → 5年MAで相対評価', () => {
    const r = getCapeMultiplier(38, 35);
    expect(r.level).not.toBe('very-high');
  });

  // 5年MA乖離率
  it('乖離率 > +20% → 0.5x かなり割高', () => {
    const r = getCapeMultiplier(37, 30); // (37-30)/30 = +23.3%
    expect(r.multiplier).toBe(0.5);
    expect(r.level).toBe('very-high');
  });

  it('乖離率 +10〜+20% → 0.75x 割高', () => {
    const r = getCapeMultiplier(34, 30); // (34-30)/30 = +13.3%
    expect(r.multiplier).toBe(0.75);
    expect(r.level).toBe('high');
  });

  it('乖離率 -10〜+10% → 1.0x 適正', () => {
    const r = getCapeMultiplier(31, 30); // (31-30)/30 = +3.3%
    expect(r.multiplier).toBe(1.0);
    expect(r.level).toBe('normal');
  });

  it('乖離率 -20〜-10% → 1.25x 割安', () => {
    const r = getCapeMultiplier(25, 30); // (25-30)/30 = -16.7%
    expect(r.multiplier).toBe(1.25);
    expect(r.level).toBe('low');
  });

  it('乖離率 < -20% → 1.5x かなり割安', () => {
    const r = getCapeMultiplier(22, 30); // (22-30)/30 = -26.7%
    expect(r.multiplier).toBe(1.5);
    expect(r.level).toBe('very-low');
  });

  // 5年MAなし（フォールバック）
  it('5年MAなし＆CAPE > 35 → 0.5x', () => {
    expect(getCapeMultiplier(36, null).multiplier).toBe(0.5);
  });

  it('5年MAなし＆CAPE 20〜30 → 1.0x', () => {
    expect(getCapeMultiplier(25, null).multiplier).toBe(1.0);
  });

  it('5年MAなし＆CAPE < 15 → 1.5x', () => {
    expect(getCapeMultiplier(14, null).multiplier).toBe(1.5);
  });
});

describe('getPbrMultiplier', () => {
  it('PBR >= 1.8 → 0.75x 割高', () => {
    expect(getPbrMultiplier(1.8).multiplier).toBe(0.75);
    expect(getPbrMultiplier(2.0).multiplier).toBe(0.75);
  });

  it('PBR 1.2〜1.8 → 1.0x 適正', () => {
    expect(getPbrMultiplier(1.2).multiplier).toBe(1.0);
    expect(getPbrMultiplier(1.5).multiplier).toBe(1.0);
    expect(getPbrMultiplier(1.79).multiplier).toBe(1.0);
  });

  it('PBR 1.0〜1.2 → 1.25x 割安', () => {
    expect(getPbrMultiplier(1.0).multiplier).toBe(1.25);
    expect(getPbrMultiplier(1.1).multiplier).toBe(1.25);
  });

  it('PBR < 1.0 → 1.5x 大バーゲン', () => {
    expect(getPbrMultiplier(0.9).multiplier).toBe(1.5);
    expect(getPbrMultiplier(0.5).multiplier).toBe(1.5);
  });
});

describe('getGsrMultiplier', () => {
  it('GSR >= 90 → 0.5x 極端に割高', () => {
    expect(getGsrMultiplier(90).multiplier).toBe(0.5);
    expect(getGsrMultiplier(100).multiplier).toBe(0.5);
  });

  it('GSR 75〜90 → 0.75x 割高', () => {
    expect(getGsrMultiplier(75).multiplier).toBe(0.75);
    expect(getGsrMultiplier(89).multiplier).toBe(0.75);
  });

  it('GSR 50〜75 → 1.0x 適正', () => {
    expect(getGsrMultiplier(50).multiplier).toBe(1.0);
    expect(getGsrMultiplier(60).multiplier).toBe(1.0);
    expect(getGsrMultiplier(74).multiplier).toBe(1.0);
  });

  it('GSR 40〜50 → 1.25x 割安', () => {
    expect(getGsrMultiplier(40).multiplier).toBe(1.25);
    expect(getGsrMultiplier(49).multiplier).toBe(1.25);
  });

  it('GSR < 40 → 1.5x 大バーゲン', () => {
    expect(getGsrMultiplier(39).multiplier).toBe(1.5);
    expect(getGsrMultiplier(20).multiplier).toBe(1.5);
  });
});
