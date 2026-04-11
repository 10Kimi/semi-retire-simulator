-- ============================================================
-- 招待コード + プロフィール（有料判定）テーブル
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. invite_codes — 招待コード管理
CREATE TABLE IF NOT EXISTS invite_codes (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code      text UNIQUE NOT NULL,
  is_used   boolean DEFAULT false,
  used_by   uuid REFERENCES auth.users(id),
  used_at   timestamptz
);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーが読み取り可能（コード照合用）
CREATE POLICY "invite_codes_select" ON invite_codes
  FOR SELECT TO authenticated USING (true);

-- 認証済みユーザーが更新可能（使用時にis_used等を更新）
CREATE POLICY "invite_codes_update" ON invite_codes
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. profiles — ユーザープロフィール（有料判定）
CREATE TABLE IF NOT EXISTS profiles (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_premium         boolean DEFAULT false,
  premium_source     text,          -- 'invite' | 'stripe'
  premium_granted_at timestamptz,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
