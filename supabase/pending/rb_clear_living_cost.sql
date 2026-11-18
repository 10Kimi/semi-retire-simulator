-- /rb を開かなかった利用者の月の生活費をサーバーから消す（FI_project #109、D-065）
--
-- まだ supabase/migrations に入れていない（db push で 047 と一緒に流れないように）。
-- 047 を適用し、画面の変更を本番に出したあと、消してよい日（オーナーが決める）に
-- supabase/migrations/ へ移して db push する。移すときは、その時点の migrations の最大の番号より大きい番号を付ける
-- （例：#111 の 046 を先に移していれば 048_rb_clear_living_cost.sql）。小さい番号だと db push に --include-all が要る。
-- ここで消した人は、次に /rb を開くと生活費が空から始まる（入れ直せばブラウザに保存される）。
-- 消した生活費も Supabase のバックアップには保持期間のあいだ残る（D-065 の前提 (d)）。
-- オーナー本人の行も例外にしない（D-066 は /ma だけ）。

UPDATE user_rb_profile
SET monthly_living_cost = NULL
WHERE monthly_living_cost IS NOT NULL;

ALTER TABLE user_rb_profile
  ADD CONSTRAINT user_rb_profile_no_living_cost CHECK (monthly_living_cost IS NULL);
