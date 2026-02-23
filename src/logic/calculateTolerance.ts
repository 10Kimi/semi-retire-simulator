import type { ToleranceQuestion, ToleranceAnswer, ToleranceResult } from '../types/assessment';

// 仕様書セクション3 準拠: 5問の心理テスト

export const TOLERANCE_QUESTIONS: ToleranceQuestion[] = [
  // Q1: 損失への反応（20点満点）
  {
    id: 1,
    question: 'ポートフォリオが1年で20%下落した場合、どうしますか？',
    maxScore: 20,
    options: [
      { label: '追加投資のチャンス。買い増す', score: 20 },
      { label: 'そのまま保有を続ける', score: 15 },
      { label: '不安だが我慢する', score: 10 },
      { label: '半分を売却する', score: 5 },
      { label: '全て売却する', score: 0 },
    ],
  },
  // Q2: 投資目的（20点満点）
  {
    id: 2,
    question: '投資の主な目的は？',
    maxScore: 20,
    options: [
      { label: '資産を大きく増やしたい（成長重視）', score: 20 },
      { label: 'インフレに負けない程度に増やしたい', score: 15 },
      { label: '安定した配当・利息収入が欲しい', score: 10 },
      { label: '元本を守りながら少しでも増やしたい', score: 5 },
      { label: '元本を絶対に守りたい', score: 0 },
    ],
  },
  // Q3: ボラティリティ許容度（20点満点）
  {
    id: 3,
    question: 'ポートフォリオの年間価格変動について、どの程度許容できますか？',
    maxScore: 20,
    options: [
      { label: '30%以上の変動も許容できる', score: 20 },
      { label: '20%程度の変動なら許容できる', score: 15 },
      { label: '10%程度の変動なら許容できる', score: 10 },
      { label: '5%程度までなら許容できる', score: 5 },
      { label: 'ほとんど変動してほしくない', score: 0 },
    ],
  },
  // Q4: 投資知識・経験（15点満点）
  {
    id: 4,
    question: '投資経験・知識について',
    maxScore: 15,
    options: [
      { label: '豊富な投資経験があり、リスクを理解している', score: 15 },
      { label: 'ある程度の投資経験がある', score: 10 },
      { label: '基本的な知識はある', score: 5 },
      { label: 'これから学びたい', score: 2 },
    ],
  },
  // Q5: 過去の損失体験（25点満点）
  {
    id: 5,
    question: '過去に大きな投資損失（20%以上）を経験したことはありますか？',
    maxScore: 25,
    options: [
      { label: 'ある。それを乗り越えて学んだ', score: 25 },
      { label: 'ない。経験してみないとわからない', score: 15 },
      { label: 'ある。二度とそうなりたくない', score: 5 },
    ],
  },
];

export function calculateTolerance(answers: ToleranceAnswer[]): ToleranceResult {
  const totalScore = answers.reduce((sum, a) => sum + a.score, 0);
  return { totalScore, answers };
}
