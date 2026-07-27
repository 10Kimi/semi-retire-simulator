-- 035_ma_reserve_month.sql
-- 待機資金を「同月内は最後の実行で上書き」できるようにする。
-- reserve_month: 最後に更新した月 'YYYY-MM'、reserve_month_base: その月に入る前の残高。
-- 同月に再実行すると base から計算し直すため、今月分が二重加算されない。
-- 適用: Supabase SQL Editor で実行（本プロジェクトは CLI 未使用）。

ALTER TABLE user_ma_settings ADD COLUMN reserve_month TEXT;
ALTER TABLE user_ma_settings ADD COLUMN reserve_month_base numeric;
