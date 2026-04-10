-- ============================================================
-- risk_model_portfolios テーブル（7段階モデル配分）
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS risk_model_portfolios (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  risk_level      integer NOT NULL,
  level_name      text NOT NULL,
  asset_class     text NOT NULL,
  ratio           numeric NOT NULL,
  expected_return numeric NOT NULL,
  volatility      numeric NOT NULL,
  sharpe_ratio    numeric NOT NULL,
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE risk_model_portfolios ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが読み取り可能（書き込みはサービスロールのみ）
CREATE POLICY "model_portfolios_read" ON risk_model_portfolios
  FOR SELECT USING (true);

-- risk_level + asset_class でユニーク
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_model_level_class
  ON risk_model_portfolios (risk_level, asset_class);

-- 初期データ投入
INSERT INTO risk_model_portfolios
  (risk_level, level_name, asset_class, ratio, expected_return, volatility, sharpe_ratio)
VALUES
  -- Lv1 超保守型
  (1, '超保守型', 'japan_equity',     0.05, 0.038, 0.031, 0.75),
  (1, '超保守型', 'developed_equity', 0.05, 0.038, 0.031, 0.75),
  (1, '超保守型', 'japan_bond',       0.80, 0.038, 0.031, 0.75),
  (1, '超保守型', 'developed_bond',   0.05, 0.038, 0.031, 0.75),
  (1, '超保守型', 'commodity',        0.05, 0.038, 0.031, 0.75),
  -- Lv2 保守型
  (2, '保守型', 'japan_equity',     0.10, 0.050, 0.062, 0.57),
  (2, '保守型', 'developed_equity', 0.10, 0.050, 0.062, 0.57),
  (2, '保守型', 'emerging_equity',  0.05, 0.050, 0.062, 0.57),
  (2, '保守型', 'japan_bond',       0.40, 0.050, 0.062, 0.57),
  (2, '保守型', 'developed_bond',   0.25, 0.050, 0.062, 0.57),
  (2, '保守型', 'commodity',        0.10, 0.050, 0.062, 0.57),
  -- Lv3 やや保守型
  (3, 'やや保守型', 'japan_equity',     0.15, 0.059, 0.089, 0.49),
  (3, 'やや保守型', 'developed_equity', 0.15, 0.059, 0.089, 0.49),
  (3, 'やや保守型', 'emerging_equity',  0.05, 0.059, 0.089, 0.49),
  (3, 'やや保守型', 'japan_bond',       0.05, 0.059, 0.089, 0.49),
  (3, 'やや保守型', 'developed_bond',   0.45, 0.059, 0.089, 0.49),
  (3, 'やや保守型', 'commodity',        0.15, 0.059, 0.089, 0.49),
  -- Lv4 バランス型
  (4, 'バランス型', 'japan_equity',     0.25, 0.067, 0.121, 0.43),
  (4, 'バランス型', 'developed_equity', 0.25, 0.067, 0.121, 0.43),
  (4, 'バランス型', 'emerging_equity',  0.10, 0.067, 0.121, 0.43),
  (4, 'バランス型', 'developed_bond',   0.25, 0.067, 0.121, 0.43),
  (4, 'バランス型', 'commodity',        0.15, 0.067, 0.121, 0.43),
  -- Lv5 やや積極型
  (5, 'やや積極型', 'japan_equity',     0.30, 0.073, 0.151, 0.39),
  (5, 'やや積極型', 'developed_equity', 0.35, 0.073, 0.151, 0.39),
  (5, 'やや積極型', 'emerging_equity',  0.15, 0.073, 0.151, 0.39),
  (5, 'やや積極型', 'developed_bond',   0.10, 0.073, 0.151, 0.39),
  (5, 'やや積極型', 'commodity',        0.10, 0.073, 0.151, 0.39),
  -- Lv6 積極型
  (6, '積極型', 'japan_equity',     0.15, 0.082, 0.199, 0.33),
  (6, '積極型', 'developed_equity', 0.45, 0.082, 0.199, 0.33),
  (6, '積極型', 'emerging_equity',  0.40, 0.082, 0.199, 0.33),
  -- Lv7 超積極型
  (7, '超積極型', 'emerging_equity', 1.00, 0.085, 0.240, 0.29)
ON CONFLICT DO NOTHING;
