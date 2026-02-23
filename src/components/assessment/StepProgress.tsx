const STEPS = [
  { number: 1, label: '基本情報' },
  { number: 2, label: '資産・収入' },
  { number: 3, label: 'ライフイベント' },
  { number: 4, label: '心理テスト' },
];

interface Props {
  currentStep: number; // 1-4
}

export default function StepProgress({ currentStep }: Props) {
  return (
    <div className="flex items-center justify-center gap-1 md:gap-2 mb-6">
      {STEPS.map((step, i) => {
        const isActive = step.number === currentStep;
        const isCompleted = step.number < currentStep;

        return (
          <div key={step.number} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-6 md:w-10 h-0.5 mx-1 ${
                  isCompleted ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isCompleted
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isCompleted ? '✓' : step.number}
              </div>
              <span
                className={`text-xs hidden md:block ${
                  isActive ? 'text-blue-700 font-semibold' : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
