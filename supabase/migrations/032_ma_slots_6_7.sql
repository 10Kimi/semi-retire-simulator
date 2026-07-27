-- 032_ma_slots_6_7.sql
-- 月次投資アドバイザーの積立スロットを 5 → 7 に拡張（特定口座を 3 → 5 に）。
-- slot6 = 特定口座 4 / slot7 = 特定口座 5。既存行は none/0 で初期化される。
-- 適用: Supabase SQL Editor で本ファイルを実行（本プロジェクトは CLI 未使用）。

ALTER TABLE user_ma_settings ADD COLUMN slot6_amount integer NOT NULL DEFAULT 0;
ALTER TABLE user_ma_settings ADD COLUMN slot6_fund_name TEXT NOT NULL DEFAULT '';
ALTER TABLE user_ma_settings ADD COLUMN slot6_asset_class TEXT NOT NULL DEFAULT 'none'
  CHECK (slot6_asset_class IN ('us','jp','em','gold','bond','none'));

ALTER TABLE user_ma_settings ADD COLUMN slot7_amount integer NOT NULL DEFAULT 0;
ALTER TABLE user_ma_settings ADD COLUMN slot7_fund_name TEXT NOT NULL DEFAULT '';
ALTER TABLE user_ma_settings ADD COLUMN slot7_asset_class TEXT NOT NULL DEFAULT 'none'
  CHECK (slot7_asset_class IN ('us','jp','em','gold','bond','none'));
