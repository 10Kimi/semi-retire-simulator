-- ============================================================
-- pending_review一括承認関数
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 使い方: SELECT approve_all_pending_review();
CREATE OR REPLACE FUNCTION approve_all_pending_review()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  approved_count integer;
BEGIN
  -- pending_reviewのリクエストをfund_masterに登録
  INSERT INTO fund_master (ticker, fund_name, asset_class, ratio)
  SELECT DISTINCT ticker, fund_name, suggested_asset_class, 1.00
  FROM fund_master_requests
  WHERE status = 'pending_review'
  ON CONFLICT DO NOTHING;

  -- ステータスをapprovedに更新
  UPDATE fund_master_requests
  SET status = 'approved'
  WHERE status = 'pending_review';

  GET DIAGNOSTICS approved_count = ROW_COUNT;
  RETURN approved_count;
END;
$$;
