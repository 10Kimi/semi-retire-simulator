import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { AnnualRow } from '../types';

interface Props {
  rows: AnnualRow[];
  retireAge: number;
}

export default function BalanceChart({ rows, retireAge }: Props) {
  const data = rows
    .filter(r => !r.isDead)
    .map(r => ({
      age: r.age,
      endBalance: Math.round(r.endBalance / 10000), // 万円
    }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="age"
            tick={{ fontSize: 11 }}
            label={{ value: '年齢', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toLocaleString()}`}
            label={{ value: '万円', position: 'insideTopLeft', offset: -5, fontSize: 11 }}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString()}万円`, '年末残高']}
            labelFormatter={(age) => `${age}歳`}
          />
          <ReferenceLine
            x={retireAge}
            stroke="#3b82f6"
            strokeDasharray="5 5"
            label={{ value: 'リタイア', position: 'top', fontSize: 11, fill: '#3b82f6' }}
          />
          <Area
            type="monotone"
            dataKey="endBalance"
            stroke="#3b82f6"
            fill="#93c5fd"
            fillOpacity={0.4}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
