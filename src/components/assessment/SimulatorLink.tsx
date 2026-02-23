import { Link } from 'react-router-dom';

interface Props {
  expectedReturn: number;
}

export default function SimulatorLink({ expectedReturn }: Props) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <p className="text-sm text-blue-800 mb-3">
        この期待リターン（<span className="font-bold">{expectedReturn}%</span>）をシミュレーターのROI欄に入力して、セミリタイア計画を確認しましょう。
      </p>
      <Link
        to="/"
        className="inline-block bg-blue-600 text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors min-h-[44px] leading-[28px]"
      >
        シミュレーターへ移動
      </Link>
    </div>
  );
}
