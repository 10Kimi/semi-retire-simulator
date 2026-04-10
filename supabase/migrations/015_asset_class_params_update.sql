-- ============================================================
-- asset_class_params 更新（GPIF第5期 高成長実現ケースベース）
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ⚠ 既存の値を上書きします。実行前にバックアップを取ってください。
-- ============================================================

-- 既存データを更新
UPDATE asset_class_params SET
  expected_return = 0.075,
  volatility = 0.192,
  updated_at = now()
WHERE asset_class = 'japan_equity';

UPDATE asset_class_params SET
  expected_return = 0.081,
  volatility = 0.203,
  updated_at = now()
WHERE asset_class = 'developed_equity';

UPDATE asset_class_params SET
  expected_return = 0.085,
  volatility = 0.240,
  updated_at = now()
WHERE asset_class = 'emerging_equity';

UPDATE asset_class_params SET
  expected_return = 0.032,
  volatility = 0.026,
  updated_at = now()
WHERE asset_class = 'japan_bond';

UPDATE asset_class_params SET
  expected_return = 0.049,
  volatility = 0.097,
  updated_at = now()
WHERE asset_class = 'developed_bond';

-- 以下は既存レコードがない場合のみinsert
INSERT INTO asset_class_params (asset_class, expected_return, volatility)
VALUES
  ('japan_reit', 0.065, 0.180),
  ('commodity',  0.050, 0.170),
  ('cash',       0.015, 0.005)
ON CONFLICT (asset_class) DO UPDATE SET
  expected_return = EXCLUDED.expected_return,
  volatility = EXCLUDED.volatility,
  updated_at = now();
