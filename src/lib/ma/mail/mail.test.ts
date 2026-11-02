import { describe, it, expect } from 'vitest';
import { scheduledSendDate, decideSend, isBusinessDay, businessDaysBetween } from './schedule';
import { checkFreshness } from './freshness';
import { evaluateCrash, resolveCrashBase } from '../crash';
import { buildMail, type MailInput } from './buildMail';
import { calculateAllocation, calculateMonthlyFromIndicators, deriveMonthlyInputs, estimateNikkeiPbr } from '../logic';
import { DEFAULT_SETTINGS, type Indicators, type UserMaSettings, type CrashState } from '../types';

const settings: UserMaSettings = {
  user_id: 'u',
  ...DEFAULT_SETTINGS,
  monthly_budget: 150000,
  reserve_balance: 300000,
  slot1: { account: 'nisa_tsumitate', amount: 50000, fund_name: 'A', asset_class: 'us' },
  slot3: { account: 'specific', amount: 60000, fund_name: 'B', asset_class: 'us' },
  slot4: { account: 'specific', amount: 25000, fund_name: 'C', asset_class: 'gold' },
};

const indicators: Indicators = {
  id: 'i',
  fetched_at: '2026-11-25T00:00:00Z',
  cape: 28,
  cape_history: [{ date: '2026年10月', cape: 30 }, { date: '2026年9月', cape: 32 }],
  topix_pbr: 1.7,
  gold_silver_ratio: 80,
  gold_price: null,
  silver_price: null,
  momentum: {
    us: { above_ma: true, last_price: 7000, label: 'S&P 500' },
    jp: { above_ma: false, last_price: 50000, label: '日経225' },
    em: { above_ma: true, last_price: 50, label: 'VWO' },
    gold: { above_ma: true, last_price: 4000, label: 'ゴールド' },
  },
  as_of: {},
};

describe('送信日の判定', () => {
  it('土日祝の判定', () => {
    expect(isBusinessDay('2026-11-25')).toBe(true); // 水
    expect(isBusinessDay('2026-10-25')).toBe(false); // 日
    expect(isBusinessDay('2026-11-23')).toBe(false); // 勤労感謝の日（月）
  });
  it('送信日が土日なら直前の営業日', () => {
    expect(scheduledSendDate('2026-11', 25)).toBe('2026-11-25');
    expect(scheduledSendDate('2026-10', 25)).toBe('2026-10-23'); // 25日が日曜 → 23日（金）
    expect(scheduledSendDate('2027-04', 25)).toBe('2027-04-23'); // 25日が日曜
  });
  it('送信日が祝日なら直前の営業日', () => {
    expect(scheduledSendDate('2026-11', 23)).toBe('2026-11-20'); // 23日が祝日（月）→ 20日（金）
  });
  it('月末を超える送信日は月末に丸めてから前倒し', () => {
    expect(scheduledSendDate('2027-02', 28)).toBe('2027-02-26'); // 28日が日曜 → 26日（金）
  });
  it('送信日より前は送らない／当日は送る／過ぎていれば送る（キャッチアップ）', () => {
    expect(decideSend('2026-11-24', 25, []).send).toBe(false);
    expect(decideSend('2026-11-25', 25, []).send).toBe(true);
    const late = decideSend('2026-11-27', 25, []);
    expect(late.send).toBe(true);
    expect(late.reason).toContain('キャッチアップ');
  });
  it('同じ月は二重に送らない', () => {
    expect(decideSend('2026-11-26', 25, ['2026-11']).send).toBe(false);
    expect(decideSend('2026-12-25', 25, ['2026-11']).send).toBe(true);
  });
});

describe('古さの判定', () => {
  it('営業日は土日祝を数えない', () => {
    expect(businessDaysBetween('2026-11-18', '2026-11-25')).toBe(4); // 19,20,24,25（23は祝日）
  });
  it('価格系は5営業日まで', () => {
    expect(checkFreshness('2026-11-17', 'price', '2026-11-25').stale).toBe(false); // 5営業日
    expect(checkFreshness('2026-11-16', 'price', '2026-11-25').stale).toBe(true); // 6営業日
  });
  it('CAPE・PBR は45日まで', () => {
    expect(checkFreshness('2026-10-11', 'monthly', '2026-11-25').stale).toBe(false); // 45日
    expect(checkFreshness('2026-10-10', 'monthly', '2026-11-25').stale).toBe(true); // 46日
  });
  it('取得できなかった指標は未更新扱い', () => {
    expect(checkFreshness(null, 'price', '2026-11-25')).toEqual({ stale: true, asOf: null, missing: true });
  });
});

describe('暴落ルール（待機資金の出口）', () => {
  const at = (last: number, ath = 100, athDate = '2026-10-01') => ({ last, ath, athDate, lastDate: '2026-11-24' });

  it('−20% に入った時点の残高を基準に、−20%・−30% は基準残高の1/3、−40% は残高の全額', () => {
    let state: CrashState | null = null;
    let reserve = 900_000;
    const step = (p: ReturnType<typeof at>) => {
      const r = evaluateCrash(p, state, reserve);
      state = r.nextState;
      reserve -= r.total;
      return r;
    };
    expect(step(at(95)).total).toBe(0);
    const s20 = step(at(79));
    expect(s20.deployments).toEqual([{ stage: 20, amount: 300_000 }]);
    expect(s20.nextState.baseReserve).toBe(900_000);
    expect(step(at(79)).total).toBe(0); // 同じ段階は繰り返さない
    reserve += 150_000; // 翌月の積み増し（基準残高は変えない）
    expect(step(at(69)).deployments).toEqual([{ stage: 30, amount: 300_000 }]);
    reserve += 150_000;
    expect(step(at(59)).deployments).toEqual([{ stage: 40, amount: 600_000 }]); // その時点の残高を全額
    expect(reserve).toBe(0);
  });

  it('最高値を更新したら段階と基準残高をリセットする', () => {
    const first = evaluateCrash(at(79), null, 900_000);
    const back = evaluateCrash(at(110, 110, '2027-03-01'), first.nextState, 600_000);
    expect(back.nextState).toEqual({ athValue: 110, athDate: '2027-03-01', triggered: [], baseReserve: null });
    expect(evaluateCrash(at(85, 110, '2027-03-01'), back.nextState, 600_000).deployments).toEqual([{ stage: 20, amount: 200_000 }]);
  });

  it('一度に −30% まで落ちたら、その時点の残高を基準に2段階分を投入する', () => {
    const r = evaluateCrash(at(68), null, 900_000);
    expect(r.deployments).toEqual([{ stage: 20, amount: 300_000 }, { stage: 30, amount: 300_000 }]);
  });

  it('一度に −40% まで落ちたら、1/3・1/3・残り全額で残高を使い切る', () => {
    const r = evaluateCrash(at(55), null, 900_000);
    expect(r.deployments.map((d) => d.amount)).toEqual([300_000, 300_000, 300_000]);
  });

  it('同じ月に計算し直すときは月初の状態に戻す（二重に発動しない・投入が消えない）', () => {
    const first = evaluateCrash(at(79), null, 900_000);
    const record = { current: first.nextState, month: '2026-11', monthBase: null };
    expect(resolveCrashBase(record, '2026-11')).toBeNull(); // 同じ月 → 月初（未発動）から計算し直す
    expect(resolveCrashBase(record, '2026-12')).toEqual(first.nextState); // 翌月 → 確定済みの状態から
  });
});

describe('画面と同じ計算', () => {
  it('TOPIX は取得値、日経225 は基準×株価比で PBR を補完する', () => {
    expect(deriveMonthlyInputs(indicators, settings).pbr).toBe(1.7);
    const nikkei = { ...settings, jp_index: 'nikkei' as const, nikkei_pbr_anchor: 1.5, nikkei_price_anchor: 40000 };
    expect(deriveMonthlyInputs(indicators, nikkei).pbr).toBe(estimateNikkeiPbr(1.5, 40000, 50000));
  });
  it('画面の自動補完と同じ入力で calculateAllocation を呼んだ結果と一致する', () => {
    const now = new Date('2026-11-25T09:00:00');
    const got = calculateMonthlyFromIndicators(indicators, settings, 'neutral', now)!;
    const expected = calculateAllocation(28, 1.7, 80, true, false, true, true, 31, settings, 'neutral');
    expect(got.result).toEqual(expected);
  });
  it('同じ月に画面で待機資金を確定済みなら、月初 base を基点にする（画面と同じ）', () => {
    const now = new Date('2026-11-25T09:00:00');
    const s = { ...settings, reserve_balance: 999999, reserve_month: '2026-11', reserve_month_base: 300000 };
    expect(calculateMonthlyFromIndicators(indicators, s, 'neutral', now)!.reserveMonthBase).toBe(300000);
  });
  it('S&P500 の高値データがあれば、画面と同じく暴落ルールを判定して待機資金から差し引く', () => {
    const now = new Date('2026-11-25T09:00:00');
    const ind = { ...indicators, drawdown: { sp500_usd: { last: 79, lastDate: '2026-11-24', ath: 100, athDate: '2026-10-01' }, sp500_jpy: null, classes: {} } };
    const got = calculateMonthlyFromIndicators(ind, settings, 'neutral', now)!;
    expect(got.crash!.total).toBe(100_000); // 待機資金 30万 の 1/3
    expect(got.result.crashDeployment).toBe(100_000);
    expect(got.result.newReserveBalance).toBe(300_000 + got.result.monthlyReserve - 100_000);
  });
  it('CAPE・PBR・金銀比率のどれかが無ければ計算しない', () => {
    expect(calculateMonthlyFromIndicators({ ...indicators, cape: null }, settings, 'neutral', new Date())).toBeNull();
  });
});

describe('メール本文', () => {
  const fresh = { stale: false, asOf: '2026-11-24', missing: false };
  const base = (): MailInput => ({
    month: '2026-11',
    mode: 'neutral',
    settings,
    indicators,
    calc: calculateMonthlyFromIndicators(indicators, settings, 'neutral', new Date('2026-11-25T09:00:00')),
    freshness: Object.fromEntries(
      ['cape', 'pbr', 'gsr', 'momentum_us', 'momentum_jp', 'momentum_em', 'momentum_gold', 'sp500_usd', 'sp500_jpy'].map((k) => [k, fresh]),
    ),
    sp500Usd: { last: 7580, lastDate: '2026-11-24', ath: 7818.93, athDate: '2026-10-06' },
    sp500Jpy: { last: 1190000, lastDate: '2026-11-24', ath: 1240000, athDate: '2026-08-13' },
  });

  it('件名に年月と S&P500 の高値比が入る', () => {
    expect(buildMail(base()).subject).toBe('【/ma】2026年11月の計算結果（S&P500 高値比 −3.1%）');
  });
  it('未更新の指標があれば件名の先頭に【データ未更新あり】、本文の該当箇所に基準日つきで明記', () => {
    const i = base();
    i.freshness.gsr = { stale: true, asOf: '2026-11-02', missing: false };
    const m = buildMail(i);
    expect(m.subject.startsWith('【データ未更新あり】')).toBe(true);
    expect(m.text).toContain('未更新（基準日 2026-11-02）');
    expect(m.text).toContain('未更新の指標を含む（金銀比率）'); // ゴールドの変動枠の横
  });
  it('待機資金の流れ（現在の残高・今月の積み増し・暴落ルールによる投入・計算後の残高）を表示する', () => {
    const i = base();
    i.calc = { ...i.calc!, crash: evaluateCrash({ last: 75, ath: 100, athDate: '2026-10-01', lastDate: '2026-11-24' }, null, 300_000) };
    i.calc.result = { ...i.calc.result, crashDeployment: 100_000, newReserveBalance: i.calc.reserveMonthBase + i.calc.result.monthlyReserve - 100_000 };
    const t = buildMail(i).text;
    expect(t).toContain(`現在の残高：¥300,000`);
    expect(t).toContain(`暴落ルールによる投入：−¥100,000`);
    expect(t).toContain(`計算後の残高：¥${(200_000 + i.calc.result.monthlyReserve).toLocaleString('ja-JP')}`);
  });
  it('計算に使った市場モードを表示する', () => {
    expect(buildMail(base()).text).toContain('計算に使った市場モード：平常（補正なし）');
  });
  it('最高値更新中は 0%（最高値更新中）と出し、プラスは出さない', () => {
    const i = base();
    i.sp500Usd = { last: 7900, lastDate: '2026-11-24', ath: 7900, athDate: '2026-11-24' };
    expect(buildMail(i).text).toContain('0%（最高値更新中）');
  });
  it('暴落ルールは条件に該当したときだけ、投入額を別の行で表示する', () => {
    expect(buildMail(base()).text).not.toContain('暴落ルール');
    const i = base();
    i.calc = { ...i.calc!, crash: evaluateCrash({ last: 75, ath: 100, athDate: '2026-10-01', lastDate: '2026-11-24' }, null, 900_000) };
    const t = buildMail(i).text;
    expect(t).toContain('第1段階（高値比 −20%）の条件に該当：基準残高の1/3 ¥300,000');
    expect(t).toContain('暴落ルールによる投入額：¥300,000');
  });
  it('「推奨」「買い時」「おすすめ」を使わない', () => {
    const i = base();
    i.calc = { ...i.calc!, crash: evaluateCrash({ last: 55, ath: 100, athDate: '2026-10-01', lastDate: '2026-11-24' }, null, 900_000) };
    const m = buildMail(i);
    for (const w of ['推奨', '買い時', 'おすすめ']) {
      expect(m.html).not.toContain(w);
      expect(m.text).not.toContain(w);
    }
  });
});
