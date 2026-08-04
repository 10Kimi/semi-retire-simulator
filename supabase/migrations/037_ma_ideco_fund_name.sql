-- 037_ma_ideco_fund_name.sql
-- iDeCo/401k で何を買っているかを記録するメモ欄。
--
-- 配分計算には使わない（036 と同じく iDeCo は配分対象外）。
-- 後から設定画面を開いたときに「どの商品に拠出しているか」を思い出せるようにするための記録。
-- スロット側の slot{N}_fund_name と同じ役割。
--
-- 適用: Supabase SQL Editor で実行（本プロジェクトは CLI 未使用）。

ALTER TABLE user_ma_settings ADD COLUMN ideco_fund_name text NOT NULL DEFAULT '';
