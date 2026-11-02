import type {
  Indicators,
  CapeHistoryEntry,
  ValuationResult,
  AllocationResult,
  UserMaSettings,
  MarketMode,
  MaAssetClass,
  MaSlot,
  JpIndex,
} from './types';
import { isTaxAdvantaged } from './types';
import { evaluateCrash, resolveCrashBase, type CrashEvaluation } from './crash';

// --- バリュエーション判定（index.htmlから移植） ---

export function getCapeMultiplier(cape: number, ma5y: number | null): ValuationResult {
  // 歴史的バブル級の絶対水準チェック
  if (cape > 42) {
    return { multiplier: 0.5, label: '歴史的バブル級', color: '#dc2626', level: 'extreme', note: 'ITバブル超え（2000年: 44.2）' };
  }
  if (cape > 38) {
    return { multiplier: 0.75, label: '要警戒水準', color: '#f87171', level: 'very-high', note: '1929年の天井（32.6）超え。過去は2000年前後と2021年末のみ' };
  }

  // 相対評価ロジック
  if (!ma5y || ma5y === 0) {
    if (cape > 35) return { multiplier: 0.5, label: 'かなり割高', color: '#f87171', level: 'very-high' };
    if (cape > 30) return { multiplier: 0.75, label: '割高', color: '#fbbf24', level: 'high' };
    if (cape > 20) return { multiplier: 1.0, label: '適正', color: '#4ade80', level: 'normal' };
    if (cape > 15) return { multiplier: 1.25, label: '割安', color: '#4a9eff', level: 'low' };
    return { multiplier: 1.5, label: 'かなり割安', color: '#a78bfa', level: 'very-low' };
  }

  const deviation = ((cape - ma5y) / ma5y) * 100;
  if (deviation > 20) return { multiplier: 0.5, label: 'かなり割高', color: '#f87171', deviation, level: 'very-high' };
  if (deviation > 10) return { multiplier: 0.75, label: '割高', color: '#fbbf24', deviation, level: 'high' };
  if (deviation > -10) return { multiplier: 1.0, label: '適正', color: '#4ade80', deviation, level: 'normal' };
  if (deviation > -20) return { multiplier: 1.25, label: '割安', color: '#4a9eff', deviation, level: 'low' };
  return { multiplier: 1.5, label: 'かなり割安', color: '#a78bfa', deviation, level: 'very-low' };
}

// PBRの割高/割安しきい値。日経225はTOPIXより構造的に高PBRのため水準を上げる。
// 数値はここ1箇所で調整可能（本人の投資スタンス）。
const PBR_THRESHOLDS: Record<JpIndex, { high: number; fair: number; cheap: number }> = {
  topix: { high: 1.8, fair: 1.2, cheap: 1.0 },
  nikkei: { high: 2.0, fair: 1.5, cheap: 1.2 },
};

/**
 * 日経225 PBR の近似推定。基準PBR × (現在株価 / 基準時株価)。
 * BPS は短期でほぼ一定なので、株価変動でPBRを追う（数ヶ月ごとに基準を入れ直す前提）。
 */
/**
 * 待機資金計算の基点残高を決める。
 * 同じ月に既に更新済みならその月の「月初base」を返す（＝再実行しても加算されず最後の実行で上書き）。
 * 別の月なら現在残高が今月のbaseになる。
 */
export function resolveReserveBase(
  reserveBalance: number,
  reserveMonth: string | null,
  reserveMonthBase: number | null,
  currentMonth: string,
): number {
  if (reserveMonth === currentMonth) return reserveMonthBase ?? reserveBalance;
  return reserveBalance;
}

export function estimateNikkeiPbr(anchorPbr: number, anchorPrice: number, nowPrice: number): number {
  if (!anchorPrice || !nowPrice) return anchorPbr;
  return Math.round(anchorPbr * (nowPrice / anchorPrice) * 100) / 100;
}

export function getPbrMultiplier(pbr: number, jpIndex: JpIndex = 'topix'): ValuationResult {
  const t = PBR_THRESHOLDS[jpIndex];
  if (pbr >= t.high) return { multiplier: 0.75, label: '割高', color: '#fbbf24' };
  if (pbr >= t.fair) return { multiplier: 1.0, label: '適正', color: '#4ade80' };
  if (pbr >= t.cheap) return { multiplier: 1.25, label: '割安', color: '#4a9eff' };
  return { multiplier: 1.5, label: '大バーゲン', color: '#a78bfa' };
}

export function getGsrMultiplier(gsr: number): ValuationResult {
  if (gsr >= 90) return { multiplier: 0.5, label: '極端に割高', color: '#f87171' };
  if (gsr >= 75) return { multiplier: 0.75, label: '割高', color: '#fbbf24' };
  if (gsr >= 50) return { multiplier: 1.0, label: '適正', color: '#4ade80' };
  if (gsr >= 40) return { multiplier: 1.25, label: '割安', color: '#4a9eff' };
  return { multiplier: 1.5, label: '大バーゲン', color: '#a78bfa' };
}

// --- モード補正 ---

function applyModeCorrection(multiplier: number, mode: MarketMode): number {
  if (mode === 'bullish') return Math.min(1.5, multiplier + 0.25);
  if (mode === 'cautious') return Math.max(0.5, multiplier - 0.25);
  return multiplier;
}

// --- スロット単位の乗数ルックアップ ---

interface MultiplierSet {
  us: number;
  jp: number;
  em: number;
  gold: number;
}

/**
 * 資産クラスに対応する乗数を返す。
 * Q3 案B: us / jp / em / gold には mode 補正を適用、bond / none には適用しない。
 */
function getSlotMultiplier(ac: MaAssetClass, m: MultiplierSet, mode: MarketMode): number {
  switch (ac) {
    case 'us':
      return applyModeCorrection(m.us, mode);
    case 'jp':
      return applyModeCorrection(m.jp, mode);
    case 'em':
      return applyModeCorrection(m.em, mode);
    case 'gold':
      return applyModeCorrection(m.gold, mode);
    case 'bond':
    case 'none':
      return 1.0;
  }
}

// --- メイン計算 ---

export function calculateAllocation(
  cape: number,
  pbr: number,
  gsr: number,
  momentumUS: boolean,
  momentumJP: boolean,
  momentumEM: boolean,
  momentumGold: boolean,
  cape5yMA: number | null,
  settings: UserMaSettings,
  mode: MarketMode,
  /** 暴落ルールで待機資金から投入する額（crash.ts の evaluateCrash で計算）。スロットには足さない */
  crashDeployment = 0,
): AllocationResult {
  const capeResult = getCapeMultiplier(cape, cape5yMA);
  const pbrResult = getPbrMultiplier(pbr, settings.jp_index);
  const gsrResult = getGsrMultiplier(gsr);

  // ベース乗数（mode 補正前）
  const usBase = capeResult.multiplier * (momentumUS ? 1.0 : 0.5);
  const jpBase = pbrResult.multiplier * (momentumJP ? 1.0 : 0.5);
  const emBase = momentumEM ? 1.0 : 0.5; // バリュエーション無し、モメンタムのみ
  const goldBase = gsrResult.multiplier * (momentumGold ? 1.0 : 0.5);

  const slots: MaSlot[] = [
    settings.slot1,
    settings.slot2,
    settings.slot3,
    settings.slot4,
    settings.slot5,
    settings.slot6,
    settings.slot7,
    settings.slot8,
    settings.slot9,
    settings.slot10,
  ];

  // 非課税枠（NISAつみたて/成長・iDeCo/401k）は「満額で埋める」のが確実に有利なため、
  // バリュエーション/モメンタム/mode の調整対象外（満額固定）。調整は特定口座のみ。
  // ※ 2026-08-07 まではスロット番号で判定していたが、1つの非課税枠で複数商品を買う
  //    ケースを表現できなかったため、スロットの口座属性で判定する方式に変更。

  // 各スロットの最終投資額を算出。特定口座は掛け算で端数が出るため 1 万円単位に丸めるが、
  // 非課税枠はユーザーが入力した確定額（iDeCo の掛金など）なので丸めずそのまま使う。
  const perSlotAmount = slots.map((slot) => {
    if (isTaxAdvantaged(slot.account)) {
      return slot.amount; // 非課税枠は満額（調整も丸めもしない）
    }
    const multiplier = getSlotMultiplier(slot.asset_class, { us: usBase, jp: jpBase, em: emBase, gold: goldBase }, mode);
    return Math.round((slot.amount * multiplier) / 10000) * 10000;
  });

  const baseInvest = perSlotAmount.reduce((sum, v) => sum + v, 0);
  // iDeCo/401k もスロットとして計上されるため、スロット合計＝その月の投資額。
  // 予算との差額がそのまま待機資金になる（実在しない資金は積み上がらない）。
  const monthlyReserve = Math.max(0, settings.monthly_budget - baseInvest);

  // 待機資金の出口は暴落ルールだけ（2026-11-02 オーナー決定）。
  // それまでの「CAPE が割安なら特定口座の最初の米国株スロットに残高の 25%／50% を投入」は廃止した
  // （米国株の特定口座スロットが無い人は投入先が無く、待機資金が積み上がる一方になっていたため）。
  const totalInvest = perSlotAmount.reduce((sum, v) => sum + v, 0);
  const newReserveBalance = settings.reserve_balance + monthlyReserve - crashDeployment;

  return {
    perSlotAmount,
    monthlyReserve,
    crashDeployment,
    totalInvest,
    newReserveBalance,
    details: {
      capeResult,
      pbrResult,
      gsrResult,
      usMultiplier: applyModeCorrection(usBase, mode),
      jpMultiplier: applyModeCorrection(jpBase, mode),
      emMultiplier: applyModeCorrection(emBase, mode),
      goldMultiplier: applyModeCorrection(goldBase, mode),
    },
  };
}

// --- 指標から計算の入力値を組み立てる（画面と /ma 月次メールで共通） ---
// 2026-11-02: MonthlyAdvisorPage.tsx の中にあった組み立て処理を切り出した。
// メールが画面と1円単位で同じ結果になるよう、両方ともここを通す。

/** CAPE 5年平均（cape_history の単純平均）。履歴が無ければ null */
export function computeCape5yMA(history: CapeHistoryEntry[] | null | undefined): number | null {
  if (!history || history.length === 0) return null;
  return history.reduce((sum, h) => sum + h.cape, 0) / history.length;
}

/** 日経225 の現在値（モメンタム取得時の終値）。無ければ null */
export function nikkeiNow(ind: Indicators | null): number | null {
  return ind?.momentum?.jp?.last_price ?? null;
}

/** PBR の自動補完値: TOPIX=取得値、日経225=基準×株価比の近似推定。補完できなければ null */
export function autofillPbr(ind: Indicators, settings: UserMaSettings): number | null {
  if (settings.jp_index === 'topix') return ind.topix_pbr ? ind.topix_pbr : null;
  const now = nikkeiNow(ind);
  if (settings.nikkei_pbr_anchor != null && settings.nikkei_price_anchor && now) {
    return estimateNikkeiPbr(settings.nikkei_pbr_anchor, settings.nikkei_price_anchor, now);
  }
  return null;
}

/** 'YYYY-MM'（待機資金の月判定に使う暦月） */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface MonthlyInputs {
  cape: number | null;
  pbr: number | null;
  gsr: number | null;
  /** 取得できなかったモメンタムは null（画面は初期値 true のまま） */
  momentum: { us: boolean | null; jp: boolean | null; em: boolean | null; gold: boolean | null };
  cape5yMA: number | null;
}

/** 画面の自動補完と同じ規則で、指標と設定から計算の入力値を組み立てる */
export function deriveMonthlyInputs(ind: Indicators, settings: UserMaSettings): MonthlyInputs {
  return {
    cape: ind.cape ? ind.cape : null,
    pbr: autofillPbr(ind, settings),
    gsr: ind.gold_silver_ratio ? ind.gold_silver_ratio : null,
    momentum: {
      us: ind.momentum?.us ? ind.momentum.us.above_ma : null,
      jp: ind.momentum?.jp ? ind.momentum.jp.above_ma : null,
      em: ind.momentum?.em ? ind.momentum.em.above_ma : null,
      gold: ind.momentum?.gold ? ind.momentum.gold.above_ma : null,
    },
    cape5yMA: computeCape5yMA(ind.cape_history),
  };
}

/**
 * 画面で「計算する」を押したのと同じ計算（入力値は自動補完のまま、手で書き換えない前提）。
 * 待機資金は同月なら月初 base を基点にする（画面と同じ）。DB は書き換えない。
 * CAPE・PBR・金銀比率のどれかが無ければ null（画面も「すべての数値を入力してください」で止まる）。
 */
export function calculateMonthlyFromIndicators(
  ind: Indicators,
  settings: UserMaSettings,
  mode: MarketMode,
  now: Date,
): { inputs: MonthlyInputs; result: AllocationResult; reserveMonthBase: number; crash: CrashEvaluation | null } | null {
  const inputs = deriveMonthlyInputs(ind, settings);
  if (inputs.cape == null || inputs.pbr == null || inputs.gsr == null) return null;
  const reserveMonthBase = resolveReserveBase(
    settings.reserve_balance, settings.reserve_month, settings.reserve_month_base, monthKey(now),
  );
  const crash = evaluateCrashForMonth(ind, settings, now, reserveMonthBase);
  const result = calculateAllocation(
    inputs.cape,
    inputs.pbr,
    inputs.gsr,
    inputs.momentum.us ?? true,
    inputs.momentum.jp ?? true,
    inputs.momentum.em ?? true,
    inputs.momentum.gold ?? true,
    inputs.cape5yMA,
    { ...settings, reserve_balance: reserveMonthBase },
    mode,
    crash?.total ?? 0,
  );
  return { inputs, result, reserveMonthBase, crash };
}

/**
 * その月の暴落ルールの判定（画面とメールで共通）。S&P500 の高値データが無ければ null。
 * @param reserveMonthBase その月の計算基点の待機資金残高（resolveReserveBase の結果）
 */
export function evaluateCrashForMonth(
  ind: Indicators | null,
  settings: UserMaSettings,
  now: Date,
  reserveMonthBase: number,
): CrashEvaluation | null {
  const sp500 = ind?.drawdown?.sp500_usd;
  if (!sp500) return null;
  return evaluateCrash(sp500, resolveCrashBase(settings.crash_state, monthKey(now)), reserveMonthBase);
}

export function formatCurrency(amount: number): string {
  return '¥' + amount.toLocaleString('ja-JP');
}
