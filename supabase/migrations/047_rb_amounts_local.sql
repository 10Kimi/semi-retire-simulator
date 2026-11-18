-- ============================================================
-- 047: /rb の金額をサーバーに置かない（FI_project #109、D-065）
-- ============================================================
-- 残高（資産クラス別の金額）と月の生活費は、画面がブラウザ（localStorage）に持つ。
--
-- rb_snapshots：既存の金額を、保存の回ごとに割合（weight、%）と指数（total_index、その利用者の最初の回＝100）に
--   置き換えてから amount を消す。回は (user_id, created_at) で見分ける（1回の保存は1つの insert で、
--   created_at の DEFAULT now() はトランザクションの開始時刻なので、同じ回の行はすべて同じ値）。
--   オーナー本人の行も例外にしない（D-066 は /ma だけ）。
-- user_rb_profile：画面（anon・authenticated）から新しい生活費を書かせない（null にするのは可）。
--   既存の生活費はこの migration では消さない。利用者が次に /rb を開いたとき、画面が一度ブラウザへ移してから消す。
--   開かなかった人の分を消すのは supabase/pending/rb_clear_living_cost.sql（あとで別に適用する）。
--
-- 適用はオーナーが Mac で `supabase db push`（D-032）。1 つのトランザクションで流れる。
-- 適用したあと、新しいアプリのコード（rb_snapshots に書かない）を main に入れる。
-- 適用からコードの反映までのあいだ、古い画面の /rb の残高の保存は CHECK で失敗し、
-- 画面に「保有残高を保存できませんでした」が出る（計算はできる。金額は書かれない）。
-- 古い画面の生活費の保存は、トリガーで元の値のまま残る（新しい金額は書かれない）。
--
-- 注意：消した金額も Supabase のバックアップには保持期間のあいだ残る（D-065 の前提 (d)）。

-- 1) rb_snapshots に割合と指数の列を足し、金額の列の NOT NULL・既定値を外す
ALTER TABLE rb_snapshots ADD COLUMN IF NOT EXISTS weight numeric;
ALTER TABLE rb_snapshots ADD COLUMN IF NOT EXISTS total_index numeric;
ALTER TABLE rb_snapshots ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE rb_snapshots ALTER COLUMN amount DROP DEFAULT;

COMMENT ON COLUMN rb_snapshots.weight IS
  'その回の資産クラスの割合（%、小数4桁。同じ回の合計は約100）。金額は保存しない（D-065）';
COMMENT ON COLUMN rb_snapshots.total_index IS
  'その回の合計の指数（その利用者の最初の回＝100、小数4桁）。同じ回の行はすべて同じ値。金額は保存しない（D-065）';
COMMENT ON COLUMN rb_snapshots.amount IS
  '廃止（047 以降つねに null）。金額は保存しない（D-065）';

-- 2) 既存の行を割合と指数に置き換える
--    合計は 0 より大きい金額の和（画面は 0 より大きいクラスだけ保存していた）。
--    合計が 0 以下の回（あり得ないはずだが）は割合・指数とも null のまま。
WITH rounds AS (
  SELECT user_id, created_at, SUM(GREATEST(amount, 0)) AS total
  FROM rb_snapshots
  WHERE amount IS NOT NULL
  GROUP BY user_id, created_at
),
firsts AS (
  SELECT DISTINCT ON (user_id) user_id, total AS first_total
  FROM rounds
  WHERE total > 0
  ORDER BY user_id, created_at ASC
)
UPDATE rb_snapshots s
SET weight = ROUND(GREATEST(s.amount, 0) / r.total * 100, 4),
    total_index = ROUND(r.total / f.first_total * 100, 4)
FROM rounds r
JOIN firsts f ON f.user_id = r.user_id
WHERE s.user_id = r.user_id
  AND s.created_at IS NOT DISTINCT FROM r.created_at
  AND s.amount IS NOT NULL
  AND r.total > 0;

-- 3) 金額を消す
UPDATE rb_snapshots SET amount = NULL WHERE amount IS NOT NULL;

-- 4) これからも金額が入らないようにする（直接の INSERT も含めて弾く）
ALTER TABLE rb_snapshots
  ADD CONSTRAINT rb_snapshots_no_amount CHECK (amount IS NULL);

-- 5) user_rb_profile：画面からの新しい生活費を書かせない
--    - 作るときは null
--    - 変えるときは null にする（＝消す）以外は元の値のまま
--      （元の値を残すのは、古い画面のまま開いている人の生活費を、ブラウザへ移す前に消さないため）
--    - service key・SQL Editor（postgres）からの書き込みはそのまま
COMMENT ON COLUMN user_rb_profile.monthly_living_cost IS
  '廃止（047 以降は画面から書けない。残っている値は画面がブラウザへ移してから消す）。金額は保存しない（D-065）';

CREATE OR REPLACE FUNCTION public.user_rb_profile_guard_amounts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- 古い画面の upsert（INSERT ... ON CONFLICT DO UPDATE）では、ここで NULL にすると EXCLUDED も NULL になり、
    -- 続く UPDATE で「消す」として通ってしまう。行がもうあるときは NEW を変えずに返し、UPDATE の分岐で元の値に戻す
    IF EXISTS (SELECT 1 FROM user_rb_profile WHERE user_id = NEW.user_id) THEN
      RETURN NEW;
    END IF;
    NEW.monthly_living_cost := NULL;
    RETURN NEW;
  END IF;

  IF NEW.monthly_living_cost IS NOT NULL THEN
    NEW.monthly_living_cost := OLD.monthly_living_cost;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_rb_profile_guard_amounts ON user_rb_profile;
CREATE TRIGGER user_rb_profile_guard_amounts
  BEFORE INSERT OR UPDATE ON user_rb_profile
  FOR EACH ROW EXECUTE FUNCTION public.user_rb_profile_guard_amounts();
