export interface OneTimeEvent {
  name: string;
  amount: number; // positive = income, negative = expense
  age: number;
}

export interface RetirementIncome {
  monthlyAmount: number;
  startAge: number;
  endAge: number;
  growthRate: number; // e.g. 0.02 for 2%
  growthStartMode: 'receiveStart' | 'retireStart'; // 受取開始年齢 or セミリタイア開始年齢
}

export interface SimulationInput {
  // 1. 基本情報
  currentAge: number;        // 今年末の年齢
  retireAge: number;         // セミリタイア予定年齢
  deathAge: number;          // 死亡想定年齢

  // 2. リタイア計画
  investmentAssets: number;  // 現在の投資資産額
  cashAssets: number;        // 現在の現金資産額
  annualLivingExpense: number; // リタイア後の生活費(年額)
  legacyAmount: number;      // 死亡時に残したい金額

  // 3. 毎月の積立
  monthlyInvestment: number; // 毎月の投資額
  monthlyCashSavings: number; // 毎月の現金貯蓄額
  savingsStartAge: number;   // 積立開始年齢
  savingsEndAge: number;     // 積立終了年齢

  // 4. ROI（利回り）
  preRetirementROI: number;  // 投資 リタイア前ROI e.g. 0.05
  postRetirementROI: number; // 投資 リタイア後ROI e.g. 0.03
  cashInterestRate: number;  // 現金貯蓄 利率 e.g. 0.001

  // 5. 税金
  investmentTaxRate: number; // 投資の取り崩し時税率 e.g. 0.20
  taxFreeRatio: number;      // 非課税投資の割合 e.g. 0 (NISA/iDeCo等)

  // 6. インフレ
  inflationRate: number;     // 想定インフレ率 e.g. 0.02

  // 7. 生活費減少
  reductionInterval: number; // 減額間隔(年)
  reductionRate: number;     // 減少率 e.g. 0.10

  // 8. 一時収支 (最大5件)
  oneTimeEvents: OneTimeEvent[];

  // 9. リタイア後収入 (最大5件)
  retirementIncomes: RetirementIncome[];

  // Current month (1-12) for partial year calculation
  currentMonth: number;
}

export interface AnnualRow {
  year: number;              // 西暦
  age: number;               // 年齢
  startBalance: number;      // L: 年始残高
  savings: number;           // M: 貯蓄・一時支出
  investmentReturn: number;  // N: 投資収益
  livingExpense: number;     // O: 生活費(インフレ・減少後)
  retirementIncome: number;  // P: リタイア後収入 + 正の一時収支
  netExpense: number;        // Q: 純生活費 (O - P, リタイア後のみ)
  preTaxExpense: number;     // R: 税引前生活費
  endBalance: number;        // S: 年末残高
  presentValue: number;      // AK: 現在価値
  isRetired: boolean;
  isDead: boolean;
}

export interface SimulationResult {
  rows: AnnualRow[];
  assetsAtRetirement: number;   // リタイア時の資産
  requiredAssets: number;       // 必要資産(現在価値の合計)
  surplus: number;              // 過不足額
  additionalMonthly: number;   // 追加必要投資額 (surplus > 0 なら 0)
  achievementScore: number;    // 達成度スコア
  scorePercent: number;        // 達成度パーセント (max 150%)
  message: string;             // 達成メッセージ
}
