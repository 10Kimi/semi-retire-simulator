// /ma の待機資金の台帳（FI_project #140、設計書 §13-69「台帳方式」。オーナー本人の行だけ）。
// 待機資金は「ボタンで確定した残高」ではなく「配分どおりに積み立てた前提の想定の累計」で持つ。
// 1ユーザー×対象月で1行。その月の行は、前月の行と、その行に固定した入力（LedgerInputs）だけで決まる。
// ここは純粋関数だけ（Supabase・時刻に依存しない）。読み書きは呼ぶ側（画面・scripts/ma-mail/run.ts）。
import type {
  AllocationResult,
  CrashState,
  Indicators,
  JpIndex,
  MaSlot,
  MarketMode,
  PricePoint,
  UserMaSettings,
} from './types';
import { DEFAULT_SETTINGS, SLOT_KEYS } from './types';
import { calculateAllocation, deriveMonthlyInputs, type MonthlyInputs } from './logic';
import { evaluateCrash, type CrashEvaluation } from './crash';

/** その月の計算に必要な入力を全部持つ（前月の行とこれだけで、その月の行が決まる） */
export interface LedgerInputs {
  cape: number;
  pbr: number;
  gsr: number;
  /** 取れなかったものは null（計算では画面と同じく true として扱う。メールの「取得できず（上昇扱い）」に使う） */
  momentum: { us: boolean | null; jp: boolean | null; em: boolean | null; gold: boolean | null };
  cape5yMA: number | null;
  /** indicators.as_of の写し（表示用） */
  as_of: Record<string, string | null>;
  /** 暴落の判定に使った値 */
  sp500_usd: PricePoint | null;
  mode: MarketMode;
  monthly_budget: number;
  jp_index: JpIndex;
  /** 10 スロット（口座・額・銘柄名・資産クラス） */
  slots: MaSlot[];
}

/** ma_ledger の1行 */
export interface LedgerRow {
  user_id: string;
  /** 'YYYY-MM'（対象月。押した日ではない） */
  month: string;
  /** seed = 旧列（reserve_balance 等）から作った最初の行。record = 計算した行 */
  kind: 'seed' | 'record';
  /** 追いつきで記録した月（当時の指標ではない） */
  catchup: boolean;
  /** seed は null */
  inputs: LedgerInputs | null;
  /** 月初の想定残高（前月の実効の月末残高）。seed は null */
  opening_balance: number | null;
  /** 今月の積み増し（seed は 0） */
  monthly_reserve: number;
  /** 暴落ルールによる投入額の合計（seed・追いつきの月は 0） */
  crash_deployment: number;
  /** この月に新たに発動した段階 */
  crash_triggered: number[];
  /** この月のあとの暴落の状態（seed は旧列の状態） */
  crash_state: CrashState | null;
  /** 月末の想定残高 = opening + monthly_reserve − crash_deployment（seed は旧列の残高） */
  closing_balance: number;
  /** 実際の残高で上書きした額（その月の月末）。null = 上書きなし */
  override_balance: number | null;
  override_at: string | null;
}

/** 画面・メールの表示に使う形（calculateMonthlyFromIndicators の戻り値と同じ。reserveMonthBase は opening） */
export interface LedgerMonthlyCalc {
  inputs: MonthlyInputs;
  result: AllocationResult;
  reserveMonthBase: number;
  crash: CrashEvaluation | null;
}

// --- 月 ---

export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

// --- 行の選び方 ---

/** 実効の月末残高（上書きがあればそれ）。翌月の opening はこれ */
export function effectiveClosing(row: LedgerRow): number {
  return row.override_balance ?? row.closing_balance;
}

const byMonth = (rows: LedgerRow[]) => [...rows].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));

/** 月が一番新しい行（無ければ null） */
export function latestRow(rows: LedgerRow[]): LedgerRow | null {
  const s = byMonth(rows);
  return s.length ? s[s.length - 1] : null;
}

/** 月が month より前の、一番新しい行（無ければ null） */
export function latestBefore(rows: LedgerRow[], month: string): LedgerRow | null {
  return latestRow(rows.filter((r) => r.month < month));
}

/** 実際の残高で上書きした行のうち、月が一番新しい行（無ければ null） */
export function lastOverride(rows: LedgerRow[]): LedgerRow | null {
  return latestRow(rows.filter((r) => r.override_balance != null));
}

// --- 入力 ---

/** 指標と設定から、その月の行に固定する入力を作る（deriveMonthlyInputs と同じ規則）。CAPE・PBR・金銀比率のどれかが無ければ null */
export function buildLedgerInputs(ind: Indicators, settings: UserMaSettings, mode: MarketMode): LedgerInputs | null {
  const d = deriveMonthlyInputs(ind, settings);
  if (d.cape == null || d.pbr == null || d.gsr == null) return null;
  return {
    cape: d.cape,
    pbr: d.pbr,
    gsr: d.gsr,
    momentum: { ...d.momentum },
    cape5yMA: d.cape5yMA,
    as_of: { ...(ind.as_of ?? {}) },
    sp500_usd: ind.drawdown?.sp500_usd ? { ...ind.drawdown.sp500_usd } : null,
    mode,
    monthly_budget: settings.monthly_budget,
    jp_index: settings.jp_index,
    slots: SLOT_KEYS.map((k) => ({ ...settings[k] })),
  };
}

// --- 1か月の計算 ---

function evaluateMonth(
  opening: number,
  prevCrash: CrashState | null,
  inputs: LedgerInputs,
  catchup: boolean,
): { result: AllocationResult; crash: CrashEvaluation | null } {
  // 追いつきの月は暴落を判定しない。S&P500 の値が無い月も判定しない
  const crash = !catchup && inputs.sp500_usd
    ? evaluateCrash(inputs.sp500_usd, prevCrash, opening, { strictNewHigh: true })
    : null;
  const settings: UserMaSettings = {
    user_id: '',
    ...DEFAULT_SETTINGS,
    monthly_budget: inputs.monthly_budget,
    jp_index: inputs.jp_index,
    reserve_balance: opening,
  };
  SLOT_KEYS.forEach((k, idx) => {
    settings[k] = inputs.slots[idx] ?? DEFAULT_SETTINGS[k];
  });
  const m = inputs.momentum;
  const result = calculateAllocation(
    inputs.cape, inputs.pbr, inputs.gsr, m.us ?? true, m.jp ?? true, m.em ?? true, m.gold ?? true,
    inputs.cape5yMA, settings, inputs.mode, crash?.total ?? 0,
  );
  return { result, crash };
}

function toMonthlyInputs(inputs: LedgerInputs): MonthlyInputs {
  return { cape: inputs.cape, pbr: inputs.pbr, gsr: inputs.gsr, momentum: { ...inputs.momentum }, cape5yMA: inputs.cape5yMA };
}

/**
 * 1か月の行と表示用の計算結果。画面の下書き（保存しない）にも使う。
 * 純粋関数：同じ (prev, month, inputs, opts) なら同じ結果（override は null で返す）。
 */
export function computeLedgerMonthDetail(
  prev: LedgerRow,
  month: string,
  inputs: LedgerInputs,
  opts: { catchup: boolean },
): { row: LedgerRow; calc: LedgerMonthlyCalc } {
  const opening = effectiveClosing(prev);
  const { result, crash } = evaluateMonth(opening, prev.crash_state, inputs, opts.catchup);
  const row: LedgerRow = {
    user_id: prev.user_id,
    month,
    kind: 'record',
    catchup: opts.catchup,
    inputs,
    opening_balance: opening,
    monthly_reserve: result.monthlyReserve,
    crash_deployment: result.crashDeployment,
    crash_triggered: crash ? [...crash.newlyTriggered] : [],
    crash_state: crash ? crash.nextState : prev.crash_state,
    closing_balance: result.newReserveBalance,
    override_balance: null,
    override_at: null,
  };
  return { row, calc: { inputs: toMonthlyInputs(inputs), result, reserveMonthBase: opening, crash } };
}

export function computeLedgerMonth(prev: LedgerRow, month: string, inputs: LedgerInputs, opts: { catchup: boolean }): LedgerRow {
  return computeLedgerMonthDetail(prev, month, inputs, opts).row;
}

/**
 * 記録済みの行を表示用の形に戻す（月次メール）。金額は行に記録した opening を基点にし、暴落の内訳は
 * 前の行の crash_state から計算し直す。行が無い・seed・前の行が無ければ null。
 */
export function ledgerMonthlyCalc(rows: LedgerRow[], month: string): LedgerMonthlyCalc | null {
  const row = rows.find((r) => r.month === month);
  const prev = latestBefore(rows, month);
  if (!row || !row.inputs || row.opening_balance == null || !prev) return null;
  const { result, crash } = evaluateMonth(row.opening_balance, prev.crash_state, row.inputs, row.catchup);
  return { inputs: toMonthlyInputs(row.inputs), result, reserveMonthBase: row.opening_balance, crash };
}

// --- 追いつき ---

/**
 * 最後に記録した月の次から targetMonth まで、新しく記録する行（古い順）。
 * 間の月は追いつき（今の指標で計算・暴落は判定しない）、targetMonth で暴落を1回だけ判定する。
 * 最後の行が targetMonth 以上なら空（記録済み）。rows が空なら呼ばない（先に seedFromLegacy）。
 */
export function catchUpLedger(rows: LedgerRow[], targetMonth: string, inputs: LedgerInputs): LedgerRow[] {
  const last = latestRow(rows);
  if (!last) throw new Error('catchUpLedger: 台帳が空です（先に seedFromLegacy で最初の行を作る）');
  if (last.month >= targetMonth) return [];
  const out: LedgerRow[] = [];
  let prev = last;
  for (let m = nextMonth(last.month); m <= targetMonth; m = nextMonth(m)) {
    prev = computeLedgerMonth(prev, m, inputs, { catchup: m < targetMonth });
    out.push(prev);
  }
  return out;
}

/**
 * 月次メールのジョブが month に作るのと同じ行を、保存せずに返す（画面の下書き）。
 * month より前の行だけを基にし（無ければ seedFromLegacy(settings, month) の1行）、抜けた月は追いつき（投入 0）で積んでから month の行を作る。
 */
export function draftLedgerMonth(
  rows: LedgerRow[],
  settings: UserMaSettings,
  month: string,
  inputs: LedgerInputs,
): { row: LedgerRow; calc: LedgerMonthlyCalc } {
  let prev = latestBefore(rows, month) ?? seedFromLegacy(settings, month);
  for (let m = nextMonth(prev.month); m < month; m = nextMonth(m)) {
    prev = computeLedgerMonth(prev, m, inputs, { catchup: true });
  }
  return computeLedgerMonthDetail(prev, month, inputs, { catchup: false });
}

/**
 * 次に記録される行の見込み（暴落の通知の投入額の見込みに使う）。
 * 最後の行の月が todayMonth 以上ならその翌月、そうでなければ todayMonth を対象に、rows 全部（空なら seed）から追いつきで積む。
 */
export function projectNextRecord(
  rows: LedgerRow[],
  settings: UserMaSettings,
  todayMonth: string,
  inputs: LedgerInputs,
): { row: LedgerRow; calc: LedgerMonthlyCalc } {
  const last = latestRow(rows);
  const target = last && last.month >= todayMonth ? nextMonth(last.month) : todayMonth;
  return draftLedgerMonth(rows, settings, target, inputs);
}

// --- 最初の行 ---

/** 旧列（reserve_balance・reserve_month・reserve_month_base・crash_state）から、beforeMonth の前月までの状態の行を作る */
export function seedFromLegacy(settings: UserMaSettings, beforeMonth: string): LedgerRow {
  const confirmedThisMonth = settings.reserve_month != null && settings.reserve_month >= beforeMonth;
  const balance = confirmedThisMonth
    ? settings.reserve_month_base ?? settings.reserve_balance
    : settings.reserve_balance;
  const month = confirmedThisMonth ? prevMonth(beforeMonth) : settings.reserve_month ?? prevMonth(beforeMonth);
  const cs = settings.crash_state;
  const crashState = cs ? (cs.month != null && cs.month >= beforeMonth ? cs.monthBase : cs.current) ?? null : null;
  return {
    user_id: settings.user_id,
    month,
    kind: 'seed',
    catchup: false,
    inputs: null,
    opening_balance: null,
    monthly_reserve: 0,
    crash_deployment: 0,
    crash_triggered: [],
    crash_state: crashState,
    closing_balance: balance,
    override_balance: null,
    override_at: null,
  };
}
