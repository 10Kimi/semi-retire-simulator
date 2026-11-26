-- migration の側を本番の今の作りに合わせる（FI_project #138、案A。#137 の比較で見つかったずれ）
--
-- 本番を Dashboard で手で直した分が migration に残っておらず、migration から作った DB（試験用）が本番とずれていた。
-- どの文も、本番に当てたときは何もしない（すでにその形）。試験用だけが本番と同じ形になる。
-- 本番だけにある手作りのテーブル english_subscribers・scene_cache はアプリが使っていないので入れない（#137）。
-- 051：試験用に当てる直前に番号を付けた（2026-11-26、D-077）。

-- 1. user_ma_settings：038 の ADD COLUMN IF NOT EXISTS は、本番では列がすでにあって飛ばされ、NOT NULL が付かなかった（推定）。
--    本番に合わせて NOT NULL を外す（DEFAULT はそのまま。アプリは null を書かない）
ALTER TABLE user_ma_settings
  ALTER COLUMN slot2_account  DROP NOT NULL,
  ALTER COLUMN slot3_account  DROP NOT NULL,
  ALTER COLUMN slot4_account  DROP NOT NULL,
  ALTER COLUMN slot5_account  DROP NOT NULL,
  ALTER COLUMN slot6_account  DROP NOT NULL,
  ALTER COLUMN slot7_account  DROP NOT NULL,
  ALTER COLUMN slot8_account  DROP NOT NULL,
  ALTER COLUMN slot9_account  DROP NOT NULL,
  ALTER COLUMN slot10_account DROP NOT NULL,
  ALTER COLUMN slot8_asset_class  DROP NOT NULL,
  ALTER COLUMN slot9_asset_class  DROP NOT NULL,
  ALTER COLUMN slot10_asset_class DROP NOT NULL,
  ALTER COLUMN slot8_fund_name  DROP NOT NULL,
  ALTER COLUMN slot9_fund_name  DROP NOT NULL,
  ALTER COLUMN slot10_fund_name DROP NOT NULL;

-- 2. indicators：本番のポリシーは "Anyone can read indicators"（010 の "Authenticated users can read indicators" は本番に無い）
DROP POLICY IF EXISTS "Authenticated users can read indicators" ON indicators;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'indicators' AND policyname = 'Anyone can read indicators') THEN
    -- 本番と同じ中身（対象のロールは指定なし＝public、USING true。2026-11-26 に本番の比べる SQL で確かめた）
    CREATE POLICY "Anyone can read indicators" ON indicators FOR SELECT USING (true);
  END IF;
END
$$;

-- 3. user_ma_settings の slot4_asset_class の CHECK：本番は許す値のリストに 'bond' が2回ある（手で直した名残り、推定）。
--    許す値は同じだが、比べる SQL をそろえるため、本番と違う形のときだけ本番と同じ形に作り直す（本番では何もしない）
DO $$
BEGIN
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid = 'public.user_ma_settings'::regclass AND conname = 'user_ma_settings_slot4_asset_class_check')
     IS DISTINCT FROM
     'CHECK ((slot4_asset_class = ANY (ARRAY[''us''::text, ''jp''::text, ''em''::text, ''gold''::text, ''bond''::text, ''bond''::text, ''none''::text])))' THEN
    ALTER TABLE user_ma_settings DROP CONSTRAINT IF EXISTS user_ma_settings_slot4_asset_class_check;
    ALTER TABLE user_ma_settings ADD CONSTRAINT user_ma_settings_slot4_asset_class_check
      CHECK (slot4_asset_class IN ('us', 'jp', 'em', 'gold', 'bond', 'bond', 'none'));
  END IF;
END
$$;

-- 4. 旧 v1 の診断のテーブル（001）：本番では手で消されている。使うのは App.tsx でルートを外したデッドコード
--    （src/lib/assessmentDb.ts の consent・assessment の関数）だけ
DROP TABLE IF EXISTS risk_assessments;
DROP TABLE IF EXISTS assessment_consents;
