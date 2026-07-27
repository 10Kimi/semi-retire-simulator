import { describe, it, expect } from 'vitest';
import { getCapeMultiplier, getPbrMultiplier, getGsrMultiplier, calculateAllocation } from './logic';
import type { UserMaSettings, MaAssetClass } from './types';

/** テスト用ヘルパー: スロットを 1 行で構築（5〜7 個。未指定分は none/0） */
function buildSettings(
  monthly_budget: number,
  reserve_balance: number,
  slots: { amount: number; ac: MaAssetClass }[],
): UserMaSettings {
  const empty = { amount: 0, fund_name: '', asset_class: 'none' as MaAssetClass };
  const toSlot = (s?: { amount: number; ac: MaAssetClass }) =>
    s ? { amount: s.amount, fund_name: '', asset_class: s.ac } : empty;
  const [s1, s2, s3, s4, s5, s6, s7] = slots;
  return {
    user_id: 'test',
    monthly_budget,
    reserve_balance,
    slot1: toSlot(s1),
    slot2: toSlot(s2),
    slot3: toSlot(s3),
    slot4: toSlot(s4),
    slot5: toSlot(s5),
    slot6: toSlot(s6),
    slot7: toSlot(s7),
  };
}

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

describe('calculateAllocation (per-slot multiplier、migration 031 後の新構造)', () => {
  // CAPE=30 / PBR=1.5 / GSR=60 / 全 momentum true / mode='neutral' を共通の「適正」シナリオに使う
  const FAIR_CAPE = 30;
  const FAIR_PBR = 1.5;
  const FAIR_GSR = 60;
  const CAPE5Y = 30; // 乖離 0% → 1.0x

  it('全スロット asset_class=none → 月次予算がそのまま固定積立される', () => {
    const settings = buildSettings(1_000_000, 0, [
      { amount: 200_000, ac: 'none' },
      { amount: 200_000, ac: 'none' },
      { amount: 200_000, ac: 'none' },
      { amount: 200_000, ac: 'none' },
      { amount: 200_000, ac: 'none' },
    ]);
    const r = calculateAllocation(FAIR_CAPE, FAIR_PBR, FAIR_GSR, true, true, true, true, CAPE5Y, settings, 'neutral');
    expect(r.perSlotAmount).toEqual([200_000, 200_000, 200_000, 200_000, 200_000, 0, 0]);
    expect(r.totalInvest).toBe(1_000_000);
    expect(r.monthlyReserve).toBe(0);
  });

  it('適正水準 + neutral mode で us/jp/em/gold/bond 各スロットが等倍', () => {
    const settings = buildSettings(500_000, 0, [
      { amount: 100_000, ac: 'us' },
      { amount: 100_000, ac: 'jp' },
      { amount: 100_000, ac: 'em' },
      { amount: 100_000, ac: 'gold' },
      { amount: 100_000, ac: 'bond' },
    ]);
    const r = calculateAllocation(FAIR_CAPE, FAIR_PBR, FAIR_GSR, true, true, true, true, CAPE5Y, settings, 'neutral');
    // 全 multiplier=1.0 なので各 100K のまま
    expect(r.perSlotAmount).toEqual([100_000, 100_000, 100_000, 100_000, 100_000, 0, 0]);
  });

  it('us 割高 (CAPE=37, 乖離 +23%) で us スロットだけ 0.5x', () => {
    const settings = buildSettings(500_000, 0, [
      { amount: 100_000, ac: 'us' },
      { amount: 100_000, ac: 'jp' },
      { amount: 100_000, ac: 'em' },
      { amount: 100_000, ac: 'gold' },
      { amount: 100_000, ac: 'bond' },
    ]);
    const r = calculateAllocation(37, FAIR_PBR, FAIR_GSR, true, true, true, true, 30, settings, 'neutral');
    expect(r.perSlotAmount[0]).toBe(50_000); // us 0.5x
    expect(r.perSlotAmount[1]).toBe(100_000); // jp 影響なし
    expect(r.perSlotAmount[2]).toBe(100_000); // em 影響なし
    expect(r.perSlotAmount[3]).toBe(100_000); // gold 影響なし
    expect(r.perSlotAmount[4]).toBe(100_000); // bond 影響なし
  });

  it('em は momentumEM=false で 0.5x、true で 1.0x（バリュエーション無し）', () => {
    const settings = buildSettings(200_000, 0, [
      { amount: 100_000, ac: 'em' },
      { amount: 100_000, ac: 'none' },
      { amount: 0, ac: 'none' },
      { amount: 0, ac: 'none' },
      { amount: 0, ac: 'none' },
    ]);
    const r1 = calculateAllocation(FAIR_CAPE, FAIR_PBR, FAIR_GSR, true, true, false, true, CAPE5Y, settings, 'neutral');
    expect(r1.perSlotAmount[0]).toBe(50_000);
    const r2 = calculateAllocation(FAIR_CAPE, FAIR_PBR, FAIR_GSR, true, true, true, true, CAPE5Y, settings, 'neutral');
    expect(r2.perSlotAmount[0]).toBe(100_000);
  });

  it('Q3 案B: mode=bullish で us/jp/em/gold は +0.25、bond/none は補正なし', () => {
    const settings = buildSettings(500_000, 0, [
      { amount: 100_000, ac: 'us' },
      { amount: 100_000, ac: 'jp' },
      { amount: 100_000, ac: 'em' },
      { amount: 100_000, ac: 'bond' },
      { amount: 100_000, ac: 'none' },
    ]);
    const r = calculateAllocation(FAIR_CAPE, FAIR_PBR, FAIR_GSR, true, true, true, true, CAPE5Y, settings, 'bullish');
    // us: 1.0 + 0.25 = 1.25 → 100K × 1.25 = 125K、1万円単位で half-up 丸めで 130K
    expect(r.perSlotAmount[0]).toBe(130_000);
    // jp: PBR=1.5(1.0x) + 0.25 = 1.25 → 130K（同上）
    expect(r.perSlotAmount[1]).toBe(130_000);
    // em: 1.0 + 0.25 = 1.25 → 130K（同上）
    expect(r.perSlotAmount[2]).toBe(130_000);
    // bond: 補正なし → 100K
    expect(r.perSlotAmount[3]).toBe(100_000);
    // none: 補正なし → 100K
    expect(r.perSlotAmount[4]).toBe(100_000);
  });

  it('待機資金投入: CAPE 割安 (level=low) 時、最初に asset_class=us のスロットに reserve × 25% を加算', () => {
    const settings = buildSettings(500_000, 1_000_000 /* reserve */, [
      { amount: 100_000, ac: 'jp' }, // us じゃない
      { amount: 100_000, ac: 'us' }, // ★ 最初の us slot
      { amount: 100_000, ac: 'us' }, // 2 つ目の us（投入対象ではない）
      { amount: 100_000, ac: 'gold' },
      { amount: 100_000, ac: 'bond' },
    ]);
    // CAPE 5y MA から -16.7% 乖離 → level='low' → 1.25x、reserve × 0.25 = 250K 投入
    const r = calculateAllocation(25, FAIR_PBR, FAIR_GSR, true, true, true, true, 30, settings, 'neutral');
    expect(r.perSlotAmount[0]).toBe(100_000); // jp 影響なし
    // 100K × 1.25 = 125K → 1万円 half-up 丸めで 130K + reserve 250K = 380K
    expect(r.perSlotAmount[1]).toBe(380_000);
    expect(r.perSlotAmount[2]).toBe(130_000); // 2 つ目の us は乗数だけ
    expect(r.reserveDeployment).toBe(250_000);
    expect(r.newReserveBalance).toBe(1_000_000 - 250_000); // monthlyReserve=0 を仮定
  });

  it('待機資金投入: us スロットが 1 つも無ければ reserveDeployment=0、待機残高は維持', () => {
    const settings = buildSettings(500_000, 1_000_000, [
      { amount: 100_000, ac: 'jp' },
      { amount: 100_000, ac: 'em' },
      { amount: 100_000, ac: 'gold' },
      { amount: 100_000, ac: 'bond' },
      { amount: 100_000, ac: 'none' },
    ]);
    const r = calculateAllocation(25, FAIR_PBR, FAIR_GSR, true, true, true, true, 30, settings, 'neutral');
    expect(r.reserveDeployment).toBe(0);
    expect(r.newReserveBalance).toBe(1_000_000); // monthlyReserve=0 → 残高そのまま
  });

  it('AC_US_RATIO 廃止: 旧 tokutei_ac_base 50万 + CAPE割高(0.75x) は旧設計 (0.834x ≒ 42万) と新設計 (0.75x → 1万単位丸めで 38万) で挙動が異なる', () => {
    // 旧: acMultiplier = 0.666 × 0.75 + 0.334 × 1.0 = 0.8335 → 50万 × 0.8335 ≒ 41.7万 → 1万単位丸めで 42万
    // 新: us 単一 = 0.75 → 50万 × 0.75 = 37.5万 → 1万単位 half-up 丸めで 38万
    const settings = buildSettings(500_000, 0, [
      { amount: 0, ac: 'none' },
      { amount: 0, ac: 'none' },
      { amount: 500_000, ac: 'us' }, // 旧 tokutei_ac_base に相当
      { amount: 0, ac: 'none' },
      { amount: 0, ac: 'none' },
    ]);
    // CAPE=34, 5yMA=30 → 乖離 +13% → 0.75x
    const r = calculateAllocation(34, FAIR_PBR, FAIR_GSR, true, true, true, true, 30, settings, 'neutral');
    expect(r.perSlotAmount[2]).toBe(380_000); // 50万 × 0.75 = 37.5万 → 38万
    // 旧の 42万 (0.8335x の概算) とは異なる = 設計通りの挙動変化
  });

  it('月次予算 > 投資合計 → 余りが monthlyReserve に', () => {
    const settings = buildSettings(1_000_000, 0, [
      { amount: 100_000, ac: 'none' },
      { amount: 100_000, ac: 'none' },
      { amount: 0, ac: 'none' },
      { amount: 0, ac: 'none' },
      { amount: 0, ac: 'none' },
    ]);
    const r = calculateAllocation(FAIR_CAPE, FAIR_PBR, FAIR_GSR, true, true, true, true, CAPE5Y, settings, 'neutral');
    expect(r.totalInvest).toBe(200_000);
    expect(r.monthlyReserve).toBe(800_000);
  });
});
