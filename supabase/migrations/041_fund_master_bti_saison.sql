-- 041: fund_master の BTI とセゾン・グローバルバランスファンドの修正（2026-11-05、FI_project #25）

-- 1. BTI は英国の会社の ADR。021 で us_equity にしていたのを developed_equity（米・日除く）に戻す
UPDATE fund_master
SET asset_class = 'developed_equity', updated_at = now()
WHERE ticker = 'BTI' AND asset_class = 'us_equity';

-- 2. セゾン・グローバルバランスファンドの按分を運用レポート（2026年4月末）の構成比に合わせる
DELETE FROM fund_master
WHERE ticker = 'セゾン・グローバルバランスファンド';

INSERT INTO fund_master (ticker, fund_name, asset_class, ratio) VALUES
  ('セゾン・グローバルバランスファンド', 'セゾン・グローバルバランスファンド', 'us_equity', 0.327),
  ('セゾン・グローバルバランスファンド', 'セゾン・グローバルバランスファンド', 'developed_equity', 0.087),
  ('セゾン・グローバルバランスファンド', 'セゾン・グローバルバランスファンド', 'emerging_equity', 0.062),
  ('セゾン・グローバルバランスファンド', 'セゾン・グローバルバランスファンド', 'japan_equity', 0.027),
  ('セゾン・グローバルバランスファンド', 'セゾン・グローバルバランスファンド', 'developed_bond', 0.455),
  ('セゾン・グローバルバランスファンド', 'セゾン・グローバルバランスファンド', 'japan_bond', 0.032),
  ('セゾン・グローバルバランスファンド', 'セゾン・グローバルバランスファンド', 'cash', 0.010);
