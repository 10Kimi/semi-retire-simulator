-- 049: /ma を開かなかった利用者の金額をサーバーから消す（FI_project #111、D-065）
--
-- pending/046 として置いていたもの。2026-11-20 オーナーの指示（「今やって。僕のデータは残す」）で、048 より大きい番号にして migrations へ移した。
-- オーナーの行（keep_amounts_on_server = true、11/19 に目印を付けた・件数 1）は消さない。暗号文の列（048）には触れない。
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
