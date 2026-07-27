-- 033_ma_jp_index.sql
-- 月次投資アドバイザーの日本株判定に使う指数を選択可能に（TOPIX / 日経225）。
-- TOPIX は自動取得済みPBRを使用、日経225は手入力（日経公式が自動取得不可のため）。
-- PBRしきい値は指数ごとに切替（logic.ts の PBR_THRESHOLDS）。
-- 適用: Supabase SQL Editor で実行（本プロジェクトは CLI 未使用）。

ALTER TABLE user_ma_settings ADD COLUMN jp_index TEXT NOT NULL DEFAULT 'topix'
  CHECK (jp_index IN ('topix', 'nikkei'));
