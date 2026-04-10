-- ============================================================
-- fund_master & fund_master_requests（/rb MFエクセル取り込み）
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. fund_master — 銘柄→アセットクラスのマッピングマスタ
CREATE TABLE IF NOT EXISTS fund_master (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker        text NOT NULL,
  fund_name     text,
  asset_class   text NOT NULL,
  ratio         numeric NOT NULL DEFAULT 1.0,
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE fund_master ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが読み取り可能（書き込みはサービスロールのみ）
CREATE POLICY "fund_master_read" ON fund_master FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_fund_master_ticker ON fund_master(ticker);

-- 2. fund_master_requests — 未登録銘柄の登録リクエスト
CREATE TABLE IF NOT EXISTS fund_master_requests (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker                text NOT NULL,
  fund_name             text,
  suggested_asset_class text NOT NULL,
  user_id               uuid REFERENCES auth.users(id),
  status                text DEFAULT 'pending',
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE fund_master_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requests_select" ON fund_master_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "requests_insert" ON fund_master_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
