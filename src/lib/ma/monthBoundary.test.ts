// 調査用（2026-11-02）：「投資実行」を月をまたいで押した場合・押し忘れた場合の、現状の挙動を確かめる。
// 期待値は「いまのコードがこう動く」を書いたもので、望ましい挙動ではない（修正したら書き換える）。
import { describe, it, expect } from 'vitest';
import { calculateMonthlyFromIndicators } from './logic';
import { resolveCrashBase } from './crash';
import { DEFAULT_SETTINGS, type Indicators, type UserMaSettings } from './types';

const base: UserMaSettings = {
  user_id: 'u',
  ...DEFAULT_SETTINGS,
  monthly_budget: 150000,
  reserve_balance: 300000,
  reserve_month: '2026-09', // 9月まで記録済み
  reserve_month_base: 250000,
  slot1: { account: 'nisa_tsumitate', amount: 50000, fund_name: 'A', asset_class: 'us' },
  slot2: { account: 'nisa_growth', amount: 50000, fund_name: 'B', asset_class: 'bond' },
};

const ind = (sp500Last = 100): Indicators => ({
  id: 'i',
  fetched_at: '2026-11-01T00:00:00Z',
  cape: 28,
  cape_history: [{ date: '2026年10月', cape: 30 }],
  topix_pbr: 1.7,
  gold_silver_ratio: 80,
  gold_price: null,
  silver_price: null,
  momentum: {},
  as_of: {},
  drawdown: { sp500_usd: { last: sp500Last, lastDate: '2026-11-01', ath: 100, athDate: '2026-08-01' }, sp500_jpy: null, classes: {} },
});

/** MonthlyAdvisorPage.tsx の calculate → confirmAndUpdateReserve と同じ保存処理（monthKey は押した日の暦の月） */
function pressConfirm(s: UserMaSettings, indicators: Indicators, now: Date) {
  const calc = calculateMonthlyFromIndicators(indicators, s, 'neutral', now)!;
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const crashState = calc.crash
    ? { current: calc.crash.nextState, month, monthBase: resolveCrashBase(s.crash_state, month) }
    : undefined;
  const next: UserMaSettings = {
    ...s,
    reserve_balance: calc.result.newReserveBalance,
    reserve_month: month,
    reserve_month_base: calc.reserveMonthBase,
    ...(crashState ? { crash_state: crashState } : {}),
  };
  return { calc, next };
}

describe('月をまたいで押した場合（現状の挙動）', () => {
  it('前月分を翌月1日に押し、同じ月に当月分を押すと、前月の待機分が消える', () => {
    const oct = pressConfirm(base, ind(), new Date('2026-11-01T10:00:00')); // 10月分の発注を 11/1 に記録
    const monthly = oct.calc.result.monthlyReserve;
    expect(monthly).toBe(50000);
    expect(oct.next.reserve_balance).toBe(350000);
    expect(oct.next.reserve_month).toBe('2026-11'); // 10月分なのに 11月として記録される

    const nov = pressConfirm(oct.next, ind(), new Date('2026-11-25T10:00:00')); // 11月分
    expect(nov.calc.reserveMonthBase).toBe(300000); // 11月の「月初」= 11/1 に押す前の残高
    expect(nov.next.reserve_balance).toBe(350000); // 本来は 400000（10月分＋11月分）。10月の 5万円が消える
  });

  it('前月分を前月中に押していれば、両方とも残る（比較用）', () => {
    const oct = pressConfirm(base, ind(), new Date('2026-10-31T10:00:00'));
    const nov = pressConfirm(oct.next, ind(), new Date('2026-11-25T10:00:00'));
    expect(nov.next.reserve_balance).toBe(400000);
  });

  it('暴落ルールが発動した月だと、同じ投入額が2回表示され、残高からは1回分しか引かれない', () => {
    const oct = pressConfirm(base, ind(79), new Date('2026-11-01T10:00:00')); // −21%：第1段階
    expect(oct.calc.crash!.total).toBe(100000); // 基準残高 300000 の 1/3
    expect(oct.next.reserve_balance).toBe(250000); // 300000 + 50000 − 100000

    const nov = pressConfirm(oct.next, ind(79), new Date('2026-11-25T10:00:00'));
    expect(nov.calc.crash!.total).toBe(100000); // 同じ月の再計算扱いで、月初の状態から判定し直す → 再び表示
    expect(nov.next.reserve_balance).toBe(250000); // 画面どおり2回買っても、記録上の差し引きは1回分
  });
});

describe('押し忘れた場合（現状の挙動）', () => {
  it('暴落ルールの投入を押し忘れると、翌月に同じ投入額がもう一度表示される', () => {
    const octCalc = calculateMonthlyFromIndicators(ind(79), base, 'neutral', new Date('2026-10-25T10:00:00'))!;
    expect(octCalc.crash!.total).toBe(100000);
    // 10月は「投資実行」を押さなかった → settings は変わらない
    const novCalc = calculateMonthlyFromIndicators(ind(79), base, 'neutral', new Date('2026-11-25T10:00:00'))!;
    expect(novCalc.crash!.newlyTriggered).toEqual([20]);
    expect(novCalc.crash!.total).toBe(100000);
    // 画面からは「先月押し忘れた」ことは分からない（reserve_month が '2026-09' のまま、という情報はある）
    expect(base.reserve_month).toBe('2026-09');
  });
});
