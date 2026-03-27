interface Props {
  onContinue: () => void;
}

export default function RiskSectionTransition({ onContinue }: Props) {
  return (
    <div className="text-center py-8 animate-fade-in">
      <div className="text-4xl mb-4">
        <span role="img" aria-label="thinking">🤔</span>
      </div>
      <h2 className="text-lg font-bold text-gray-800 mb-3">
        ここまでお疲れさまでした
      </h2>
      <p className="text-sm text-gray-600 mb-6 leading-relaxed">
        次は、投資への感覚についていくつか質問します。<br />
        正解はありません。直感でお答えください。
      </p>
      <button
        onClick={onContinue}
        className="px-8 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
      >
        続ける
      </button>
    </div>
  );
}
