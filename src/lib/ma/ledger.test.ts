// 台帳方式（FI_project #140、設計書 §13-69）。期待値は1万円の倍数だけにしない（予算・スロット・残高に端数を入れる）
import { describe, it, expect } from 'vitest';
import {
  buildLedgerInputs,
  catchUpLedger,
  computeLedgerMonth,
  computeLedgerMonthDetail,
  draftLedgerMonth,
  effectiveClosing,
  lastOverride,
  latestBefore,
  latestRow,
  ledgerMonthlyCalc,
  nextMonth,
  prevMonth,
  projectNextRecord,
  seedFromLegacy,
  type LedgerInputs,
  type LedgerRow,
} from './ledger';
import { evaluateCrash } from './crash';
import { DEFAULT_SETTINGS, SLOT_KEYS, type CrashState, type Indicators, type PricePoint, type UserMaSettings } from './types';

// 予算 153,700。非課税 37,500＋23,000（そのまま）、特定口座の米国株 60,000 は CAPE 28／5年平均 31（−9.7%）で ×1.0 → 60,000。
// スロット合計 120,500、毎月の積み増し 33,200
const MONTHLY = 33_200;
const slots = SLOT_KEYS.map((k) => ({ ...DEFAULT_SETTINGS[k], amount: 0 }));
slots[0] = { account: 'nisa_tsumitate', amount: 37_500, fund_name: 'A', asset_class: 'none' };
slots[1] = { account: 'ideco', amount: 23_000, fund_name: 'B', asset_class: 'none' };
slots[2] = { account: 'specific', amount: 60_000, fund_name: 'C', asset_class: 'us' };

const sp = (last: number, ath = 100, athDate = '2026-10-01'): PricePoint => ({ last, lastDate: '2026-11-24', ath, athDate });

const inputsWith = (sp500: PricePoint | null): LedgerInputs => ({
  cape: 28,
  pbr: 1.7,
  gsr: 80,
  momentum: { us: true, jp: true, em: true, gold: true },
  cape5yMA: 31,
  as_of: {},
  sp500_usd: sp500,
  mode: 'neutral',
  monthly_budget: 153_700,
  jp_index: 'topix',
  slots,
});

const seed = (month: string, closing: number, crash: CrashState | null = null): LedgerRow => ({
  user_id: 'owner',
  month,
  kind: 'seed',
  catchup: false,
  inputs: null,
  opening_balance: null,
  monthly_reserve: 0,
  crash_deployment: 0,
  crash_triggered: [],
  crash_state: crash,
  closing_balance: closing,
  override_balance: null,
  override_at: null,
});

describe('月の前後', () => {
  it('年をまたぐ', () => {
    expect(prevMonth('2027-01')).toBe('2026-12');
    expect(prevMonth('2026-11')).toBe('2026-10');
    expect(nextMonth('2026-12')).toBe('2027-01');
    expect(nextMonth('2026-09')).toBe('2026-10');
  });
});

describe('1か月の計算', () => {
  it('opening＝前の行の実効の月末残高、closing＝opening＋積み増し−投入', () => {
    const row = computeLedgerMonth(seed('2026-08', 412_345), '2026-09', inputsWith(null), { catchup: false });
    expect(row).toMatchObject({
      month: '2026-09', kind: 'record', catchup: false, opening_balance: 412_345, monthly_reserve: MONTHLY,
      crash_deployment: 0, crash_triggered: [], crash_state: null, closing_balance: 445_545, override_balance: null, override_at: null,
    });
  });

  it('同じ月を2回計算して同じ結果', () => {
    const prev = seed('2026-10', 478_745);
    const a = computeLedgerMonth(prev, '2026-11', inputsWith(sp(68)), { catchup: false });
    const b = computeLedgerMonth(prev, '2026-11', inputsWith(sp(68)), { catchup: false });
    expect(b).toEqual(a);
  });
});

describe('追いつき（2か月抜け）', () => {
  const rows = [seed('2026-08', 412_345)];

  it('古い順に記録し、抜けた月に catchup の印、抜けた月の暴落の投入は 0（C7）', () => {
    const out = catchUpLedger(rows, '2026-11', inputsWith(sp(55)));
    expect(out.map((r) => [r.month, r.catchup])).toEqual([['2026-09', true], ['2026-10', true], ['2026-11', false]]);
    for (const r of out.slice(0, 2)) {
      expect(r.crash_deployment).toBe(0);
      expect(r.crash_triggered).toEqual([]);
      expect(r.crash_state).toBeNull();
    }
    expect(out.map((r) => r.opening_balance)).toEqual([412_345, 445_545, 478_745]);
  });

  it('記録済み（最後の行が対象月以上）なら空', () => {
    expect(catchUpLedger([seed('2026-11', 1)], '2026-11', inputsWith(null))).toEqual([]);
    expect(catchUpLedger([seed('2026-12', 1)], '2026-11', inputsWith(null))).toEqual([]);
  });

  it('行が月の順でなくても、最後の月の次から', () => {
    const r10 = computeLedgerMonth(seed('2026-09', 100_001), '2026-10', inputsWith(null), { catchup: false });
    const out = catchUpLedger([r10, seed('2026-09', 100_001)], '2026-11', inputsWith(null));
    expect(out.map((r) => r.month)).toEqual(['2026-11']);
    expect(out[0].opening_balance).toBe(133_201);
  });
});

describe('追いつきの暴落ルール C1〜C7', () => {
  const rows = [seed('2026-08', 412_345)];
  // 対象月 2026-11 の月初の想定残高 = 412,345 + 33,200×2 = 478,745。1/3 = 159,581（切り捨て）

  it('C1 −32% でまとめて発動：20・30 が同じ月に、基準＝その月の月初の想定残高、それぞれ 1/3', () => {
    const nov = catchUpLedger(rows, '2026-11', inputsWith(sp(68))).at(-1)!;
    expect(nov.crash_triggered).toEqual([20, 30]);
    expect(nov.crash_deployment).toBe(319_162);
    expect(nov.crash_state).toEqual({ athValue: 100, athDate: '2026-10-01', triggered: [20, 30], baseReserve: 478_745 });
    expect(nov.closing_balance).toBe(478_745 + MONTHLY - 319_162); // 192,783
  });

  it('C2 −45%：20・30 は 1/3、40 は残り全額', () => {
    const nov = catchUpLedger(rows, '2026-11', inputsWith(sp(55))).at(-1)!;
    const calc = ledgerMonthlyCalc([...rows, ...catchUpLedger(rows, '2026-11', inputsWith(sp(55)))], '2026-11')!;
    expect(calc.crash!.deployments).toEqual([
      { stage: 20, amount: 159_581 }, { stage: 30, amount: 159_581 }, { stage: 40, amount: 159_583 },
    ]);
    expect(nov.crash_deployment).toBe(478_745);
    expect(nov.closing_balance).toBe(MONTHLY);
  });

  it('C3 発動済みの基準を維持：前の行で 20 発動・基準 B、今 −32% → 30 だけ B/3', () => {
    const prev = seed('2026-10', 250_000, { athValue: 100, athDate: '2026-10-01', triggered: [20], baseReserve: 300_010 });
    const nov = catchUpLedger([prev], '2026-11', inputsWith(sp(68))).at(-1)!;
    expect(nov.crash_triggered).toEqual([30]);
    expect(nov.crash_deployment).toBe(100_003);
    expect(nov.crash_state).toEqual({ athValue: 100, athDate: '2026-10-01', triggered: [20, 30], baseReserve: 300_010 });
    expect(nov.closing_balance).toBe(250_000 + MONTHLY - 100_003); // 183,197
  });

  describe('C4 最高値の更新', () => {
    const prevState: CrashState = { athValue: 100, athDate: '2026-10-01', triggered: [20], baseReserve: 300_010 };
    const prev = seed('2026-10', 250_000, prevState);

    it('値が大きく日付が後ならリセット', () => {
      const nov = catchUpLedger([prev], '2026-11', inputsWith(sp(105, 110, '2026-11-20'))).at(-1)!;
      expect(nov.crash_state).toEqual({ athValue: 110, athDate: '2026-11-20', triggered: [], baseReserve: null });
      expect(nov.crash_deployment).toBe(0);
    });

    it('リセットのあと同じ月に −20% を越えていれば、新しい最高値から数えて発動（基準はその月の月初）', () => {
      const nov = catchUpLedger([prev], '2026-11', inputsWith(sp(87.5, 110, '2026-11-02'))).at(-1)!; // 87.5/110 = −20.5%
      expect(nov.crash_triggered).toEqual([20]);
      expect(nov.crash_state).toEqual({ athValue: 110, athDate: '2026-11-02', triggered: [20], baseReserve: 250_000 });
      expect(nov.crash_deployment).toBe(83_333);
    });

    it('値だけ大きく日付が同じ（過去の終値の訂正）ならリセットしない', () => {
      const nov = catchUpLedger([prev], '2026-11', inputsWith(sp(68, 100.4, '2026-10-01'))).at(-1)!; // −32.3%
      expect(nov.crash_triggered).toEqual([30]);
      expect(nov.crash_deployment).toBe(100_003);
      expect(nov.crash_state).toEqual({ athValue: 100, athDate: '2026-10-01', triggered: [20, 30], baseReserve: 300_010 });
    });
  });

  it('C5 抜けている間に越えて今は戻っている段階は発動しない（今 −15%）', () => {
    const nov = catchUpLedger(rows, '2026-11', inputsWith(sp(85))).at(-1)!;
    expect(nov.crash_triggered).toEqual([]);
    expect(nov.crash_deployment).toBe(0);
    expect(nov.crash_state).toEqual({ athValue: 100, athDate: '2026-10-01', triggered: [], baseReserve: null });
    expect(nov.closing_balance).toBe(511_945);
  });

  it('C6 2回実行で不変（1回目の行を足して2回目は空。指標が変わっていても）', () => {
    const first = catchUpLedger(rows, '2026-11', inputsWith(sp(68)));
    expect(catchUpLedger([...rows, ...first], '2026-11', inputsWith(sp(68)))).toEqual([]);
    expect(catchUpLedger([...rows, ...first], '2026-11', inputsWith(sp(50)))).toEqual([]);
  });

  it('C7 抜けた月の投入は 0（−45% でも、抜けた月は判定しない）', () => {
    const out = catchUpLedger(rows, '2026-11', inputsWith(sp(55)));
    expect(out.slice(0, 2).map((r) => r.crash_deployment)).toEqual([0, 0]);
    expect(out[2].crash_deployment).toBe(478_745);
  });

  it('S&P500 の値が無い月は判定しない（状態は前の行のまま）', () => {
    const st: CrashState = { athValue: 100, athDate: '2026-10-01', triggered: [20], baseReserve: 300_010 };
    const nov = computeLedgerMonth(seed('2026-10', 250_000, st), '2026-11', inputsWith(null), { catchup: false });
    expect(nov.crash_state).toEqual(st);
    expect(nov.crash_deployment).toBe(0);
  });
});

describe('ボタン方式の evaluateCrash の既定は変えない', () => {
  it('既定（省略）は値だけで更新とみなす。strictNewHigh なら日付も見る', () => {
    const prev: CrashState = { athValue: 100, athDate: '2026-10-01', triggered: [20], baseReserve: 300_010 };
    const p = sp(68, 100.4, '2026-10-01');
    expect(evaluateCrash(p, prev, 250_000).nextState).toEqual({ athValue: 100.4, athDate: '2026-10-01', triggered: [20, 30], baseReserve: 250_000 });
    expect(evaluateCrash(p, prev, 250_000, { strictNewHigh: true }).nextState).toEqual({ athValue: 100, athDate: '2026-10-01', triggered: [20, 30], baseReserve: 300_010 });
  });
});

describe('実際の残高で上書き', () => {
  it('翌月はその額から積む・取り消すと元に戻る。暴落の状態は変えない', () => {
    const st: CrashState = { athValue: 100, athDate: '2026-10-01', triggered: [20], baseReserve: 300_010 };
    const sep = computeLedgerMonth(seed('2026-08', 412_345, st), '2026-09', inputsWith(null), { catchup: false });
    const overridden = { ...sep, override_balance: 400_123, override_at: '2026-09-30T10:00:00Z' };
    expect(effectiveClosing(overridden)).toBe(400_123);
    expect(overridden.closing_balance).toBe(445_545); // 想定値は残す
    const oct = computeLedgerMonth(overridden, '2026-10', inputsWith(null), { catchup: false });
    expect(oct.opening_balance).toBe(400_123);
    expect(oct.closing_balance).toBe(433_323);
    expect(oct.crash_state).toEqual(st);

    const undone = { ...overridden, override_balance: null, override_at: null };
    const oct2 = computeLedgerMonth(undone, '2026-10', inputsWith(null), { catchup: false });
    expect(oct2.opening_balance).toBe(445_545);
    expect(oct2.closing_balance).toBe(478_745);
  });
});

describe('seedFromLegacy', () => {
  const base: UserMaSettings = { user_id: 'owner', ...DEFAULT_SETTINGS, reserve_balance: 512_340 };

  it('その月にボタンで確定済み：残高は reserve_month_base、月は前月', () => {
    const s = seedFromLegacy({ ...base, reserve_month: '2026-11', reserve_month_base: 478_900 }, '2026-11');
    expect(s).toEqual(seed('2026-10', 478_900));
  });
  it('その月に確定済みで base が null なら reserve_balance', () => {
    expect(seedFromLegacy({ ...base, reserve_month: '2026-11', reserve_month_base: null }, '2026-11').closing_balance).toBe(512_340);
  });
  it('それより前の月に確定：残高は reserve_balance、月は reserve_month', () => {
    const s = seedFromLegacy({ ...base, reserve_month: '2026-09', reserve_month_base: 478_900 }, '2026-11');
    expect(s).toEqual(seed('2026-09', 512_340));
  });
  it('reserve_month が null：残高は reserve_balance、月は前月', () => {
    expect(seedFromLegacy({ ...base, reserve_month: null }, '2026-11')).toEqual(seed('2026-10', 512_340));
  });
  it('crash_state：month が beforeMonth 以上なら monthBase、それ以外は current、無ければ null', () => {
    const current: CrashState = { athValue: 100, athDate: '2026-10-01', triggered: [20], baseReserve: 300_010 };
    const monthBase: CrashState = { athValue: 100, athDate: '2026-10-01', triggered: [], baseReserve: null };
    const cs = { current, month: '2026-11', monthBase };
    expect(seedFromLegacy({ ...base, crash_state: cs }, '2026-11').crash_state).toEqual(monthBase);
    expect(seedFromLegacy({ ...base, crash_state: cs }, '2026-12').crash_state).toEqual(current);
    expect(seedFromLegacy({ ...base, crash_state: { current, month: null, monthBase: null } }, '2026-11').crash_state).toEqual(current);
    expect(seedFromLegacy({ ...base, crash_state: null }, '2026-11').crash_state).toBeNull();
  });
  it('seed からの追いつき（確定済みの月の分は計算し直す）', () => {
    const s = seedFromLegacy({ ...base, reserve_month: '2026-11', reserve_month_base: 478_900 }, '2026-11');
    const out = catchUpLedger([s], '2026-11', inputsWith(null));
    expect(out.map((r) => [r.month, r.opening_balance, r.closing_balance])).toEqual([['2026-11', 478_900, 512_100]]);
  });
});

describe('行の選び方', () => {
  const r = (month: string, override: number | null = null): LedgerRow => ({ ...seed(month, 1), override_balance: override });
  const rows = [r('2026-10', 5), r('2026-08', 7), r('2026-11'), r('2026-09')];
  it('latestRow・latestBefore・lastOverride は月の順でなくても', () => {
    expect(latestRow(rows)!.month).toBe('2026-11');
    expect(latestRow([])).toBeNull();
    expect(latestBefore(rows, '2026-11')!.month).toBe('2026-10');
    expect(latestBefore(rows, '2026-08')).toBeNull();
    expect(lastOverride(rows)!.month).toBe('2026-10');
    expect(lastOverride([r('2026-08')])).toBeNull();
  });
});

describe('入力と表示の形', () => {
  const settings: UserMaSettings = {
    user_id: 'owner', ...DEFAULT_SETTINGS, monthly_budget: 153_700,
    slot1: slots[0], slot2: slots[1], slot3: slots[2], slot4: slots[3], slot5: slots[4],
    slot6: slots[5], slot7: slots[6], slot8: slots[7], slot9: slots[8], slot10: slots[9],
  };
  const ind: Indicators = {
    id: 'i', fetched_at: '2026-11-25T00:00:00Z', cape: 28,
    cape_history: [{ date: '2026年10月', cape: 30 }, { date: '2026年9月', cape: 32 }],
    topix_pbr: 1.7, gold_silver_ratio: 80, gold_price: null, silver_price: null,
    momentum: { us: { above_ma: true, label: 'S&P 500' }, jp: { above_ma: false, label: 'TOPIX' } },
    as_of: { cape: '2026-11-01' },
    drawdown: { sp500_usd: sp(68), sp500_jpy: null, classes: {} },
  };

  it('buildLedgerInputs：deriveMonthlyInputs と同じ規則、取れないモメンタムは null（印を残す）', () => {
    expect(buildLedgerInputs(ind, settings, 'cautious')).toEqual({
      cape: 28, pbr: 1.7, gsr: 80, momentum: { us: true, jp: false, em: null, gold: null }, cape5yMA: 31,
      as_of: { cape: '2026-11-01' }, sp500_usd: sp(68), mode: 'cautious', monthly_budget: 153_700, jp_index: 'topix', slots,
    });
  });
  it('取れなかったモメンタム（null）は計算では true と同じ', () => {
    const prev = seed('2026-10', 100_001);
    const withNull = { ...inputsWith(null), momentum: { us: null, jp: true, em: null, gold: null } };
    expect(computeLedgerMonthDetail(prev, '2026-11', withNull, { catchup: false }).calc.result)
      .toEqual(computeLedgerMonthDetail(prev, '2026-11', inputsWith(null), { catchup: false }).calc.result);
  });
  it('CAPE・PBR・金銀比率のどれかが無ければ null', () => {
    expect(buildLedgerInputs({ ...ind, cape: null }, settings, 'neutral')).toBeNull();
    expect(buildLedgerInputs({ ...ind, topix_pbr: null }, settings, 'neutral')).toBeNull();
    expect(buildLedgerInputs({ ...ind, gold_silver_ratio: null }, settings, 'neutral')).toBeNull();
  });

  it('ledgerMonthlyCalc は下書き（computeLedgerMonthDetail）と同じ形・同じ値、reserveMonthBase は opening', () => {
    const rows = [seed('2026-08', 412_345)];
    const all = [...rows, ...catchUpLedger(rows, '2026-11', inputsWith(sp(68)))];
    const draft = computeLedgerMonthDetail(all[2], '2026-11', inputsWith(sp(68)), { catchup: false });
    const calc = ledgerMonthlyCalc(all, '2026-11')!;
    expect(calc).toEqual(draft.calc);
    expect(calc.reserveMonthBase).toBe(478_745);
    expect(calc.result.newReserveBalance).toBe(all[3].closing_balance);
    expect(calc.result.crashDeployment).toBe(all[3].crash_deployment);
    expect(ledgerMonthlyCalc(all, '2026-08')).toBeNull(); // seed
    expect(ledgerMonthlyCalc(all, '2026-12')).toBeNull();
  });
  it('追いつきの月の表示は暴落なし', () => {
    const rows = [seed('2026-08', 412_345)];
    const all = [...rows, ...catchUpLedger(rows, '2026-11', inputsWith(sp(55)))];
    expect(ledgerMonthlyCalc(all, '2026-10')!.crash).toBeNull();
  });
});

describe('画面の下書き draftLedgerMonth・次の記録の見込み projectNextRecord', () => {
  const legacy: UserMaSettings = { user_id: 'owner', ...DEFAULT_SETTINGS, reserve_balance: 512_347, reserve_month: '2026-09' };

  it('(1) 抜けた月があるとき、下書きの行は catchUpLedger の最後の行と同じ（月初の残高がメールの記録と食い違わない）', () => {
    const rows = [seed('2026-08', 412_345)];
    const recorded = catchUpLedger(rows, '2026-11', inputsWith(sp(68)));
    const draft = draftLedgerMonth(rows, legacy, '2026-11', inputsWith(sp(68)));
    expect(draft.row).toEqual(recorded.at(-1));
    expect(draft.row.opening_balance).toBe(478_745);
    expect(draft.calc).toEqual(ledgerMonthlyCalc([...rows, ...recorded], '2026-11'));
  });

  it('(2) 台帳が空なら seedFromLegacy(settings, month) から作る', () => {
    // seed は 2026-09 末 512,347 → 10月は追いつき → 11月の月初 545,547
    const draft = draftLedgerMonth([], legacy, '2026-11', inputsWith(sp(85)));
    const s = seedFromLegacy(legacy, '2026-11');
    expect(draft.row).toEqual(catchUpLedger([s], '2026-11', inputsWith(sp(85))).at(-1));
    expect(draft.row.opening_balance).toBe(545_547);
    expect(draft.row.closing_balance).toBe(578_747);
  });

  it('(3) month の行が既にあっても base には入れない（month より前の行だけ）', () => {
    const rows = [seed('2026-08', 412_345)];
    const recorded = catchUpLedger(rows, '2026-11', inputsWith(sp(68)));
    const withOverride = recorded.map((r) => (r.month === '2026-11' ? { ...r, override_balance: 1_234 } : r));
    const draft = draftLedgerMonth([...rows, ...withOverride], legacy, '2026-11', inputsWith(sp(68)));
    expect(draft.row).toEqual(recorded.at(-1)); // 11月の行（上書き付き）を前の行にしない
    expect(draft.row.opening_balance).toBe(478_745);
  });

  it('(4a) 最後の行が今月以上なら、その翌月の見込み', () => {
    const rows = [seed('2026-08', 412_345)];
    const all = [...rows, ...catchUpLedger(rows, '2026-11', inputsWith(null))];
    const next = projectNextRecord(all, legacy, '2026-11', inputsWith(sp(68)));
    expect(next.row.month).toBe('2026-12');
    expect(next.row.catchup).toBe(false);
    expect(next.row.opening_balance).toBe(511_945);
    expect(next.calc.crash!.deployments).toEqual([{ stage: 20, amount: 170_648 }, { stage: 30, amount: 170_648 }]);
  });

  it('(4b) 最後の行が今月より前なら、今月を対象に抜けた月を追いつきで積む（空なら seed から）', () => {
    const rows = [seed('2026-08', 412_345)];
    const next = projectNextRecord(rows, legacy, '2026-11', inputsWith(sp(68)));
    expect(next.row).toEqual(catchUpLedger(rows, '2026-11', inputsWith(sp(68))).at(-1));
    expect(next.row.crash_deployment).toBe(319_162);
    const fromSeed = projectNextRecord([], legacy, '2026-11', inputsWith(sp(68)));
    expect(fromSeed.row).toEqual(draftLedgerMonth([], legacy, '2026-11', inputsWith(sp(68))).row);
    expect(fromSeed.row.opening_balance).toBe(545_547);
  });
});
