import { useState } from 'react';
import { EDUCATION_COST_TABLE } from '../../logic/educationCosts';
import type { EducationPattern } from '../../types/assessment';

export default function EducationCostTable() {
  const [open, setOpen] = useState(false);

  const patterns = Object.entries(EDUCATION_COST_TABLE) as [EducationPattern, { label: string; totalCost: number }][];

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        type="button"
        className="w-full px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-50 flex justify-between items-center"
        onClick={() => setOpen(!open)}
      >
        教育費の目安を見る
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-1 text-gray-600 font-medium">教育パターン</th>
                <th className="text-right py-1 text-gray-600 font-medium">総額（概算）</th>
              </tr>
            </thead>
            <tbody>
              {patterns.map(([key, { label, totalCost }]) => (
                <tr key={key} className="border-b border-gray-100">
                  <td className="py-1 text-gray-700">{label}</td>
                  <td className="py-1 text-right text-gray-700">{totalCost.toLocaleString()}万円</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-2">※ 2024-2025年ベースの概算値です。インフレ率1.5%で調整されます。</p>
        </div>
      )}
    </div>
  );
}
