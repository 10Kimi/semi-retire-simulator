-- ============================================================
-- Monthly Advisor テーブル（/ma 月次投資アドバイザー）
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. indicators テーブル（市場指標データ。fetch_indicators.pyがupsert）
CREATE TABLE indicators (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  cape numeric,                        -- 米国CAPE（Shiller PE）
  cape_history jsonb DEFAULT '[]',     -- 60ヶ月分の履歴配列 [{date, cape}, ...]
  topix_pbr numeric,                   -- TOPIX PBR（JPX公式）
  gold_silver_ratio numeric,           -- 金銀比率
  gold_price numeric,                  -- 金価格（USD）
  silver_price numeric,                -- 銀価格（USD）
  momentum jsonb DEFAULT '{}'          -- {us: {above_ma, last_price, ma10}, jp: {...}, gold: {...}}
);

ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが読める（認証済み）
CREATE POLICY "Authenticated users can read indicators"
  ON indicators FOR SELECT
  TO authenticated
  USING (true);

-- 2. user_ma_settings テーブル（ユーザーごとの投資設定）
CREATE TABLE user_ma_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_budget integer NOT NULL DEFAULT 1000000,
  nisa_tsumitate integer NOT NULL DEFAULT 100000,
  nisa_growth integer NOT NULL DEFAULT 200000,
  tokutei_bond integer NOT NULL DEFAULT 20000,
  tokutei_ac_base integer NOT NULL DEFAULT 500000,
  tokutei_gold_base integer NOT NULL DEFAULT 180000,
  reserve_balance integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_ma_settings ENABLE ROW LEVEL SECURITY;

-- 自分の設定のみ読み書き
CREATE POLICY "Users can read own settings"
  ON user_ma_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_ma_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_ma_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_ma_settings_updated_at
  BEFORE UPDATE ON user_ma_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- indicatorsへのservice_role insert/update用（fetch_indicators.pyから）
-- service_roleはRLSバイパスするので追加ポリシー不要
