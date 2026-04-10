-- ============================================================
-- リバランスツール テーブル（/rb）
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. user_rb_settings — ユーザーの目標配分
CREATE TABLE user_rb_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_class text NOT NULL,
  target_ratio numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, asset_class)
);

ALTER TABLE user_rb_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rb settings"
  ON user_rb_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rb settings"
  ON user_rb_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rb settings"
  ON user_rb_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own rb settings"
  ON user_rb_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER user_rb_settings_updated_at
  BEFORE UPDATE ON user_rb_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 2. rb_snapshots — 残高入力履歴（月次スナップショット）
CREATE TABLE rb_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  asset_class text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rb_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rb snapshots"
  ON rb_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rb snapshots"
  ON rb_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- スナップショット検索用インデックス
CREATE INDEX idx_rb_snapshots_user_date
  ON rb_snapshots (user_id, snapshot_date DESC);
