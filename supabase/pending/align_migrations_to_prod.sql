-- migration の側を本番の今の作りに合わせる（FI_project #138、案A。#137 の比較で見つかったずれ）
--
-- 本番を Dashboard で手で直した分が migration に残っておらず、migration から作った DB（試験用）が本番とずれていた。
-- どの文も、本番に当てたときは何もしない（すでにその形）。試験用だけが本番と同じ形になる。
-- 本番だけにある手作りのテーブル english_subscribers・scene_cache はアプリが使っていないので入れない（#137）。
-- 番号は適用の直前に付ける（D-032・D-077）。

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
    -- 仮：中身（ロール・USING）は本番の比較の結果で確かめてから決める
    CREATE POLICY "Anyone can read indicators" ON indicators FOR SELECT USING (true);
  END IF;
END
$$;

-- 3. 旧 v1 の診断のテーブル（001）：本番では手で消されている。使うのは App.tsx でルートを外したデッドコード
--    （src/lib/assessmentDb.ts の consent・assessment の関数）だけ
DROP TABLE IF EXISTS risk_assessments;
DROP TABLE IF EXISTS assessment_consents;
