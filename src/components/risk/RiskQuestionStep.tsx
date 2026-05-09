import type { RiskQuestion } from '../../types/risk';

interface Props {
  question: RiskQuestion;
  selectedIndex: number | null;
  onSelect: (index: number, value: number) => void;
  onNext: () => void;
  onBack: () => void;
  isFirst: boolean;
}

export default function RiskQuestionStep({
  question,
  selectedIndex,
  onSelect,
  onNext,
  onBack,
  isFirst,
}: Props) {
  return (
    <div className="animate-fade-in">
      <h2 className="text-base md:text-lg font-bold text-gray-800 mb-1">
        {question.title}
      </h2>
      {question.subtitle && (
        <p className="text-xs text-gray-500 mb-4">{question.subtitle}</p>
      )}
      {!question.subtitle && <div className="mb-4" />}

      <div className="space-y-2">
        {question.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => onSelect(i, opt.value)}
            className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors min-h-[44px] ${
              selectedIndex === i
                ? 'border-blue-500 bg-blue-50 text-blue-800 font-medium'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex justify-between mt-6">
        <button
          onClick={onBack}
          disabled={isFirst}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
        >
          戻る
        </button>
        <button
          onClick={onNext}
          disabled={selectedIndex === null}
          className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] transition-colors"
        >
          次へ
        </button>
      </div>
    </div>
  );
}
