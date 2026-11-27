import { ASSET_CLASSES } from './types';
import type { TargetAllocation } from './types';

// /portfolio の「この配分を採用する」（FI_project、D-099）。保存するのは割合（%）だけ。

/** 合計が100%（±0.01）の目標配分か。/rb の「合計を100%にしてください」と同じ条件 */
export function isCompleteTarget(target: TargetAllocation | null | undefined): target is TargetAllocation {
  if (!target) return false;
  const sum = ASSET_CLASSES.reduce((s, ac) => s + (Number(target[ac.key]) || 0), 0);
  return Math.abs(sum - 100) < 0.01;
}

/**
 * 金額（万円）から割合（0.1%単位）を出す。丸めのずれは一番大きいクラスで吸収し、合計をちょうど100にする。
 * 金額の合計が0なら null。マイナスの金額は0として扱う（/rb の目標配分にマイナスを入れないため）。
 */
export function percentsFromAmounts(input: Record<string, number>): TargetAllocation | null {
  const amounts: Record<string, number> = {};
  ASSET_CLASSES.forEach(ac => { amounts[ac.key] = Math.max(0, Number(input[ac.key]) || 0); });
  const total = ASSET_CLASSES.reduce((s, ac) => s + amounts[ac.key], 0);
  if (total <= 0) return null;
  const out: TargetAllocation = {};
  let maxKey: string = ASSET_CLASSES[0].key;
  ASSET_CLASSES.forEach(ac => {
    out[ac.key] = Math.round(((amounts[ac.key] ?? 0) / total) * 1000) / 10;
    if ((amounts[ac.key] ?? 0) > (amounts[maxKey] ?? 0)) maxKey = ac.key;
  });
  const sum = ASSET_CLASSES.reduce((s, ac) => s + out[ac.key], 0);
  out[maxKey] = Math.round((out[maxKey] + (100 - sum)) * 10) / 10;
  return out;
}
