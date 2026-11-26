-- /ma の待機資金の台帳（オーナー本人のみ、FI_project #140、設計書 §13-69「台帳方式」、D-007・D-066）
--
-- 1ユーザー×対象月で1行。待機資金を「ボタンで確定した残高」ではなく「配分どおりに積み立てた前提の想定の累計」で持つ。
-- 行は月次メールのジョブ（scripts/ma-mail/run.ts、service key）が送信日に作る。画面（authenticated）にできるのは
--   - 最初の行（kind = 'seed'、旧列 reserve_balance・reserve_month・crash_state から作る）を作ること
--   - 実際の残高で上書きする（override_balance・override_at）こと、その取り消し
-- だけ。読み書きできるのは、金額をサーバーに置く目印（user_ma_settings.keep_amounts_on_server）の付いた行の持ち主だけ
-- （ほかの利用者の金額はサーバーに平文で置かない。D-065・D-071）。
-- 旧列（user_ma_settings の reserve_balance・reserve_month・reserve_month_base・crash_state）は1サイクル残す。消すのは別の migration（D-091）。
-- 番号は試験用に当てる直前に付けた（D-077。今の最大は 051）。

CREATE TABLE IF NOT EXISTS ma_ledger (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  kind text NOT NULL CHECK (kind IN ('seed', 'record')),
  catchup boolean NOT NULL DEFAULT false,        -- 追いつきで記録した月（当時の指標ではない）
  inputs jsonb,                                  -- その月の入力（指標と基準日・倍率の元・予算・スロット・市場モード）。seed は null
  opening_balance bigint,                        -- 月初の想定残高。seed は null
  monthly_reserve bigint NOT NULL DEFAULT 0,     -- 今月の積み増し
  crash_deployment bigint NOT NULL DEFAULT 0,    -- 暴落ルールによる投入額の合計
  crash_triggered integer[] NOT NULL DEFAULT '{}', -- この月に新たに発動した段階
  crash_state jsonb,                             -- この月のあとの暴落の状態（CrashState）
  closing_balance bigint NOT NULL,               -- 月末の想定残高（上書きしても残す）
  override_balance bigint CHECK (override_balance IS NULL OR override_balance >= 0), -- 実際の残高（その月の月末）
  override_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);

ALTER TABLE ma_ledger ENABLE ROW LEVEL SECURITY;

-- 目印の付いた行の持ち主だけ（ほかの人には行が見えず、作れない）
DROP POLICY IF EXISTS "Owner can read own ledger" ON ma_ledger;
CREATE POLICY "Owner can read own ledger"
  ON ma_ledger FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM user_ma_settings s WHERE s.user_id = auth.uid() AND s.keep_amounts_on_server)
  );

DROP POLICY IF EXISTS "Owner can insert own seed" ON ma_ledger;
CREATE POLICY "Owner can insert own seed"
  ON ma_ledger FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND kind = 'seed'
    AND EXISTS (SELECT 1 FROM user_ma_settings s WHERE s.user_id = auth.uid() AND s.keep_amounts_on_server)
  );

DROP POLICY IF EXISTS "Owner can update own override" ON ma_ledger;
CREATE POLICY "Owner can update own override"
  ON ma_ledger FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM user_ma_settings s WHERE s.user_id = auth.uid() AND s.keep_amounts_on_server)
  )
  WITH CHECK (auth.uid() = user_id);
-- DELETE の方針は作らない（画面からは消せない）

-- 画面（anon・authenticated）からの書き込みの見張り（service key・SQL Editor からはそのまま。045 の user_ma_settings_guard_amounts と同じ形）
--   - 作れるのは、その人の台帳が空のときの最初の行（seed）だけ。計算した値の列は持たせない
--   - 更新で変えられるのは、最後の行（月が一番新しい行）の上書きの2列だけ。ほかの列は元の値に戻す
CREATE OR REPLACE FUNCTION public.ma_ledger_guard_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM ma_ledger l WHERE l.user_id = NEW.user_id) THEN
    RAISE EXCEPTION '台帳に行があるので、最初の行は作れません（FI_project #140）';
  END IF;
  NEW.catchup := false;
  NEW.inputs := NULL;
  NEW.opening_balance := NULL;
  NEW.monthly_reserve := 0;
  NEW.crash_deployment := 0;
  NEW.crash_triggered := '{}';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ma_ledger_guard_insert ON ma_ledger;
CREATE TRIGGER ma_ledger_guard_insert
  BEFORE INSERT ON ma_ledger
  FOR EACH ROW EXECUTE FUNCTION public.ma_ledger_guard_insert();

CREATE OR REPLACE FUNCTION public.ma_ledger_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM ma_ledger l WHERE l.user_id = OLD.user_id AND l.month > OLD.month) THEN
    RAISE EXCEPTION '上書きできるのは台帳の最後の月だけです（FI_project #140）';
  END IF;
  NEW.user_id := OLD.user_id;
  NEW.month := OLD.month;
  NEW.kind := OLD.kind;
  NEW.catchup := OLD.catchup;
  NEW.inputs := OLD.inputs;
  NEW.opening_balance := OLD.opening_balance;
  NEW.monthly_reserve := OLD.monthly_reserve;
  NEW.crash_deployment := OLD.crash_deployment;
  NEW.crash_triggered := OLD.crash_triggered;
  NEW.crash_state := OLD.crash_state;
  NEW.closing_balance := OLD.closing_balance;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ma_ledger_guard_update ON ma_ledger;
CREATE TRIGGER ma_ledger_guard_update
  BEFORE UPDATE ON ma_ledger
  FOR EACH ROW EXECUTE FUNCTION public.ma_ledger_guard_update();

-- anon には何も渡さない（RLS があっても、権限も絞る）
REVOKE ALL ON ma_ledger FROM anon;
REVOKE ALL ON ma_ledger FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON ma_ledger TO authenticated;
