-- 046: /ma を開かなかった利用者の金額をサーバーから消す（FI_project #111、D-065）
--
-- まだ supabase/migrations に入れていない（db push で 045 と一緒に流れないように）。
-- 045 を適用し、オーナーの行に目印（keep_amounts_on_server）を付け、画面の変更を本番に出したあと、
-- 消してよい日（オーナーが決める）に supabase/migrations/ へ移して db push する。
-- ここで消した人は、次に /ma を開くと金額が既定値（0）から始まる。
-- 消した金額も Supabase のバックアップには保持期間のあいだ残る（D-065 の前提 (d)）。

-- 目印の付いた行（オーナー本人）が無ければ止める（目印を付け忘れたままオーナーの金額を消さないため）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_ma_settings WHERE keep_amounts_on_server) THEN
    RAISE EXCEPTION 'keep_amounts_on_server が true の行がありません。先にオーナーの行に目印を付けてください（FI_project #111）';
  END IF;
END $$;

UPDATE user_ma_settings
SET monthly_budget = NULL, reserve_balance = NULL, reserve_month = NULL, reserve_month_base = NULL, crash_state = NULL,
    slot1_amount = NULL, slot2_amount = NULL, slot3_amount = NULL, slot4_amount = NULL, slot5_amount = NULL,
    slot6_amount = NULL, slot7_amount = NULL, slot8_amount = NULL, slot9_amount = NULL, slot10_amount = NULL
WHERE NOT keep_amounts_on_server;
