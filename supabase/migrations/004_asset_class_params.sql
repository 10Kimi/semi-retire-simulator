-- ============================================================
-- Asset Class Parameters (ボラティリティ・リターン・相関マスター)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE asset_class_params (
  asset_class TEXT PRIMARY KEY,
  volatility DECIMAL(6,2) NOT NULL,       -- 年率ボラティリティ（%）
  expected_return DECIMAL(6,2) NOT NULL,  -- 年率期待リターン（%）
  correlation JSONB NOT NULL DEFAULT '{}', -- 他資産との相関係数 {"japan_equity": 1.0, "us_equity": 0.65, ...}
  data_source TEXT NOT NULL DEFAULT 'yahoo_finance',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE asset_class_params ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read asset class params"
  ON asset_class_params FOR SELECT USING (true);
