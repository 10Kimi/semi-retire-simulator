import { describe, it, expect } from 'vitest';
import sample from './__fixtures__/mf_assets_sample.txt?raw';
import cryptoSample from './__fixtures__/mf_assets_crypto_sample.txt?raw';
import { parseMfText, clampNegativeHoldings } from './mfParser';
import { allocateHoldings, summarizeAllocations } from './allocator';
import type { FundMasterEntry } from './allocator';

const fundMaster: FundMasterEntry[] = [
  { ticker: 'Z901', fund_name: 'サンプル工業', asset_class: 'japan_equity', ratio: 1 },
  { ticker: 'Z902', fund_name: '架空商事', asset_class: 'japan_equity', ratio: 1 },
  { ticker: 'ZZFKE', fund_name: 'デモ・インデックスETF', asset_class: 'us_equity', ratio: 1 },
  { ticker: '架空インデックスファンド 全世界', fund_name: null, asset_class: 'us_equity', ratio: 0.6 },
  { ticker: '架空インデックスファンド 全世界', fund_name: null, asset_class: 'developed_equity', ratio: 0.3 },
  { ticker: '架空インデックスファンド 全世界', fund_name: null, asset_class: 'emerging_equity', ratio: 0.1 },
  { ticker: 'サンプル先進国債券ファンド', fund_name: null, asset_class: 'developed_bond', ratio: 1 },
  { ticker: 'デモゴールドファンド', fund_name: null, asset_class: 'gold', ratio: 1 },
  { ticker: 'サンプル確定拠出年金', fund_name: null, asset_class: 'us_equity', ratio: 0.7 },
  { ticker: 'サンプル確定拠出年金', fund_name: null, asset_class: 'japan_equity', ratio: 0.3 },
];

/** 区分1つのテキストを作る（債券の書式：名前・評価額・金融機関） */
function bondSection(stated: string, amounts: string[], heading = '債券'): string {
  return [
    heading,
    `合計：${stated}`,
    '銘柄名\t評価額\t保有金融機関',
    ...amounts.map((a, i) => `テスト債${i}\t${a}\tデモ証券\t変更\t削除`),
  ].join('\n');
}

describe('parseMfText', () => {
  const { holdings, warnings } = parseMfText(sample);
  const ofSection = (section: string) => holdings.filter(h => h.section === section);
  const find = (name: string) => holdings.find(h => h.name === name);

  it('区分の名前を allocateHoldings が読む表記にそろえる', () => {
    expect([...new Set(holdings.map(h => h.section))]).toEqual([
      '預金・現金・暗号資産', '株式（現物）', '投資信託', '債券', '年金',
    ]);
  });

  it('見本は警告が出ない（株式は合計と3円ずれるが許容差の内）', () => {
    expect(warnings).toEqual([]);
  });

  it('預金は口座ごとの行のまま。マイナスの行も残し、0円と `-` の行は出さない', () => {
    expect(ofSection('預金・現金・暗号資産').map(h => [h.name, h.amount])).toEqual([
      ['サンプル銀行 普通預金', 1_234_567],
      ['架空信用金庫 普通預金', 345_678],
      ['サンプルカード 未払い分', -12_345],
    ]);
  });

  it('株式は銘柄コードで合算し、評価額が `-` の行は読まない', () => {
    expect(ofSection('株式（現物）')).toEqual([
      { section: '株式（現物）', name: 'サンプル工業', ticker: 'Z901', institution: 'デモ証券 特定', crypto: false, amount: 703_500 },
      { section: '株式（現物）', name: '架空商事', ticker: 'Z902', institution: 'デモ証券 特定', crypto: false, amount: 123_456 },
      { section: '株式（現物）', name: 'デモ・インデックスETF', ticker: 'ZZFKE', institution: 'デモ証券 特定', crypto: false, amount: 1_234_789 },
    ]);
  });

  it('投信は名前（NFKC で照合）で合算し、マイナスの行も足す。表記は最初の行のまま', () => {
    expect(find('架空インデックスファンド 全世界')?.amount).toBe(4_022_098);
    expect(find('架空インデックスファンド　全世界')).toBeUndefined();
  });

  it('合算して0円になった銘柄は出さない', () => {
    expect(find('架空相殺ファンド')).toBeUndefined();
  });

  it('債券・年金は名前で合算する。年金の金額は現在価値', () => {
    expect(find('サンプル国債 10年')?.amount).toBe(750_321);
    expect(find('サンプル確定拠出年金')?.amount).toBe(1_288_654);
  });

  it('ポイントと、列名・広告の行を読まない', () => {
    const names = holdings.map(h => h.name);
    expect(names).not.toContain('サンプルポイント');
    expect(names).not.toContain('銘柄名');
    expect(names).not.toContain('今なら手数料無料');
    expect(names.filter(n => n.includes('広告'))).toEqual([]);
    expect(holdings).toHaveLength(13);
  });

  it('金額の小数は銘柄の合算のあとで円に丸める', () => {
    const text = [
      '債券', '合計：2円',
      '同じ債券\t0.7円\tデモ証券',
      '同じ債券\t0.8円\tデモ証券',
    ].join('\n');
    expect(parseMfText(text).holdings[0].amount).toBe(2);
  });

  it('改行が CRLF でも、見出しが全角かっこでも読める', () => {
    const text = [
      '株式（現物）', '合計：1,234円',
      'Z901\t架空\t1\t1円\t1円\t1,234円\t0円\t0円\t0%\tデモ証券',
    ].join('\r\n');
    expect(parseMfText(text)).toEqual({
      holdings: [{ section: '株式（現物）', name: '架空', ticker: 'Z901', institution: 'デモ証券', crypto: false, amount: 1_234 }],
      warnings: [],
    });
  });

  it('銘柄コードが空の株式は名前で区別する', () => {
    const text = [
      '株式(現物)', '合計：3,000円',
      '\t架空A\t1\t1円\t1円\t1,000円',
      '\t架空B\t1\t1円\t1円\t2,000円',
    ].join('\n');
    expect(parseMfText(text).holdings.map(h => h.name)).toEqual(['架空A', '架空B']);
  });

  it('区分が読めないテキストは空を返す', () => {
    expect(parseMfText('')).toEqual({ holdings: [], warnings: [] });
    expect(parseMfText('関係のない文章\n別の文章').holdings).toEqual([]);
    expect(parseMfText('関係のない文章\n別の文章').warnings).toEqual([]);
  });

  it('列名が複数行に分かれていても、金額として読める値が無ければ読み飛ばす', () => {
    const text = [
      '投資信託', '合計：1,234円',
      '銘柄名',
      '保有数\t平均取得単価',
      '基準価額\t評価額\t前日比\t評価損益\t評価損益率',
      '銘柄名\t保有数\t平均取得単価\t基準価額\t評価額',
      '保有金融機関',
      '架空ファンド\t1\t1円\t1円\t1,234円\t0円\t0円\t0%\tデモ証券',
    ].join('\n');
    expect(parseMfText(text)).toEqual({
      holdings: [{ section: '投資信託', name: '架空ファンド', ticker: '', institution: 'デモ証券', crypto: false, amount: 1_234 }],
      warnings: [],
    });
  });
});

describe('parseMfText の警告', () => {
  it('合計とのずれが1,000円ちょうどなら警告しない', () => {
    expect(parseMfText(bondSection('101,234円', ['100,234円'])).warnings).toEqual([]);
    expect(parseMfText(bondSection('99,234円', ['100,234円'])).warnings).toEqual([]);
  });

  it('1,000円を超えたら区分名と金額を警告する（取り込みは止めない）', () => {
    const { holdings, warnings } = parseMfText(bondSection('101,235円', ['100,234円']));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('債券');
    expect(warnings[0]).toContain('101,235円');
    expect(warnings[0]).toContain('100,234円');
    expect(holdings[0].amount).toBe(100_234);
  });

  it('合計の金額が読めない区分は警告する', () => {
    const { warnings } = parseMfText(bondSection('-', ['100,234円']));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('債券');
  });

  it('未知の区分は名前を出して読み飛ばし、金額が保有額に入らないことを伝える', () => {
    const text = `${bondSection('1,234円', ['1,234円'])}\n${bondSection('5,678円', ['5,678円'], '架空の区分')}`;
    const { holdings, warnings } = parseMfText(text);
    expect(holdings.map(h => h.amount)).toEqual([1_234]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('架空の区分');
    expect(warnings[0]).toContain('保有額に入りません');
  });

  it('同じ区分が2回あれば警告し、2回目は読まない', () => {
    const text = `${bondSection('1,234円', ['1,234円'])}\n${bondSection('5,678円', ['5,678円'])}`;
    const { holdings, warnings } = parseMfText(text);
    expect(holdings.map(h => h.amount)).toEqual([1_234]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('2回');
  });

  it('内訳にある区分の見出しが本文に無ければ、区分名を警告する', () => {
    const start = sample.indexOf('\n債券\n');
    const end = sample.indexOf('\n年金\n');
    const { holdings, warnings } = parseMfText(sample.slice(0, start) + sample.slice(end));
    expect(holdings.some(h => h.section === '債券')).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('債券');
    expect(warnings[0]).toContain('本文にありません');
  });

  it('内訳のポイントは本文に無くても警告しない', () => {
    const { warnings } = parseMfText(sample.slice(0, sample.indexOf('ポイント \n')));
    expect(warnings).toEqual([]);
  });

  it('内訳が無いテキストでは、区分が足りなくても警告しない', () => {
    expect(parseMfText(bondSection('1,234円', ['1,234円'])).warnings).toEqual([]);
  });

  it('見出しが全く無くても内訳の区分は警告する（読める区分なしのとき）', () => {
    const { holdings, warnings } = parseMfText('資産の内訳\n預金・現金\t100円\t100%');
    expect(holdings).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('預金・現金');
  });

  it('ポイントは未知の区分として警告しない', () => {
    expect(parseMfText('ポイント \n合計：100円\nサンプルポイント\tポイント\t100\t1\t100円').warnings).toEqual([]);
  });
});

describe('parseMfText → allocateHoldings → summarizeAllocations', () => {
  const allocated = allocateHoldings(parseMfText(sample).holdings, fundMaster);

  it('預金の行は全部 cash に入り、未分類にならない', () => {
    const deposits = allocated.filter(a => a.holding.section === '預金・現金・暗号資産');
    expect(deposits).toHaveLength(3);
    for (const d of deposits) {
      expect(d.matched).toBe(true);
      expect(d.allocations).toEqual([{ assetClass: 'cash', amount: d.holding.amount }]);
    }
  });

  it('債券は fund_master になくても developed_bond に入る', () => {
    const bonds = allocated.filter(a => a.holding.section === '債券');
    expect(bonds).toHaveLength(2);
    expect(bonds.every(b => b.matched && b.allocations[0].assetClass === 'developed_bond')).toBe(true);
  });

  it('未分類は fund_master にない銘柄だけ', () => {
    expect(allocated.filter(a => !a.matched).map(a => a.holding.name)).toEqual(['ダミー未登録ファンド']);
  });

  it('資産クラス別の合計（未分類は手で選ぶまで入らない）', () => {
    expect(summarizeAllocations(allocated)).toMatchObject({
      cash: 1_567_900,
      japan_equity: 1_213_552,
      us_equity: 4_550_106,
      developed_equity: 1_206_629,
      emerging_equity: 402_210,
      developed_bond: 1_926_975,
      gold: 150_000,
      commodity: 0,
    });
  });

  it('未分類を手で選ぶと、そのクラスに入る', () => {
    const chosen = allocated.map(a => (a.matched ? a : { ...a, manualClass: 'commodity' }));
    expect(summarizeAllocations(chosen).commodity).toBe(65_432);
  });
});

describe('見出しが「預金・現金・暗号資産」のとき', () => {
  it('預金として読み、cash に入る', () => {
    const text = '預金・現金・暗号資産\n合計：1,500円\n種類・名称\t残高\t保有金融機関\nサンプル口座\t1,500円\tサンプル銀行\n';
    const { holdings, warnings } = parseMfText(text);
    expect(warnings).toEqual([]);
    expect(summarizeAllocations(allocateHoldings(holdings, [])).cash).toBe(1500);
  });
});

describe('clampNegativeHoldings', () => {
  const negativeCash = [
    '預金・現金', '合計：-37,655円',
    'サンプル口座\t12,345円\tサンプル銀行',
    'サンプルカード 未払い分\t-50,000円\tサンプルカード',
    '債券', '合計：123,456円',
    '架空債\t123,456円\tデモ証券',
  ].join('\n');

  it('クラスの合計がマイナスなら0にして、そのクラスを返す。ほかのクラスは変えない', () => {
    const summary = summarizeAllocations(allocateHoldings(parseMfText(negativeCash).holdings, fundMaster));
    expect(summary.cash).toBe(-37_655);

    const { holdings, clamped } = clampNegativeHoldings(summary);
    expect(holdings.cash).toBe(0);
    expect(holdings.developed_bond).toBe(123_456);
    expect(clamped).toEqual(['cash']);
    expect(summary.cash).toBe(-37_655); // 元の値は書き換えない
  });

  it('行のマイナスがあってもクラスの合計がプラスなら、そのまま', () => {
    const summary = summarizeAllocations(allocateHoldings(parseMfText(sample).holdings, fundMaster));
    const { holdings, clamped } = clampNegativeHoldings(summary);
    expect(holdings).toEqual(summary);
    expect(holdings.cash).toBe(1_567_900);
    expect(clamped).toEqual([]);
  });
});

describe('内訳と本文で預金の見出しの表記が違うとき', () => {
  it('本文に区分があるので、欠落の警告は出ない', () => {
    const text = '資産の内訳\n 預金・現金\t1,500円\t100.00%\n預金・現金・暗号資産\n合計：1,500円\nサンプル口座\t1,500円\tサンプル銀行\n';
    expect(parseMfText(text).warnings).toEqual([]);
  });
});

describe('見本に暗号資産の行があるとき（mf_assets_crypto_sample.txt）', () => {
  const { holdings, warnings } = parseMfText(cryptoSample);
  const deposits = holdings.filter(h => h.section === '預金・現金・暗号資産');

  it('暗号資産の行も区分の照合に含めるので、警告は増えない', () => {
    expect(warnings).toEqual([]);
  });

  it('暗号資産の3行は crypto=true、銀行預金・カードの行は false', () => {
    expect(deposits.map(h => [h.name, h.institution, h.crypto, h.amount])).toEqual([
      ['サンプル銀行 普通預金', 'サンプル銀行', false, 1_234_567],
      ['架空信用金庫 普通預金', '架空信用金庫', false, 345_678],
      ['サンプルカード 未払い分', 'サンプルカード', false, -12_345],
      ['ビットコイン', 'bitFlyer', true, 300_000],
      ['イーサリアム', 'Coincheck', true, 120_000],
      ['BTC', '架空ウォレット', true, 30_000],
    ]);
  });

  it('預金以外の区分は crypto=false', () => {
    expect(holdings.filter(h => h.section !== '預金・現金・暗号資産').every(h => !h.crypto)).toBe(true);
  });

  it('暗号資産は cash に入らず、ほかのクラスの合計は暗号資産が無い見本と同じ', () => {
    const summary = summarizeAllocations(allocateHoldings(holdings, fundMaster));
    expect(summary).toEqual(summarizeAllocations(allocateHoldings(parseMfText(sample).holdings, fundMaster)));
    expect(summary.cash).toBe(1_567_900);
  });
});
