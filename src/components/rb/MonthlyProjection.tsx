import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ASSET_CLASSES } from '../../lib/rb/types';
import type { Holdings, TargetAllocation, PeriodRebalanceResult } from '../../lib/rb/types';
import { simulateMonthly, formatMan } from '../../lib/rb/logic';

interface Props {
  holdings: Holdings;
  target: TargetAllocation;
  periodResult: PeriodRebalanceResult;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1', '#64748b',
];

export default function MonthlyProjection({ holdings, target, periodResult }: Props) {
  const [open, setOpen] = useState(false);

  const snapshots = useMemo(
    () => simulateMonthly(holdings, target, periodResult),
    [holdings, target, periodResult],
  );

  // アクティブなクラス（操作があるか保有がある）
  const activeClasses = useMemo(() => {
    return ASSET_CLASSES.filter(ac => {
      const hasTarget = (target[ac.key] || 0) > 0;
      const hasHolding = (holdings[ac.key] || 0) > 0;
      return hasTarget || hasHolding;
    });
  }, [holdings, target]);

  // グラフ用データ
  const chartData = useMemo(() => {
    return snapshots.map(snap => {
      const row: Record<string, number> = { month: snap.month };
      for (const op of snap.operations) {
        row[op.key] = op.ratio;
      }
      return row;
    });
  }, [snapshots]);

  if (snapshots.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm text-slate-300 hover:bg-slate-700 flex items-center justify-center gap-2"
      >
        <span>📊</span> 月次推移を見る <span className="text-xs text-slate-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-6">
          {/* 積み上げ面グラフ */}
          <div className="bg-slate-900 rounded-2xl p-4">
            <h4 className="text-xs text-slate-400 mb-3">アセットクラス比率の推移（%）</h4>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={v => `${v}月`}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={v => `${v}ヶ月目`}
                  formatter={(value: number | undefined, name: string | undefined) => {
                    const ac = ASSET_CLASSES.find(a => a.key === (name ?? ''));
                    return [`${(value ?? 0).toFixed(1)}%`, ac?.label ?? (name ?? '')];
                  }}
                />
                {activeClasses.map((ac, i) => (
                  <Area
                    key={ac.key}
                    type="monotone"
                    dataKey={ac.key}
                    stackId="1"
                    fill={COLORS[i % COLORS.length]}
                    stroke={COLORS[i % COLORS.length]}
                    fillOpacity={0.6}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>

            {/* 凡例 */}
            <div className="flex flex-wrap gap-3 mt-2">
              {activeClasses.map((ac, i) => (
                <div key={ac.key} className="flex items-center gap-1 text-xs text-slate-400">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span>{ac.label}</span>
                  <span className="text-slate-600">({target[ac.key] || 0}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* 月別操作テーブル */}
          <div className="bg-slate-900 rounded-2xl p-4">
            <h4 className="text-xs text-slate-400 mb-3">月別操作テーブル</h4>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="min-w-max text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-slate-500 py-2 pr-3 sticky left-0 bg-slate-900 z-10 min-w-[80px]">クラス</th>
                    {snapshots.map(snap => (
                      <th key={snap.month} className="text-center text-slate-500 py-2 px-2 min-w-[100px]" colSpan={2}>
                        {snap.month}ヶ月目
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <th className="sticky left-0 bg-slate-900 z-10"></th>
                    {snapshots.flatMap(snap => [
                      <th key={`op-${snap.month}`} className="text-center text-slate-600 py-1 px-1">操作</th>,
                      <th key={`ratio-${snap.month}`} className="text-center text-slate-600 py-1 px-1">比率</th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {activeClasses.map(ac => (
                    <tr key={ac.key} className="border-b border-slate-800/50">
                      <td className="text-slate-300 py-2 pr-3 sticky left-0 bg-slate-900 z-10 font-medium">
                        {ac.label}
                      </td>
                      {snapshots.map(snap => {
                        const op = snap.operations.find(o => o.key === ac.key);
                        if (!op) return [
                          <td key={`${snap.month}-op`} className="text-center py-2 px-1 text-slate-600">−</td>,
                          <td key={`${snap.month}-r`} className="text-center py-2 px-1 text-slate-500">−</td>,
                        ];
                        return [
                          <td key={`${snap.month}-op`} className={`text-center py-2 px-1 ${
                            op.operationAmount > 0 ? 'text-emerald-400' : op.operationAmount < 0 ? 'text-red-400' : 'text-slate-600'
                          }`}>
                            {formatMan(op.operationAmount)}
                          </td>,
                          <td key={`${snap.month}-r`} className="text-center py-2 px-1 text-slate-400">
                            {op.ratio}%{op.reachedTarget ? ' ✓' : ''}
                          </td>,
                        ];
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
