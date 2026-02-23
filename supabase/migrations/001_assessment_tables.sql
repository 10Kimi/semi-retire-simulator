-- ============================================================
-- Risk Assessment Tables
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. 免責同意記録
CREATE TABLE assessment_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  consented_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE assessment_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own consent" ON assessment_consents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own consent" ON assessment_consents FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. 診断結果
CREATE TABLE risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  assessed_at TIMESTAMPTZ DEFAULT now(),

  -- Risk Capacity
  capacity_score INTEGER NOT NULL,
  capacity_time_horizon INTEGER NOT NULL,
  capacity_portfolio_ratio INTEGER NOT NULL,
  capacity_cash_flow INTEGER NOT NULL,
  capacity_income_stability INTEGER NOT NULL,
  capacity_emergency_fund INTEGER NOT NULL,

  -- Risk Capacity 入力データ（再計算・再表示用）
  input_age INTEGER NOT NULL,
  input_retirement_age INTEGER NOT NULL,
  input_current_assets BIGINT NOT NULL,
  input_annual_savings BIGINT NOT NULL,
  input_monthly_expenses INTEGER NOT NULL,
  input_emergency_months INTEGER NOT NULL,
  input_income_type TEXT NOT NULL,
  input_life_events JSONB DEFAULT '{}',

  -- Risk Tolerance
  tolerance_score INTEGER NOT NULL,
  tolerance_loss_reaction INTEGER NOT NULL,
  tolerance_investment_goal INTEGER NOT NULL,
  tolerance_volatility INTEGER NOT NULL,
  tolerance_knowledge INTEGER NOT NULL,
  tolerance_past_experience INTEGER NOT NULL,

  -- 総合結果
  final_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  limiting_factor TEXT NOT NULL,

  -- 推奨配分
  recommended_allocation JSONB NOT NULL,
  expected_return DECIMAL(5,2) NOT NULL,
  expected_volatility DECIMAL(5,2) NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_risk_assessments_user ON risk_assessments(user_id);
CREATE INDEX idx_risk_assessments_date ON risk_assessments(assessed_at DESC);

ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own assessments" ON risk_assessments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assessments" ON risk_assessments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. 市場データ（Phase 4b用、テーブルだけ先に作成）
CREATE TABLE market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculated_at TIMESTAMPTZ DEFAULT now(),
  data_period TEXT NOT NULL,
  asset_returns JSONB NOT NULL,
  asset_risks JSONB NOT NULL,
  correlation_matrix JSONB NOT NULL,
  optimal_allocations JSONB NOT NULL,
  is_current BOOLEAN DEFAULT true
);

ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read market data" ON market_data FOR SELECT USING (true);
