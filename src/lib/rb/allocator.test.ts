import { describe, it, expect } from 'vitest';
import cryptoSample from './__fixtures__/mf_assets_crypto_sample.txt?raw';
import { allocateHoldings, summarizeAllocations, sumExcludedCrypto, excludedCryptoNames } from './allocator';
import type { FundMasterEntry } from './allocator';
import { parseMfText } from './mfParser';
import type { MfHolding } from './mfParser';

const fundMaster: FundMasterEntry[] = [
  { ticker: 'eMAXIS Slim 全世界株式(オール・カントリー)', fund_name: 'eMAXIS Slim 全世界株式(オール・カントリー)', asset_class: 'developed_equity', ratio: 0.84 },
  { ticker: 'eMAXIS Slim 全世界株式(オール・カントリー)', fund_name: 'eMAXIS Slim 全世界株式(オール・カントリー)', asset_class: 'emerging_equity', ratio: 0.10 },
  { ticker: 'eMAXIS Slim 全世界株式(オール・カントリー)', fund_name: 'eMAXIS Slim 全世界株式(オール・カントリー)', asset_class: 'japan_equity', ratio: 0.06 },
  { ticker: 'VTI', fund_name: 'バンガード', asset_class: 'developed_equity', ratio: 1.00 },
  { ticker: 'JEPI', fund_name: 'JPモルガン', asset_class: 'commodity', ratio: 1.00 },
];

describe('allocateHoldings', () => {
  it('銘柄名完全一致で按分する', () => {
    const holdings: MfHolding[] = [
      { section: '投資信託', name: 'eMAXIS Slim 全世界株式(オール・カントリー)', ticker: '', institution: '', crypto: false, amount: 1_000_000 },
    ];
    const result = allocateHoldings(holdings, fundMaster);
    expect(result[0].matched).toBe(true);
    expect(result[0].allocations).toHaveLength(3);
    expect(result[0].allocations[0]).toEqual({ assetClass: 'developed_equity', amount: 840_000 });
    expect(result[0].allocations[1]).toEqual({ assetClass: 'emerging_equity', amount: 100_000 });
    expect(result[0].allocations[2]).toEqual({ assetClass: 'japan_equity', amount: 60_000 });
  });

  it('ticker完全一致で振り分ける', () => {
    const holdings: MfHolding[] = [
      { section: '株式（現物）', name: 'バンガード・トータル', ticker: 'VTI', institution: '', crypto: false, amount: 500_000 },
    ];
    const result = allocateHoldings(holdings, fundMaster);
    expect(result[0].matched).toBe(true);
    expect(result[0].allocations).toEqual([{ assetClass: 'developed_equity', amount: 500_000 }]);
  });

  it('未登録銘柄は未分類', () => {
    const holdings: MfHolding[] = [
      { section: '株式（現物）', name: '未知の銘柄', ticker: 'XXXX', institution: '', crypto: false, amount: 100_000 },
    ];
    const result = allocateHoldings(holdings, fundMaster);
    expect(result[0].matched).toBe(false);
    expect(result[0].allocations).toHaveLength(0);
  });

  it('預金は現金・預金に自動振り分け', () => {
    const holdings: MfHolding[] = [
      { section: '預金・現金・暗号資産', name: '預金・現金・暗号資産', ticker: '', institution: '', crypto: false, amount: 2_000_000 },
    ];
    const result = allocateHoldings(holdings, fundMaster);
    expect(result[0].matched).toBe(true);
    expect(result[0].allocations).toEqual([{ assetClass: 'cash', amount: 2_000_000 }]);
  });

  it('債券は先進国債券に自動振り分け', () => {
    const holdings: MfHolding[] = [
      { section: '債券', name: '債券', ticker: '', institution: '', crypto: false, amount: 500_000 },
    ];
    const result = allocateHoldings(holdings, fundMaster);
    expect(result[0].allocations).toEqual([{ assetClass: 'developed_bond', amount: 500_000 }]);
  });
});

describe('summarizeAllocations', () => {
  it('按分結果をアセットクラス別に合計する', () => {
    const allocated = allocateHoldings([
      { section: '投資信託', name: 'eMAXIS Slim 全世界株式(オール・カントリー)', ticker: '', institution: '', crypto: false, amount: 1_000_000 },
      { section: '株式（現物）', name: 'JPモルガン', ticker: 'JEPI', institution: '', crypto: false, amount: 300_000 },
      { section: '預金・現金・暗号資産', name: '預金・現金・暗号資産', ticker: '', institution: '', crypto: false, amount: 500_000 },
    ], fundMaster);

    const summary = summarizeAllocations(allocated);
    expect(summary.developed_equity).toBe(840_000);
    expect(summary.emerging_equity).toBe(100_000);
    expect(summary.japan_equity).toBe(60_000);
    expect(summary.commodity).toBe(300_000);
    expect(summary.cash).toBe(500_000);
  });

  it('手動振り分けを反映する', () => {
    const allocated = allocateHoldings([
      { section: '年金', name: '年金', ticker: '', institution: '', crypto: false, amount: 200_000 },
    ], fundMaster);
    allocated[0].manualClass = 'japan_bond';

    const summary = summarizeAllocations(allocated);
    expect(summary.japan_bond).toBe(200_000);
  });

  it('除外(exclude)は合計に含めない', () => {
    const allocated = allocateHoldings([
      { section: '年金', name: '年金', ticker: '', institution: '', crypto: false, amount: 200_000 },
    ], fundMaster);
    allocated[0].manualClass = 'exclude';

    const summary = summarizeAllocations(allocated);
    const total = Object.values(summary).reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });
});

describe('暗号資産（crypto=true）の行', () => {
  const holdings: MfHolding[] = [
    { section: '預金・現金・暗号資産', name: 'サンプル銀行 普通預金', ticker: '', institution: 'サンプル銀行', crypto: false, amount: 1_234_567 },
    { section: '預金・現金・暗号資産', name: 'ビットコイン', ticker: '', institution: 'bitFlyer', crypto: true, amount: 300_000 },
    { section: '預金・現金・暗号資産', name: 'イーサリアム', ticker: '', institution: 'Coincheck', crypto: true, amount: 120_000 },
    { section: '預金・現金・暗号資産', name: 'BTC', ticker: '', institution: '架空ウォレット', crypto: true, amount: 30_000 },
  ];
  const allocated = allocateHoldings(holdings, fundMaster);

  it('対象外の印が付き、振り分けなし・未分類にもならない', () => {
    for (const a of allocated.slice(1)) {
      expect(a.excluded).toBe(true);
      expect(a.matched).toBe(true);
      expect(a.allocations).toEqual([]);
    }
  });

  it('預金の行は今までどおり cash', () => {
    expect(allocated[0].excluded).toBeUndefined();
    expect(allocated[0].allocations).toEqual([{ assetClass: 'cash', amount: 1_234_567 }]);
  });

  it('cash に入らず、対象外の合計は 450,000円', () => {
    const summary = summarizeAllocations(allocated);
    expect(summary.cash).toBe(1_234_567);
    expect(Object.values(summary).reduce((s, v) => s + v, 0)).toBe(1_234_567);
    expect(sumExcludedCrypto(allocated)).toBe(450_000);
  });

  it('暗号資産が無ければ対象外の合計は 0', () => {
    expect(sumExcludedCrypto(allocated.slice(0, 1))).toBe(0);
  });
});

describe('excludedCryptoNames', () => {
  it('見本（mf_assets_crypto_sample.txt）から外した3行の名前が出てきた順に出る', () => {
    const { holdings } = parseMfText(cryptoSample);
    const allocated = allocateHoldings(holdings, fundMaster);
    expect(excludedCryptoNames(allocated)).toEqual(['ビットコイン', 'イーサリアム', 'BTC']);
    expect(sumExcludedCrypto(allocated)).toBe(450_000);
  });

  it('同じ名前の行が複数あっても名前は1回だけ', () => {
    const holdings: MfHolding[] = [
      { section: '預金・現金・暗号資産', name: 'ビットコイン', ticker: '', institution: 'bitFlyer', crypto: true, amount: 300_000 },
      { section: '預金・現金・暗号資産', name: 'サンプル銀行 普通預金', ticker: '', institution: 'サンプル銀行', crypto: false, amount: 1_234_567 },
      { section: '預金・現金・暗号資産', name: 'イーサリアム', ticker: '', institution: 'Coincheck', crypto: true, amount: 120_000 },
      { section: '預金・現金・暗号資産', name: 'ビットコイン', ticker: '', institution: 'Coincheck', crypto: true, amount: 45_678 },
    ];
    const allocated = allocateHoldings(holdings, fundMaster);
    expect(excludedCryptoNames(allocated)).toEqual(['ビットコイン', 'イーサリアム']);
    expect(sumExcludedCrypto(allocated)).toBe(465_678);
  });

  it('暗号資産が無ければ空', () => {
    const allocated = allocateHoldings(
      [{ section: '預金・現金・暗号資産', name: 'サンプル銀行 普通預金', ticker: '', institution: 'サンプル銀行', crypto: false, amount: 1_234_567 }],
      fundMaster,
    );
    expect(excludedCryptoNames(allocated)).toEqual([]);
  });
});
