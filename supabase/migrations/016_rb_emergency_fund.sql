-- ============================================================
-- 緊急資金設定テーブル（/rb リバランスツール）
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_rb_profile (
  user_id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_living_cost integer DEFAULT NULL,
  emergency_months    integer DEFAULT 6,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE user_rb_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rb profile"
  ON user_rb_profile FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rb profile"
  ON user_rb_profile FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rb profile"
  ON user_rb_profile FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_rb_profile_updated_at
  BEFORE UPDATE ON user_rb_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
