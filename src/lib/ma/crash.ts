// 暴落ルール（オーナー決定、2026-11-02）。待機資金の唯一の出口。
// - 判定は S&P500（ドル建て）の過去最高値からの下落率
// - −20% に入った時点の待機資金残高を「基準残高」として記録する
// - −20%・−30% の段階では、それぞれ基準残高の 1/3 を投入する
// - −40% の段階では、その時点の残高を全額投入する
// - 各段階は1回だけ発動する。最高値を更新したら基準残高と段階をリセットする
// 投入額はスロットに足さない（何を買うかは本人が選ぶ）。「投資実行＆待機資金を更新」で残高から差し引く。
import type { CrashRecord, CrashState, PricePoint } from './types';

export const CRASH_STAGES = [20, 30, 40] as const;

export interface CrashEvaluation {
  /** 下落率（0 以下。−0.25 = −25%） */
  drawdown: number;
  /** 今回新たに条件に該当した段階 */
  newlyTriggered: number[];
  /** 段階ごとの投入額（円） */
  deployments: { stage: number; amount: number }[];
  /** 今回の投入額の合計（円） */
  total: number;
  /** 投資実行で保存する状態 */
  nextState: CrashState;
}

/** その月の計算に使う「前回までの状態」。同じ月に確定済みなら月初の状態に戻して計算し直す */
export function resolveCrashBase(record: CrashRecord | null, currentMonth: string): CrashState | null {
  if (!record) return null;
  return record.month === currentMonth ? record.monthBase : record.current;
}

/**
 * @param reserve 計算の基点にする待機資金残高（同月は月初 base。今月の積み増し分は含まない）
 */
export function evaluateCrash(sp500: PricePoint, prev: CrashState | null, reserve: number): CrashEvaluation {
  const drawdown = Math.min(0, sp500.last / sp500.ath - 1);
  const reset = !prev || sp500.ath > prev.athValue;
  const triggered = reset ? [] : prev.triggered;
  const newlyTriggered = CRASH_STAGES.filter((s) => drawdown <= -s / 100 && !triggered.includes(s));
  // 基準残高は最初の段階に入った時点の残高（一度に −30% まで落ちた場合もその時点の残高）
  const baseReserve = reset ? null : prev.baseReserve;
  const base = newlyTriggered.length > 0 && baseReserve == null ? reserve : baseReserve;

  let remaining = reserve;
  const deployments = newlyTriggered.map((stage) => {
    const amount = stage === 40 ? remaining : Math.min(remaining, Math.floor((base ?? 0) / 3));
    remaining -= amount;
    return { stage, amount };
  });

  return {
    drawdown,
    newlyTriggered: [...newlyTriggered],
    deployments,
    total: deployments.reduce((sum, d) => sum + d.amount, 0),
    nextState: {
      athValue: reset ? sp500.ath : prev.athValue,
      athDate: reset ? sp500.athDate : prev.athDate,
      triggered: [...triggered, ...newlyTriggered].sort((a, b) => a - b),
      baseReserve: base ?? null,
    },
  };
}
