import { describe, it, expect } from 'vitest';
import { allocateHoldings, summarizeAllocations } from './allocator';
import type { FundMasterEntry } from './allocator';
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
      { section: '投資信託', name: 'eMAXIS Slim 全世界株式(オール・カントリー)', ticker: '', amount: 1_000_000 },
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
      { section: '株式（現物）', name: 'バンガード・トータル', ticker: 'VTI', amount: 500_000 },
    ];
    const result = allocateHoldings(holdings, fundMaster);
    expect(result[0].matched).toBe(true);
    expect(result[0].allocations).toEqual([{ assetClass: 'developed_equity', amount: 500_000 }]);
  });

  it('未登録銘柄は未分類', () => {
    const holdings: MfHolding[] = [
      { section: '株式（現物）', name: '未知の銘柄', ticker: 'XXXX', amount: 100_000 },
    ];
    const result = allocateHoldings(holdings, fundMaster);
    expect(result[0].matched).toBe(false);
    expect(result[0].allocations).toHaveLength(0);
  });

  it('預金は現金・預金に自動振り分け', () => {
    const holdings: MfHolding[] = [
      { section: '預金・現金・暗号資産', name: '預金・現金・暗号資産', ticker: '', amount: 2_000_000 },
    ];
    const result = allocateHoldings(holdings, fundMaster);
    expect(result[0].matched).toBe(true);
    expect(result[0].allocations).toEqual([{ assetClass: 'cash', amount: 2_000_000 }]);
  });

  it('債券は先進国債券に自動振り分け', () => {
    const holdings: MfHolding[] = [
      { section: '債券', name: '債券', ticker: '', amount: 500_000 },
    ];
    const result = allocateHoldings(holdings, fundMaster);
    expect(result[0].allocations).toEqual([{ assetClass: 'developed_bond', amount: 500_000 }]);
  });
});

describe('summarizeAllocations', () => {
  it('按分結果をアセットクラス別に合計する', () => {
    const allocated = allocateHoldings([
      { section: '投資信託', name: 'eMAXIS Slim 全世界株式(オール・カントリー)', ticker: '', amount: 1_000_000 },
      { section: '株式（現物）', name: 'JPモルガン', ticker: 'JEPI', amount: 300_000 },
      { section: '預金・現金・暗号資産', name: '預金・現金・暗号資産', ticker: '', amount: 500_000 },
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
      { section: '年金', name: '年金', ticker: '', amount: 200_000 },
    ], fundMaster);
    allocated[0].manualClass = 'japan_bond';

    const summary = summarizeAllocations(allocated);
    expect(summary.japan_bond).toBe(200_000);
  });

  it('除外(exclude)は合計に含めない', () => {
    const allocated = allocateHoldings([
      { section: '年金', name: '年金', ticker: '', amount: 200_000 },
    ], fundMaster);
    allocated[0].manualClass = 'exclude';

    const summary = summarizeAllocations(allocated);
    const total = Object.values(summary).reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });
});
