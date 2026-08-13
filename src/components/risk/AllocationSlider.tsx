import { useState, useMemo, useCallback } from 'react';
import { ASSET_CLASSES, MODEL_ALLOCATIONS } from '../../lib/rb/types';
import { FALLBACK_ASSET_RETURNS, FALLBACK_ASSET_RISKS, FALLBACK_CORRELATION_MATRIX } from '../../logic/portfolioDiagnosis';
import { useAuth } from '../../contexts/AuthContext';

// ボラティリティ上限（各レベル）
const VOL_UPPER: Record<number, number> = {
  1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 16.5, 7: 100,   // 2026-08-12: Lv6上限 20→16.5
};

/** ウェイトからボラティリティを計算（pfSimple.tsと同じ式） */
function calcVolatility(weights: Record<string, number>): number {
  const keys = ASSET_CLASSES.map(ac => ac.key);
  let variance = 0;
  for (const ki of keys) {
    for (const kj of keys) {
      const wi = weights[ki] ?? 0;
      const wj = weights[kj] ?? 0;
      const si = (FALLBACK_ASSET_RISKS[ki] ?? 0) / 100;
      const sj = (FALLBACK_ASSET_RISKS[kj] ?? 0) / 100;
      const rho = FALLBACK_CORRELATION_MATRIX[ki]?.[kj] ?? (ki === kj ? 1 : 0);
      variance += wi * wj * si * sj * rho;
    }
  }
  return Math.round(Math.sqrt(Math.max(variance, 0)) * 100 * 10) / 10;
}

/** ウェイトから期待リターンを計算（加重平均） */
function calcExpectedReturn(weights: Record<string, number>): number {
  const keys = ASSET_CLASSES.map(ac => ac.key);
  let ret = 0;
  for (const k of keys) {
    ret += (weights[k] ?? 0) * (FALLBACK_ASSET_RETURNS[k] ?? 0);
  }
  return Math.round(ret * 10) / 10;
}

interface Props {
  finalLevel: number;
}

export default function AllocationSlider({ finalLevel }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // 配分state（%単位、0〜100、合計100）
  const [alloc, setAlloc] = useState<Record<string, number>>(() => {
    const base = MODEL_ALLOCATIONS[finalLevel] ?? MODEL_ALLOCATIONS[4];
    const result: Record<string, number> = {};
    ASSET_CLASSES.forEach(ac => { result[ac.key] = base[ac.key] ?? 0; });
    return result;
  });

  // アクティブなクラス（モデル配分>0 のクラスのみスライダー表示）
  const activeKeys = useMemo(() => {
    const base = MODEL_ALLOCATIONS[finalLevel] ?? MODEL_ALLOCATIONS[4];
    return ASSET_CLASSES.filter(ac => (base[ac.key] ?? 0) > 0);
  }, [finalLevel]);

  // ウェイト（0〜1）に変換して計算
  const weights = useMemo(() => {
    const w: Record<string, number> = {};
    ASSET_CLASSES.forEach(ac => { w[ac.key] = (alloc[ac.key] ?? 0) / 100; });
    return w;
  }, [alloc]);

  const volatility = useMemo(() => calcVolatility(weights), [weights]);
  const expectedReturn = useMemo(() => calcExpectedReturn(weights), [weights]);
  const volLimit = VOL_UPPER[finalLevel] ?? 100;
  const overLimit = volatility > volLimit;

  const handleSlider = useCallback((key: string, newVal: number) => {
    setAlloc(prev => {
      const oldVal = prev[key] ?? 0;
      const diff = newVal - oldVal;
      if (diff === 0) return prev;

      const next = { ...prev, [key]: newVal };

      // 他のアクティブクラスを比例配分で調整して合計100%を維持
      const otherKeys = activeKeys.filter(ac => ac.key !== key);
      const otherSum = otherKeys.reduce((s, ac) => s + (prev[ac.key] ?? 0), 0);

      if (otherSum > 0) {
        let remaining = 100 - newVal;
        // 非アクティブクラスは0固定
        ASSET_CLASSES.forEach(ac => {
          if (!activeKeys.find(a => a.key === ac.key) && ac.key !== key) {
            next[ac.key] = 0;
          }
        });

        for (let i = 0; i < otherKeys.length; i++) {
          const k = otherKeys[i].key;
          if (i === otherKeys.length - 1) {
            // 最後のクラスで端数を吸収
            next[k] = Math.max(0, Math.round(remaining));
          } else {
            const ratio = (prev[k] ?? 0) / otherSum;
            const adjusted = Math.max(0, Math.round(remaining * ratio / 5) * 5);
            next[k] = adjusted;
            remaining -= adjusted;
          }
        }
      }

      return next;
    });
  }, [activeKeys]);

  // 未ログインユーザーにはロックUI
  if (!user) {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 text-center">
        <p className="text-sm text-gray-500 mb-2">配分の調整シミュレーション</p>
        <p className="text-xs text-gray-400">ログイン後に利用可能です</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between text-sm text-gray-700 hover:bg-gray-50"
      >
        <span>配分を調整してシミュレーション</span>
        <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {/* スライダー */}
          <div className="space-y-3">
            {activeKeys.map(ac => (
              <div key={ac.key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">{ac.label}</span>
                  <span className="font-medium text-gray-800">{alloc[ac.key]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={alloc[ac.key]}
                  onChange={e => handleSlider(ac.key, Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            ))}
          </div>

          {/* 計算結果 */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">期待リターン（計算上の参考値）</span>
              <span className="font-medium text-gray-800">{expectedReturn}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">ボラティリティ</span>
              <span className={`font-medium ${overLimit ? 'text-red-600' : 'text-gray-800'}`}>
                {volatility}%
              </span>
            </div>
            {overLimit && (
              <p className="text-xs text-red-500">
                このリスクレベルの上限（{volLimit}%）を超えています
              </p>
            )}
          </div>

          {/* 合計チェック */}
          {(() => {
            const total = ASSET_CLASSES.reduce((s, ac) => s + (alloc[ac.key] ?? 0), 0);
            if (Math.abs(total - 100) > 1) {
              return <p className="text-xs text-orange-500">合計: {total}%（100%から乖離しています）</p>;
            }
            return null;
          })()}

          <p className="text-xs text-gray-400">
            この配分は計算上の参考値です。投資判断はご自身でご確認ください。
          </p>
        </div>
      )}
    </div>
  );
}
