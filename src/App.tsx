import { useState, useMemo } from 'react';
import type { SimulationInput } from './types';
import { runSimulation } from './logic/simulator';
import { useAuth } from './contexts/AuthContext';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import ResetPassword from './components/auth/ResetPassword';
import InputForm from './components/InputForm';
import ResultSummary from './components/ResultSummary';
import BalanceChart from './components/BalanceChart';
import AchievementGauge from './components/AchievementGauge';
import BalanceSheet from './components/BalanceSheet';

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
    monthlyAmount: 0,
    startAge: 0,
    endAge: 0,
    growthRate: 0,
    growthStartMode: 'receiveStart' as const,
  })),
  currentMonth: new Date().getMonth() + 1,
};

function App() {
  const { user, loading, signOut } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register' | 'reset'>('login');
  const [input, setInput] = useState<SimulationInput>(defaultInput);
  const [showTable, setShowTable] = useState(false);

  const result = useMemo(() => runSimulation(input), [input]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    if (authView === 'register') {
      return <RegisterForm onSwitchToLogin={() => setAuthView('login')} />;
    }
    if (authView === 'reset') {
      return <ResetPassword onSwitchToLogin={() => setAuthView('login')} />;
    }
    return (
      <LoginForm
        onSwitchToRegister={() => setAuthView('register')}
        onSwitchToReset={() => setAuthView('reset')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-3 py-2 md:px-4 md:py-3 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-sm md:text-lg font-bold text-gray-800">
            セミリタイア ライフ・マネー・シミュレーション
          </h1>
          <p className="text-xs text-gray-500 hidden sm:block">Semi-Retire Life & Money Simulator</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 hidden md:inline">
            {user.user_metadata?.full_name || user.email}
          </span>
          <button
            onClick={signOut}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-3 py-2 md:px-2 md:py-1 min-h-[44px] md:min-h-0"
          >
            ログアウト
          </button>
        </div>
      </header>

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
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
