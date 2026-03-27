// ── 簡易版リスク許容度診断 型定義 ──

/** 質問の選択肢 */
export interface RiskOption {
  label: string;
  /** スコア値（Capacity: 1〜7, Tolerance: 1〜7）または補正値（負数あり） */
  value: number;
}

/** 質問定義 */
export interface RiskQuestion {
  id: string;            // "C1" | "C2" | ... | "T1" | "T2" | ...
  section: 'capacity' | 'tolerance';
  title: string;
  subtitle?: string;
  options: RiskOption[];
}

/** ユーザーの回答 */
export interface RiskAnswer {
  questionId: string;
  selectedIndex: number;
  value: number;
}

/** リスクレベル定義 */
export interface RiskLevelDef {
  level: number;         // 1〜7
  name: string;
  volatility: string;    // ボラティリティ目安
  color: string;         // Tailwind bg class
  textColor: string;     // Tailwind text class
}

/** 診断結果 */
export interface RiskSimpleResult {
  capacityScore: number;    // 1〜7
  toleranceScore: number;   // 1〜7
  finalLevel: number;       // 1〜7
  gapType: 'balanced' | 'capacity_higher' | 'tolerance_higher';
  gapMessage: string;
  levelDef: RiskLevelDef;
}
