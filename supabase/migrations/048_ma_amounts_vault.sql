-- 048: /ma の利用者の金額を、本人のパスフレーズの鍵で暗号化した封筒にしてサーバーにも置く（FI_project #117、D-070・D-071）
--
-- 暗号化・復号はブラウザの中だけ（アプリの src/lib/vault/vault.ts、AES-GCM 256・PBKDF2-SHA256）。
-- サーバーに置くのは暗号文・鍵の確かめ用の値・保存した時刻だけで、金額の平文は今までどおり置かない（045 のトリガーのまま）。
-- オーナー（service key）にも中身は見えない。パスフレーズを忘れたら、画面の「リセット」でこの3列を null にする（復元の仕組みは無い）。
--
-- 045 のトリガー（user_ma_settings_guard_amounts）は金額の15列だけを名前で見張っているので、この3列は画面から書ける。トリガーは変えない。
-- RLS は 010 の「本人の行だけ SELECT・INSERT・UPDATE」がそのまま効く（DELETE のポリシーは無い。リセットは UPDATE で null）。
-- オーナー本人の行（keep_amounts_on_server）では画面がこの3列を使わない（D-066）。
-- supabase/pending/046（開かなかった人の金額を消す）は金額の15列だけを消し、この3列には触れない。
-- 046 を migrations へ移すときは、その時点の最大より大きい番号を付ける（048 より後）。

ALTER TABLE user_ma_settings
  ADD COLUMN IF NOT EXISTS amounts_vault  text,
  ADD COLUMN IF NOT EXISTS vault_verifier text,
  ADD COLUMN IF NOT EXISTS vault_saved_at timestamptz;

-- 封筒は数 KB に収まる。書き換えで大きな値を置かれないように上限を置く
ALTER TABLE user_ma_settings DROP CONSTRAINT IF EXISTS user_ma_settings_vault_size;
ALTER TABLE user_ma_settings ADD CONSTRAINT user_ma_settings_vault_size
  CHECK (coalesce(length(amounts_vault), 0) <= 20000 AND coalesce(length(vault_verifier), 0) <= 2000);

COMMENT ON COLUMN user_ma_settings.amounts_vault  IS '本人のパスフレーズの鍵で暗号化した金額（ブラウザで暗号化。サーバーでは読めない）。FI_project #117';
COMMENT ON COLUMN user_ma_settings.vault_verifier IS 'パスフレーズが合っているかを確かめる値（既知の文字列の暗号文）。FI_project #117';
COMMENT ON COLUMN user_ma_settings.vault_saved_at IS 'amounts_vault を保存した時刻（端末をまたいだとき新しい方を採る）。金額は含まない。FI_project #117';
