// ── Risk Assessment Type Definitions ──

// Income type options for capacity scoring
export type IncomeType = 'stable' | 'real_estate' | 'dividend' | 'unstable' | 'none';

// Education pattern options
export type EducationPattern =
  | 'all_public'           // 公立一貫
  | 'private_elementary'   // 私立小学校から
  | 'private_junior_high'  // 私立中学校から
  | 'private_high_school'  // 私立高校から
  | 'private_univ_arts'    // 私立大学のみ（文系）
  | 'private_univ_science' // 私立大学（理系）
  | 'private_medical'      // 私立医学部
  | 'overseas_us';         // 海外留学（米国4年）

// Child info for education cost calculation
export interface ChildInfo {
  age: number;
  educationPattern: EducationPattern;
}

// Life event for cash flow calculation
export interface LifeEventInput {
  // Children
  hasChildren: boolean;
  children: ChildInfo[];
  // Caregiving
  hasCaregiving: boolean;
  caregivingYears: number;
  // Housing
  hasHousingLoan: boolean;
  housingLoanRemaining: number; // 万円
  // Other
  otherEvents: { name: string; amount: number; age: number }[];
}

// ── Step Input Data ──

export interface StepBasicInput {
  age: number;
  retireAge: number;
}

export interface StepFinancialInput {
  currentAssets: number;    // 万円
  annualSavings: number;    // 万円
  monthlyExpenses: number;  // 万円
  emergencyMonths: number;  // 生活費の何ヶ月分
  incomeType: IncomeType;
}

// ── Capacity Scoring ──

export interface CapacitySubScore {
  key: string;
  label: string;
  score: number;
  maxScore: number;
}

export interface CapacityResult {
  totalScore: number;
  subScores: {
    timeHorizon: CapacitySubScore;
    portfolioRatio: CapacitySubScore;
    cashFlow: CapacitySubScore;
    incomeStability: CapacitySubScore;
    emergencyFund: CapacitySubScore;
  };
  cashFlowDetail: {
    educationCostTotal: number;   // インフレ調整後, 万円
    caregivingCostTotal: number;  // インフレ調整後, 万円
    housingLoanTotal: number;     // 万円
    otherEventsTotal: number;     // 万円
    totalFutureExpenses: number;  // 合計, 万円
    expenseRatio: number;         // vs 現在資産
  };
}

// ── Tolerance Scoring ──

export interface ToleranceOption {
  label: string;
  score: number;
}

export interface ToleranceQuestion {
  id: number;
  question: string;
  maxScore: number;
  options: ToleranceOption[];
}

export interface ToleranceAnswer {
  questionId: number;
  selectedIndex: number;
  score: number;
}

export interface ToleranceResult {
  totalScore: number;
  answers: ToleranceAnswer[];
}

// ── Risk Level ──

export type RiskLevel =
  | 'conservative'
  | 'moderately_conservative'
  | 'balanced'
  | 'moderately_aggressive'
  | 'aggressive';

export type LimitingFactor = 'capacity' | 'tolerance';

export interface RiskLevelInfo {
  level: RiskLevel;
  label: string;
  scoreMin: number;
  scoreMax: number;
  color: string;        // Tailwind bg class
  textColor: string;    // Tailwind text class
}

// ── Portfolio Allocation ──

export interface AssetAllocation {
  key: string;
  label: string;
  percentage: number;
  color: string; // hex color
}

export interface MarketDataInfo {
  calculatedAt: string;
  dataPeriod: string;
}

export interface PortfolioPreset {
  riskLevel: RiskLevel;
  allocations: AssetAllocation[];
  expectedReturn: number;     // e.g. 5.2 (%)
  expectedVolatility: number; // e.g. 12.0 (%)
  dataInfo?: MarketDataInfo;
}

// ── Assessment Result ──

export interface AssessmentResult {
  capacityResult: CapacityResult;
  toleranceResult: ToleranceResult;
  finalScore: number;
  riskLevel: RiskLevel;
  limitingFactor: LimitingFactor;
  portfolio: PortfolioPreset;
}

// ── Wizard State ──

export interface AssessmentWizardState {
  currentStep: number; // 0=disclaimer, 1=basic, 2=financial, 3=lifeEvents, 4=tolerance, 5=results
  hasConsented: boolean;
  basicInput: StepBasicInput;
  financialInput: StepFinancialInput;
  lifeEventInput: LifeEventInput;
  toleranceAnswers: ToleranceAnswer[];
  result: AssessmentResult | null;
}

// ── DB Types ──

export interface DbAssessmentConsent {
  id: string;
  user_id: string;
  consented_at: string;
}

export interface DbRiskAssessment {
  id: string;
  user_id: string;
  assessed_at: string;
  capacity_score: number;
  capacity_time_horizon: number;
  capacity_portfolio_ratio: number;
  capacity_cash_flow: number;
  capacity_income_stability: number;
  capacity_emergency_fund: number;
  input_age: number;
  input_retirement_age: number;
  input_current_assets: number;
  input_annual_savings: number;
  input_monthly_expenses: number;
  input_emergency_months: number;
  input_income_type: string;
  input_life_events: LifeEventInput;
  tolerance_score: number;
  tolerance_loss_reaction: number;
  tolerance_investment_goal: number;
  tolerance_volatility: number;
  tolerance_knowledge: number;
  tolerance_past_experience: number;
  final_score: number;
  risk_level: string;
  limiting_factor: string;
  recommended_allocation: Record<string, number>;
  expected_return: number;
  expected_volatility: number;
  created_at: string;
}
