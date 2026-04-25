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

// ── チャート用データ生成（2回暴落・20年シナリオ） ──
// 5年目: コロナ級（1.7σ、回復早い）、15年目: リーマン級（2.5σ、回復遅い）
// 青: 適正PFで持ち続けた人
// 橙: 攻撃的PFで耐えた人
// 赤: 攻撃的PFで売却した人

/** リスクレベル別の代表期待リターン（%） */
const CHART_LEVEL_RETURN: Record<number, number> = {
  1: 0.5, 2: 2.0, 3: 3.5, 4: 5.0, 5: 6.5, 6: 8.0, 7: 9.5,
};

interface ChartRow {
  year: number;
  label: string;
  proper: number;
  endured: number;
  sold: number;
}

function buildChartData(
  totalAmount: number,
  impact: RiskExcessImpact,
  pfLevel: number,
  toleranceLevel: number,
): ChartRow[] {
  const tolReturn = (CHART_LEVEL_RETURN[toleranceLevel] ?? 3.5) / 100;
  const pfReturn = (CHART_LEVEL_RETURN[pfLevel] ?? 6.5) / 100;

  // 適正PFの暴落下落率
  const tolCoronaCrashR = impact.toleranceCrashPercentCorona / 100;
  const tolLehmanCrashR = impact.toleranceCrashPercentLehman / 100;
  // 攻撃的PFの暴落下落率
  const pfCoronaCrashR = impact.crashPercentCorona / 100;
  const pfLehmanCrashR = impact.crashPercentLehman / 100;
  // 離脱期間（暴落種類別）
  const absCorona = Math.round(impact.absenceYearsCorona);
  const absLehman = Math.round(impact.absenceYearsLehman);

  const data: ChartRow[] = [];

  let properAsset = totalAmount;
  let enduredAsset = totalAmount;
  let soldAsset = totalAmount;
  let soldInCash = false;
  let reentryCountdown = 0;

  for (let y = 0; y <= 20; y++) {
    if (y === 0) {
      // 現在
    } else if (y === 5) {
      // コロナ級暴落
      properAsset = Math.round(properAsset * (1 - tolCoronaCrashR));
      enduredAsset = Math.round(enduredAsset * (1 - pfCoronaCrashR));
      if (!soldInCash) {
        soldAsset = Math.round(soldAsset * (1 - pfCoronaCrashR));
        soldInCash = true;
        reentryCountdown = absCorona;
      }
    } else if (y === 15) {
      // リーマン級暴落
      properAsset = Math.round(properAsset * (1 - tolLehmanCrashR));
      enduredAsset = Math.round(enduredAsset * (1 - pfLehmanCrashR));
      if (!soldInCash) {
        soldAsset = Math.round(soldAsset * (1 - pfLehmanCrashR));
        soldInCash = true;
        reentryCountdown = absLehman;
      }
    } else {
      // 通常年
      properAsset = Math.round(properAsset * (1 + tolReturn));
      enduredAsset = Math.round(enduredAsset * (1 + pfReturn));

      if (soldInCash) {
        reentryCountdown--;
        if (reentryCountdown <= 0) soldInCash = false;
      } else {
        if (y < 15) {
          soldAsset = Math.round(soldAsset * (1 + pfReturn));
        } else {
          soldAsset = Math.round(soldAsset * (1 + tolReturn));
        }
      }
    }

    const labels: Record<number, string> = {
      0: '現在', 5: 'コロナ級', 15: 'リーマン級', 20: '20年後',
    };

    data.push({
      year: y,
      label: labels[y] ?? '',
      proper: properAsset,
      endured: enduredAsset,
      sold: soldAsset,
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
    () => buildChartData(totalAmount, impact, pfLevel, assessmentLevel),
    [totalAmount, impact, pfLevel, assessmentLevel],
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

  // step 2: 第2の痛み — 売っても地獄、持ち続けても地獄
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

          {/* 二重苦の提示 */}
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium mb-2">
                売った場合
              </p>
              <p className="text-sm text-red-700">
                <span className="font-bold">{impact.crashLoss.toLocaleString()}万円</span>の含み損が確定損になります。
                さらに恐怖で市場に戻れず、回復局面を逃します。
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-800 font-medium mb-2">
                持ち続けた場合
              </p>
              <p className="text-sm text-orange-700">
                含み損<span className="font-bold">{impact.crashLoss.toLocaleString()}万円</span>を毎日見ながら耐え続ける日々。
                睡眠や仕事への影響、家族との関係悪化 — 許容度を超えた含み損は生活の質を確実に蝕みます。
              </p>
            </div>
          </div>

          <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              <span className="font-bold">どちらを選んでも辛い</span> — これが許容度を超えたPFの本質です。
              問題はあなたの意志の強さではなく、<span className="font-bold">PFのリスクレベルが合っていないこと</span>です。
            </p>
          </div>
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
            どちらの道を選んでも、許容度を超えたPFは回復局面で代償を払います。
          </p>

          <div className="grid grid-cols-1 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium mb-2">
                売った人のその後
              </p>
              <p className="text-sm text-red-700 leading-relaxed">
                暴落の記憶が残り、市場に戻れない期間は<span className="font-bold">少なくとも{impact.absenceYears}年</span>。
                しかし歴史的に、暴落直後に最大のリターンが集中しています。
                あなたの場合、離脱で逃すリターンは
                <span className="font-bold">約{impact.opportunityCost.toLocaleString()}万円</span>。
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-800 font-medium mb-2">
                耐えた人のその後
              </p>
              <p className="text-sm text-orange-700 leading-relaxed">
                回復はしますが、<span className="font-bold">{impact.crashLoss.toLocaleString()}万円</span>の含み損を抱え続けます。
                回復の速さは暴落の種類によって異なります（リーマンは約4年、コロナは約半年）。下落が深いほど元本回復までの期間は長く、その間ずっと「あのとき売っておけば」という後悔と戦うことになります。
                適正PFなら含み損は<span className="font-bold">{impact.toleranceCrashLoss.toLocaleString()}万円</span>で済み、回復も相対的に早い。
              </p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-400 shrink-0 mt-0.5">▎</span>
              <p className="text-xs text-gray-600">
                <span className="font-medium">三菱UFJ銀行データ:</span>{' '}
                リーマン時に離脱→28%の損失確定。継続保有→4年後にプラス転換、12年半後に+84%
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

          <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              <span className="font-bold">売っても耐えても、許容度を超えたPFは代償が大きい。</span><br />
              適正PFなら、浅い下落で済み、冷静に回復を待てます。
            </p>
          </div>
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
          リスクを超えたPFで暴落を迎えた場合の最大損失額
        </h4>
        <div className="space-y-2 mb-3">
          <CostRow label="第1の痛み（暴落による下落）" amount={impact.crashLoss} />
          <CostRow label="第2の痛み（底値で売却）" amount={0} note="含み損 → 確定損" />
          <CostRow label="第3の痛み（離脱による機会損失）" amount={impact.opportunityCost} />
        </div>
        <div className="border-t-2 border-red-300 pt-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-red-800">最大損失額</span>
            <span className="text-xl font-bold text-red-600">
              約{impact.totalCost.toLocaleString()}万円
            </span>
          </div>
        </div>
      </div>

      {/* 分岐チャート */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h4 className="text-sm font-bold text-gray-800 mb-1">
          20年間でコロナ級とリーマン級の暴落が来た場合
        </h4>
        <p className="text-xs text-gray-500 mb-3">
          同じ{totalAmount.toLocaleString()}万円を運用した場合の3つのシナリオ
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
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    proper: '適正PFで継続',
                    endured: '攻撃的PFで耐えた',
                    sold: '攻撃的PFで売却',
                  };
                  return [`${Number(value).toLocaleString()}万円`, labels[name as string] ?? name];
                }}
              />
              <ReferenceLine y={totalAmount} stroke="#9ca3af" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="proper"
                stroke="#2563eb"
                fill="#dbeafe"
                fillOpacity={0.3}
                strokeWidth={2}
                name="proper"
              />
              <Area
                type="monotone"
                dataKey="endured"
                stroke="#f59e0b"
                fill="none"
                strokeWidth={2}
                strokeDasharray="5 3"
                name="endured"
              />
              <Area
                type="monotone"
                dataKey="sold"
                stroke="#dc2626"
                fill="#fee2e2"
                fillOpacity={0.15}
                strokeWidth={2}
                name="sold"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1 text-xs mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-blue-600 shrink-0" />
            <span className="text-gray-600">適正PF（Lv{assessmentLevel}）で持ち続けた: {chartData[chartData.length - 1].proper.toLocaleString()}万円</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0 shrink-0 border-t-2 border-dashed border-amber-500" />
            <span className="text-gray-600">攻撃的PF（Lv{pfLevel}）で耐えた: {chartData[chartData.length - 1].endured.toLocaleString()}万円</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-red-600 shrink-0" />
            <span className="text-gray-600">攻撃的PF（Lv{pfLevel}）で売却: {chartData[chartData.length - 1].sold.toLocaleString()}万円</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          ※ 一括投資・積立なしの想定。毎月の積立を加えると、暴落後の安値で買い増す効果により複利の差はさらに拡大します<br />
          ※ 5年目にコロナ級（1.7σ）、15年目にリーマン級（2.5σ）の暴落を想定。赤線は暴落のたびに売却→離脱（コロナ後{Math.round(impact.absenceYearsCorona)}年・リーマン後{Math.round(impact.absenceYearsLehman)}年）→復帰を繰り返す
        </p>
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
                  -{impact.crashLoss.toLocaleString()}万円（-{impact.crashPercent}%）
                </td>
                <td className="py-2 px-3 text-right text-xs font-medium text-blue-700">
                  -{sliderImpact.crashLoss.toLocaleString()}万円（-{sliderImpact.crashPercent}%）
                </td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="py-2 px-3 text-xs text-gray-600">底値売却リスク</td>
                <td className="py-2 px-3 text-right text-xs font-medium text-red-600">
                  {impact.panicSell.numerator > 0
                    ? `${impact.panicSell.denominator}人に${impact.panicSell.numerator}人`
                    : 'ほぼなし'}
                </td>
                <td className="py-2 px-3 text-right text-xs font-medium text-blue-700">
                  {sliderImpact.panicSell.numerator > 0
                    ? `${sliderImpact.panicSell.denominator}人に${sliderImpact.panicSell.numerator}人`
                    : 'ほぼなし'}
                </td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="py-2 px-3 text-xs text-gray-600">離脱期間</td>
                <td className="py-2 px-3 text-right text-xs font-medium text-red-600">
                  {impact.absenceYears > 0 ? `少なくとも${impact.absenceYears}年は回復に要する` : '離脱なし'}
                </td>
                <td className="py-2 px-3 text-right text-xs font-medium text-blue-700">
                  {sliderImpact.absenceYears > 0 ? `少なくとも${sliderImpact.absenceYears}年は回復に要する` : '離脱なし'}
                </td>
              </tr>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="py-2 px-3 text-xs font-bold text-gray-700">最大損失額</td>
                <td className="py-2 px-3 text-right text-sm font-bold text-red-600">
                  {impact.totalCost.toLocaleString()}万円
                </td>
                <td className="py-2 px-3 text-right text-sm font-bold text-blue-700">
                  {sliderImpact.totalCost.toLocaleString()}万円
                </td>
              </tr>
              <tr className="border-t border-gray-200 bg-blue-50">
                <td className="py-2 px-3 text-xs font-bold text-gray-700">20年後の資産額<br /><span className="font-normal text-gray-400">（暴落2回・持ち続けた場合）</span></td>
                <td className="py-2 px-3 text-right text-sm font-bold text-red-600">
                  {impact.properValue20y.toLocaleString()}万円
                </td>
                <td className="py-2 px-3 text-right text-sm font-bold text-blue-700">
                  {sliderImpact.properValue20y.toLocaleString()}万円
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
