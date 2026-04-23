import { useState, useMemo } from 'react';
import type { SimulationInput } from '../types';
import { runSimulation } from '../logic/simulator';
import InputForm from '../components/InputForm';
import ResultSummary from '../components/ResultSummary';
import BalanceChart from '../components/BalanceChart';
import AchievementGauge from '../components/AchievementGauge';
import BalanceSheet from '../components/BalanceSheet';
import Layout from '../components/Layout';
import { SEOHead } from '../components/seo/SEOHead';
import { JsonLd } from '../components/seo/JsonLd';
import { softwareApplicationSchema } from '../lib/seo/schemas';

const defaultInput: SimulationInput = {
  currentAge: 53,
  retireAge: 60,
  deathAge: 100,
  taxableAssets: 8000000,
  nisaAssets: 2000000,
  idecoAssets: 0,
  cashAssets: 2000000,
  annualLivingExpense: 3840000,
  legacyAmount: 0,
  monthlyTaxable: 0,
  monthlyNisa: 100000,
  monthlyIdeco: 20000,
  monthlyCash: 20000,
  savingsStartAge: 53,
  savingsEndAge: 60,
  preRetirementROI: 0.05,
  postRetirementROI: 0.03,
  cashInterestRate: 0.001,
  investmentTaxRate: 0.20,
  inflationRate: 0.02,
  reductionStartAge: 70,
  reductionInterval: 10,
  reductionRate: 0.10,
  oneTimeEvents: Array.from({ length: 5 }, () => ({ name: '', amount: 0, age: 0 })),
  retirementIncomes: Array.from({ length: 5 }, () => ({
    name: '',
    monthlyAmount: 0,
    startAge: 0,
    endAge: 0,
    growthRate: 0,
    growthStartMode: 'receiveStart' as const,
  })),
  currentMonth: new Date().getMonth() + 1,
};

export default function SimulatorPage() {
  const [input, setInput] = useState<SimulationInput>(defaultInput);
  const [showTable, setShowTable] = useState(false);

  const result = useMemo(() => runSimulation(input), [input]);

  return (
    <>
      <SEOHead
        title="FIREシミュレーター｜資産運用で経済的自由まで何年？"
        description="現在の資産・積立額・期待リターンから、経済的自由（FIRE）到達までの年数を計算。合同会社ラルゴ運営、計算結果の提供のみで投資助言ではありません。"
        canonical="/"
      />
      <JsonLd
        data={softwareApplicationSchema({
          name: 'FIREシミュレーター',
          description:
            '現在の資産・積立額・期待リターンから、経済的自由到達までの年数を計算するツール。',
          url: '/',
        })}
      />
    <Layout>
      <main className="max-w-7xl mx-auto px-3 py-4 md:px-4 md:py-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
          {/* Left: Input Form */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-3">入力パラメータ</h2>
              <InputForm input={input} onChange={setInput} />
            </div>
          </div>

          {/* Right: Results */}
          <div className="xl:col-span-2 space-y-4 md:space-y-6">
            {/* Achievement Gauge */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-3">達成度メーター</h2>
              <AchievementGauge scorePercent={result.scorePercent} />
            </div>

            {/* Result Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-3">シミュレーション結果</h2>
              <ResultSummary result={result} />
            </div>

            {/* Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-3">年末残高推移</h2>
              <BalanceChart rows={result.rows} retireAge={input.retireAge} />
            </div>

            {/* Balance Sheet */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-700">年次バランスシート</h2>
                <button
                  onClick={() => setShowTable(!showTable)}
                  className="text-xs text-blue-600 hover:text-blue-800 min-h-[44px] flex items-center px-2"
                >
                  {showTable ? '非表示' : '表示する'}
                </button>
              </div>
              {showTable && <BalanceSheet rows={result.rows} retireAge={input.retireAge} />}
            </div>

            <p className="text-xs text-gray-400 text-center">
              ※期待リターンによる複利計算のため、実際の資産増加はボラティリティの影響で下回る可能性があります
            </p>
          </div>
        </div>
      </main>
    </Layout>
    </>
  );
}
