import { useState } from 'react';

// ── NumberField ──

export function NumberField({
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
      <label className="text-sm text-gray-700 md:min-w-[180px] md:shrink-0">{label}</label>
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

// ── SelectField ──

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
      <label className="text-sm text-gray-700 md:min-w-[180px] md:shrink-0">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded px-2 py-2 text-sm min-h-[44px] md:min-h-0 w-full md:w-auto"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── CheckboxField ──

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

// ── RadioGroup ──

export function RadioGroup({
  options,
  selectedIndex,
  onChange,
}: {
  options: { label: string; description?: string }[];
  selectedIndex: number | null;
  onChange: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <label
          key={i}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            selectedIndex === i
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <input
            type="radio"
            checked={selectedIndex === i}
            onChange={() => onChange(i)}
            className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <div>
            <span className="text-sm text-gray-800">{opt.label}</span>
            {opt.description && (
              <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}

// ── Section (Collapsible) ──

export function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
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
