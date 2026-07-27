-- 034_ma_nikkei_pbr_anchor.sql
-- 日経225 PBR の近似オートフィル用の「基準」を保存する。
-- 推定PBR = nikkei_pbr_anchor × (現在の日経225株価 / nikkei_price_anchor)。
-- 日経PBRは自動取得できないため、実測PBRを一度入力して基準化し、以降は株価変動で追う。
-- 適用: Supabase SQL Editor で実行（本プロジェクトは CLI 未使用）。

ALTER TABLE user_ma_settings ADD COLUMN nikkei_pbr_anchor numeric;
ALTER TABLE user_ma_settings ADD COLUMN nikkei_price_anchor numeric;
