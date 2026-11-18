-- 045: /ma の利用者の金額をサーバーに置かない（FI_project #111、D-065）
--
-- 金額（月の予算・積立額・待機資金・暴落ルールの状態）は画面がブラウザ（localStorage）に持つ。
-- オーナー本人の行だけは /ma 月次メール・暴落の通知が service key で読むので、目印 keep_amounts_on_server を付けて残す
-- （#111 のオーナーの回答、2026-11-18）。目印はこの migration では付けない（オーナーの user_id をリポジトリに書かないため）。
-- 適用のあと、オーナーが SQL Editor で自分の行に目印を付ける（STATUS の #111 の手順）。
--
-- この migration は既存の金額を消さない。利用者が次に /ma を開いたとき、画面が一度ブラウザへ移してから消す。
-- 開かなかった人の分を消すのは supabase/pending/046_ma_clear_remaining_amounts.sql（あとで別に適用する）。

-- 1. 目印（オーナー本人の行だけ true）
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS keep_amounts_on_server boolean NOT NULL DEFAULT false;

-- 2. 金額の列を null にできるように。既定値も外す（新しい行は金額を持たない）
ALTER TABLE user_ma_settings
  ALTER COLUMN monthly_budget  DROP NOT NULL, ALTER COLUMN monthly_budget  DROP DEFAULT,
  ALTER COLUMN reserve_balance DROP NOT NULL, ALTER COLUMN reserve_balance DROP DEFAULT,
  ALTER COLUMN slot1_amount  DROP NOT NULL, ALTER COLUMN slot1_amount  DROP DEFAULT,
  ALTER COLUMN slot2_amount  DROP NOT NULL, ALTER COLUMN slot2_amount  DROP DEFAULT,
  ALTER COLUMN slot3_amount  DROP NOT NULL, ALTER COLUMN slot3_amount  DROP DEFAULT,
  ALTER COLUMN slot4_amount  DROP NOT NULL, ALTER COLUMN slot4_amount  DROP DEFAULT,
  ALTER COLUMN slot5_amount  DROP NOT NULL, ALTER COLUMN slot5_amount  DROP DEFAULT,
  ALTER COLUMN slot6_amount  DROP NOT NULL, ALTER COLUMN slot6_amount  DROP DEFAULT,
  ALTER COLUMN slot7_amount  DROP NOT NULL, ALTER COLUMN slot7_amount  DROP DEFAULT,
  ALTER COLUMN slot8_amount  DROP NOT NULL, ALTER COLUMN slot8_amount  DROP DEFAULT,
  ALTER COLUMN slot9_amount  DROP NOT NULL, ALTER COLUMN slot9_amount  DROP DEFAULT,
  ALTER COLUMN slot10_amount DROP NOT NULL, ALTER COLUMN slot10_amount DROP DEFAULT;

-- 3. 画面（anon・authenticated）からの書き込みの見張り
--    - 目印は画面から変えられない（作るときは false、変えようとしても元に戻す）
--    - 目印の無い行には新しい金額を書けない。作るときは全部 null、変えるときは null にする（＝消す）以外は元の値のまま
--      （元の値を残すのは、古い画面のまま開いている人の金額を、ブラウザへ移す前に消さないため）
--    - service key・SQL Editor（postgres）からの書き込みはそのまま
CREATE OR REPLACE FUNCTION public.user_ma_settings_guard_amounts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.keep_amounts_on_server := false;
    NEW.monthly_budget := NULL;  NEW.reserve_balance := NULL;
    NEW.reserve_month := NULL;   NEW.reserve_month_base := NULL;  NEW.crash_state := NULL;
    NEW.slot1_amount := NULL; NEW.slot2_amount := NULL; NEW.slot3_amount := NULL; NEW.slot4_amount := NULL; NEW.slot5_amount := NULL;
    NEW.slot6_amount := NULL; NEW.slot7_amount := NULL; NEW.slot8_amount := NULL; NEW.slot9_amount := NULL; NEW.slot10_amount := NULL;
    RETURN NEW;
  END IF;

  NEW.keep_amounts_on_server := OLD.keep_amounts_on_server;
  IF OLD.keep_amounts_on_server THEN
    RETURN NEW;
  END IF;

  IF NEW.monthly_budget     IS NOT NULL THEN NEW.monthly_budget     := OLD.monthly_budget;     END IF;
  IF NEW.reserve_balance    IS NOT NULL THEN NEW.reserve_balance    := OLD.reserve_balance;    END IF;
  IF NEW.reserve_month      IS NOT NULL THEN NEW.reserve_month      := OLD.reserve_month;      END IF;
  IF NEW.reserve_month_base IS NOT NULL THEN NEW.reserve_month_base := OLD.reserve_month_base; END IF;
  IF NEW.crash_state        IS NOT NULL THEN NEW.crash_state        := OLD.crash_state;        END IF;
  IF NEW.slot1_amount  IS NOT NULL THEN NEW.slot1_amount  := OLD.slot1_amount;  END IF;
  IF NEW.slot2_amount  IS NOT NULL THEN NEW.slot2_amount  := OLD.slot2_amount;  END IF;
  IF NEW.slot3_amount  IS NOT NULL THEN NEW.slot3_amount  := OLD.slot3_amount;  END IF;
  IF NEW.slot4_amount  IS NOT NULL THEN NEW.slot4_amount  := OLD.slot4_amount;  END IF;
  IF NEW.slot5_amount  IS NOT NULL THEN NEW.slot5_amount  := OLD.slot5_amount;  END IF;
  IF NEW.slot6_amount  IS NOT NULL THEN NEW.slot6_amount  := OLD.slot6_amount;  END IF;
  IF NEW.slot7_amount  IS NOT NULL THEN NEW.slot7_amount  := OLD.slot7_amount;  END IF;
  IF NEW.slot8_amount  IS NOT NULL THEN NEW.slot8_amount  := OLD.slot8_amount;  END IF;
  IF NEW.slot9_amount  IS NOT NULL THEN NEW.slot9_amount  := OLD.slot9_amount;  END IF;
  IF NEW.slot10_amount IS NOT NULL THEN NEW.slot10_amount := OLD.slot10_amount; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_ma_settings_guard_amounts ON user_ma_settings;
CREATE TRIGGER user_ma_settings_guard_amounts
  BEFORE INSERT OR UPDATE ON user_ma_settings
  FOR EACH ROW EXECUTE FUNCTION public.user_ma_settings_guard_amounts();
