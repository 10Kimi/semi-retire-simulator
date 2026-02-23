import type { EducationPattern, ChildInfo } from '../types/assessment';

// 教育費テーブル（2024-2025年ベース、万円）
// 仕様書セクション2.3準拠
export const EDUCATION_COST_TABLE: Record<EducationPattern, { label: string; totalCost: number }> = {
  all_public:           { label: '公立一貫（幼稚園〜大学）', totalCost: 750 },
  private_elementary:   { label: '私立小学校から',           totalCost: 1500 },
  private_junior_high:  { label: '私立中学校から',           totalCost: 1200 },
  private_high_school:  { label: '私立高校から',             totalCost: 900 },
  private_univ_arts:    { label: '私立大学のみ（文系）',     totalCost: 420 },
  private_univ_science: { label: '私立大学（理系）',         totalCost: 580 },
  private_medical:      { label: '私立医学部',               totalCost: 2350 },
  overseas_us:          { label: '海外留学（米国4年）',       totalCost: 3000 },
};

// 教育費インフレ率（年率）
const EDUCATION_INFLATION_RATE = 0.015;


/**
 * 子供1人の教育費合計（インフレ調整後、万円）
 * 子供の現在年齢から残りの教育費を、インフレ率1.5%で調整して算出
 */
export function calculateChildEducationCost(child: ChildInfo): number {
  const { totalCost } = EDUCATION_COST_TABLE[child.educationPattern];

  // 教育費が発生する残り年数の重心（平均的にあと何年後に支出するか）を概算
  // 簡易的に: 教育開始年齢(3歳)〜終了(22歳)の中間点(12.5歳)までの年数でインフレ調整
  const educationMidAge = 12.5;
  const yearsUntilMidpoint = Math.max(0, educationMidAge - child.age);

  // 既に教育段階を過ぎている場合、残りの費用を概算
  let remainingRatio = 1.0;
  if (child.age > 3) {
    // 3歳〜22歳の19年間のうち、既に経過した年数分を差し引く
    const totalEducationYears = 19;
    const yearsCompleted = Math.min(totalEducationYears, Math.max(0, child.age - 3));
    remainingRatio = Math.max(0, (totalEducationYears - yearsCompleted) / totalEducationYears);
  }

  const remainingCost = totalCost * remainingRatio;
  const inflationAdjusted = remainingCost * Math.pow(1 + EDUCATION_INFLATION_RATE, yearsUntilMidpoint);

  return Math.round(inflationAdjusted);
}

/**
 * 全子供の教育費合計（インフレ調整後、万円）
 */
export function calculateTotalEducationCost(children: ChildInfo[]): number {
  return children.reduce((sum, child) => sum + calculateChildEducationCost(child), 0);
}

/**
 * 介護費合計（インフレ調整後、万円）
 * 月8万円 × 12ヶ月 × 想定年数、インフレ率2.5%
 */
export function calculateCaregivingCost(years: number): number {
  if (years <= 0) return 0;

  const MONTHLY_CARE_COST = 8; // 万円/月
  const CARE_INFLATION_RATE = 0.025;
  const annualCost = MONTHLY_CARE_COST * 12; // 96万円/年

  let total = 0;
  for (let y = 0; y < years; y++) {
    total += annualCost * Math.pow(1 + CARE_INFLATION_RATE, y);
  }

  return Math.round(total);
}
