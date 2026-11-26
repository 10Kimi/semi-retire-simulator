-- 050: /rb を開かなかった利用者の月の生活費をサーバーから消す（FI_project #109、D-065）
--
-- pending/rb_clear_living_cost.sql として置いていたもの。2026-11-20 オーナーの指示で migrations へ移した。
-- オーナーの生活費は、/rb を開いたときにブラウザへ移っている（11/19 に本番の /rb で確認）。ここで消すのはサーバーの写しだけ。
-- ここで消した人は、次に /rb を開くと生活費が空から始まる（入れ直せばブラウザに保存される）。
-- 消した生活費も Supabase のバックアップには保持期間のあいだ残る（D-065 の前提 (d)）。
-- オーナー本人の行も例外にしない（D-066 は /ma だけ）。

UPDATE user_rb_profile
SET monthly_living_cost = NULL
WHERE monthly_living_cost IS NOT NULL;

ALTER TABLE user_rb_profile
  ADD CONSTRAINT user_rb_profile_no_living_cost CHECK (monthly_living_cost IS NULL);
