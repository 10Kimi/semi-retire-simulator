-- 038_ma_slot_accounts.sql
-- スロットに「口座」の属性を持たせ、スロット数を 7 → 10 に拡張する。
--
-- 背景: これまで「スロット番号＝口座」で固定されていた（slot1=NISAつみたて、
-- slot2=NISA成長、slot3〜7=特定口座）。しかし1つの非課税枠で複数の商品を買うのが普通で、
-- 例えば「米国株25% / 先進国債券30% / エマージング債20% / 日本リート10% / ゴールド15%」を
-- 月15万で積むと、iDeCo 2.3万 + NISAつみたて 10万 + NISA成長 20万 の非課税枠に全部収まり、
-- 5商品を3つの非課税口座に振り分けることになる。旧構造ではNISAに1枠ずつしかなく表現できない。
--
-- さらに logic.ts はスロット番号で非課税を判定していたため（idx < 2）、
-- NISAの商品を特定口座スロットに入れて回避すると、非課税枠なのにバリュエーション調整が
-- かかるという誤った計算になっていた。
-- 変更後は slot{N}_account で判定する（specific のみ調整対象）。
--
-- 適用: Supabase SQL Editor に【全文を貼り付けて一度に実行】する。
--       IF NOT EXISTS / IF EXISTS で書いてあるので、途中まで適用済みの状態から
--       再実行しても安全（何度流しても同じ結果になる）。

-- 1. スロット 8〜10
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot8_amount      numeric NOT NULL DEFAULT 0;
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot8_fund_name   text    NOT NULL DEFAULT '';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot8_asset_class text    NOT NULL DEFAULT 'none';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot9_amount      numeric NOT NULL DEFAULT 0;
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot9_fund_name   text    NOT NULL DEFAULT '';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot9_asset_class text    NOT NULL DEFAULT 'none';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot10_amount     numeric NOT NULL DEFAULT 0;
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot10_fund_name  text    NOT NULL DEFAULT '';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot10_asset_class text   NOT NULL DEFAULT 'none';

-- 2. 各スロットの口座属性
--    'nisa_tsumitate' | 'nisa_growth' | 'ideco' | 'specific'
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot1_account  text NOT NULL DEFAULT 'specific';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot2_account  text NOT NULL DEFAULT 'specific';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot3_account  text NOT NULL DEFAULT 'specific';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot4_account  text NOT NULL DEFAULT 'specific';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot5_account  text NOT NULL DEFAULT 'specific';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot6_account  text NOT NULL DEFAULT 'specific';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot7_account  text NOT NULL DEFAULT 'specific';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot8_account  text NOT NULL DEFAULT 'specific';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot9_account  text NOT NULL DEFAULT 'specific';
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS slot10_account text NOT NULL DEFAULT 'specific';

-- 3〜5. 既存データの移行と旧カラム削除。
--       旧カラムが既に消えている場合（再実行時）はスキップする。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_ma_settings' AND column_name = 'ideco_amount'
  ) THEN
    -- 旧構造の slot1/slot2 は NISA 枠だった（slot3〜7 は 'specific' のままでよい）
    UPDATE user_ma_settings SET slot1_account = 'nisa_tsumitate';
    UPDATE user_ma_settings SET slot2_account = 'nisa_growth';

    -- ideco_amount / ideco_fund_name を slot8（iDeCo）へ移行
    -- 旧: 予算から差し引くだけの特殊処理 → 新: 他のスロットと同じ「調整対象外の枠」
    UPDATE user_ma_settings
    SET slot8_account     = 'ideco',
        slot8_amount      = ideco_amount,
        slot8_fund_name   = ideco_fund_name,
        slot8_asset_class = 'none'
    WHERE ideco_amount > 0;

    -- 差し引き専用フィールドは不要になった（スロット合計＝投資額で完結するため）
    ALTER TABLE user_ma_settings DROP COLUMN IF EXISTS ideco_amount;
    ALTER TABLE user_ma_settings DROP COLUMN IF EXISTS ideco_fund_name;
  END IF;
END $$;
