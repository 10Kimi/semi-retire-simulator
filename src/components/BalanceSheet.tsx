import type { AnnualRow } from '../types';

interface Props {
  rows: AnnualRow[];
  retireAge: number;
}

function formatMoney(value: number): string {
  const man = value / 10000;
  return man.toLocaleString('ja-JP', { maximumFractionDigits: 0 });
}

export default function BalanceSheet({ rows, retireAge }: Props) {
  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-gray-400 mb-1 md:hidden">← スクロールできます →</p>
      <table className="w-full min-w-[600px] text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1.5 text-center border border-gray-200 whitespace-nowrap">年</th>
            <th className="px-2 py-1.5 text-center border border-gray-200 whitespace-nowrap">年齢</th>
            <th className="px-2 py-1.5 text-right border border-gray-200 whitespace-nowrap">年始残高</th>
            <th className="px-2 py-1.5 text-right border border-gray-200 whitespace-nowrap">貯蓄</th>
            <th className="px-2 py-1.5 text-right border border-gray-200 whitespace-nowrap">投資収益</th>
            <th className="px-2 py-1.5 text-right border border-gray-200 whitespace-nowrap">生活費</th>
            <th className="px-2 py-1.5 text-right border border-gray-200 whitespace-nowrap">収入</th>
            <th className="px-2 py-1.5 text-right border border-gray-200 whitespace-nowrap">税引前費用</th>
            <th className="px-2 py-1.5 text-right border border-gray-200 whitespace-nowrap font-bold">年末残高</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isRetireYear = row.age === retireAge;
            const isZeroBalance = row.endBalance === 0 && row.isRetired;
            return (
              <tr
                key={row.age}
                className={`
                  ${isRetireYear ? 'bg-blue-50 font-semibold' : ''}
                  ${isZeroBalance ? 'bg-red-50' : ''}
                  ${row.isDead ? 'opacity-30' : ''}
                  hover:bg-gray-50
                `}
              >
                <td className="px-2 py-1 text-center border border-gray-100">{row.year}</td>
                <td className="px-2 py-1 text-center border border-gray-100">{row.age}</td>
                <td className="px-2 py-1 text-right border border-gray-100">{formatMoney(row.startBalance)}</td>
                <td className="px-2 py-1 text-right border border-gray-100">{formatMoney(row.savings)}</td>
                <td className="px-2 py-1 text-right border border-gray-100">{formatMoney(row.investmentReturn)}</td>
                <td className="px-2 py-1 text-right border border-gray-100">{formatMoney(row.livingExpense)}</td>
                <td className="px-2 py-1 text-right border border-gray-100">{formatMoney(row.retirementIncome)}</td>
                <td className="px-2 py-1 text-right border border-gray-100">
                  <span className={row.preTaxExpense > 0 ? 'text-red-600' : row.preTaxExpense < 0 ? 'text-green-600' : ''}>
                    {formatMoney(row.preTaxExpense)}
                  </span>
                </td>
                <td className={`px-2 py-1 text-right border border-gray-100 font-bold ${isZeroBalance ? 'text-red-600' : ''}`}>
                  {formatMoney(row.endBalance)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-1 text-right">※ 金額は万円単位</p>
    </div>
  );
}
