import { useAssessment } from '../../contexts/AssessmentContext';
import { NumberField } from './FormFields';
import StepProgress from './StepProgress';

export default function StepBasicInfo() {
  const { state, updateBasicInput, setStep } = useAssessment();
  const { basicInput } = state;

  const canProceed = basicInput.age > 0 && basicInput.retireAge > basicInput.age;

  return (
    <div className="max-w-2xl mx-auto">
      <StepProgress currentStep={1} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-1">Step 1: 基本情報</h2>
        <p className="text-xs text-gray-500 mb-6">年齢とリタイア予定年齢を入力してください。</p>

        <div className="space-y-4">
          <NumberField
            label="現在の年齢"
            value={basicInput.age}
            onChange={(v) => updateBasicInput({ age: v })}
            unit="歳"
            min={18}
            max={99}
          />
          <NumberField
            label="リタイア予定年齢"
            value={basicInput.retireAge}
            onChange={(v) => updateBasicInput({ retireAge: v })}
            unit="歳"
            min={basicInput.age + 1}
            max={99}
          />

          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
            投資期間: <span className="font-bold">{Math.max(0, basicInput.retireAge - basicInput.age)}</span> 年
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={() => setStep(0)}
            className="flex-1 py-3 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 min-h-[44px]"
          >
            戻る
          </button>
          <button
            onClick={() => setStep(2)}
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
