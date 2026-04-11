-- ============================================================
-- アセットクラスキー統一（13クラス化）
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 不足しているアセットクラスを追加
INSERT INTO asset_class_params (asset_class, expected_return, volatility)
VALUES
  ('us_equity',      0.081, 0.200),
  ('emerging_bond',  0.042, 0.120),
  ('developed_reit', 0.058, 0.180),
  ('emerging_reit',  0.065, 0.220),
  ('gold',           0.050, 0.150)
ON CONFLICT (asset_class) DO NOTHING;
