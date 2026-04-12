-- ============================================================
-- optimal_portfolios テーブル（事前計算済み最適PF）
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS optimal_portfolios (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  risk_level  integer UNIQUE NOT NULL,  -- 1〜7
  allocations jsonb NOT NULL,           -- { "japan_equity": 15, "us_equity": 30, ... }（%単位）
  expected_return numeric,
  volatility numeric,
  sharpe_ratio numeric,
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE optimal_portfolios ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが読み取り可能
CREATE POLICY "optimal_portfolios_read" ON optimal_portfolios
  FOR SELECT USING (true);
