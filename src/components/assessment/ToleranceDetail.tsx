import { useState } from 'react';
import type { ToleranceResult } from '../../types/assessment';
import { TOLERANCE_QUESTIONS } from '../../logic/calculateTolerance';

interface Props {
  toleranceResult: ToleranceResult;
}

export default function ToleranceDetail({ toleranceResult }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        type="button"
        className="w-full px-4 py-3 text-left font-semibold text-sm bg-gray-50 hover:bg-gray-100 rounded-t-lg flex justify-between items-center min-h-[44px]"
        onClick={() => setOpen(!open)}
      >
        <span>
          Tolerance内訳（リスク許容度）:{' '}
          <span className="text-blue-600">{toleranceResult.totalScore}点</span> / 100点
        </span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-4">
          {TOLERANCE_QUESTIONS.map((q, qIndex) => {
            const answer = toleranceResult.answers.find((a) => a.questionId === q.id);
            const selectedOption = answer ? q.options[answer.selectedIndex] : null;

            return (
              <div key={q.id}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm text-gray-700">
                    問{qIndex + 1}. {q.question}
                  </span>
                  <span className="text-sm text-gray-800 font-medium shrink-0">
                    {answer?.score ?? 0} / {q.maxScore}
                  </span>
                </div>
                {selectedOption && (
                  <div className="ml-4 text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 inline-block">
                    {selectedOption.label}
                  </div>
                )}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${((answer?.score ?? 0) / q.maxScore) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
