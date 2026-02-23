import { useAssessment } from '../../contexts/AssessmentContext';
import { NumberField, SelectField } from './FormFields';
import StepProgress from './StepProgress';

const INCOME_OPTIONS = [
  { value: 'stable', label: '安定収入（給与・年金）' },
  { value: 'real_estate', label: '不動産収入' },
  { value: 'dividend', label: '配当収入' },
  { value: 'unstable', label: '不安定（事業収入・フリーランス）' },
  { value: 'none', label: '無収入（資産取り崩し中）' },
];

export default function StepFinancialInfo() {
  const { state, updateFinancialInput, setStep } = useAssessment();
  const { financialInput } = state;

  const canProceed =
    financialInput.currentAssets >= 0 &&
    financialInput.monthlyExpenses > 0;

  return (
    <div className="max-w-2xl mx-auto">
      <StepProgress currentStep={2} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-1">Step 2: 資産・収入情報</h2>
        <p className="text-xs text-gray-500 mb-6">現在の資産状況と収入について入力してください。</p>

        <div className="space-y-4">
          <NumberField
            label="金融資産総額"
            value={financialInput.currentAssets}
            onChange={(v) => updateFinancialInput({ currentAssets: v })}
            unit="万円"
            step={100}
            min={0}
          />
          <NumberField
            label="年間貯蓄額"
            value={financialInput.annualSavings}
            onChange={(v) => updateFinancialInput({ annualSavings: v })}
            unit="万円"
            step={10}
            min={0}
          />
          <NumberField
            label="月間生活費"
            value={financialInput.monthlyExpenses}
            onChange={(v) => updateFinancialInput({ monthlyExpenses: v })}
            unit="万円"
            step={1}
            min={1}
          />
          <NumberField
            label="緊急資金（生活費の何ヶ月分）"
            value={financialInput.emergencyMonths}
            onChange={(v) => updateFinancialInput({ emergencyMonths: v })}
            unit="ヶ月"
            step={1}
            min={0}
          />
          <SelectField
            label="主な収入源"
            value={financialInput.incomeType}
            onChange={(v) => updateFinancialInput({ incomeType: v as StepFinancialInput['incomeType'] })}
            options={INCOME_OPTIONS}
          />
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={() => setStep(1)}
            className="flex-1 py-3 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 min-h-[44px]"
          >
            戻る
          </button>
          <button
            onClick={() => setStep(3)}
            disabled={!canProceed}
            className={`flex-1 py-3 rounded-lg text-sm font-semibold min-h-[44px] ${
              canProceed
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  );
}

// Type import for the cast
import type { StepFinancialInput } from '../../types/assessment';
