-- ============================================================
-- 042: 招待コードの使用をサーバー側の関数に移す（FI_project #45）
-- Apply: the owner runs `npx supabase db push --remote --yes` after approving the SQL
-- ============================================================

-- 1. 招待コードの照合・使用済みにする・有料の付与を1つの関数で行う
CREATE OR REPLACE FUNCTION redeem_invite_code(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite invite_codes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'unauthenticated';
  END IF;

  SELECT * INTO v_invite
  FROM invite_codes
  WHERE code = btrim(p_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_invite.is_used THEN
    RETURN 'used';
  END IF;

  UPDATE invite_codes
  SET is_used = true, used_by = v_uid, used_at = now()
  WHERE id = v_invite.id;

  INSERT INTO profiles (user_id, is_premium, premium_source, premium_granted_at)
  VALUES (v_uid, true, 'invite', now())
  ON CONFLICT (user_id) DO UPDATE
  SET is_premium = true, premium_source = 'invite', premium_granted_at = now();

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION redeem_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION redeem_invite_code(text) TO authenticated;

-- 2. invite_codes は利用者から読めない・書けない（関数だけが触る）
DROP POLICY IF EXISTS "invite_codes_select" ON invite_codes;
DROP POLICY IF EXISTS "invite_codes_update" ON invite_codes;

-- 3. profiles は本人が読むだけ。書き込みは関数（とサービスロール）だけ
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- 4. 投信の登録の一括承認は、SQL Editor（オーナー）からだけ
REVOKE ALL ON FUNCTION approve_all_pending_review() FROM PUBLIC, anon, authenticated;
