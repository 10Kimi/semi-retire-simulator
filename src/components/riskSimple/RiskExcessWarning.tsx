import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  calculateRiskExcessImpact,
  type RiskExcessImpact,
} from '../../logic/pfSimple';
import { getRiskLevelDef } from '../../logic/riskSimpleScoring';

interface Props {
  totalAmount: number;
  pfLevel: number;
  assessmentLevel: number;
}

// ── チャート用データ生成 ──

function buildChartData(totalAmount: number, impact: RiskExcessImpact) {
  const holdReturn = 0.065; // 持ち続けた場合の年率（近似）
  const bottomAsset = impact.soldValue;

  const data: { year: number; label: string; hold: number; sold: number }[] = [];

  for (let y = 0; y <= 13; y++) {
    let hold: number;
    let sold: number;

    if (y === 0) {
      hold = totalAmount;
      sold = totalAmount;
    } else if (y === 1) {
      // 暴落年
      hold = bottomAsset;
      sold = bottomAsset;
    } else {
      // 回復期
      hold = Math.round(bottomAsset * Math.pow(1 + holdReturn, y - 1));
      sold = bottomAsset; // 売った人は底値で確定
    }

    const labels = ['現在', '暴落', '', '', '4年後', '', '', '', '', '', '', '', '', '12年半後'];
    data.push({
      year: y,
      label: labels[y] ?? `${y}年`,
      hold: Math.round(hold),
      sold: Math.round(sold),
    });
  }
  return data;
}

// ── メインコンポーネント ──

export default function RiskExcessWarning({ totalAmount, pfLevel, assessmentLevel }: Props) {
  const [step, setStep] = useState(0); // 0: initial, 1-3: pain steps, 4: chart+slider
  const [sliderLevel, setSliderLevel] = useState(pfLevel);

  const impact = useMemo(
    () => calculateRiskExcessImpact(totalAmount, pfLevel, assessmentLevel),
    [totalAmount, pfLevel, assessmentLevel],
  );

  const sliderImpact = useMemo(
    () => calculateRiskExcessImpact(totalAmount, sliderLevel, assessmentLevel),
    [totalAmount, sliderLevel, assessmentLevel],
  );

  const chartData = useMemo(
    () => buildChartData(totalAmount, impact),
    [totalAmount, impact],
  );

  const pfDef = getRiskLevelDef(pfLevel);
  const tolDef = getRiskLevelDef(assessmentLevel);
  const sliderDef = getRiskLevelDef(sliderLevel);

  // step 0: 最初のきっかけ
  if (step === 0) {
    return (
      <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-5">
        <div className="text-center mb-4">
          <p className="text-sm font-bold text-orange-800 mb-2">
            あなたのPFには、複利の仕組みを壊すリスクがあります
          </p>
          <p className="text-xs text-orange-700 leading-relaxed">
            PFのリスクレベル（{pfDef.name}）がリスク許容度（{tolDef.name}）を超えています。<br />
            暴落が来たとき、何が起きるかを確認してみてください。
          </p>
        </div>
        <button
          onClick={() => setStep(1)}
          className="w-full py-3 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 transition-colors"
        >
          暴落シミュレーションを見る
        </button>
      </div>
    );
  }

  // step 1: 第1の痛み
  if (step === 1) {
    return (
      <div className="rounded-xl border-2 border-red-200 bg-white p-5 animate-fade-in">
        <StepIndicator current={1} />

        <p className="text-xs text-gray-500 mb-3">📅 暴落発生</p>

        <div className="text-center mb-4">
          <p className="text-sm text-gray-600 mb-1">
            あなたの{totalAmount.toLocaleString()}万円が…
          </p>

          <div className="my-4 space-y-2">
            <div className="text-2xl font-bold text-gray-800">
              {totalAmount.toLocaleString()}万円
            </div>
            <div className="text-red-500 text-lg">↓ -{impact.crashPercent}%</div>
            <div className="text-3xl font-bold text-red-600">
              {impact.soldValue.toLocaleString()}万円
            </div>
          </div>

          <p className="text-sm text-red-700 font-medium">
            失ったのは {impact.crashLoss.toLocaleString()}万円
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-blue-700">
            許容度に合ったPF（{tolDef.name}）なら、
            <span className="font-bold">-{impact.toleranceCrashPercent}%（-{impact.toleranceCrashLoss.toLocaleString()}万円）</span>
            で済んでいました。
          </p>
        </div>

        <button
          onClick={() => setStep(2)}
          className="w-full py-3 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition-colors"
        >
          次へ →
        </button>
      </div>
    );
  }

  // step 2: 第2の痛み
  if (step === 2) {
    return (
      <div className="rounded-xl border-2 border-red-200 bg-white p-5 animate-fade-in">
        <StepIndicator current={2} />

        <p className="text-xs text-gray-500 mb-3">📅 暴落から3ヶ月後 — 底値圏</p>

        <div className="space-y-4 mb-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            毎日のニュースは「さらに下がる」と報じています。<br />
            SNSでは「全部売った」という声が増えています。
          </p>

          <p className="text-sm text-gray-700 leading-relaxed">
            この状況で
            <span className="font-bold text-red-600">
              {impact.soldValue.toLocaleString()}万円
            </span>
            を持ち続けられるでしょうか？
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 font-medium mb-1">
              行動経済学の知見
            </p>
            <p className="text-sm text-red-700">
              リスク許容度を超えたPFを持つ投資家の
              <span className="font-bold text-lg">
                {' '}{impact.panicSell.denominator}人に{impact.panicSell.numerator}人
              </span>
              が底値圏で売却しています。
            </p>
          </div>

          <p className="text-sm text-gray-700">
            売却した場合、
            <span className="font-bold text-red-600">{impact.crashLoss.toLocaleString()}万円</span>
            の含み損が<span className="font-bold">確定損</span>になります。
          </p>
        </div>

        <button
          onClick={() => setStep(3)}
          className="w-full py-3 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition-colors"
        >
          次へ →
        </button>
      </div>
    );
  }

  // step 3: 第3の痛み
  if (step === 3) {
    return (
      <div className="rounded-xl border-2 border-red-200 bg-white p-5 animate-fade-in">
        <StepIndicator current={3} />

        <p className="text-xs text-gray-500 mb-3">📅 暴落後 — 回復局面</p>

        <div className="space-y-4 mb-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            暴落の記憶が残り、市場に戻れない期間は
            <span className="font-bold">平均{impact.absenceYears}年</span>。
          </p>

          <p className="text-sm text-gray-700 leading-relaxed">
            しかし歴史は、<span className="font-bold">暴落直後に最大のリターンが来る</span>ことを示しています。
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-400 shrink-0 mt-0.5">▎</span>
              <p className="text-xs text-gray-600">
                <span className="font-medium">三菱UFJ銀行データ:</span>{' '}
                リーマン時に離脱した場合28%の損失確定。継続保有した場合は4年後にプラス転換、12年半後に+84%
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-400 shrink-0 mt-0.5">▎</span>
              <p className="text-xs text-gray-600">
                <span className="font-medium">J.P. Morgan:</span>{' '}
                過去20年で最高の10日を逃すとリターンが半減。その「最高の日」は暴落の直後に集中
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-700">
            あなたの場合、{impact.absenceYears}年の離脱で逃すリターン:{' '}
            <span className="font-bold text-red-600">約{impact.opportunityCost.toLocaleString()}万円</span>
          </p>
        </div>

        <button
          onClick={() => setStep(4)}
          className="w-full py-3 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition-colors"
        >
          合計コストとチャートを見る →
        </button>
      </div>
    );
  }

  // step 4: まとめ + チャート + スライダー + 導線
  return (
    <div className="space-y-5 animate-fade-in">
      {/* 合計コスト */}
      <div className="rounded-xl border-2 border-red-200 bg-white p-5">
        <h4 className="text-sm font-bold text-gray-800 mb-4 text-center">
          リスクを超えたPFで暴落を迎えた場合の総コスト
        </h4>
        <div className="space-y-2 mb-3">
          <CostRow label="第1の痛み（暴落による下落）" amount={impact.crashLoss} />
          <CostRow label="第2の痛み（底値で売却）" amount={0} note="含み損 → 確定損" />
          <CostRow label="第3の痛み（離脱による機会損失）" amount={impact.opportunityCost} />
        </div>
        <div className="border-t-2 border-red-300 pt-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-red-800">総コスト</span>
            <span className="text-xl font-bold text-red-600">
              約{impact.totalCost.toLocaleString()}万円
            </span>
          </div>
        </div>
      </div>

      {/* 分岐チャート */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h4 className="text-sm font-bold text-gray-800 mb-1">
          持ち続けた人 vs 売った人
        </h4>
        <p className="text-xs text-gray-500 mb-3">
          三菱UFJ銀行データをあなたの{totalAmount.toLocaleString()}万円に当てはめた場合
        </p>
        <div className="w-full h-52 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={0}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => `${v.toLocaleString()}`}
                label={{ value: '万円', position: 'insideTopLeft', offset: -5, fontSize: 10 }}
              />
              <Tooltip
                formatter={(value, name) => [
                  `${Number(value).toLocaleString()}万円`,
                  name === 'hold' ? '持ち続けた人' : '売った人',
                ]}
              />
              <ReferenceLine y={totalAmount} stroke="#9ca3af" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="hold"
                stroke="#2563eb"
                fill="#dbeafe"
                strokeWidth={2}
                name="hold"
              />
              <Area
                type="monotone"
                dataKey="sold"
                stroke="#dc2626"
                fill="#fee2e2"
                strokeWidth={2}
                name="sold"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between text-xs mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-blue-600" />
            <span className="text-gray-600">持ち続けた人: {impact.holdValue12y.toLocaleString()}万円</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-red-600" />
            <span className="text-gray-600">売った人: {impact.soldValue.toLocaleString()}万円で確定</span>
          </div>
        </div>
      </div>

      {/* スライダー: リスクレベルを調整したら？ */}
      <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5">
        <h4 className="text-sm font-bold text-blue-900 mb-3">
          リスクレベルを調整したらどうなる？
        </h4>
        <p className="text-xs text-blue-700 mb-4">
          スライダーを動かして、あなたの許容度（レベル{assessmentLevel}）に合わせてみてください。
        </p>

        {/* スライダー */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500">保守</span>
            <span className="text-sm font-bold text-blue-800">
              レベル {sliderLevel} — {sliderDef.name}
            </span>
            <span className="text-xs text-gray-500">積極</span>
          </div>
          <input
            type="range"
            min={1}
            max={7}
            value={sliderLevel}
            onChange={(e) => setSliderLevel(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between mt-1">
            {[1, 2, 3, 4, 5, 6, 7].map(lv => (
              <span
                key={lv}
                className={`text-xs w-6 text-center ${
                  lv === assessmentLevel
                    ? 'text-green-600 font-bold'
                    : lv === pfLevel
                      ? 'text-red-500 font-bold'
                      : 'text-gray-400'
                }`}
              >
                {lv === assessmentLevel ? '許容' : lv === pfLevel ? '現在' : lv}
              </span>
            ))}
          </div>
        </div>

        {/* 比較テーブル */}
        <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-100">
                <th className="text-left py-2 px-3 text-xs font-medium text-blue-800" />
                <th className="text-right py-2 px-3 text-xs font-medium text-red-600">
                  現在（Lv{pfLevel}）
                </th>
                <th className="text-right py-2 px-3 text-xs font-medium text-blue-600">
                  Lv{sliderLevel}に変更
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="py-2 px-3 text-xs text-gray-600">暴落時の下落</td>
                <td className="py-2 px-3 text-right text-xs font-medium text-red-600">
                  -{impact.crashLoss.toLocaleString()}万円
                </td>
                <td className="py-2 px-3 text-right text-xs font-medium text-blue-700">
                  -{sliderImpact.crashLoss.toLocaleString()}万円
                </td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="py-2 px-3 text-xs text-gray-600">底値売却リスク</td>
                <td className="py-2 px-3 text-right text-xs font-medium text-red-600">
                  {impact.panicSell.denominator}人に{impact.panicSell.numerator}人
                </td>
                <td className="py-2 px-3 text-right text-xs font-medium text-blue-700">
                  {sliderImpact.panicSell.denominator}人に{sliderImpact.panicSell.numerator}人
                </td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="py-2 px-3 text-xs text-gray-600">離脱期間</td>
                <td className="py-2 px-3 text-right text-xs font-medium text-red-600">
                  平均{impact.absenceYears}年
                </td>
                <td className="py-2 px-3 text-right text-xs font-medium text-blue-700">
                  平均{sliderImpact.absenceYears}年
                </td>
              </tr>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="py-2 px-3 text-xs font-bold text-gray-700">総コスト</td>
                <td className="py-2 px-3 text-right text-sm font-bold text-red-600">
                  {impact.totalCost.toLocaleString()}万円
                </td>
                <td className="py-2 px-3 text-right text-sm font-bold text-blue-700">
                  {sliderImpact.totalCost.toLocaleString()}万円
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {sliderLevel <= assessmentLevel && (
          <p className="text-xs text-green-700 mt-3 text-center font-medium">
            このレベルなら、暴落時も市場に残り続けられる可能性が高まります。
          </p>
        )}
      </div>

      {/* /portfolio 導線 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
        <p className="text-sm text-gray-700 mb-1 font-medium">
          あなたの仕組みを守るために
        </p>
        <p className="text-xs text-gray-500 mb-4">
          市場に居続けることが、複利を止めない唯一の方法です。
        </p>
        <a
          href="/portfolio"
          className="inline-block px-8 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          ポートフォリオを調整する
        </a>
      </div>

      {/* 法的表記 */}
      <p className="text-xs text-gray-400 text-center leading-relaxed">
        ※ 本表示は過去の市場データ（三菱UFJ銀行、J.P. Morgan Asset Management）に基づく計算上の参考値であり、
        将来の運用成果を保証するものではありません。投資判断はご自身の責任で行ってください。
      </p>

      {/* やり直し */}
      <div className="text-center">
        <button
          onClick={() => setStep(0)}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          最初から見直す
        </button>
      </div>
    </div>
  );
}

// ── サブコンポーネント ──

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-4">
      {[1, 2, 3].map(s => (
        <div
          key={s}
          className={`h-1 flex-1 rounded-full ${
            s <= current ? 'bg-red-400' : 'bg-gray-200'
          }`}
        />
      ))}
      <span className="text-xs text-gray-400 ml-2">{current}/3</span>
    </div>
  );
}

function CostRow({ label, amount, note }: { label: string; amount: number; note?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-600">{label}</span>
      <span className="text-sm font-medium text-red-600">
        {amount > 0 ? `-${amount.toLocaleString()}万円` : note ?? '—'}
      </span>
    </div>
  );
}
