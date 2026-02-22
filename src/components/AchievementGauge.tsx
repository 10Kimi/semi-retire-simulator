interface Props {
  scorePercent: number;
}

export default function AchievementGauge({ scorePercent }: Props) {
  const clampedPercent = Math.min(scorePercent, 150);
  const barWidth = (clampedPercent / 150) * 100;

  const getColor = () => {
    if (clampedPercent >= 100) return 'bg-green-500';
    if (clampedPercent >= 80) return 'bg-yellow-500';
    if (clampedPercent >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-full">
      <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor()}`}
          style={{ width: `${barWidth}%` }}
        />
        {/* 100% marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-gray-600"
          style={{ left: `${(100 / 150) * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1 px-0.5">
        <span>0%</span>
        <span style={{ position: 'absolute', left: `${(100 / 150) * 100}%`, transform: 'translateX(-50%)' }} className="relative">100%</span>
        <span>150%</span>
      </div>
    </div>
  );
}
