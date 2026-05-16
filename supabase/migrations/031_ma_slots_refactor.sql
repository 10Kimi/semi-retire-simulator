-- ============================================================
-- user_ma_settings: 5 枠をスロット化 + 銘柄名永続化 + asset_class 列追加
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
--
-- 背景:
--   旧 schema は 5 枠の amount を nisa_tsumitate / nisa_growth /
--   tokutei_ac_base / tokutei_gold_base / tokutei_bond として
--   持っていたが、ac/gold は資産クラス固定の乗数が適用される
--   ハードコード前提だった。
--
--   新 schema は slot{1-5}_amount / slot{1-5}_fund_name /
--   slot{1-5}_asset_class の 15 列に変更。銘柄名永続化 +
--   各スロットが任意の資産クラス（us/jp/em/gold/bond/none）を
--   選択できる構造に。
--
--   `acMultiplier` (0.666 × usMult + 0.334) は廃止、各スロットが
--   単一の asset_class に対応する純粋な乗数を取る設計に変更。
--
-- 設計書: Docs/migration_031_ma_refactor_plan.md
-- ============================================================

-- 1. 既存 amount 列を slot{N}_amount にリネーム
ALTER TABLE user_ma_settings RENAME COLUMN nisa_tsumitate    TO slot1_amount;
ALTER TABLE user_ma_settings RENAME COLUMN nisa_growth       TO slot2_amount;
ALTER TABLE user_ma_settings RENAME COLUMN tokutei_ac_base   TO slot3_amount;
ALTER TABLE user_ma_settings RENAME COLUMN tokutei_gold_base TO slot4_amount;
ALTER TABLE user_ma_settings RENAME COLUMN tokutei_bond      TO slot5_amount;

-- 2. fund_name 列を 5 個追加（銘柄名永続化、旧仕様では揮発）
ALTER TABLE user_ma_settings ADD COLUMN slot1_fund_name TEXT NOT NULL DEFAULT '';
ALTER TABLE user_ma_settings ADD COLUMN slot2_fund_name TEXT NOT NULL DEFAULT '';
ALTER TABLE user_ma_settings ADD COLUMN slot3_fund_name TEXT NOT NULL DEFAULT '';
ALTER TABLE user_ma_settings ADD COLUMN slot4_fund_name TEXT NOT NULL DEFAULT '';
ALTER TABLE user_ma_settings ADD COLUMN slot5_fund_name TEXT NOT NULL DEFAULT '';

-- 3. asset_class 列を 5 個追加 + CHECK 制約
--    DEFAULT は旧挙動を概ね保持:
--      slot1 (旧 NISA積立) = 'none'  （旧: 固定 ×1.0）
--      slot2 (旧 NISA成長) = 'none'  （旧: 固定 ×1.0）
--      slot3 (旧 特定口座 株式) = 'us'   （旧: acMultiplier 66% US 重点）
--      slot4 (旧 特定口座 ゴールド) = 'gold' （旧: goldMultiplier）
--      slot5 (旧 特定口座 債券) = 'bond' （旧: 固定 ×1.0）
ALTER TABLE user_ma_settings ADD COLUMN slot1_asset_class TEXT NOT NULL DEFAULT 'none'
  CHECK (slot1_asset_class IN ('us','jp','em','gold','bond','none'));
ALTER TABLE user_ma_settings ADD COLUMN slot2_asset_class TEXT NOT NULL DEFAULT 'none'
  CHECK (slot2_asset_class IN ('us','jp','em','gold','bond','none'));
ALTER TABLE user_ma_settings ADD COLUMN slot3_asset_class TEXT NOT NULL DEFAULT 'us'
  CHECK (slot3_asset_class IN ('us','jp','em','gold','bond','none'));
ALTER TABLE user_ma_settings ADD COLUMN slot4_asset_class TEXT NOT NULL DEFAULT 'gold'
  CHECK (slot4_asset_class IN ('us','jp','em','gold','bond','none'));
ALTER TABLE user_ma_settings ADD COLUMN slot5_asset_class TEXT NOT NULL DEFAULT 'bond'
  CHECK (slot5_asset_class IN ('us','jp','em','gold','bond','none'));
