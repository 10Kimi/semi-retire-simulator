import { useAssessment } from '../../contexts/AssessmentContext';
import { NumberField, CheckboxField, SelectField } from './FormFields';
import EducationCostTable from './EducationCostTable';
import StepProgress from './StepProgress';
import { EDUCATION_COST_TABLE, calculateTotalEducationCost } from '../../logic/educationCosts';
import type { EducationPattern, ChildInfo } from '../../types/assessment';

const EDUCATION_OPTIONS = Object.entries(EDUCATION_COST_TABLE).map(([value, { label }]) => ({
  value,
  label,
}));

export default function StepLifeEvents() {
  const { state, updateLifeEventInput, setStep } = useAssessment();
  const { lifeEventInput } = state;

  const updateChild = (index: number, updates: Partial<ChildInfo>) => {
    const children = [...lifeEventInput.children];
    children[index] = { ...children[index], ...updates };
    updateLifeEventInput({ children });
  };

  const addChild = () => {
    if (lifeEventInput.children.length < 4) {
      updateLifeEventInput({
        children: [...lifeEventInput.children, { age: 0, educationPattern: 'all_public' }],
      });
    }
  };

  const removeChild = (index: number) => {
    const children = lifeEventInput.children.filter((_, i) => i !== index);
    updateLifeEventInput({ children });
  };

  const updateOtherEvent = (index: number, field: string, value: string | number) => {
    const events = [...lifeEventInput.otherEvents];
    events[index] = { ...events[index], [field]: value };
    updateLifeEventInput({ otherEvents: events });
  };

  const addOtherEvent = () => {
    if (lifeEventInput.otherEvents.length < 3) {
      updateLifeEventInput({
        otherEvents: [...lifeEventInput.otherEvents, { name: '', amount: 0, age: 0 }],
      });
    }
  };

  const removeOtherEvent = (index: number) => {
    const events = lifeEventInput.otherEvents.filter((_, i) => i !== index);
    updateLifeEventInput({ otherEvents: events });
  };

  // Education cost display
  const educationCost = lifeEventInput.hasChildren
    ? calculateTotalEducationCost(lifeEventInput.children)
    : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <StepProgress currentStep={3} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-1">Step 3: ライフイベント</h2>
        <p className="text-xs text-gray-500 mb-6">将来の大型支出を入力してください。</p>

        <div className="space-y-6">
          {/* Children / Education */}
          <div>
            <CheckboxField
              label="子供がいる（または予定がある）"
              checked={lifeEventInput.hasChildren}
              onChange={(v) => {
                updateLifeEventInput({ hasChildren: v });
                if (v && lifeEventInput.children.length === 0) {
                  updateLifeEventInput({ children: [{ age: 0, educationPattern: 'all_public' }] });
                }
              }}
            />

            {lifeEventInput.hasChildren && (
              <div className="ml-6 mt-3 space-y-3">
                {lifeEventInput.children.map((child, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600">子供 {i + 1}</span>
                      {lifeEventInput.children.length > 1 && (
                        <button
                          onClick={() => removeChild(i)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          削除
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <NumberField
                        label="現在の年齢"
                        value={child.age}
                        onChange={(v) => updateChild(i, { age: v })}
                        unit="歳"
                        min={0}
                        max={22}
                      />
                      <SelectField
                        label="教育パターン"
                        value={child.educationPattern}
                        onChange={(v) => updateChild(i, { educationPattern: v as EducationPattern })}
                        options={EDUCATION_OPTIONS}
                      />
                    </div>
                  </div>
                ))}

                {lifeEventInput.children.length < 4 && (
                  <button
                    onClick={addChild}
                    className="text-xs text-blue-600 hover:text-blue-800 py-1"
                  >
                    + 子供を追加
                  </button>
                )}

                {educationCost > 0 && (
                  <div className="bg-blue-50 rounded-lg px-4 py-2 text-sm text-blue-800">
                    教育費合計（インフレ調整後）: <span className="font-bold">{educationCost.toLocaleString()}</span>万円
                  </div>
                )}

                <EducationCostTable />
              </div>
            )}
          </div>

          {/* Caregiving */}
          <div>
            <CheckboxField
              label="親の介護費を考慮する"
              checked={lifeEventInput.hasCaregiving}
              onChange={(v) => updateLifeEventInput({ hasCaregiving: v })}
            />

            {lifeEventInput.hasCaregiving && (
              <div className="ml-6 mt-3">
                <NumberField
                  label="想定介護年数"
                  value={lifeEventInput.caregivingYears}
                  onChange={(v) => updateLifeEventInput({ caregivingYears: v })}
                  unit="年"
                  min={1}
                  max={20}
                />
                <p className="text-xs text-gray-400 mt-1">※ 月額約8万円 × 12ヶ月で概算します</p>
              </div>
            )}
          </div>

          {/* Housing Loan */}
          <div>
            <CheckboxField
              label="住宅ローンがある"
              checked={lifeEventInput.hasHousingLoan}
              onChange={(v) => updateLifeEventInput({ hasHousingLoan: v })}
            />

            {lifeEventInput.hasHousingLoan && (
              <div className="ml-6 mt-3">
                <NumberField
                  label="ローン残高"
                  value={lifeEventInput.housingLoanRemaining}
                  onChange={(v) => updateLifeEventInput({ housingLoanRemaining: v })}
                  unit="万円"
                  step={100}
                  min={0}
                />
              </div>
            )}
          </div>

          {/* Other Events */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">その他のライフイベント</span>
              {lifeEventInput.otherEvents.length < 3 && (
                <button
                  onClick={addOtherEvent}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  + 追加
                </button>
              )}
            </div>

            {lifeEventInput.otherEvents.length > 0 && (
              <div className="mt-2 space-y-2">
                {lifeEventInput.otherEvents.map((evt, i) => (
                  <div key={i} className="flex flex-col gap-2 md:flex-row md:items-center border border-gray-100 rounded-lg p-3 bg-gray-50">
                    <input
                      type="text"
                      placeholder="名前"
                      value={evt.name}
                      onChange={(e) => updateOtherEvent(i, 'name', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-2 text-sm w-full md:w-28 min-h-[44px] md:min-h-0"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="金額"
                        value={evt.amount || ''}
                        onChange={(e) => updateOtherEvent(i, 'amount', Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-2 text-sm w-full md:w-28 text-right min-h-[44px] md:min-h-0"
                        step={10}
                      />
                      <span className="text-xs text-gray-500 shrink-0">万円</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="年齢"
                        value={evt.age || ''}
                        onChange={(e) => updateOtherEvent(i, 'age', Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-2 text-sm w-full md:w-16 text-right min-h-[44px] md:min-h-0"
                      />
                      <span className="text-xs text-gray-500 shrink-0">歳</span>
                    </div>
                    <button
                      onClick={() => removeOtherEvent(i)}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={() => setStep(2)}
            className="flex-1 py-3 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 min-h-[44px]"
          >
            戻る
          </button>
          <button
            onClick={() => setStep(4)}
            className="flex-1 py-3 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 min-h-[44px]"
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  );
}
