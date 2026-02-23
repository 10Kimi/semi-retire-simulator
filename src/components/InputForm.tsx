import { useState } from 'react';
import type { SimulationInput, OneTimeEvent, RetirementIncome } from '../types';

interface Props {
  input: SimulationInput;
  onChange: (input: SimulationInput) => void;
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg mb-3">
      <button
        type="button"
        className="w-full px-3 py-3 md:px-4 md:py-2.5 text-left font-semibold text-sm bg-gray-50 hover:bg-gray-100 rounded-t-lg flex justify-between items-center min-h-[44px]"
        onClick={() => setOpen(!open)}
      >
        {title}
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 py-3 space-y-3">{children}</div>}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  unit = '',
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
      <label className="text-sm text-gray-700 md:min-w-[160px] md:shrink-0">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          step={step}
          min={min}
          max={max}
          className="border border-gray-300 rounded px-2 py-2 text-sm w-full md:w-32 text-right min-h-[44px] md:min-h-0"
        />
        {unit && <span className="text-sm text-gray-500 shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

function PercentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
      <label className="text-sm text-gray-700 md:min-w-[160px] md:shrink-0">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={Math.round(value * 10000) / 100}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          step={0.1}
          className="border border-gray-300 rounded px-2 py-2 text-sm w-full md:w-24 text-right min-h-[44px] md:min-h-0"
        />
        <span className="text-sm text-gray-500">%</span>
      </div>
    </div>
  );
}

export default function InputForm({ input, onChange }: Props) {
  const update = <K extends keyof SimulationInput>(key: K, value: SimulationInput[K]) => {
    onChange({ ...input, [key]: value });
  };

  const updateOneTimeEvent = (index: number, field: keyof OneTimeEvent, value: string | number) => {
    const events = [...input.oneTimeEvents];
    events[index] = { ...events[index], [field]: value };
    update('oneTimeEvents', events);
  };

  const updateRetirementIncome = (index: number, field: keyof RetirementIncome, value: string | number) => {
    const incomes = [...input.retirementIncomes];
    incomes[index] = { ...incomes[index], [field]: value };
    update('retirementIncomes', incomes);
  };

  return (
    <div className="space-y-1">
      <Section title="1. 基本情報">
        <NumberField label="今年末の年齢" value={input.currentAge} onChange={(v) => update('currentAge', v)} unit="歳" />
        <NumberField label="セミリタイア予定年齢" value={input.retireAge} onChange={(v) => update('retireAge', v)} unit="歳" />
        <NumberField label="死亡想定年齢" value={input.deathAge} onChange={(v) => update('deathAge', v)} unit="歳" />
      </Section>

      <Section title="2. リタイア計画">
        <NumberField label="現在の投資資産額" value={input.investmentAssets / 10000} onChange={(v) => update('investmentAssets', v * 10000)} unit="万円" step={10} />
        <NumberField label="現在の現金資産額" value={input.cashAssets / 10000} onChange={(v) => update('cashAssets', v * 10000)} unit="万円" step={10} />
        <p className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
          金融資産総額: <span className="font-bold">{((input.investmentAssets + input.cashAssets) / 10000).toLocaleString()}</span> 万円
        </p>
        <NumberField label="リタイア後生活費(年額)" value={input.annualLivingExpense / 10000} onChange={(v) => update('annualLivingExpense', v * 10000)} unit="万円" step={1} />
        <NumberField label="死亡時に残したい金額" value={input.legacyAmount / 10000} onChange={(v) => update('legacyAmount', v * 10000)} unit="万円" step={10} />
      </Section>

      <Section title="3. 毎月の積立">
        <NumberField label="毎月の投資額" value={input.monthlyInvestment / 10000} onChange={(v) => update('monthlyInvestment', v * 10000)} unit="万円" step={1} />
        <NumberField label="毎月の現金貯蓄額" value={input.monthlyCashSavings / 10000} onChange={(v) => update('monthlyCashSavings', v * 10000)} unit="万円" step={1} />
        <NumberField label="積立開始年齢" value={input.savingsStartAge} onChange={(v) => update('savingsStartAge', v)} unit="歳" />
        <NumberField label="積立終了年齢" value={input.savingsEndAge} onChange={(v) => update('savingsEndAge', v)} unit="歳" />
      </Section>

      <Section title="4. ROI（利回り）" defaultOpen={false}>
        <PercentField label="投資 リタイア前ROI" value={input.preRetirementROI} onChange={(v) => update('preRetirementROI', v)} />
        <PercentField label="投資 リタイア後ROI" value={input.postRetirementROI} onChange={(v) => update('postRetirementROI', v)} />
        <PercentField label="現金貯蓄 利率" value={input.cashInterestRate} onChange={(v) => update('cashInterestRate', v)} />
      </Section>

      <Section title="5. 税金" defaultOpen={false}>
        <PercentField label="セミリタイア期間の税率" value={input.taxRate} onChange={(v) => update('taxRate', v)} />
      </Section>

      <Section title="6. インフレ" defaultOpen={false}>
        <PercentField label="想定インフレ率" value={input.inflationRate} onChange={(v) => update('inflationRate', v)} />
      </Section>

      <Section title="7. 生活費減少" defaultOpen={false}>
        <NumberField label="減額間隔" value={input.reductionInterval} onChange={(v) => update('reductionInterval', v)} unit="年" />
        <PercentField label="減少率" value={input.reductionRate} onChange={(v) => update('reductionRate', v)} />
      </Section>

      <Section title="8. 一時収支" defaultOpen={false}>
        <p className="text-xs text-gray-500 mb-2">正の金額 = 収入、負の金額 = 支出</p>
        <div className="space-y-2">
          {input.oneTimeEvents.map((event, i) => (
            <div key={i} className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap">
              <input
                type="text"
                placeholder="名前"
                value={event.name}
                onChange={(e) => updateOneTimeEvent(i, 'name', e.target.value)}
                className="border border-gray-300 rounded px-2 py-2 text-sm w-full md:w-28 min-h-[44px] md:min-h-0"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="金額"
                  value={event.amount ? event.amount / 10000 : ''}
                  onChange={(e) => updateOneTimeEvent(i, 'amount', Number(e.target.value) * 10000)}
                  className="border border-gray-300 rounded px-2 py-2 text-sm w-full md:w-28 text-right min-h-[44px] md:min-h-0"
                  step={10}
                />
                <span className="text-xs text-gray-500 shrink-0">万円</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="年齢"
                  value={event.age || ''}
                  onChange={(e) => updateOneTimeEvent(i, 'age', Number(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-2 text-sm w-full md:w-16 text-right min-h-[44px] md:min-h-0"
                />
                <span className="text-xs text-gray-500 shrink-0">歳</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="9. リタイア後収入" defaultOpen={false}>
        <div className="space-y-4">
          {input.retirementIncomes.map((inc, i) => (
            <div key={i} className="border border-gray-100 rounded p-3 bg-gray-50 space-y-2">
              <div className="text-xs font-semibold text-gray-600">収入 {i + 1}</div>
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                <label className="text-xs text-gray-600 min-w-[70px] md:min-w-[100px]">月額</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={inc.monthlyAmount ? inc.monthlyAmount / 10000 : ''}
                    onChange={(e) => updateRetirementIncome(i, 'monthlyAmount', Number(e.target.value) * 10000)}
                    className="border border-gray-300 rounded px-2 py-2 text-sm w-full md:w-28 text-right min-h-[44px] md:min-h-0"
                    step={1}
                  />
                  <span className="text-xs text-gray-500 shrink-0">万円</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                <label className="text-xs text-gray-600 min-w-[70px] md:min-w-[100px]">開始年齢</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={inc.startAge || ''}
                    onChange={(e) => updateRetirementIncome(i, 'startAge', Number(e.target.value))}
                    className="border border-gray-300 rounded px-2 py-2 text-sm w-full md:w-20 text-right min-h-[44px] md:min-h-0"
                  />
                  <span className="text-xs text-gray-500 shrink-0">歳</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                <label className="text-xs text-gray-600 min-w-[70px] md:min-w-[100px]">終了年齢</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={inc.endAge || ''}
                    onChange={(e) => updateRetirementIncome(i, 'endAge', Number(e.target.value))}
                    className="border border-gray-300 rounded px-2 py-2 text-sm w-full md:w-20 text-right min-h-[44px] md:min-h-0"
                  />
                  <span className="text-xs text-gray-500 shrink-0">歳</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                <label className="text-xs text-gray-600 min-w-[70px] md:min-w-[100px]">上昇率</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={Math.round(inc.growthRate * 10000) / 100 || ''}
                    onChange={(e) => updateRetirementIncome(i, 'growthRate', Number(e.target.value) / 100)}
                    className="border border-gray-300 rounded px-2 py-2 text-sm w-full md:w-20 text-right min-h-[44px] md:min-h-0"
                    step={0.1}
                  />
                  <span className="text-xs text-gray-500 shrink-0">%</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                <label className="text-xs text-gray-600 min-w-[70px] md:min-w-[100px]">上昇開始</label>
                <select
                  value={inc.growthStartMode}
                  onChange={(e) => updateRetirementIncome(i, 'growthStartMode', e.target.value)}
                  className="border border-gray-300 rounded px-2 py-2 text-sm min-h-[44px] md:min-h-0"
                >
                  <option value="receiveStart">受取開始年齢</option>
                  <option value="retireStart">セミリタイア開始年齢</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
