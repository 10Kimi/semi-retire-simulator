# CHANGELOG

## 2026-11-10 — 投信の登録リクエストが審査待ちのとき「登録済み」と見せない（FI_project #38）

- Yahoo Finance で確かめられないまま送った登録リクエスト（`fund_master_requests` に `pending_review` で入り、`fund_master` には未登録）の返り値を `auto_approved` から `pending_review` に。審査待ちの銘柄を送り直したときも `pending_review` を返す
- `MfImportFlow.tsx`：審査待ちは「送信しました（審査中）」と出し、「次の取り込みでも未分類のままになることがある」と添える。前回までに送った審査待ちも同じ表示（`fetchSubmittedRequestTickers` が審査待ちを分けて返す）
- 承認の仕組み（`approve_all_pending_review()`、migration 022）は変えていない。DB の変更なし

## 2026-11-10 — /rb の暗号資産として外した行の名前も表示（FI_project #37）

- 取り込みのプレビューと確認の画面で、「計算の対象外：暗号資産 ◯円」の下に「対象外にした行：ビットコイン、イーサリアム、BTC」のように外した行の名前を出す（同じ名前は1回だけ、出てきた順）。誤って外れた預金に気づけるようにするため
- `src/lib/rb/allocator.ts` に `excludedCryptoNames` を追加。見分け方のリスト（`crypto.ts`）と対象外にする判定は変えていない
- DB の変更なし

## 2026-11-10 — /ma 暴落ルールの段階に達したら、月次メールを待たずに通知（FI_project #34）

- 送信日でない日に S&P500（ドル建て）の高値比を確かめ、−20%／−30%／−40% の段階にまだ知らせていない段階で新たに達していたら、オーナー本人に短い通知メールを1通送る。判定は暴落ルールと同じで、`crash.ts`・`logic.ts` は変えていない。通知は知らせるだけで、待機資金・`crash_state` は書き換えない
- 新規 `src/lib/ma/mail/crashAlert.ts`（判定 `decideCrashAlert`・本文 `buildCrashAlert`・テスト）、`scripts/market/fetch_sp500_drawdown.py`（S&P500 だけ取得、DB に書かない）
- `scripts/ma-mail/run.ts`：送信日でない日の確認、`state.json` に `crashAlert`。送信日の判定・`sentMonths`・送信の経路・healthchecks.io の合図は変えていない（送信日の dry-run の HTML が変更前と同一）
- DB の変更なし

## 2026-11-10 — /rb の暗号資産を配分の計算の対象外に（FI_project #33）

- マネーフォワードの預金の区分（見出し「預金・現金」「預金・現金・暗号資産」）の行のうち、金融機関が暗号資産の交換業者か、名前が主な通貨名の行を暗号資産とし、cash に振り分けない。保存する残高（`rb_snapshots`）と緊急資金の差し引きにも入らない。見分け方のリストは `src/lib/rb/crypto.ts`（FI_project `personal-monitor/monitor/crypto.py` と同じ中身）
- 取り込みのプレビューと確認の画面に「計算の対象外：暗号資産 ◯円」を出す。区分の合計の照合には含めたまま（警告は増えない）
- DB の変更なし

## 2026-11-05 — 画面の確認はログインなしの範囲に（FI_project #31）

- app-verifier・app-reviewer の定義を変更。本番でログインせず、ログイン後の画面はオーナーに頼む

## 2026-11-05 — fund_master の BTI とセゾン・グローバルバランスファンドを修正（FI_project #25）

- migration 041（本番に適用済み）。BTI を `us_equity` から `developed_equity` に戻した。英国の会社の ADR で、`developed_equity` は米・日除く
- セゾン・グローバルバランスファンドの按分を、運用レポート（2026年4月末）の構成比の7行に合わせた。`cash` 1% を含む。この分は /rb の現金に足され、緊急資金の差し引きの対象になる

## 2026-11-05 — /rb の取り込みを MF の Excel から「資産」ページの貼り付けに（FI_project #24）

- マネーフォワードの Excel がダウンロードできなくなったため、`parseMfExcel` を `parseMfText` に置き換え。区分の見出し・列の位置・合算の読み方は `src/lib/rb/mfParser.ts`。`xlsx` の依存を外した
- `MfImportFlow.tsx` の最初のステップをテキストの貼り付け欄に。テキストはブラウザの中で読むだけで、読んだら state から消す。振り分け・未分類の手当ては今のまま（`allocator.ts` のロジックは変えていない）
- 区分の合計のずれ（1,000円超）・未対応の区分・同じ区分の2回目・内訳にあって本文に無い区分は preview に警告を出す（取り込みは止めない）
- 預金は口座ごとの行に（全部 `cash`）。マイナスの行も足す。Excel のときはマイナスの行を読み飛ばしていた。資産クラスの合計がマイナスになったら0にそろえ、confirm に警告を出す（`clampNegativeHoldings`）
- テストは `src/lib/rb/mfParser.test.ts`、見本は `src/lib/rb/__fixtures__/mf_assets_sample.txt`（架空のデータ）。`.gitignore` の `*.txt` に見本の例外を追加

## 2026-11-05 — /rb の残高の復元は最後の保存だけを読む（FI_project #23）

- `fetchLatestSnapshot` を `created_at` で最後の保存の行だけ読む形に。同じ日に保存し直すと、古い金額や、途中で0にした資産クラスの古い金額が混ざることがあった。DB は変えていない
- `saveSnapshot` の日付を日本時間に（`todayInJapan`）。日本時間の 0〜9 時は前日の日付になっていた

## 2026-11-05 — 保存の失敗を画面に出す（/risk・/rb）（FI_project #22）

- /risk：診断結果の保存に失敗したら、その旨と「もう一度保存する」を表示する。マジックリンクからの復元の経路は、保存できたときだけ回答を消す（`RiskPage.tsx`）
- /risk「このPFを採用する」：失敗したら「採用しました」にせず、失敗を表示してもう一度押せるようにする（`adoptModelAllocation`、`RiskResultDisplay.tsx`）
- /rb：目標配分・保有残高・生活費の設定の保存に失敗したら、どのステップでも表示してもう一度保存できるようにする（`RebalancePage.tsx`。MF 取込の保存も同じ）
- `saveTargetAllocation`・`saveSnapshot`・`saveRbProfile` は成否を返す。テストは `src/lib/riskDb.test.ts`・`src/lib/rb/db.test.ts`

## 2026-11-04 — /ma の設定の行の初回作成で重複しても失敗しないように（FI_project #18）

- `fetchUserSettings` の初回作成を insert から重複を無視する upsert に。重複で行が返らなければ読み直す。既存の行は上書きしない（`src/lib/ma/db.test.ts`）

## 2026-11-04 — マイグレーションの適用を Supabase CLI に／Playwright MCP／3役の定義の更新（FI_project #17）

- マイグレーションの適用手順を SQL Editor から `supabase db push` に（CLAUDE.md「マイグレーション」）。`db push`・`migration repair` は `.claude/settings.json` の ask、`supabase db query`・`psql` などは deny。本番の登録状況の整合（`migration repair`）は CLI の導入と `supabase link` のあと、オーナーの OK を待って行う
- `.mcp.json` に Playwright MCP（`@playwright/mcp@0.0.83`、`--isolated --headless`、出力は `.playwright-mcp/`）。app-verifier・app-reviewer が画面を確かめる（開発サーバー・本番とも見るだけ、保存・送信しない、スマホ幅）
- 本番の登録状況をそろえた（`migration repair --remote` で 025・027〜040 を applied に。001〜040 が一致）。`db push`・`repair` も既定はローカルなので手順に `--remote`、エージェントからは `--yes` が要ることを追記
- テスト用アカウントを作成（有料の状態。ログイン情報は `.env.local`）。app-verifier・app-reviewer に置き場所を追記
- app-reviewer の資産クラスの記述を #12（13クラスに統一）後に。app-* に「作業ログは FI_project の `logs/app-calc.md`」「地図・定義が名指しする状態を変えたら同じコミットで直す」

## 2026-11-02 — /ma 月次メール（Phase A）＋ 待機資金の出口を暴落ルールに一本化

`65a7f28`、migration 039・040、設計書 §13-69

- 月次メール：launchd `jp.largogk.fi.ma-mail` で毎月25日（土日祝は直前の営業日）に送信。初回の本番送信は 11/25
- CAPE が割安なときの待機資金投入（`getReserveDeployment`）を廃止し、暴落ルール（`src/lib/ma/crash.ts`）だけに。画面とメールが同じ判定
- 入力値の組み立てを `logic.ts` に切り出し（`calculateMonthlyFromIndicators`）。テスト136件・`npm run build` 通過、本番の配信ファイルで反映を確認
- 講義（実践4-2 スライド4）・スクリーンショット・動画は実装確定後にまとめて直す

## 2026-11-02 — モデル配分のレベル食い違いの修正 ＋ 月次の自動照合 ＋ launchd 移行

設計書 v7.24

- 10/30 のパラメータ更新で Lv6 のモデル配分が 14.77%（Lv5 判定）、Lv7 が 16.50%（境界 `<=16.5` で Lv6 判定）になっていた
- **Lv6/7 境界を 16.5% → 16.0%**（`classifyRiskLevel7` / `VOL_UPPER` ×2 / `riskScoring.ts` 表示 / `EFF_UPPER[6]`・`LEVEL_VOL_MIN[7]`）
- **Lv6 のモデル配分**：米国株45／新興国株45／新興国REIT5／金5（15.40%）。`MODEL_ALLOCATIONS[6]`・`MODEL_META[6]`・DB を同期
- **`scripts/check_model_levels.py` 新規**（CLAUDE.md「最適PFの再計算」参照）
- 定期ジョブ6本を cron から launchd（`~/Library/LaunchAgents/jp.largogk.fi.*.plist`）へ移行。
  cron はフルディスクアクセス不足で `~/Documents` に書けず、スリープ中の実行も補わなかった

## 2026-08-12 — 最適PF再最適化 ＋ リスクレベル境界の変更

semi-retire-app 1 commit・push 済み

- **発端**: 実践4-3 のスライドを「Lv3の配分が◯%ずれるとLv4になる」と具体化するため
  数字を検算したところ、`optimal_portfolios`（DB保存値）と現在の `asset_class_params` で
  再計算した値が全レベルでズレていた。**Lv1〜3 は帯の上限を超え、Lv6〜7 は下限を割っていた**
- **原因**: `scripts/optimize_portfolios.py` が **DB を読まずスクリプト内の定数**
  （`RETURNS` / `RISKS` / `CORR_FLAT`、2026-06 時点）を使っていた。その後 `fetch_volatility.py`
  （cron 毎月1日）と日本株ボラ逆転バグ修正で **DB 側だけが更新され続け**、
  ボラが 11/13 資産でズレていた（us_equity 20.00%→16.58%、emerging_equity 24.00%→19.29% 等）。
  期待リターンは 2026-06 の GPIF 統一で両方直したため 13/13 一致していた
- **`--apply` が一度も成功していなかった**: PostgREST の upsert に必要な
  `on_conflict=risk_level` が無く、`Prefer: resolution=merge-duplicates` だけでは
  insert 扱いになり全レベル 409（一意制約違反）で失敗していた。前回（2026-06-20）の更新が
  SQL Editor 手動だったのはこのため。修正して自動実行が通るようにした
- **リスクレベル境界を 20% → 16.5% に変更**（`classifyRiskLevel7` / `VOL_UPPER` /
  `riskScoring.ts` の表示文言）。ボラ実測の反映で**単一資産の最大ボラが 19.50%（commodity）**
  まで下がり、分散した状態で 20% を超える組み合わせが存在しなくなったため、
  旧 Lv7 帯（20〜24%）が**到達不能**になっていた。16.5 なのは実現可能な
  Lv6(15.11%) と Lv7(16.91%) を分ける必要があるため（17.0 だと Lv7 のモデル配分が Lv6 と判定される）
- **単一資産の上限を新設**: 従来は emerging_bond / emerging_equity にしか上限が無く、
  最適化が「Lv6 = エマージング株15% + エマージングREIT85%」という2資産解を返した。
  数学的には最大シャープだが両者は同じ地域リスクを共有し危機時に一緒に落ちる。
  `DEFAULT_CAP = 0.45`（全資産45%）を追加。**シャープ最大化より分散を優先する価値判断**
- **最低資産数**: Lv4・5 は4資産、Lv6・7 は高ボラ資産が乏しいため3資産
- 新配分（全レベルで判定Lvと一致することを検証済み）:
  Lv1 2.94% / Lv2 5.71% / Lv3 8.52% / Lv4 10.47% / Lv5 13.20% / Lv6 15.11% / Lv7 16.91%
- `MODEL_ALLOCATIONS` / `MODEL_META`（`types.ts`）も DB と同期。
  **ここは `/risk` の「このPFを採用する」で保存される値**なので、DB だけ直しても意味がない
- 適用前のDB値は `optimal_portfolios_backup_20260812.json` に退避（scratchpad）
- テスト109件・`npm run build` 通過

## 2026-08-09〜10 — `/ma` 非課税枠の丸めバグ修正 ＋ `/rb` に口座注記

semi-retire-app 2 commit・push 済み

- **非課税枠を1万円単位に丸めていた不具合を修正**（`2f4c949`）: 実機で「入力合計15万・計算結果16万」を
  ユーザーが発見。`logic.ts` が非課税枠にも `Math.round(amount/10000)*10000` をかけており、
  37,500→40,000 / 45,000→50,000 / 15,000→20,000 / 22,500→20,000 で繰り上げ3件・繰り下げ1件が
  相殺せず +1万円になっていた。コメントには「満額（調整しない）」と書いてあり実装と食い違っていた。
  非課税枠の金額は iDeCo の掛金など**ユーザーが入力した確定額**で、掛け算をしないので端数も出ない。
  丸める理由がないため `return slot.amount` に変更。特定口座の丸めは維持。
  **既存テストが非課税枠の金額を全て1万円の倍数（100,000/50,000/20,000）で書いていたため
  バグを検出できていなかった**。実機の再現ケースをテストに追加（テスト109件パス）
- **`/rb` の売却提案に「どの口座で売るか」の注記**（`be19b52`、`RebalancePage.tsx`）:
  `/rb` は資産クラス単位で計算し口座の概念を持たないため、実践4-1で教えた
  「① iDeCo内スイッチング → ② NISA（枠は翌年復活）→ ③ 特定口座（約20%課税）」の原則が
  ツール側で切れていた。売却が実際に出るとき（売却あり／期間指定モード）だけ静的注記を表示。
  ロジック・入力項目の変更なし。積立のみモードでは出さない

## 2026-08-04〜07 — /ma スロットの口座属性化 ＋ iDeCo統合

設計書 v7.22、semi-retire-app 4 commit＋migration 036〜038・全 push 済み

- **iDeCo/401k の控除欄を追加 → 後にスロットへ統合**（`4445f69` migration 036 / `80edce7` migration 037 → `2e03e00` migration 038 で廃止）: 「毎月15万投資する」という認識には iDeCo の掛金が含まれるのが自然だが、/ma は `monthly_budget` からスロット合計を引いた差額を待機資金として積む設計のため、iDeCo込みの予算を入れると**実在しない資金が毎月積み上がり**、割安時に「無い資金を投入せよ」という指示になっていた。当初は `ideco_amount` で差し引く方式にしたが、038 でスロットに統合して構造的に解消
- **NISA枠の補正セレクタを無効化**（`4445f69`）: `logic.ts` は NISA枠を満額固定として補正を無視するのに、UIではセレクタが選べてしまい、選んでも結果が変わらず誤解を生んでいた。「満額固定（バリュエーション調整なし）」の固定表示に置換
- **スロットに口座属性・7→10枠**（`2e03e00`、migration 038）: 「スロット番号＝口座」の固定構造では**1つの非課税枠に複数商品を置けなかった**。モデルケース（米国株25%/先進国債券30%/エマージング債20%/日本リート10%/ゴールド15%）を月15万で積むと非課税枠に全部収まり5商品を3口座に振り分けるが、旧構造ではNISAに1枠ずつしかない。さらに `logic.ts` がスロット番号で非課税を判定していた（`idx < 2`）ため、NISAの商品を特定口座スロットに入れて回避すると**非課税枠なのに調整がかかる**誤計算になっていた。`slot{N}_account`（nisa_tsumitate / nisa_growth / ideco / specific）を追加し `isTaxAdvantaged()` で判定する方式へ。待機資金の投入先も「特定口座かつ米国株」に変更
- **¥表示・初期値を全額0**（`80edce7`）: 金額入力3種に ¥ を重ね表示（pointer-events-none）。`DEFAULT_SETTINGS` は運営者個人の設定（月次予算100万等）が新規ユーザーの既定値になっていたため全額0に
- **口座別サマリー**（`2e03e00` → `ecef453` で位置修正）: 口座ごとの小計と NISAつみたて月10万／成長月20万の超過警告。当初は入力欄の上に置いたが「入力していないのに金額がある」と誤解されたため**積立欄の下**へ移動（入力→合計の順に読める）
- **制度上の制約**: つみたて投資枠で買えるのは**株式のみ**。純粋な債券インデックス・REIT・ゴールドは成長投資枠でのみ購入可（SBI実機で確認）。バランス型で代用する案は配分を自分で決められずリバランスもできないため不採用
- **運用知見**（SQL Editor 時代の知見。2026-11-04 #17 以降は `supabase db push`）: Supabase SQL Editor が**長いスクリプトの貼り付けで文字を落とす**（`ALTADD`、`user_ma_sSTS`）。複数文をまとめて貼るとブロックの先頭1文しか実行されないケースも。**マイグレーションは最初から1文ずつ短く提示する**
- テスト108件パス。「同じ非課税枠に複数商品」「iDeCoスロットは満額固定」「特定口座だけ調整」を新規に固定

## 2026-08-03 — 認証まわりの不具合修正 ＋ リポジトリ整理

semi-retire-app 6 commit・全 push 済み

- **パスワードリセットが完了できずループする問題を修正**（`accdc9e`）: `resetPasswordForEmail` の `redirectTo` が `window.location.origin`（＝トップ）で、しかも新パスワードを設定する画面自体が存在しなかった。未ログインのトップはログイン画面のため「忘れた方→メール→リンク→ログイン画面」を無限に繰り返す状態だった。`ResetPasswordPage.tsx` を新設（`/reset-password`）し、implicit フローで戻るリカバリセッション（`PASSWORD_RECOVERY`）を待って `updateUser({password})` で再設定。リンク期限切れ／使用済みは専用メッセージで案内。ルートは**未ログイン・メール未確認・ログイン済みの3分岐すべて**に登録（リカバリ時にセッションが張られるかで到達分岐が変わるため）。Supabase の Redirect URLs は既存の `fire.largogk.jp/**` でカバー済み（追加設定は不要だった）
- **ログイン中のパスワード変更画面を追加**（`61cf592`）: 変更手段がリセットメールしかなく、リカバリリンクでログインした人は「ログインできたがパスワードは分からない」まま、もう一度メールを発行する往復が必要だった。`PasswordChangeModal.tsx` を新設し `UserStatusBar` のログアウト横に導線（`Layout` 経由で全ページ）。**現在のパスワードは要求しない**——リカバリ直後は本人が現在のパスワードを知らないため、要求すると変更できず同じ往復に戻る。厳格化する場合は Supabase 側の Secure password change を有効にすればこの画面はエラー表示で対応する。パスワードは `auth.users`、有料状態は `profiles.is_premium` と別テーブルのため、**変更しても招待コードで付与した有料状態は維持される**
- **招待コード生成スクリプトを追跡対象に**（`724e714`）: `scripts/generate-invite-code.ts` は有料ツールの招待コード発行の唯一の手段だが git 未追跡でローカルにしか存在しなかった。追跡し `npm run invite -- --count N` で実行できるよう `package.json` に追加。キーは `scripts/market/.env`（gitignore 済み）から読むためスクリプト本体に秘密は含まない
- **/ma の待機資金ラベルから iBond 表記を削除**（`12bee19`）: 「待機資金残高（iBond）」「今月の待機分 → iBond」は運営者個人の運用先で一般ユーザーには当てはまらないため汎用表現に変更
- **未追跡ファイルの整理**（`e359e5c` / `d451720`）: `__pycache__` と `scripts/market/indicators.json`（`fetch_indicators.py` の生成物）を gitignore、`Docs/lp_draft_age50s_v1.md` を追跡（CHANGELOG「2026-05-03 — /tools/age50s LP 新設」と `Docs/phase-history-2026H1.md` の同じ項目が参照しているのに未追跡だった）、`src/content/legal/privacy.md` を物理削除（CHANGELOG「2026-04-30 — largogk.jp コーポレートサイト復活」で削除済みのローカル残骸。`/privacy` は `vercel.json` で largogk.jp へリダイレクトしており正本ではない。`tokushoho.md` と同じ処理）。これで `git status` はクリーン

## 2026-07-27 — /ma 月次投資アドバイザーの大改修

semi-retire-app 6 commit＋migration 032〜035・全 push 済み。`src/lib/ma/*` と `MonthlyAdvisorPage.tsx` が中心

- **指標取得の信頼性修正**（`2cf1424`）: `indicators.gold_silver_ratio` に過去の壊れた値 `-0.5` が残り /ma が異常補完していたのを再取得で解消（→68.4）。`openpyxl` 未導入で TOPIX PBR がずっと取得失敗していたのを `scripts/market/requirements.txt` に openpyxl/lxml 追加で解消（→1.8）。`fetch_indicators.py` は `--fetch-only` 必須（無いと `serve_and_open` の HTTP サーバーで永久ハング）を明記＋crontab 修正。「自動取得済み」ブロックに CAPE/PBR/金銀比率の数値＋20日超で⚠️表示を追加
- **積立スロット 5→7（特定口座 3→5）**（`a8ede6a`、migration 032）: slot6/7 追加。`SLOT_KEYS`/`slots` 配列/`_row`/`UpdatePatch` を7スロット対応
- **バリュエーション調整を特定口座オンリー・NISA枠は満額固定**（`e0f1aab`）: `logic.ts` の `NISA_SLOT_COUNT=2`（038 で `isTaxAdvantaged(slot.account)` に置換）で slot1/2(NISA)は係数・mode・待機投入の対象外＝満額。税制優遇枠は満額が確実に有利という原則（iDeCo/401k も同様）。UIに「満額」バッジ＋注記
- **日本株の指標を TOPIX / 日経225 で選択**（`11aacef`、migration 033）: `UserMaSettings.jp_index`。`PBR_THRESHOLDS[jpIndex]`（TOPIX 割高≥1.8 / 日経225 割高≥2.0）。TOPIX は自動取得、日経225 は日経公式が自動取得不可のため手入力
- **日経225 PBR の近似オートフィル**（`ce3c1e7`、migration 034）: 実測PBRを一度「基準」入力→以降は既取得の日経225株価で `estimateNikkeiPbr = 基準PBR × 現在株価/基準時株価`。`nikkei_pbr_anchor`/`nikkei_price_anchor` に保存、数ヶ月ごと再基準
- **待機資金は同月内は最後の実行で上書き**（`03fe4e6`、migration 035）: `reserve_month`/`reserve_month_base`（月初base）を記録し `resolveReserveBase()` で同月再実行時は base から計算＝二重加算しない。カレンダー月境界。翌月は現残高が新base
- **設計の芯**: 「税制優遇枠は満額／タイミング調整は課税口座で／自分が買ってる指数で割高感を測る」。講座コンテンツの骨子にもなる。テストは `logic.test.ts` 37件パス

## 2026-07-14 — /risk「このPFを採用する」ボタン ＋ 採用PF＝全ツールのアンカー確定

設計書 v7.19、semi-retire-app 1 commit `98534b5`・push 済み

- **採用ボタン**（`RiskResultDisplay.tsx` のみ、+54/-8）: /risk 診断結果のモデル配分カード直下に「このPFを採用する」を新設。タップで `MODEL_ALLOCATIONS[finalLevel]` を `saveTargetAllocation` で `user_rb_settings`（＝/rb が `fetchTargetAllocation` で自動読み込みする目標配分）に保存。採用後は「✓ 採用しました。あなたの目標配分に設定されました」＋次の一歩（口座別リバランス）のテキスト案内のみ（**A案・最小**、/rb への hard CTA は「順番が飛ぶ」ため撤去）。`useAuth()` の user で保存し未ログイン時はボタン無効。`npm run build`（tsc -b + vite + prerender）通過。これで「診断→最適PF→ワンタップ採用（＝目標配分アンカー生成）」が一本化
- **ツールのライフサイクル確定**: 初回移行リバランス＝口座別ワークシート（講座配布物・Google Sheet）／普段の積立（毎月）＝/ma／定期リバランス（6ヶ月〜1年に一度）＝/rb
- **「採用PF＝全ツールのアンカー」構想＝採用（Yes）**。大半は実現済み（採用＝保存、/rb が参照）。唯一の新規候補「**/ma の積立リバランス**（採用PFを読んで積立を不足アセットに寄せる／ノーセル・リバランス）」の go/no-go は**実践4-2（維持リバランス）の脚本着手時にレビュー確定**（脚本と機能の一致が必須＝棚上げ防止トリガー）。/ma は現状 holdings も target も読まず指標＋積立設定のみのため、実装するなら現在保有の配管が要る

## 2026-07-11〜12 — /portfolio 保有PFデータ化＋明示カード＋3列比較＋DB化

設計書 v7.18、`PortfolioCustomizePage.tsx`、5 commit

- **保有PFを編集可能データ化＋明示カード＋すり替わりバグ修正**（`7d5d048`）: 状態モデルを `heldAmounts`（保有PF金額スナップショット）＋`editingHeld`＋`adjustedOptimal` に作り直し。折りたたみ式📌保有中のPFカード（内訳・合計・4指標・「✏️修正」で入力欄へ復元）を新設。**バグ根治**＝「最適配分に戻す」2度押しで保有PFが最適にすり替わる不具合を、入力欄が保有PFを表す `editingHeld` のときだけ撮り直す方式で解消。以降は入力欄で書き換え→分析で保有PF更新（＝将来のデータ修正）。カード指標追加`9ebefc0`／開閉式`1802273`
- **比較表を3列に**（`42900c8`）: 調整後があるとき（保有PFあり＋調整済み）は「保有中／調整後／最適配分」の3列で並列表示。未調整時は2列
- **ボラ計算のDB化**（`b11adbc`）: 従来 /portfolio だけ古いフォールバック定数（米国株ボラ20%等）を直接使い 2026-06 補正済みDB値（米国株16.58%等）とズレて vol・Lv が過大だった（同PFで 9.2%/Lv4→DB値なら約8.1%/Lv3）。`/pf` と同じ `loadAssetClassParams()` でDB取得し `calcVolatility`/`calcExpectedReturn`/`computeResult`/`optimal`/`heldInfo` に `MarketParams` を渡す方式に。取得失敗時のみフォールバック。保有中・調整後・最適の全列がDB基準になり `/pf` と一致
- **残TODO**: `MODEL_META`（types.ts）は /risk・/rb で静的表示され毎月cronのDB更新と乖離しうる（別途 optimize_portfolios.py 再実行で再同期）。`AllocationSlider.tsx` はフォールバック直だが未使用デッドコード（CLAUDE.md の TODO に移した）

## 2026-07-10〜11 — /portfolio 金額モードの最適配分 + 比較左列の出し分け

設計書 v7.17、`PortfolioCustomizePage.tsx`、4 commit

- **金額モードで「最適配分にする／戻す」を機能**（`f8fc558`）: 従来は金額入力時にボタンを押すと `amounts` が消え %モードへ飛ぶだけだった。金額モードでは**保有総額を維持したまま最適配分（`MODEL_ALLOCATIONS[baseLevel]`）の比率で各アセット金額に再割り当て**（丸め誤差は最大配分アセットで吸収し合計を厳密一致）。ボタン文言は `amountOptimalApplied` で未適用「最適配分にする」／適用後「最適配分に戻す」を出し分け
- **tsc -b 型エラー修正**（`0a0edd1`）: `reduce` の string キーで `Record<AssetClassKey,number>` を添字アクセスし TS7053 で Vercel ビルド失敗。`newKeys` を `AssetClassKey[]` 型に。**教訓＝このリポは `tsc -b`（project references、`tsc --noEmit` より厳格）を使うので確認は `npm run build` で行う**
- **比較左列を保有PF/調整後で出し分け**（`f9dd2f8`→`0b8ec1d`）: `heldWeights` スナップショットを保持し、「最適配分にする」で入力欄を最適に置換しても比較の左列は保有PFのまま。金額を編集するとスナップショット破棄→以降は `調整後 vs 最適配分`（※この weights スナップショット方式は2026-07-11〜12（v7.18）で `heldAmounts`＋カードに作り直し）

## 2026-07-07〜08 — /portfolio 金額入力 + /tools 招待コード導線 + 現PF vs 最適配分の比較

設計書 v7.15〜v7.16、3 commit

- **金額入力**（`1d77a06`）: アセット配分を %／金額で切替可能に（金額→自動%換算、合計額をモンテカルロ初期資産へ反映）。金額モードは 'cash' を activeKeys に含め、余剰現金の入力を促す
- **/tools 招待コード導線**（`11701fa`, `ToolsHubPage.tsx`）: 有料ロックカードのモーダルから招待コード入力（ログイン済→`InviteCodeModal`、未ログイン→トップ誘導）、成功で is_premium refresh し全ツール解放
- **現PF vs 最適配分の比較 + MC比較**（`3a2dbd0`, `PortfolioCustomizePage.tsx`）: ボタン「初期配分に戻す」→「**最適配分に戻す**」に改称。分析結果に「今の配分／最適配分（`MODEL_ALLOCATIONS[baseLevel]`）」の指標比較（期待リターン・ボラ・シャープ）を並記。最適の指標は `MODEL_META` の生値ではなく現PFと同じ `calcExpectedReturn`/`calcVolatility` で算出し同一基準に。モンテカルロも最適配分で同条件実行し 3シナリオ＋中央値差を並記（`mcOptimalResult` state 追加、表示は `mcResult && mcOptimalResult` でゲート）。未使用化した `getRiskLevelDef` import 削除。tsc 0エラー・vite build 成功

## 2026-06-21 — PF診断〜最適PFの一本化 + データ品質修正

semi-retire-app 6 commit + FI_project 2 commit + SQL Editor 適用

- **PF診断ラベル修正**（`4bc7857`）: PF診断結果のスコア表示ラベル「あなたのリスク許容度（簡易診断結果）」→「あなたのリスク許容度」。`PfDiagnosisSimplePage.tsx` のスコア表示のラベル 1 行のみ
- **PF診断 → /portfolio 導線追加**（`54c3ea3` match / `3a62545` pf_lower）: ギャップ分析で `gapType==='match'`（合っている）と `'pf_lower'`（保守的すぎ）の場合に「ポートフォリオを最適化する」CTA（`<a href="/portfolio">`、薄緑/黄でケース別配色）を追加。`/portfolio` は `PremiumGate` で有料・招待制のため、無料ユーザーには 🔒 招待画面が出る**アップセル導線**として意図的に設置。`pf_higher` は既存 `RiskExcessWarning`（暴落シミュ + 調整導線）を維持。リスクレベルは `/portfolio` 側が DB から取得するため素リンクで OK
- **最適PF再設計**（`9b6f7b6`、`scripts/optimize_portfolios.py`）: 旧実装は「5アセット以上・乱択200試行・vol帯下限張り付き」で 8〜9 資産に分散しがちだった。**①上限5資産（サイズ2〜5の部分集合を総当たり）②vol目標を実効上限の90%（上部帯狙い）③新興債≤25%・新興株≤50%（全レベル）④Lv7 のみ新興株≤65%・新興REIT≤15%・最低4資産・vol下限20%（VOL_UPPER[7]=50 はセンチネルで実効上限24%を採用しても0.9×24=21.6%が到達不能なため）⑤--apply 無しは dry-run** に刷新。検証で「分散はLv4で5資産が頭打ち（9資産はシャープ+0.006のみ）」を実測した上での設計判断
- **optimal_portfolios テーブル更新**（SQL Editor 直接適用、7 レベル upsert）: 上記の確定配分を反映。vol が帯上部へ・資産数すっきり5以下・Lv4 の新興債40%偏重も解消
- **MODEL_ALLOCATIONS/MODEL_META を一本化**（`687ba68`、`src/lib/rb/types.ts`）: 初期表示用のハードコード配分を optimal_portfolios の確定値と一致させ、`/risk`（無料・RiskResultDisplay）/ `/portfolio` 初期表示 / `/rb` プリセット の値ズレを解消。MODEL_META の期待リターン/ボラ/シャープも同一PFの計算結果に同期（旧 MODEL_META のシャープ Lv1=0.75 等は根拠不明だった）
- **「理論上の最適PF」ボタン→「初期配分に戻す」**（`833ebcb`、`PortfolioCustomizePage.tsx`）: 一本化で初期表示=optimal_portfolios になり DB フェッチボタンが同値を返すだけになったため、同期で MODEL_ALLOCATIONS を復元するリセットボタンに変更。不要な `supabase` import / `optimalLoading` state を削除
- **日本株ボラ逆転バグ修正**（FI_project `50a65ce`、`content-pipeline/fetch_volatility.py`）: PF診断で「日本株+現金=Lv5、米国株+現金=Lv3」と逆転していた根本原因は、`asset_class_params.japan_equity.volatility=27.40%`（全資産で最大という異常値）。1306.T(TOPIX ETF)の **2026-03 10:1株式分割が Yahoo データで未調整のまま -91% の偽月次リターンとして混入**し、年率ボラを ~17%→27.4% に押し上げていた（`auto_adjust=True` でも未補正）。月次±50%超を分割等の価格不連続とみなして除外する `clean_monthly_returns` を追加し、vol と相関の両方をクリーンに再計算。再実行で japan_equity vol 16.96% に正常化、両ケースとも Lv3 に収束（cron 毎月1日も以後クリーン）
- **期待リターンを全13資産GPIFベースに統一**（FI_project `9b7a97e`、同スクリプト）: 従来は GPIF4資産以外が Yahoo 実現リターンにフォールバックし gold 13.4%・emerging_equity 16.1%・developed_reit 11.5% 等が過大だった。`GPIF_EXPECTED_RETURNS` を全13資産に拡張し `optimize_portfolios.py` の RETURNS と一致させ、診断の期待リターンと最適PF/モデル配分の前提を整合（ボラは引き続き Yahoo 実績、リターンのみ前向き推計）

## 2026-05-23 — Footer の特商法リンクを largogk.jp 直リンク化 + prerender コメント清掃

### 概要
2026-04-30 に `/tokushoho` `/privacy` を largogk-corporate に移管した時の残骸を整理。Footer のリンクが Vercel 308 redirect 1 段中継経由になっていたのを直リンク化、`prerender.ts` のコメントから既に消えた route 言及を削除。

| コミット | 内容 |
|---|---|
| **`b36277e`** | fix: direct footer tokushoho link to largogk.jp, clean prerender comment (2 files / +8 / -3) |

### 1. Footer.tsx の `/tokushoho` リンク直接化

旧:
```tsx
<Link to="/tokushoho" className="hover:text-gray-900 hover:underline">
  特定商取引法に基づく表記
</Link>
```

新:
```tsx
<a
  href="https://largogk.jp/tokushoho.html"
  target="_blank"
  rel="noopener noreferrer"
  className="hover:text-gray-900 hover:underline"
>
  特定商取引法に基づく表記
</a>
```

→ クリック時の流れ: SPA 内部遷移 → Vercel 308 redirect → largogk.jp/tokushoho.html (3 段) から、**新規タブで largogk.jp/tokushoho.html へ直接遷移 (1 段)** に短縮。`import { Link }` は `/about` `/privacy` で継続使用のため維持。

### 2. prerender.ts コメント整理

旧 (L43):
```
* Commit 3: /about, /privacy, /tokushoho を追加
```
新:
```
* Commit 3: /about を追加
```

→ `/privacy` `/tokushoho` は既に PRERENDER_ROUTES から除外済み（corporate 移管で）、コメントだけ古い情報が残っていたのを清掃。実 PRERENDER_ROUTES（7 ルート）と整合。

### 3. 検証

- build + prerender 7 routes 成功（`/risk`, `/about`, `/tools`, `/tools/risk`, `/tools/retirement-simulation`, `/tools/age50s`, `/tools/retirement`）
- legal-check baseline 7 件維持

### 補足 (2026-05-24 追加)

`src/content/legal/tokushoho.md`（L15 に `静岡県伊東市池893-354` の番地が記載されたローカル残骸）を物理削除。`git ls-files` で確認した結果、このファイルは元から **untracked（本番未公開）** だったため commit 不要、物理削除のみで完全クリーン化。corporate / fire 両 repo に対する住所・資産額一括 grep 監査の結果として実施。

---

## 2026-05-19 — `/tools` ハブページ新設（SEO Phase 1 Commit 4 完全クローズ）

### 概要
設計書 v7.0 §3-9「後半生を設計し、回し続けるための6つのツール」の主軸メッセージを具現化する `/tools` ハブを新設。`/tools/*` 下に既存 4 LP（risk / retirement-simulation / age50s / retirement）+ 新規ハブ 1 ページの構成が確定し、SEO Phase 1 Commit 4「/tools/ ハブ + LP 4 本」が完全クローズ。

| コミット | 内容 |
|---|---|
| **`f88f85c`** | `/tools` ハブページ新設（4 ファイル / +371 行）|

### 1. ToolsHubPage.tsx 新規（約 320 行）

**§1a ヒーロー（写真 + h1 + サブ）**
- 既存 LP と同じパターン: `bg-image (/images/hero-izu.jpeg) + bg-black/50 overlay + min-h-screen flex justify-center`
- h1: 「後半生を設計し、回し続けるための6つのツール」（`text-3xl md:text-4xl lg:text-5xl font-bold`）
- サブ: 「資産形成は意志ではなく、仕組みの力で実現しよう。」（既存 LP の `text-xl md:text-2xl text-white/80 mt-4` 規約に揃え）

**§1b リード文 5 段落（写真の下、白背景、装飾 3 点）**
- 黄色マーカー: 「100万円単位でお金が毎日溶けていく」
- 青下線: 「パニック売り」
- 引用ブロック: 「長期投資に耐え得る仕組みを事前に作っておかないと、暴落時の恐怖心に意志の力だけで抗うのは、ほぼ無理です。」
- 末尾「48歳でリタイアしました（詳しくはこちら）」→ `/about` リンク

**§2 サイクル説明**
- h2: 「設計して、淡々と回し続ける」+ 段落 1 つ

**§3 6 ツールカード一覧**
- `grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6` で横並び
- フェーズ別 `border-l-4` アクセント: 設計フェーズ無料 = `border-l-blue-500` / 設計フェーズ有料 = `border-l-indigo-500` / 運用フェーズ有料 = `border-l-amber-500`
- カード = アイコン + 番号 + タイトル + tagline 1 行のコンパクト表示。tagline は `mt-auto pt-3` で下揃え（タイトルの 1/2 行差を吸収）
- クリックでモーダル展開（`NicknameModal.tsx` 規約踏襲: `fixed inset-0 z-50 bg-black/50` + 中央寄せ + X ボタン + オーバーレイクリックで閉じる）
- モーダル内で `description.split('\n\n').map(<p>)` で段落分割（2-3 文/段落）+ CTA ボタン

**ツール構成と区分**
| # | タイトル | tagline | phase | CTA (ログイン後) |
|---|---|---|---|---|
| ① | リスク許容度診断 | 客観 × 心理の2軸で測る、設計の出発点 | 設計無料 | `/risk`（認証不要）|
| ② | PF診断 | 今のPFが許容度の範囲内か即チェック | 設計無料 | `/pf`（認証必須）|
| ③ | 資産寿命シミュレーター | 自分のLv基準の利回りで試算する | 設計無料 | `/`（認証必須）|
| ④ | PFカスタマイズ | 13資産スライダー × 1000試行モンテカルロ | 設計有料 | なし（招待制）|
| ⑤ | 月次投資アドバイザー | 市場指標で月次投資額を自動調整 | 運用有料 | なし（招待制）|
| ⑥ | リバランス | ズレを可視化、リバランス計画を自動算出 | 運用有料 | なし（招待制）|

**ゲート挙動**:
- ログイン未完了の ②③ は opacity-50 + モーダル内に「リスク許容度診断を完了するとご利用いただけます」amber バナー + CTA 非表示
- 有料 ④⑤⑥ は opacity-60 + Lock アイコン + 常時 CTA なし
- 「※ 有料ツールは現在、招待制で提供しています」注記を §3 末尾に配置

**§4 SEO LP 別枠**
- h2: 「資産運用の考え方を深めたい方へ」
- pill 型ボタン 4 個で既存 LP に送客（`/tools/risk` / `/tools/retirement-simulation` / `/tools/age50s` / `/tools/retirement`）

### 2. ルーティング・SEO 配線

- **`App.tsx`**: `<Route path="/tools" element={<ToolsHubPage />} />` を 3 auth ブロックすべてに追加（認証不要）
- **`sitemap.xml`**: `/tools` を `priority 0.8` / `lastmod 2026-05-19` で追加（7 → 8 URL）
- **`scripts/prerender.ts`**: `PRERENDER_ROUTES` に `/tools` 追加（6 → 7 ルート）

### 3. 設計判断（実装時に確認）

- アイコン: lucide-react で対応（BarChart3 / SlidersHorizontal / Calculator / Lock / X / ChevronDown）→ Tabler Icons 新規依存追加せず
- `/tools` の sitemap priority: 0.8（既存 LP と同等）
- 未ログイン ②③ の挙動: グレーアウト + モーダル内メッセージ（指示通り）

### 4. 検証

- legal-check baseline: **7 件維持**（新規 NG なし）
- build + prerender: 7 routes すべて成功（`/risk`, `/about`, `/tools`, `/tools/risk`, `/tools/retirement-simulation`, `/tools/age50s`, `/tools/retirement`）
- 本番デプロイ: Vercel `dpl_BdT6ESQFVmzputEZ3SxfU8PrPy4i`（commit 時刻 12:54:42 → deploy 完了 12:54:46、4 秒差で同一コミットのデプロイ）

### 5. これで SEO Phase 1 Commit 4 完全クローズ

| 残作業 | 状態 |
|---|---|
| `/tools/` ハブ | ✅ 完了（本コミット）|
| `/tools/risk` LP | ✅ 既存 |
| `/tools/retirement-simulation` LP | ✅ 既存 |
| `/tools/age50s` LP | ✅ 既存 |
| `/tools/retirement` LP | ✅ 既存 |

次は SEO Phase 1 Commit 5+（内部リンク・品質チェック・Lighthouse）または Phase 3.5（ステップメール）へ移行。

---

## 2026-05-16 — 月次投資アドバイザー(/ma) 5 枠 asset_class 選択式リファクタ + 新興国モメンタム追加（migration 031 + fetch_indicators 拡張）

### 概要
`/ma` の 5 枠を「税制口座種別 + 資産クラス固定」構造から「資産クラス選択式」構造へリファクタ。同日に発生した PF リバランス需要（米国偏重 → JP + 新興国へ）の中で「ゴールド枠に日経225 を入れると GSR 連動で月次投資額が振れる」「銘柄名がリロードで消える」問題が顕在化したことを発端に着手。

| コミット | 内容 |
|---|---|
| `0901864` | `fetch_indicators.py` に VWO (新興国 ETF) momentum を追加 |
| `2b39b4e` | migration 031 + types/logic/db/UI/test の 5 ファイル + 設計書を 1 コミットで投入 |

### 1. Phase A 仕様確定（Q1〜Q4 判断）
- **Q1: 新興国指標 = 案A モメンタムのみ**（VWO 10ヶ月MA 比較。バリュエーション拡張は Phase 2 で）
- **Q2: スロット数 = 案A 5 枠維持**（可変化のメリット薄）
- **Q3: モード補正範囲 = 案B 株 + Gold に適用、債券は除外**
- **Q4: DB スキーマ = 案B カラム名リネーム + asset_class 列追加**

設計書: [Docs/migration_031_ma_refactor_plan.md](Docs/migration_031_ma_refactor_plan.md)（440 行、Phase A 結論 / DB 設計 / コード変更 / リスク・ロールバック・適用順序まで網羅）

### 2. DB スキーマ変更（migration 031）
旧 schema:
```
nisa_tsumitate / nisa_growth / tokutei_ac_base / tokutei_gold_base / tokutei_bond
```

新 schema（rename 5 + add 10 = 計 15 操作 + CHECK 制約 5）:
```
slot1_amount / slot1_fund_name / slot1_asset_class
slot2_amount / slot2_fund_name / slot2_asset_class
slot3_amount / slot3_fund_name / slot3_asset_class
slot4_amount / slot4_fund_name / slot4_asset_class
slot5_amount / slot5_fund_name / slot5_asset_class
```

DEFAULT で旧挙動を概ね保持: slot1='none', slot2='none', slot3='us', slot4='gold', slot5='bond'。CHECK 制約は `IN ('us','jp','em','gold','bond','none')`。

### 3. `AC_US_RATIO` 廃止と新乗数体系
旧: `acMultiplier = 0.666 × usMultiplier + 0.334 × 1.0`（66% US + 33% その他の暗黙 mix）
新: 各 slot が単一の asset_class に対応する純粋な乗数を取る。`acMultiplier` 概念を完全廃止。
- 'us' → `CAPE × momentumUS`（× mode 補正）
- 'jp' → `PBR × momentumJP`（× mode 補正）
- 'em' → `momentumEM`（バリュエーション無し、× mode 補正）
- 'gold' → `GSR × momentumGold`（× mode 補正）
- 'bond' → `1.0`（mode 補正非適用）
- 'none' → `1.0`（mode 補正非適用、純粋固定）

旧 `tokutei_ac_base ¥500K + CAPE 割高(0.75x)` の挙動: 旧 ¥500K × 0.834 ≒ ¥42万 → 新 ¥500K × 0.75 = ¥38万。**設計通りの挙動変化、ユーザーは新興国に移行予定のため実害なし**（テストで明示的に確認）。

### 4. `reserveDeployment` ロジック改修
旧: CAPE 割安時、`tokutei_ac_base` に reserve × 25/50% を加算（固定）
新: 最初に asset_class='us' のスロットに加算。'us' スロットが無ければ `reserveDeployment=0` で待機残高そのまま（テストで境界条件確認）

### 5. fetch_indicators.py 拡張
`targets` dict に `"em": {"ticker": "VWO", "label": "新興国(VWO)"}` を 1 行追加。スキーマ変更なし（既存 JSON カラムに 1 キー増えるだけ）。手動実行で 2026-05-16 14:04 時点の VWO momentum (58.44 vs MA10 54.90, above_ma=true) を `market_data` に投入済み。

### 6. UI 変更（MonthlyAdvisorPage.tsx）
- `fundNames` local state（揮発）を削除、`settings.slot{N}.fund_name` 経由で DB 永続化
- 各 slot に **資産クラス dropdown** を追加（6 オプション、`MA_ASSET_CLASS_OPTIONS` 経由）
- ラベル中立化: 旧「特定口座（株式/ゴールド/債券）ベース」→ 新「特定口座 1 / 2 / 3」
- モメンタムセクションに「新興国株」トグル追加
- 「判定詳細」セクションに「新興国株 最終倍率」表示追加
- 結果表示は `result.perSlotAmount[idx]` をループで描画。reserve deployment 表示は最初の 'us' スロットにバッジ表示

### 7. テスト変更（logic.test.ts）
既存 26 ケース（getCapeMultiplier / getPbrMultiplier / getGsrMultiplier）を維持。新規 `describe('calculateAllocation')` に 8 ケース追加:
- 全 slot 'none' で固定積立
- 適正水準で全 slot 等倍
- us 割高で us slot だけ 0.5x
- em は momentum のみで 0.5x / 1.0x
- mode=bullish で us/jp/em/gold が +0.25、bond/none は補正なし（Q3 案B 確認）
- reserve deployment が最初の 'us' スロットに行く
- 'us' スロット無し時、reserveDeployment=0 で待機残高維持
- `AC_US_RATIO` 廃止の挙動差（旧 ¥42万 vs 新 ¥38万）

最終: **98/98 pass + build OK + 6 routes prerender OK**。

### 8. 適用と検証
- **適用方式**: Vercel deploy Ready 確認後、SQL Editor で migration 031 を即時実行（短時間の不整合窓を最小化）。`schema_migrations` テーブルは案 A 継続で触らず
- **適用後 DB 検証**: tsx 経由 SELECT で 20 カラム構造確認、きみさんの user_id で `slot3_asset_class='em' / slot4_asset_class='jp'` まで切替済みを目視確認
- **実機 UI**: `/ma` で 5 枠 + 3 入力（金額 / 銘柄名 / 資産クラス dropdown）+ 新興国モメンタムトグル + 新興国株 最終倍率行が全て表示されていることを確認

### 9. 既知の制約と後続タスク
- **VWO バリュエーション指標** は未実装（Phase 2 で VWO P/E + 5 年 MA 乖離判定）
- **`saveSnapshot` 重複 INSERT バグ**（rb 側、2026-05-16 発覚）は別タスクで対応予定、本変更には含めない

### 10. ロールバック手順
設計書 `Docs/migration_031_ma_refactor_plan.md §2-4` 参照。DROP COLUMN 10 列 + RENAME COLUMN 5 列（旧名復元）+ フロントコード revert がセットで必要。

---

## 2026-05-16 — fund_master JEPI 誤分類修正 + 日本個別株 16 銘柄 seed + 年金 2 銘柄 seed（migration 028 + 029 + 030）

### 概要
2026-05-16 のリバランス計算で発覚した 2 つの分類問題を Supabase マイグレーションで修正。`mfParser.ts` に分類ロジックは存在せず、判定は `fund_master` テーブルとの ticker 照合で行われる構造なので、コード変更なしの SQL 修正のみで完結。

### 1. 発覚した問題
- **JEPI コモディティ誤分類**: コモディティ合計 ¥5,685,924 のうち、DBA ¥4,418 は正しい一方、**JEPI ¥5,681,506 が混入**。migration 021 で JEPI/QYLD/RYLD を `alternative → commodity` に一括 UPDATE したのが誤判断（カバードコール戦略でも原資産は米国株式 ETF）
- **日本個別株 16 銘柄が全て「未分類」**: seed 013 が投信 + 米国 ETF + 米国個別株のみで日本個別株を含まず、`fund_master` に 4 桁数字 ticker が 0 件だった

### 2. Phase A 調査の重要知見
- **`mfParser.ts` (191 行) に分類ロジックなし** — Excel から `{ name, ticker, amount }` を抽出するだけ。分類は `fund_master` の ticker 照合で `MfImportFlow.tsx` の allocator が決定
- **`fund_master.ticker` に UNIQUE 制約なし** — PK は uuid `id` のみ（migration 012 L7-14）
- **UI 経由で既存行を訂正する手段がない** — `submitFundRequest()` (db.ts:163-170) は ticker 既存で INSERT スキップ。SQL UPDATE が唯一の手段
- **ticker 保存形式**: `parseStockRow` の `String(col0).trim()` で日本株は `"1605"`（裸の 4 桁、`.T` なし）
- **既存 asset_class 値**: `commodity / developed_bond / developed_equity / emerging_equity / gold / japan_bond / japan_equity / us_equity` の 8 種

### 3. migration 028: JEPI 誤分類修正
- **UPDATE 3 行**: JEPI/QYLD/RYLD を `commodity → us_equity` に訂正（021 の逆操作）
- **INSERT 4 行（予防的 seed）**: JEPQ / XYLD / SCHD / VYM を `us_equity` で登録
  - JEPQ: stockanalysis.com/etf/jepq 確認、Nasdaq-100 covered call
  - XYLD: globalxetfs.com/funds/xyld（発行元公式）確認、S&P 500 covered call
  - SCHD: stockanalysis.com/etf/schd 確認、Dow Jones US Dividend 100 連動
  - VYM: stockanalysis.com/etf/vym 確認、FTSE US High Dividend Yield 連動
- **NUSI 除外**: 発行元（Nationwide）公式ページ接続不能、stockanalysis 404、Morningstar 403 で確証取れず → 推測排除原則で除外（021 と同じ轍を踏まない）

### 4. migration 029: 日本個別株 16 銘柄 seed
| ticker | fund_name |
|---|---|
| 1605 | INPEX | 2914 | JT | 3003 | ヒューリック | 4792 | 山田コンサル |
| 4967 | 小林製薬 | 5938 | LIXIL | 6365 | 電業社 | 6652 | IDEC |
| 8267 | イオン | 8395 | 佐賀銀 | 8630 | SOMPOHD | 8697 | JPX |
| 8725 | MS&AD | 8871 | ゴールドクレ | 8894 | REVOLUTION | 9651 | 日プロ |

全 16 銘柄を `asset_class = 'japan_equity'` で INSERT。fund_name は 2026-05-16 のきみさん MF Excel 出力（R21-R36）の表記そのまま採用（将来 MF 側の表記が変わったら別マイグレーションで UPDATE 想定）。

### 5. migration 030: 年金セクション 2 銘柄 seed
028 / 029 適用後に MF 取込で年金セクション（R94-R95）の 2 銘柄が「未分類」で残ったため追加対応。

| ticker（照合キー、MF 出力そのまま） | fund_name（表示用短縮） | asset_class |
|---|---|---|
| `iFree NYダウ・インデックス(iFree NYダウ・インデックス)` | `iFree NYダウ・インデックス` | us_equity |
| `農林中金<パートナーズ>長期厳選投資 おおぶね(農林中金(パートナーズ)長期厳選投資 おおぶね)` | `農林中金<パートナーズ>長期厳選投資 おおぶね` | us_equity |

**Phase A 追加知見**: `mfParser.ts:154-167` の `parsePensionRow` は `{ name, ticker: '' }` を返す（ticker は空文字列固定、投信 / 債券も同じ）。`allocator.ts:45-49` の照合ロジックは **fund_master の `ticker` カラムだけ**を使う（`fund_name` は表示用で照合には使われない、コメントは「銘柄名一致」だが実装は `fm.ticker === h.name`）。投信 / 債券 / 年金の seed は **ticker カラムに MF 出力 name の完全一致文字列**を入れる規約（既存パターン: `('eMAXIS Slim 全世界株式(オール・カントリー)', 'eMAXIS Slim 全世界株式(オール・カントリー)', ...)`、013 seed L7 以降）。030 もこれに準拠。

### 6. 適用と検証
- **適用方式**: Supabase Dashboard SQL Editor 直接実行（CLI 未使用）。`schema_migrations` テーブルは触らず、migration 027 と同じ案 A を継続
- **適用前**: fund_master 総行数 44、028 対象 3 行が `commodity`（誤分類確定）、4 行未登録、029 対象 16 行未登録、030 対象 2 行未登録
- **適用後（028 + 029）**: 総行数 **64**（+4 from 028 INSERT, +16 from 029 INSERT）、028 対象 7 行すべて `us_equity`、029 対象 16 行すべて `japan_equity`
- **適用後（030 追加）**: 総行数 **66**（+2 from 030 INSERT）、030 対象 2 行すべて `us_equity`
- いずれも tsx 経由の SELECT で確認済

### 6. 設計書
[Docs/migration_028_029_plan.md](Docs/migration_028_029_plan.md) — Phase A 結論サマリ / 各マイグレーションの想定影響範囲 / ロールバック SQL / 検証 SELECT / 適用順序チェックリスト

### 関連コミット
- migrations 028 + 029 + 設計書: 本コミット
- Phase A 調査時に発見した既存実装: `src/lib/rb/mfParser.ts` / `src/components/rb/MfImportFlow.tsx` / `src/lib/rb/db.ts` / 設計の経緯は 011（rb_snapshots）/ 012（fund_master）/ 013（seed）/ 021（asset_class fix の誤判断）

---

## 2026-05-03 — /tools/age50s LP 新設 + 14 項目修正（SEO Phase 1 Commit 4 の 3 本目）

### 概要
SEO Phase 1 Commit 4 の 3 本目 LP として 50 代向け資産運用 LP を新設、その後 2 段階の修正（10 項目 + 4 項目）で構成・本文・余白を仕上げ。`Docs/lp_draft_age50s_v1.md` を本文ドラフトとして保管。

| コミット | 内容 |
|---|---|
| **7a22da5** | `/tools/age50s` LP 新規実装（8 セクション構成、ガイドライン v1.3 準拠） |
| **905d221** | 10 項目修正（ヒーロー圧縮 / 「§3 を踏まえると」削除 / 選択肢 B・C・D 強化 / 「30代後半の失敗」削除 / h2 整理 ほか） |
| **8d4ff6f** | 4 項目修正（選択肢A 2段落化 / 選択肢D 箇条書き化 / 「商品を売っていない」言い換え / §4.5 引用 wrap） |

### 1. LP 新設（コミット 7a22da5）
**`src/pages/tools/Age50sLPPage.tsx`** を新規作成（約 470 行）。`RetirementSimulationLPPage.tsx` を雛形に v1.3 ガイドライン完全準拠で実装。

#### SEO ターゲット
- メインキーワード: **「50代 資産運用」**（月間 390・難易度 40）
- title: 「50代の資産運用、定型から自分の許容度へ｜お金の仕組み化プログラム」
- canonical: `https://fire.largogk.jp/tools/age50s`

#### 8 セクション構成
1. ヒーロー（min-h-screen + 背景画像 + 黒オーバーレイ）
2. 50代になると、見えてくるもの
3. 「もう遅い」と「年齢別の定型」、二つの誤解
4. 考えうる選択肢は、4つ（A: 年齢別の定型 / B: 金融機関の診断 / C: 直感 / D: 中立的かつ詳細な計測）
5. 自分で設計するもう一つの意味――手数料
6. 自分の場合のこと
7. 50代は、節目の見直しの時期
8. このツールについて（CTA で `/risk` へ送客）

#### 装飾配分（v1.3 ガイドライン準拠）
- 黄色マーカー: 5 箇所
- 青下線: 1 箇所
- 青引用ブロック: 3 箇所

### 2. 10 項目修正（コミット 905d221）
本番実機・ドラフトレビューを踏まえ以下を一括修正：
- ヒーロー本文の圧縮（冗長な説明削除）
- §3 への内部参照「§3 を踏まえると」など削除（読者は段落順で読まないため）
- 選択肢 B（金融機関の診断）の批判文脈整備、選択肢 C（直感）の表現精緻化、選択肢 D の「中立的かつ詳細」「米国大学の学術調査」などキーワード強化
- 「30代後半に一度大きな失敗をしました」など個人体験の重複表現を削除（`/about` で語る範囲と分離）
- h2 文言整理、「最大 50 年」など運用期間の数字強化

### 3. 4 項目修正（コミット 8d4ff6f）
構成と読みやすさの最終調整：
- **選択肢A**: 1 段落 → 2 段落に分割。1 段落目で「雑誌や FP 記事で目にする『50代は株式50%、債券50%』のような定型」と具体化、2 段落目で「同じ50代でも家族構成・収入・既存資産・性格は人によって全く違う」と合わない理由を明示
- **選択肢D**: 「2つの観点」を地の文 → `<ul className="list-disc list-inside space-y-2 leading-loose">` の箇条書きに整理（**リスクを取れる客観的条件** / **心理的に耐えられる範囲**）
- **選択肢D 末尾**: 「商品を売っていないので」→「**金融商品の販売を目的としていないので**」に言い換え（より中立的な表現）
- **§4.5 引用ブロック「お客さん」**: 直前直後の段落と密着していたため、`<div className="py-12 md:py-16">` で wrap して上下に視覚的余白を確保

### 検証
- `npm run legal-check` baseline: 5 件（すべて批判的引用文脈で許容済み、新規追加なし）
- `npm run build` で 5 ルート全 prerender 成功（`/risk /about /tools/risk /tools/retirement-simulation /tools/age50s`）
- Vercel deploy: 各コミットとも ● Ready
- 本番反映: cache buster 付き curl で h2 7 件、装飾 9 件（黄 5 / 下線 1 / 引用 3）、修正キーワード 4 件、削除確認 0 件すべて pass

### サイトマップ更新
`public/sitemap.xml` に `/tools/age50s` を追加（priority 0.8、changefreq monthly、lastmod 2026-05-03）。
`scripts/prerender.ts` の `PRERENDER_ROUTES` も 5 件目として追加。

---

## 2026-05-01 — LP 余白構造の本格整備とガイドライン v1.0→v1.3 整備（4 段階の構造変更）

### 概要
simulation LP / risk LP / about の本番実機確認で順次発覚した余白問題を、構造的に解消。LP 視覚＋文体ガイドライン `Docs/lp_visual_text_guideline.md` を新規作成し、v1.0 → v1.1 → v1.2 → v1.3 の 4 段階で改訂。同時に LP 実装も追従。

| コミット | 内容 |
|---|---|
| **a1bd444** | section から `py-12 md:py-20` 削除、h2 の `mt-12 md:mt-16` で余白制御（v1.2 適用） |
| **8428fff** | section に `pt-12 md:pt-20` 復活、h2 の `mt-12 md:mt-16` 削除、引用ブロック `my-2` 削除、risk LP disclaimer 削除（v1.3 適用） |

### 1. ガイドライン整備の経緯（v1.0 → v1.3）
| version | section | h2 mt | 結果 |
|---|---|---|---|
| v1.0 | `py-12 md:py-20` | `mt-12 md:mt-16` + `mb-4` | 余白過多（隣接合算 224px+） |
| v1.1 | `py-12 md:py-20` | `mt-12 md:mt-16` + `mb-6 md:mb-8` | 余白さらに過多 |
| v1.2 | （背景色のみ、`pt-*` なし） | `mt-12 md:mt-16` のみ | 背景と h2 のズレで「ぶつ切り感」 |
| **v1.3** | **`pt-12 md:pt-20` + 背景色** | **`mb-6 md:mb-8` のみ（mt 削除）** | **ちょうど良い余白 + 背景一致** |

### 2. v1.2（コミット a1bd444）
section から `py-12 md:py-20` を削除し、h2 の `mt-12 md:mt-16` で隣接セクション間余白を担う方式に変更。simulation LP / risk LP の section 計 19 個から `py-12 md:py-20` 削除、最後 section（§8 ツール紹介 / クロージング）には `pb-12 md:pb-20` を維持してフッター余白確保。risk LP の h2 11 個には `mt-12 md:mt-16` を新規追加（元構造に `mt` がなかったため）。
→ 隣接セクション間の物理パディング累積（224px+）は解消したが、本番実機で「背景の切り替わりが h2 から 48-64px 上で起き、ぶつ切り感」が新たに発覚。

### 3. v1.3（コミット 8428fff）
section に `pt-12 md:pt-20` を復活させ、h2 の `mt-12 md:mt-16` を削除する逆構造に再変更。
- simulation LP: 7 section に `pt-12 md:pt-20` 追加、7 h2 から `mt-12 md:mt-16` 削除、4 引用ブロックから `my-2` 削除
- risk LP: 12 section に `pt-12 md:pt-20` 追加、11 h2 から `mt-12 md:mt-16` 削除（v1.2 で追加した分）、1 引用ブロックから `my-2` 削除、不要な disclaimer 1 件削除（「計測結果は投資の推奨ではありません」）
- 最後 section は `pt-12 md:pt-20 pb-12 md:pb-20` の両方持つ形で、フッター余白も確保

→ 背景の切り替わりが h2 を含む領域の上端で起きる構造に。/about（A 型単一 main）と同等の余白感を LP（B 型複数 section）で実現。

### 4. 引用ブロック my-2 削除の構造的意義
v1.0〜v1.2 で引用ブロックに `my-2`（8px）を「セクション末尾の例外」として許容していたが、外枠 `space-y-6 md:space-y-8`（24-32px）と CSS specificity / source order で干渉し、引用ブロック直後の段落との余白が 8px に切り詰められる問題が発覚。v1.3 では引用ブロックも他のブロック要素（リスト・grid・通常段落）と同様 `my-*` なしで統一。**例外なし**。

### 5. risk LP disclaimer 削除
risk LP の「このツールについて」セクション末尾に `<p className="text-sm text-gray-500">計測結果は投資の推奨ではありません。設計の起点です。</p>` という disclaimer 段落があったが、本文サイズと違う小さい文字で挿入され、文章自体が意味不明（何の計測結果か曖昧）と判断し削除。本文の流れがクライマックスメッセージへスムーズに繋がる構造に。
→ 副次効果として `legal-check` baseline が **4 → 3 件**に減少。

### 6. ガイドライン v1.3 の §6 落とし穴 #5 / #6 整理
- **#5**: section 余白制御の変遷（v1.0〜v1.3）をテーブル形式で整理。「実機を見て初めて分かる問題」を反映する正常な改訂サイクルとして記録
- **#6**: 引用ブロックの `my-2` が外枠 `space-y-*` と干渉する問題（設計書 v6.5 §13-28 の知見の応用）

### 検証
- `npm run legal-check` baseline: 4 → **3 件**（disclaimer 削除で 1 件減、新規追加なし）
- Vercel build: a1bd444 / 8428fff いずれも ● Ready、4 ルート全 prerender 成功
- 本番反映: cache buster 付き curl で全件確認済み（simulation LP `pt-12 md:pt-20` × 7、risk LP × 12、両 LP の `mt-12 md:mt-16` 残存 0、disclaimer 残存 0）

### 関連: ガイドライン本体
`FI_project/Docs/lp_visual_text_guideline.md` を 2026-05-01 に新規作成（v1.0）、同日 v1.1 / v1.2 / v1.3 と急速改訂。今後の LP 残り 2 本（age/50s, retirement）は v1.3 基準で実装する想定。

---

## 2026-05-01 — 老後資産シミュレーション LP 新設 + h2 マージン拡大 + CTA「（無料）」表記追加

### 概要
SEO Phase 1 Commit 4 の 2 本目 LP として老後資産シミュレーション LP を新設、続けて全 LP / 本文ページの h2 マージンと CTA 文言を整備。

| コミット | 内容 |
|---|---|
| **b0e05e3** | `/tools/retirement-simulation` LP 新規実装 |
| **accf0a3** | h2 下マージン拡大（`mb-4` → `mb-6 md:mb-8`）+ CTA「5分で診断する」→「5分で診断する（無料）」 |

### 1. 老後資産シミュレーション LP 新設（コミット b0e05e3）
**`src/pages/tools/RetirementSimulationLPPage.tsx`** を新規作成（約 400 行）。

#### SEO ターゲット
- メインキーワード: **「老後資産 シミュレーション」**（SEO 難易度 33・月間 170）
- サブキーワード: 老後資産運用 / 老後資産形成 / ポートフォリオ
- title: 「老後資産シミュレーション｜リスク許容度から考える設計の出発点 - お金の仕組み化プログラム」

#### 8 セクション構成
1. ヒーロー（背景画像 + 黒オーバーレイ + h1「老後資産の設計、何から始めていますか?」）
2. 「いくら必要か」から逆算される世界
3. でも、その利回り、自分の許容度の範囲内か
4. 許容度の中なら、設計は自由
5. 許容度を超えると、設計は崩れる
6. 許容度の範囲内で目標に届かない場合（橘玲の富の式を中央寄せ青引用ブロックで再掲）
7. だからまず、自分の許容度を知る
8. このツールについて（**STEP 1 / STEP 2 ブロック**の新規視覚パターン、CTA で `/risk` へ送客）

#### 装飾 11 箇所
ガイドライン §4 の頻度目安（LP 8〜15 箇所）の中央値:
- 黄色マーカー（気づき・実体験フレーズ）: 4 箇所
- 青下線（結論的フレーズ）: 3 箇所
- 青引用ブロック（決め台詞・外部引用句）: 4 箇所

#### 引用された外部権威
- ジョージ・ソロス（既存 risk LP §10 で引用済みのフレーズ流用）
- 橘玲『お金持ちになれる黄金の羽根の拾い方』の式「富 = 収入 − 支出 +（資産 × 利回り）」を §6 で再掲（中央寄せ青引用ブロック、risk LP §2 と整合）

#### ルート・SEO 配線
- `src/App.tsx`: 3 認証ブロックすべてに `/tools/retirement-simulation` ルート追加
- `public/sitemap.xml`: 5 URL に拡張（priority 0.8 / monthly / lastmod 2026-05-01）
- `scripts/prerender.ts`: PRERENDER_ROUTES に追加 → Vercel build で prerender HTML 焼き込み

#### tone_guideline_lp.md / lp_visual_text_guideline.md 準拠
- §5 の「FXやビットコインなど、投機性の高い対象に集中している」は固有名詞含むセンシティブ表現として原文一字一句保持
- §3 の「中高年にはその時間がない」を黄色マーカーでターゲット層に直接訴求
- §8 の disclaimer 的な一文「『このリスク水準を取るべき』という提案ではない」は legal-check で「提案」が引っかかるが、**否定の文脈**で不可避と判断（baseline 4 件のうち 1 件として許容）
- 比喩表現（飛行機/新幹線/特急 / フェラーリ200km/h）は装飾なしで平叙文として実装、読者が比喩の力で理解する設計

### 2. h2 下マージン拡大（コミット accf0a3、ガイドライン v1.0 → v1.1）
全 LP / 本文ページの h2 下マージンを `mb-4` → **`mb-6 md:mb-8`** に拡大（モバイル 24px / デスクトップ 32px）。simulation LP / about の実機確認で「h2 と本文の間が狭い」フィードバックを反映。

- simulation LP: h2 7 件
- about: h2 4 件
- risk LP: h2 11 件は別構造（`text-3xl md:text-4xl ... mb-8`、border-b なし、mt-* なし）で対象外

### 3. CTA「5分で診断する（無料）」表記追加（コミット accf0a3）
登録不要・無料の心理的ハードルを下げる文言追加。**全角カッコ「（無料）」**で統一。

- simulation LP §8 CTA: 「5分で診断する →」 → **「5分で診断する（無料） →」**
- simulation LP ポップアップ: 同上
- risk LP ポップアップ: 同上

risk LP の `<InlineCTA />` 3 箇所（「リスク許容度を診断する →」）はテキストが異なるため変更対象外、現状維持。

### 検証
- `npm run legal-check`: baseline は新規 LP の §8 disclaimer 否定文「『このリスク水準を取るべき』という提案ではない」が 1 件追加され、3 → 4 件
- Vercel build: 各コミットすべて ● Ready、4 ルート全 prerender 成功
- 本番 HTML 反映: simulation LP の 8 セクション + 11 装飾箇所すべて焼き込み確認

### 関連
- ガイドライン v1.1 適用（`Docs/lp_visual_text_guideline.md`、別リポジトリ FI_project root で管理）

---

## 2026-05-01 — 設計書 v6.5 関連の各種改修（LP 出典明記 / ヘッダー UI 整備 / サービス名変更 / /about 全面リライト）

### 概要
設計書 v6.5 で確定された方針に沿った 4 つの改修を実施。`/tools/risk` LP の出典明記、モバイル UI overflow 修正、サービス名のリネーム、`/about` ページ全面リライト。

| コミット | 内容 |
|---|---|
| **0a405da** | `/tools/risk` LP「資産形成の構造」セクションに橘玲出典を明記、富への語彙修正 |
| **4a269ab** | ヘッダー モバイル overflow 解消、ハンバーガーメニュー化（lucide-react 導入） |
| **328591d** | ヘッダー サービス名を「お金の仕組み化プログラム / Wealth Program」に変更 |
| **9040914** | `/about` ページ全面リライト + 段落間余白・行間調整 |

### 1. `/tools/risk` LP「資産形成の構造」に橘玲出典を明記（コミット 0a405da）

#### 変更内容
- 式の左辺「資産」→「**富**」に修正（橘玲『お金持ちになれる黄金の羽根の拾い方』原典準拠）
- 右辺の「資産 × 利回り」は維持（原典どおり、両辺一律置換すると式が壊れるため）
- 式の直後に出典明記の新段落を追加: 「橘玲さんの本で目にして、自分の感覚と一致した式です。富とは、自由に使えるお金のこと。」
- 「収入はすでにある」→「**収入はある程度ある**」（ターゲット層 世帯年収1500-4000万への配慮）
- 既存の黄色マーカー（「『資産 × 利回り』の部分が…思いのほか多い。」、文単位）は維持（4-30 セッションの設計判断を尊重）

### 2. ヘッダー モバイル overflow 修正（コミット 4a269ab、設計書 v6.5 §13-12）

#### 真因
viewport 375px で 4 リンクが画面幅を超え、横スクロール発生 + ログインボタンがリスク診断・PF 診断と被る問題。

#### 実装
- 新規依存: **`lucide-react ^1.14.0`** 追加（Menu / X アイコン使用）
- `< 768px` でハンバーガーメニュー化、`>= 768px` は現状の横並び維持
- 既存 `<nav>` と `<UserStatusBar />` に **`hidden md:flex`** を付与してモバイルで非表示化
- ハンバーガーボタン（`md:hidden p-2`、aria-label / aria-expanded 付与、Menu/X トグル）を追加
- ヘッダー直下に **absolute positioned dropdown**（`absolute top-full left-0 right-0 bg-white border-b shadow-md z-50`）
- メニュー項目（縦並び 5 項目）: シミュレーション / リスク診断 / PF診断 / 運営者について / **ログイン**（強調別枠扱い）
- メニュー項目タップで `setIsMenuOpen(false)` 自動閉じ
- ログインボタン: `bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg` の fill スタイル（既存 `<UserStatusBar />` のアウトライン風とは別実装、デスクトップ表示には影響なし）
- ログイン済み時: ユーザー名（`text-xs text-gray-500`）+ ログアウトボタン（`bg-gray-600 hover:bg-gray-700` の **gray 系 fill**、blue ログインと色差別化）
- state 管理: `Layout.tsx` 内に `useState` を新規追加（既存は `useLocation()` のみ）
- `useAuth()` を Layout.tsx で直接呼び、`user` `signOut` を取得して未/ログイン状態判定

### 3. ヘッダー サービス名を「お金の仕組み化プログラム / Wealth Program」に変更（コミット 328591d、設計書 v6.5 §3-5 / §13-1 関連）

#### 変更内容
- h1: 「セミリタイア シミュレーター」→ **「お金の仕組み化プログラム」**
- p（サブテキスト）: 「Semi-Retire Life & Money Simulator」→ **「Wealth Program」**
- 既存クラス（`text-sm md:text-lg font-bold text-gray-800` / `text-xs text-gray-500 hidden sm:block`）は維持
- HTML 構造（h1 + p）は変更なし

#### 意図
`/tools/risk` LP のメッセージと整合させ、合同会社ラルゴの flagship project 名に統一。設計書 §13-1 のドメインリネーム前の事前整備として位置づけ。SEOHead や `<title>` タグ等のメタ情報は今回触らず（別タスクで対応）。

### 4. `/about` ページ全面リライト + 段落間余白・行間調整（コミット 9040914、設計書 v6.5 §3-4 / §9-3 / §4-3）

#### コンテンツの全面置換
本人の実体験を中心とした 5 セクション構成に再構成:
- **リード**（H1直下、3 段落）: 外資IT 20 年 → 48 歳セミリタイア → 伊豆 → 「お金の仕組み化」テーマ
- **H2: 経歴**: 給料増えても貯まらないジレンマ → 富の形成設計を真剣に考え始めた経緯 → 資産運用 + 入金力最大化の両輪 → 48 歳セミリタイア
- **H2: このサイトを始めた理由**: 数百万 → 数千万を一気に投入 → 一時下落で狼狽売り → 「リスク許容度」概念との出会い → 仕組み整備で安定運用
- **H2: いま伊豆で暮らしながら考えていること**: 朝のルーティン（野鳥 / コーヒー / 海 / 庭の朝露）→ 自分の本質は静かなところにある → 1 人で没頭する時間が生活の中心 → 「**心穏やかに平常運行できていること**」を黄色マーカーで強調 → リスク許容度はライフイベントで変わる、節目で測り直すべき
- **H2: 運営方針**: 箇条書き 2 項目（金融商品を勧めない / 投資助言・代理業に該当しない範囲）+ 「自分で判断できる人を増やす」のメッセージ

#### 役割分担の整理（`/tools/risk` LP との重複解消）
- **`/tools/risk` LP**: 理論・概念（リスク許容度・投資/投機・複利・孫子）
- **`/about`**: 人生経験（数千万円突っ込んでの狼狽売り、伊豆での朝、心穏やかに平常運行できている事実）

#### 実装方式の変更
- **react-markdown + `about.md` → JSX 直書きに切替**
- `src/content/legal/about.md` を **git rm で削除**
- `MarkdownContent.tsx` + `react-markdown` 依存は **残置**（他箇所での再利用余地、別タスクで整理予定）

#### スタイル基準（v6.5 §4-3 適合）
| 要素 | 旧 | 新 |
|---|---|---|
| 本文ラッパー | `max-w-5xl mx-auto px-4 py-8 md:py-12` | `max-w-3xl mx-auto px-4 md:px-6 space-y-6 md:space-y-8` |
| セクション枠 | `<main py-8 md:py-12>` | `<main py-12 md:py-20>` |
| h1 | `text-2xl md:text-3xl mb-6` | `text-3xl md:text-4xl font-bold mb-4` |
| h2 | `text-xl md:text-2xl mt-10 mb-3` | `text-2xl md:text-3xl mt-12 md:mt-16 mb-4 + border-b pb-2` |
| 本文 p 行間 | `leading-relaxed` (1.625) | **`leading-loose`** (2.0) |
| 段落間余白 | 各 p に `mb-4` 直接付与 | **外枠 `space-y-6 md:space-y-8`** に一任、p 自身に `my-*` なし（v6.5 §13-28 の干渉知見遵守） |
| 黄色マーカー | なし | `bg-yellow-200 px-1 rounded` で「心穏やかに平常運行できていること」 |

### 検証
- `npm run legal-check` baseline: 3 件維持（既存 `schemas.ts:30` "推奨" + LP 内 IFA 業界陳述 "提案" + disclaimer "推奨ではありません"、新規追加で増えず）
- Vercel build: 各コミットすべて ● Ready、3 ルート全 prerender 成功
- 本番反映: 各 URL で cache buster 付き curl で新コンテンツ確認済み

### 補足
- ヘッダー変更は全ページ横断（`/`, `/risk`, `/pf`, `/about`, `/tools/risk` 等すべて）
- prerender HTML には `isMenuOpen=false` 状態が焼き込まれる（CSR 後に React state で動的にドロップダウン展開、これは正しい挙動）
- ヘッダーサービス名は `<title>` タグ等のメタ情報には未反映（別タスクで対応）

---

## 2026-04-30 — /tools/risk LP コンテンツ・デザイン改善（4 コミット統合）

### 概要
SEO Phase 1 Commit 4 先行実装した `/tools/risk` LP に対して、4 段階の改善を実施。コンテンツ拡張（ニック・マジューリ著書ベースの新規 2 セクション + 既存 2 セクション改題）、リズム要素の本格適用（黄色マーカー / 青下線 / 青引用ブロック）、レイアウト調整（セクション縦パディング縮小、リスト直後の余白詰まり修正）。

| コミット | 内容 |
|---|---|
| **2fcfa79** | コンテンツ更新（新規 2 + 改題 2 + 重複行削除 3） |
| **9363a17** | grid レイアウト崩れ修正 + リズム要素 11 箇所追加 |
| **1c29a75** | 全 12 セクションの縦パディング縮小 |
| **06dc442** | リスト・引用ブロック直後の余白詰まり修正 |

### 1. コンテンツ更新（コミット 2fcfa79）

#### 新規 2 セクション追加
- **「投資のつもりで、投機をやっていた」**（「正直に言います」直後）: 投資/投機の特徴を孫子セクションと同構造の grid（`grid-cols-1 sm:grid-cols-2`）で対比、文字色のみ通常背景用に `text-gray-800` に置換。本文末尾の「自分がそうでした。だから、自分のリスク許容度を知る必要があったんですよね。」を青引用ブロック化
- **「急がない」**（「己を知る、敵を知る」直後）: ジョージ・ソロスの「私の原則は、まず生き残ること。稼ぐのはそれからだ」を青引用ブロック化、「資産形成はマラソン」の論点で締めくくり

#### 既存 2 セクション改題 + 本文整理
- **「株価下落は避けられない」→「市場から出ない」**: 冒頭重複段落「株価下落は、避けられません。」を削除、本文を「長期で資産運用をしている限り、一時的な下落は何度か通過することになります。…」に刷新
- **「孫子 — 己を知り敵を知る」→「己を知る、敵を知る」**: 「孫子は言いました。」の前置きを削除し、引用「『彼を知り己を知れば百戦殆うからず』。」直入りに

#### 見出し重複の 1 行目削除（3 箇所）
- 「正直に言います」セクション内「正直に言います。」の重複段落を削除
- 「複利を味方につける」セクション内「そして、複利を味方につける。」の重複段落を削除
- 「このツールについて」セクション内「このツールについて。」の重複段落を削除

#### tone_guideline_lp.md 準拠の本文微修正（ユーザー確認済み）
- セクション「市場から出ない」内: 「必ず来ます」→「来ます」（「必ず」が絶対回避リスト該当のため）
- 引用ブロック「私の原則は、まず生き残ること。稼ぐのはそれからだ」: CC が独断で追加した「— ジョージ・ソロス」表記を削除し、原文通り「だ」（句点なし、原文では引用外の「と。」に句点があったため）に統一

### 2. grid レイアウト修正 + リズム要素追加（コミット 9363a17）

#### 投資/投機 grid のレイアウト調整
各カラム `<div>` に `space-y-3` を追加して h3↔ul 間の余白を確保。`mb-3` は二重指定回避のため削除。

#### リズム要素 11 箇所追加（既存実装パターン踏襲）
- 黄色マーカー（`bg-yellow-200 px-1 rounded`）: +5 → 計 11 箇所
- 青下線（`underline decoration-blue-400 decoration-2 underline-offset-4`）: +4 → 計 6 箇所（うち 1 件は既存 font-bold を下線に置換）
- 青引用ブロック（`bg-blue-50 border-l-4 border-blue-500 py-6 px-8` + `<p className="text-xl font-medium text-blue-900">`）: +2 → 計 3 箇所

#### 青引用ブロック 3 つで形成されるリズム
1. 「投資のつもりで、投機をやっていた」末尾: 自分がそうでした。〜
2. 「急がない」中盤: 私の原則は、まず生き残ること。〜（ソロス引用）
3. 「複利を味方につける」末尾: あなたが安心して眠れる夜は、設計の先にあります。（既存）

→ LP の上から下にかけて、3 つの重要ポイント（**投資/投機の自覚 → 急がず生き残る原則 → 安心して眠れる設計**）がそれぞれ青引用ブロックで締められる構成。

### 3. 全 12 セクションの縦パディング縮小（コミット 1c29a75）
全 `<section>` の縦パディングを `py-20 md:py-28` から **`py-12 md:py-20`** に縮小（一括 replace_all）。セクション間の間延びを抑制。

### 4. リスト・引用ブロック直後の余白詰まり修正（コミット 06dc442）

#### 真因
Tailwind v4 で `space-y-*` ユーティリティと `my-*` ユーティリティが同 specificity になり source order 依存。リスト・ブロック要素自身に `my-2` が付いていると、外枠 `space-y-6 md:space-y-8`（24px / 32px）が機能せず 8px に詰まる。

#### 修正方針
リスト・ブロック要素自身の `my-2` を削除し、外枠 `space-y-*` に余白制御を一任する方針で統一。

| 対象 | 変更 |
|---|---|
| 投資/投機 grid（L170） | `my-2` 削除 |
| 「自分がそうでした」引用ブロック（L197） | `my-2` 削除（整合性） |
| ソロス引用ブロック（L359） | `my-2` 削除（段落中盤位置で同種問題が起きうるため） |
| 「あなたが安心して眠れる夜は」引用ブロック（L406） | **維持**（複利セクション末尾で機能しているため） |

ol 3 個（資産形成の構造 / 複利を味方につける / このツールについて）は元から `my-*` なしの OK パターンで、変更不要。

### 検証
- `npm run legal-check` baseline: 3 件維持（既存 `schemas.ts:30` "推奨" + LP 内 IFA 業界陳述 "提案" + disclaimer "推奨ではありません"、新規追加で増えず）
- Vercel build: 各コミットすべて ● Ready、3 ルート全 prerender 成功
- 本番 HTML 反映確認: セクション順序 12 個指示書通り、装飾要素件数完全一致、`my-2` 残存 1 件（L406 のみ）

---

## 2026-04-30 — largogk.jp コーポレートサイト復活（別リポジトリ化）+ /privacy /tokushoho を corporate に移管

### 概要
2026-04-29 セッションで apex/www → fire の 308 redirect で復旧していた `largogk.jp` を、合同会社ラルゴの **コーポレートサイト本体** として復活。fire.largogk.jp は資産形成 PF ツール群として明確に分離。

設計書 v6.3 §13 の最終確定方針:
- **`largogk.jp`** = 合同会社ラルゴ corporate（新リポジトリ [10Kimi/largogk-corporate](https://github.com/10Kimi/largogk-corporate)、2026-04-30 新規作成）
- **`fire.largogk.jp`** = 資産形成 PF ツール群（本リポジトリ semi-retire-simulator、既存維持）
- **法的ページ統合**: `/privacy` `/tokushoho` は corporate 側に集約、fire 側からは削除して corporate に 308 redirect

本リポジトリ側の変更は以下のみ。corporate 本体の作業は別リポジトリの履歴を参照。

### 1. `/privacy` `/tokushoho` の削除（コミット 17e3760）
- `src/pages/PrivacyPage.tsx` 削除
- `src/pages/TokushohoPage.tsx` 削除
- `src/content/legal/privacy.md` 削除
- `src/content/legal/tokushoho.md` 削除
- `src/App.tsx` の 3 認証ブロックすべてから `/privacy` `/tokushoho` ルートと import を削除
- ※ Footer.tsx 内の `/privacy` `/tokushoho` リンクは触らない（次の redirect で連続するため）

### 2. `largogk.jp` への 308 redirect 設定（コミット a2337af）
`vercel.json` に `redirects` を追加:
```json
{
  "redirects": [
    { "source": "/privacy", "destination": "https://largogk.jp/privacy.html", "permanent": true },
    { "source": "/tokushoho", "destination": "https://largogk.jp/tokushoho.html", "permanent": true }
  ],
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
- 拡張子 `.html` 付き（corporate 側が静的 HTML で配信されるため）
- `redirects` は `rewrites` より先に評価される Vercel 仕様で、SPA fallback と競合しない

### 3. sitemap.xml と PRERENDER_ROUTES の更新（コミット abe55a8）
- `public/sitemap.xml`: `/privacy` `/tokushoho` を削除（6 URL → 4 URL）
- `scripts/prerender.ts` の `PRERENDER_ROUTES`: `/privacy` `/tokushoho` を削除（5 ルート → **3 ルート（`/risk /about /tools/risk`）**）

### 4. 検証結果（本番反映後）
| パス | 期待 | 実測 |
|---|---|---|
| `https://fire.largogk.jp/privacy` | 308 → `https://largogk.jp/privacy.html` | ✅ |
| `https://fire.largogk.jp/tokushoho` | 308 → `https://largogk.jp/tokushoho.html` | ✅ |
| `https://fire.largogk.jp/about` `/risk` `/tools/risk` | 200 OK | ✅ 影響なし |

### 5. 作業順序（指示書遵守、本番断絶リスク回避）
1. CC: corporate 側を構築 + GitHub push（別リポジトリ）
2. ユーザー: corporate を Vercel に import + `largogk.jp` `www.largogk.jp` を attach（既存 `semi-retire-simulator` プロジェクトから redirect 設定を解除した上で移管）
3. CC: 本リポジトリの 3 コミット（17e3760 / a2337af / abe55a8）をローカルコミットまで作って push 待機
4. ユーザー: corporate の preview 動作確認 → CC に push 指示
5. CC: push → fire 側本番反映 → 動作確認

→ ユーザー手作業の後ろまで含めて本番断絶せず移行完了。

### 関連: corporate 側で発見した Vercel Hobby plan の commit author 制約
別リポジトリ `largogk-corporate` の deploy 復旧作業で以下が確定（公式 doc 参照: troubleshoot-project-collaboration#account-configuration）:

- **Vercel Hobby plan は commit author email = Vercel team owner email でないと deployment を Block する**
- 本リポジトリ `semi-retire-simulator` は既存（grandfathered）で `kiminori.chida@largogk.com` のまま動作中、変更不要
- 新規 `largogk-corporate` は `wiseoutput@gmail.com`（Vercel アカウントメアド）必須に切替（local config のみ）

詳細は `largogk-corporate` 側の `README.md` および 設計書 v6.4（後日反映予定）§8 を参照。

---

## 2026-04-29 — prerender 復旧 + SEO Phase 1 Commit 4 先行（/tools/risk LP）+ largogk.jp SSL リダイレクト復旧

### 概要
3 つの独立した作業を 1 日にまとめて実施:
1. **prerender 復旧**: `puppeteer` → `@sparticuz/chromium + puppeteer-core` 置換で Vercel build 環境での Chromium 起動失敗を解消し、`vercel.json` の `buildCommand: build:spa-only` 迂回を解除して通常 build に復帰
2. **SEO Phase 1 Commit 4 先行**: リスク許容度診断 LP `/tools/risk` を新設、デザイン・テキスト改善 5 段階を経て本番投入
3. **largogk.jp SSL リダイレクト復旧**: apex (`largogk.jp`) と www が Netlify を指したまま放置で SSL 検証失敗していた件を修復、`https://largogk.jp/*` → `https://fire.largogk.jp/*`（path/query 保持、308 Permanent）の運用に統一

### 1. prerender 復旧（コミット 196e5f0）

#### 背景
2026-04-25 に Vercel build 環境で `puppeteer.launch()` が Chromium 起動失敗、`vercel.json` で
`build:spa-only` に迂回して暫定停止していた（CLAUDE.md TODO「prerender を Vercel build に戻す」）。
LP 量産前に復旧が必要なタイミング。

#### 実装
- `npm uninstall puppeteer` + `npm install -D @sparticuz/chromium puppeteer-core`
  - `puppeteer ^24.0.0` → 削除
  - `@sparticuz/chromium ^148.0.0` + `puppeteer-core ^24.42.0` を devDependencies に追加
- `scripts/prerender.ts`:
  - import を `puppeteerCore` + `chromium` に変更、型注釈 `puppeteer.Browser` → `puppeteerCore.Browser`
  - `launch()` を環境分岐:
    - Vercel/Lambda: `chromium.args` + `chromium.executablePath()` + `chromium.headless`
    - ローカル (macOS): `['--no-sandbox', '--disable-setuid-sandbox']` + ローカル Chrome の executablePath + `headless: true`
    - ※ `chromium.args` には `--single-process` 等 Lambda 用フラグが含まれており、デスクトップ Chrome に渡すと即クラッシュするため args/headless もローカルでは既存値に切替
- `vercel.json` から `"buildCommand": "npm run build:spa-only"` を削除 → 通常 `npm run build` に復帰
- `PRERENDER_ROUTES` に `/about /privacy /tokushoho` を追加（Commit 3 で公開済みなのに配列が未追従だった）

#### 検証
- ローカル `npm run build` で 4 ルート全 prerender 成功
- Vercel build: ● Ready / 32s（前回 spa-only は 19s、+13s が prerender ぶん）
- 本番 `curl https://fire.largogk.jp/risk` で React 描画後の HTML が焼き込まれていることを確認

### 2. SEO Phase 1 Commit 4 先行: `/tools/risk` LP 新設

#### 設計判断
- `Docs/tone_guideline_lp.md` 準拠で本文・CTA を構築
- 本文は **JSX で直接記述**（信頼性ページとは異なり、装飾と動的要素が必要なため Markdown 不採用）
- 既存 `/risk` ページは触らず、LP からの導線（CTA → `/risk`）として実装
- ルーティング: 3 認証状態すべてに `/tools/risk` を追加し、未認証アクセス可能に

#### 実装サマリ（5 コミットの差分を統合）

| コミット | 内容 |
|---|---|
| **eaf559c** | 初版 — 11 セクション本文（ヒーロー / 資産形成の構造 / 正直に言います / リスク許容度次第と言いながら / 転換点 / 株価下落は避けられない / 2択ではない / 孫子 / 複利 / このツールについて / クロージング）+ CTA（→ /risk）+ ルート/sitemap/prerender 配線 |
| **a4f27bc** | デザイン改善 — ヒーロー full-screen 化、セクション交互背景（white ↔ gray-50）、強調ブロック 3 点（方程式 = bg-gray-900 / 孫子 = bg-emerald-900 / 安心して眠れる夜 = bg-blue-50）、InlineCTA を 3 箇所に配置（転換点末尾／2択ではない末尾／クロージング）、70% スクロールでポップアップ表示（1 回のみ、`popupDismissed` フラグ） |
| **90d82be** | テキスト改善 — h1 サイズ調整、段落間余白拡大（`space-y-6 md:space-y-8`）、強調装飾 12 箇所（マーカー 6 + 太字 4 + 下線 2）、本文テキスト変更なし（span ラップのみ） |
| **42136bf** | h1 サイズ縮小（`text-3xl md:text-4xl lg:text-5xl`）、マーカー範囲を単語単位 → 文単位に拡大 |
| **659a152** + **d09dff3** | ヒーロー背景画像（伊豆海岸）+ 黒オーバーレイ + テキスト白系化、`public/Images` → `public/images` ケース修復（macOS 開発で見落とす Linux/Vercel ケース依存問題） |

#### `tone_guideline_lp.md` 準拠のため本文 2 箇所のみ微修正（ユーザー確認済み）
- 【セクション 5】「必ず来ます」→「来ます」（絶対回避リストの「必ず」を回避、不可避性は前文で確立済み）
- 【クロージング】末尾の「では、また。」を削除（LP は CTA で締める方針）
- ポップアップ CTA: 指示書「無料で診断する」→「5 分で診断する」に変更（「無料」も避け語）

#### ルート・SEO 配線
- `src/App.tsx`: 3 認証ブロックすべてに `/tools/risk` ルート追加
- `public/sitemap.xml`: `<loc>https://fire.largogk.jp/tools/risk</loc>` を `priority 0.8 / changefreq monthly / lastmod 2026-04-29` で追加
- `scripts/prerender.ts` の `PRERENDER_ROUTES` に追加 → Vercel build で prerender HTML が焼き込まれる

### 3. largogk.jp SSL リダイレクト復旧

#### 発覚
`https://largogk.jp` (apex) にアクセスすると SSL 証明書エラー。証明書サブジェクトは
`*.netlify.app` で `largogk.jp` をカバーしないため検証失敗。`fire.largogk.jp` は正常。

#### 原因（DNS 調査結果）
- apex `largogk.jp` の A レコード = `75.2.60.5` (Netlify) のまま
- `www.largogk.jp` も `largogk.netlify.app.` (Netlify) のまま
- Vercel アカウントには `largogk.jp` が 66 日前から登録されていたが、DNS が向いておらず
  Let's Encrypt 発行も完了していなかった
- DNS 管理: バリュードメイン (`01-04.dnsv.jp`)

#### 修復方針 B = apex を `fire.largogk.jp` にリダイレクト
1. **Vercel CLI**: `vercel domains add largogk.jp` + `vercel domains add www.largogk.jp` で `semi-retire-simulator` プロジェクトに attach
2. **Vercel Dashboard**: Project Settings → Domains で両ドメインに「Redirect to a different domain」設定（→ `fire.largogk.jp`、308 Permanent、Path & Query 保持）
3. **DNS（バリュードメイン）**:
   - 旧 Netlify レコード削除: `a @ 75.2.60.5`、`cname www largogk.netlify.app.`
   - 新 Vercel レコード追加: `a @ 76.76.21.21`、`cname www cname.vercel-dns.com.`
   - 既存 `cname fire ...vercel-dns-017.com.` `cname english ...` は維持

#### 検証結果（すべて Pass）
| パス | 期待 | 実測 |
|---|---|---|
| `https://largogk.jp` | 308 → `https://fire.largogk.jp/` | ✅ |
| `https://largogk.jp/about` | 308 → `https://fire.largogk.jp/about` | ✅ |
| `https://largogk.jp/risk?show_result=1` | 308 → `https://fire.largogk.jp/risk?show_result=1` | ✅ |
| `https://www.largogk.jp` | 308 → `https://fire.largogk.jp/` | ✅ |
| `https://www.largogk.jp/tools/risk` | 308 → `https://fire.largogk.jp/tools/risk` | ✅ |
| `https://fire.largogk.jp` | 200 OK / Vercel | ✅ 影響なし |

SSL は Let's Encrypt 自動発行済み（`Server: Vercel` + HSTS ヘッダー付与確認）。
`x-vercel-id: kix1::...` で東京エッジ経由を確認。

#### 残作業（ユーザー手動対応）
- Netlify 側の旧サイト削除 / アカウント整理（同一 Netlify アカウントで他プロジェクトが
  動いている可能性があり、解約前に Netlify Dashboard でホスト一覧の確認が必要）
- 旧サイトのソースは `~/Documents/Projects/デジタルタイムカプセル/ラルゴHP/files/` に保管

---

## 2026-04-26 — SEO基盤 Phase 1 Commit 3（信頼性ページ /about /privacy /tokushoho 実装 + 関連 SEO 整備）

### 概要
信頼性ページ3本（/about、/privacy、/tokushoho）の実装を中心に、フッター・ヘッダーナビ整備、
Google Search Console 認証、sitemap.xml 更新まで一連で完了。本番（fire.largogk.jp）に
公開済み、Search Console 認証 + サイトマップ送信も成功。

### 1. 信頼性ページ実装

#### 設計判断
- 本文は markdown として `src/content/legal/` に置き、ページコンポーネントから raw import
- レンダリングは **react-markdown を新規導入**（既存ライブラリは未導入）+ components prop で
  Tailwind スタイリング。`@tailwindcss/typography` は導入せず、各要素にクラスを当てる方針
- React Router の3ブロック構造（未認証・メール未確認・確認済み）すべてに /about /privacy
  /tokushoho を追加 → **未認証でも閲覧可能**（信頼性ページの法的要件）
- 文体は `Docs/tone_guideline_lp.md §4` に準拠（事実ベース、煽らない、計算結果のみ提示）

#### 実装内容
- `src/content/legal/{about,privacy,tokushoho}.md` 新設、本文配置
  - /about: 48歳セミリタイア、SEI Investments の暴落データ（目標設定済み顧客 75% が
    持ち続けた、未設定顧客 6割が売却）、4年運用継続のストーリー
  - /privacy: 取得情報（メアド + 計算ツール入力）・利用目的・業務委託先（Supabase, Vercel）・
    `simulation_logs` の匿名性（IP・UA 非保存）
  - /tokushoho: 合同会社ラルゴ事業者情報・連絡先・動作環境
- `src/components/MarkdownContent.tsx` 新設（react-markdown ラッパー、h1/h2/h3/p/ul/li/strong/a/hr/blockquote
  にカスタム Tailwind クラスを適用）
- `src/pages/{AboutPage,PrivacyPage,TokushohoPage}.tsx` 新設（Layout + SEOHead + MarkdownContent）
- `src/App.tsx` の3ブロック全てに3ルート追加
- `src/components/Footer.tsx` 新設、Layout に flex-col + sticky-footer で組み込み
  - 「運営者について」「プライバシーポリシー」「特定商取引法に基づく表記」の3リンク
  - コピーライト「© 2026 合同会社ラルゴ」併記
- `legal-check` 偽陽性回避のための本文最小調整
  - about.md「特定の金融商品を**推奨しない**」→「特定の金融商品を**勧めない**」
  - tokushoho.md「ブラウザ...での**利用を推奨します**」→「ブラウザ...での**利用を想定しています**」
  - `src/lib/seo/schemas.ts:30` の同種コメントは既存コード由来のため別タスクで対応

### 2. dev サーバー復旧（clean install + recharts ピン）

#### 発覚
react-markdown 導入時の `npm install` が `ERR_INVALID_ARG_TYPE` で失敗、`--no-audit`
で回避してインストール完了。その後 `npm run dev` で
`Failed to resolve entry for package "micromark-util-subtokenize"` のエラーで
dev サーバーが起動しなくなった（`build:spa-only` は成功するため見落としやすい）。

#### 原因
`--no-audit` 回避時の不完全な install で `node_modules/micromark-util-subtokenize/`
配下に重複ファイル（`index 2.js`、`package 2.json` 等、permission 600 の異常状態）
が残り、Vite の dep optimizer が `exports.development` 経由で `dev/index.js` を
解決しようとして失敗。

#### 対処
- `node_modules` + `package-lock.json` を削除して clean install（`--no-audit` なし）
  → 重複ファイル消失、permission 正常化、dev 起動 OK
- 副次的に `recharts` が `^3.7.0` の `^` で 3.7.0 → 3.8.1 にバージョンアップし、
  `MonthlyProjection.tsx`（L79）と `PortfolioCustomizePage.tsx`（L399）の `Formatter`
  関数で TS 型エラーが発生
- `recharts` を `3.7.0` にピン（`^` を削除）して既存 build を維持
- recharts 上げに伴う既存型エラー修正は別タスク（CLAUDE.md TODO へ）

### 3. ヘッダーナビ・本文幅調整

#### 実装内容
- `Layout.tsx` のヘッダーナビに「運営者について」リンクを追加（PF診断 の右、UserStatusBar の左）
  - 既存リンクと同一の active highlight ロジック（`bg-blue-50 text-blue-700`）
- 信頼性ページ3本の `<main>` の `max-w-3xl`（768px）→ `max-w-5xl`（1024px）に拡張
  - ワイド画面での左右空白が大きすぎたため、視覚的にバランスの良い幅に
  - モバイル（< 1024px）では viewport 幅に追従、レイアウト崩れなし
- /privacy、/tokushoho へのリンクはヘッダーには追加せず、フッター誘導のみ（法的に必要だが
  能動的に見せるべきページではないため、/about のみヘッダー昇格）

#### 既知事項
- モバイル（375px）でヘッダーナビが overflow（`scrollWidth=559 > clientWidth=375`）。
  `shrink-0` で折り返しせず、横スクロールが必要。レスポンシブ対応（ハンバーガーメニュー化等）
  は別タスク

### 4. SEO 周辺整備

#### Google Search Console verification

`index.html` の `<head>` に verification meta タグを追加：
```html
<meta name="google-site-verification" content="-F4u87K93aZcDoF3dMkQK3S0NOolmV0bUlcDPbawchw" />
```

配置判断：
- SEOHead（ページ別動的メタ、React 19 metadata hoisting）と独立して **`index.html` 直書き**
- 理由: prerender 暫定停止中の SPA 構成下で、initial HTML に確実に含まれるのが最も robust
- charset・viewport と同列の「サイト共通固定 meta」ブロックに配置

#### sitemap.xml の更新

- `public/sitemap.xml` に /about /privacy /tokushoho を追加（手書き運用、Phase 2 で
  自動生成移行予定）
  - /about: priority 0.7, changefreq yearly
  - /privacy: priority 0.3, changefreq yearly
  - /tokushoho: priority 0.3, changefreq yearly
- `public/sitemap.xml` の `<urlset>` 名前空間 URL のタイポ修正
  - `http://www.sitemap.org/schemas/sitemap/0.9` → `http://www.sitemaps.org/schemas/sitemap/0.9`
  - **Phase 1 Commit 1 から残っていた誤り**。Search Console で「誤ったネームスペース」
    エラーが発生して発覚
- `robots.txt` は既存のまま（Sitemap 参照を含む、修正不要）

#### 達成事項（Google 側）
- **Google Search Console 所有権確認完了**（HTML タグ方式、`fire.largogk.jp` 認証済み）
- **サイトマップ送信成功**: `sitemap.xml` ステータス「成功しました」、5 URL 検出
  （`/`、`/risk`、`/about`、`/privacy`、`/tokushoho`）

### コミット
```
c702b58 feat: 信頼性ページ /about /privacy /tokushoho を実装(SEO Phase 1 Commit 3)
e1c5928 feat: フッターを追加し信頼性ページへの導線を整備
88bd46d chore: dev サーバー復旧のため clean install + recharts を 3.7.0 にピン
a58cc51 fix: 信頼性ページの本文幅を max-w-3xl → max-w-5xl に拡張
f1dd667 feat: ヘッダーナビに「運営者について」リンクを追加
9747c6e chore: Google Search Console site verification の meta タグを追加
e960542 chore: sitemap.xml に /about /privacy /tokushoho を追加(SEO Phase 1 Commit 3)
dffc08f fix: sitemap.xml の xmlns ネームスペース URL のタイポを修正
```

---

## 2026-04-25 — Vercel build 復旧（prerender 暫定停止 + 重複プロジェクト削除）

### 発覚
2026-04-23 以降の push（SEO Phase 1 Commit 1, PF Step 2, SEO Commit 2,
マイグレーション修復, ドキュメント一連）が **本番（fire.largogk.jp）に反映されていない**
ことが判明。`vercel ls` で確認した結果、`semi-retire-simulator` は 13 日前以降の
production deployment が**全て Error**（4 件連続失敗）。

### 原因
`npm run build` が呼び出す `tsx scripts/prerender.ts` の `puppeteer.launch()` が
Vercel build 環境で Chromium 起動に失敗。ローカル（Node 22）では全 3 段階成功するため、
Vercel 特有の問題と確定（Chromium 関連 system library 不足が有力仮説）。

### 短期対応（本コミット）
- `vercel.json` に `"buildCommand": "npm run build:spa-only"` を追記
- push トリガで両プロジェクト（semi-retire-simulator + 重複の semi-retire-app）が
  自動 build → 両方 ● Ready
- fire.largogk.jp が 13 日ぶりに最新コードに更新（PF Step 2 / simulation_logs 基盤 / 修復された migrations が反映）

### 重複プロジェクト整理
同じ GitHub リポジトリ（`10Kimi/semi-retire-simulator`）に Vercel プロジェクトが 2 つ
紐付いていた状態を解消：
- `semi-retire-simulator`（2026-02-22 作成、本番 fire.largogk.jp 紐付け）→ **保持**
- `semi-retire-app`（2026-04-18 作成、`*.vercel.app` 自動ドメインのみ）→ **削除**

削除前確認：env vars 0 件、カスタムドメインなし、GitHub webhook なし
（Vercel GitHub App 連携経由）→ 影響範囲ゼロを確認済み。

`vercel project remove semi-retire-app` で削除実行。push 1 回あたりの build 起動が
1 本に集約され、重複 Error 通知も解消。

### 中期対応（別コミット予定）
`puppeteer` → `@sparticuz/chromium` + `puppeteer-core` に置換し、Vercel build で
prerender を復活させる。詳細は `CLAUDE.md` TODO「prerender を Vercel build に
戻す（中期対応）」参照。SEO Phase 1 Commit 3〜4 の前に実施推奨。

### コミット
```
377fde2 chore(vercel): Build Command を build:spa-only に切替（prerender 暫定停止）
```

---

## 2026-04-25 — マイグレーション番号衝突修復（案A'）

### 経緯と判断
CLAUDE.md TODO「マイグレーション番号衝突の修復（案A）」を実行する直前に、
事前確認 SQL で `supabase_migrations.schema_migrations` 011 行が
`risk_gap_snapshots`（後付け untracked 版を指していた）と判明。元の案A（INSERT のみ）
では 011 不整合が解消できないため、Phase 2 を **DELETE + INSERT 方式（案A'）**
に切り替えて実施。

### ローカルファイル変更
- `011_risk_gap_snapshots.sql` → `023_risk_gap_snapshots.sql` にリネーム
  （`011_rebalance_tool.sql` との番号衝突を解消）
- `012_invite_codes.sql` を削除（`018_invite_codes_profiles.sql` の RLS なし不完全版・代替済み）
- 結果: `supabase/migrations/` は 001..024 連続 24 ファイル、番号重複なし

### 本番 DB 側の対応
- `schema_migrations` の 011 = `risk_gap_snapshots` を DELETE
- 011..024 を一括 INSERT（011 = `rebalance_tool`、023 = `risk_gap_snapshots`、024 = `simulation_logs`）
- 最終 24 行、各 name はローカルファイル名と完全一致
- テーブル・カラム・関数の実体は一切変更していない

### 関連ドキュメント
- `Docs/migration-repair-planA.md` — 改訂版（案A'）手順書を永続化
- 元の案A は履歴セクションとして残存（事前確認 → 改訂判断の経緯付き）

### コミット
```
1cce732 chore(migrations): 番号衝突修復（011→023、012削除、案A'適用）
14617e8 chore(docs): 案A 手順書を案A' 改訂版に更新
33643b4 chore(docs): マイグレーション番号衝突修復手順書（案A）を追加
```

---

## 2026-04-25 — SEO基盤 Phase 1 Commit 2（匿名シミュレーションログ基盤）

### 背景
SEO 経由の流入導線・コンバージョンを定量分析するための匿名ログ基盤。
実際の `logSimulationEvent` 呼び出しは Commit 3 以降（信頼性ページ・/tools/* LP 実装時）
で配置予定。本コミットはあくまで基盤のみ。

### 追加
- **`supabase/migrations/024_simulation_logs.sql`** 新規
  - `simulation_logs` テーブル（id, anon_session_id, tool_path, event_type, payload, referrer_host, created_at の 7カラム）
  - インデックス 3 本（session / path_created / event_created × `created_at DESC`）
  - RLS: INSERT は anon キーから可、SELECT/UPDATE/DELETE はポリシー無し（service_role のみ閲覧）
- **`src/lib/anonSession.ts`** 新規
  - `getAnonSessionId()`: localStorage `fire_anon_session_id` から UUID v4 を取得・無ければ発行。プライベートブラウジング時は揮発IDフォールバック
  - `getReferrerHost()`: `document.referrer` から hostname のみ抽出。同一オリジン・パース失敗は null
- **`src/lib/simulationLogsDb.ts`** 新規
  - `logSimulationEvent({ toolPath, eventType, payload? })`: fire-and-forget で 1 行 INSERT。例外は呼び出し側に伝播させない

### プライバシー設計
- **IP アドレス・User-Agent は保存しない**（クライアントから送信もしない）
- `anon_session_id` は localStorage の UUID v4 のみ。個人特定情報なし
- `referrer_host` はホスト名のみ。フルURL・クエリ文字列は保存しない（検索クエリ漏洩防止）

### マイグレーション番号
- 024 を採番（023 は `risk_gap_snapshots` のリネーム予約のため避けた）

### コミット
```
576f3a9 feat(seo): Phase 1 Commit 2 — 匿名シミュレーションログ基盤（simulation_logs）
e7f3ba1 chore: supabase/.temp/ を .gitignore に追加
```

---

## 2026-04-25 — リスク超過警告 2回暴落シナリオ刷新 + PF診断永続化（PF Step 2）

### 表示ロジック（`RiskExcessWarning.tsx`）
- Step 2: 単一メッセージ → 「売った場合 / 持ち続けた場合」二重苦カードに刷新。
  「問題は意志ではなくPFのリスクレベル」とメタメッセージで着地
- Step 3: 「売った人 / 耐えた人」二カード対比、出典（三菱UFJ・JP Morgan）で裏付け
- Step 4: 12.5年・1回暴落・2線チャート → **20年・2回暴落・3線チャート**
  （適正PF継続 / 攻撃的PF耐えた / 攻撃的PF売却）に拡張。比較表に「20年後の資産額」行を追加

### 計算ロジック（`pfSimple.ts`）
- 暴落関数を `crashDrawdownCorona` (1.7σ) / `crashDrawdownLehman` (2.5σ) に分離
- 離脱期間も `absenceYearsCorona` (0/0.5/1/1.5) / `absenceYearsLehman` (0/2/3/4) に分離
- 機会損失計算はリーマン級ベースに固定（最大の痛みを示す）
- 20年シミュ `properValue20y` / `soldValue20y` を追加（5年目コロナ級・15年目リーマン級）
- `panicSellRate` 仕様変更: gap≤0 を `{1,10}` → `{0,0}`。許容度以下のPFは売却リスクなしと明示
- 段階テーブル（`absenceYears` / 暴落タイミング）の設計意図を docstring に明記。
  引用元データではなく見積もり値である旨、UI 側の「少なくともN年」表現で断定を回避する旨

### 永続化（`diagnosisDb.ts`）
- `savePfWithSnapshot` を追加。Supabase RPC `save_pf_with_snapshot` 経由で
  `portfolio_diagnoses` + `risk_gap_snapshots` を同トランザクション保存
- `PfDiagnosisSimplePage` から fire-and-forget で発火

### 残タスク
- `calculateRiskExcessImpact` の単体テストは別コミットで後追い
  （境界値 gap=0/1/2/3+、`absenceYears` 段階テーブル、20年シミュ単純ケース）
- チャートとテーブルの「持ち続けた」ラベル（チャート＝tolerance held、テーブル＝pfLevel held）の
  明示化は別UIレビューで対応

### コミット
```
46ef507 feat(pf): リスク超過警告を2回暴落シナリオに刷新 + PF診断結果の永続化
ec3218e docs(seo): Phase 1 Commit 1 の補足記録 + TODO 整備
```

---

## 2026-04-23 — SEO基盤 Phase 1 Commit 1（prerender + SEOHead + JsonLd）

### 背景
note / X 発信以外の流入経路として、検索エンジン経由の診断ツール流入（特に
「資産運用シミュレーション」月33,100 等）を狙う戦略を開始。ただし YMYL 領域
での記事量産リスクを避け、「ツール群を SEO に乗せる」方針。
まず SEO 基盤（静的 HTML 生成・メタタグ・構造化データ）を Commit 1 として整備。

### 技術選定の経緯
当初 `vite-react-ssg` を検討するも React Router v7 未対応（v6 専用 peer deps）。
React Router v7 の Framework Mode 移行は工数 16〜24h かかるため Phase 1 立ち上げ
では過剰と判断。最終的に **Puppeteer ベースの自作 post-build prerender スクリプト**
を採用（100行、React Router 非依存、Vercel ビルド環境で動作）。

### 追加・変更
- **`scripts/prerender.ts`** 新規
  - `serve-handler` で dist/ を静的配信 → Puppeteer で各ルートを並列描画 → HTML 化
  - 並列数 3、タイムアウト 30s、ルートリスト明示
  - Commit 1 時点の対象は `/risk` のみ、Commit 3 で `/about /privacy /tokushoho`、
    Commit 4 で `/tools/*` を追加予定
- **`src/components/seo/SEOHead.tsx`** 新規
  - React 19 のネイティブ metadata hoisting を使用（外部ライブラリ不要）
  - title / description / canonical / OGP / Twitter カードを宣言的に設定
- **`src/components/seo/JsonLd.tsx`** 新規
- **`src/lib/seo/schemas.ts`** 新規
  - `organizationSchema`（合同会社ラルゴ）
  - `softwareApplicationSchema()`（各ツールに付与、無料 Offer price=0）
  - `breadcrumbListSchema()`（Phase 2 のパンくず用）
- **既存3ページに SEOHead + JsonLd 埋込**: `/`（FIREシミュレーター）、
  `/risk`（リスク診断）、`/pf`（PF診断）
- **`public/robots.txt`** 新規（AI クローラー対応コメント付き）
- **`public/sitemap.xml`** 新規（手書き版、Phase 2 で自動生成に移行予定）
- **`index.html`** から static `<title>` を撤去（React 19 hoist に統一）
- **`package.json`**: `puppeteer@24.x` / `serve-handler@6.x` / `p-limit@5.x` /
  `@types/serve-handler` を devDependencies 追加。`build` スクリプトに prerender 統合、
  `build:spa-only` で prerender スキップ可

### 却下した選択肢
- **`react-helmet-async`**: React 19 未対応（peer deps 失敗）
- **`vite-react-ssg`**: React Router v7 全バージョン非対応（v6 専用）
- **React Router v7 Framework Mode 移行**: Phase 1 立ち上げ工数として過剰、
  Phase 3 後半〜4 での再検討事項に送り
- **`vike` 移行**: pages/ 構造への書き換えコスト大
- **SSG 無効・純 SPA**: AI 検索クローラー（ChatGPT/Perplexity 等）JS 非実行のため不適

### マイグレーション調査（本コミットとは独立・Step 3 として後日実行予定）
以下を並行調査して記録：
- 本番 DB（PostgREST API 経由）: public スキーマに 23 テーブル + 1 ビューが存在。
  `risk_gap_snapshots` `invite_codes` `fund_master` 等、マイグレーション 013〜022 が
  定義するテーブル・カラム・関数すべて適用済みを確認
- schema_migrations の記録は `011_rebalance_tool.sql` までで止まっている
  （012以降は Supabase Dashboard 経由で手動適用されたため）
- 未tracked ファイル `011_risk_gap_snapshots.sql` と `012_invite_codes.sql` が
  既 commit 済み `011_rebalance_tool.sql` / `012_fund_master.sql` と**番号衝突**
- 修復方針として **案A（リネーム + `supabase migration repair --status applied`）**
  を採用決定。本番 DB には一切触らず schema_migrations テーブルを書き戻すのみ
- 詳細は `CLAUDE.md` の TODO セクションに記録

### 検証済み事項
- `npm run build:spa-only`: tsc + vite build 成功（773 modules、3.48s）
- `npm run build`: フルビルド + prerender 成功、`dist/risk/index.html` に正しい
  `<title>` / meta description / canonical / OGP / JSON-LD が焼き付き
- `dist/index.html`（SPA entry）: static title なし、各ページの SEOHead で設定される
- 既存ルート（`/ /risk /pf /ma /rb /portfolio`）の挙動は無改修

### コミット
```
be2fc65 feat(seo): Phase 1 Commit 1 — SEO基盤（prerender + SEOHead + JsonLd）
```

---

## 2026-04-11 — 有料基盤 + /portfolio + モンテカルロ + 13アセット統一

### 有料プラン基盤
- **招待コード認証**: invite_codes + profiles テーブル（`018_invite_codes_profiles.sql`）
- **useIsPremiumフック**: profiles.is_premiumで有料判定
- **InviteCodeModal**: コード入力→照合→プラン有効化
- **PremiumGate共通コンポーネント**: /ma・/rb・/portfolioを統一ゲートでラップ
- **有料ツール**: /portfolio、/ma、/rb
- **無料ツール**: /（シミュレーター）、/risk（リスク診断）、/pf（PF診断）

### /portfolio（ポートフォリオカスタマイズ）
- 13アセット対応スライダー（独立動作、5%刻み、アセット追加/削除）
- 「分析する」ボタンで4指標計算（リスクレベル・期待リターン・ボラティリティ・シャープレシオ）
- 合計100%でない場合はボタンをグレーアウト
- 許容度超過時: 赤背景アラート、許容度内: 緑背景アラート
- /risk結果画面のAllocationSliderを削除→「配分をカスタマイズする →」リンクに変更

### モンテカルロシミュレーション
- `src/logic/monteCarlo.ts`: Box-Muller法で1000試行、20ビンヒストグラム生成
- /portfolio画面の4指標の下に入力セクション（金融資産・毎月積立額・積立期間）
- rechartsのBarChartでヒストグラム表示、中央値にReferenceLine
- 3シナリオ表示: 悲観（下位25%）・中央値・楽観（上位75%）

### アセットクラス13クラス統一（My Index準拠）
- ASSET_CLASSES: 11→13クラス（us_equity, developed_reit, emerging_reit, commodity, gold追加、alternative・foreign_reit削除）
- MODEL_ALLOCATIONS: 旧commodity→gold、旧alternative→削除、us_equity追加
- FALLBACK_ASSET_RETURNS/RISKS/CORRELATION_MATRIX: 13x13に拡張
- Supabase: `019_asset_class_unify.sql`（不足アセットをINSERT）

### リスク診断 詳細版 + Capacity計算式修正

### リスク診断 詳細版（/risk）
- **バージョン選択UI**: /riskトップに簡易版/詳細版の選択画面を追加
- **詳細版Capacity（C1〜C8）**: C7収入安定性（C2スコアへの係数0.6〜1.0）、C8家族構成補正（-1.0〜+0.5）を追加
- **詳細版Tolerance（T1〜T15, 12問）**: 米国大学の学術調査ベース、総点（12〜84点）を1〜7に正規化
  - T9/T10: 小額・大額の期待値感応度ペア
  - T13: スタートアップ出資（リスク集中許容度）
  - T15: アクティブファンド乗り換え（方針継続力）
- **質問・スコアリング**: `src/logic/riskDetailQuestions.ts`, `src/logic/riskDetailScoring.ts`
- **テスト**: `src/logic/riskDetailScoring.test.ts`（10件パス）
- **簡易版結果画面**: 「詳細版を試す」ボタン追加（ログイン済みはゲートスキップ）
- **Supabase**: `risk_assessment_simple` テーブルに `version` カラム追加（`017_risk_assessment_version.sql`）

### Capacity計算式修正（簡易版・詳細版共通）
- **raw_capacity**: `(C1+C2)/2` → `C1*0.6 + C2*0.4`（資産重視に変更）
- **C3（負債残高）**: 絶対額→相対値（金融資産の何割か）、5段階（0/-0.3/-0.7/-1.0/-1.5）
- **C4（大型支出）**: 絶対額→相対値、4段階（0/-0.3/-0.8/-1.0）
- **詳細版のincomeScore**: `C2 * C7係数` に `rawCapacity = C1*0.6 + incomeScore*0.4` を適用

## 2026-04-10 — リバランスツール（/rb）全機能 + リスクモデル統一

### /rb リバランスツール
- **Phase 1**: 11アセットクラス別残高入力、目標配分設定、乖離表示（色分け付き）、3モード調整計算
  - ページ: `src/pages/RebalancePage.tsx`
  - ロジック: `src/lib/rb/logic.ts`
  - DB層: `src/lib/rb/db.ts`
  - 型定義: `src/lib/rb/types.ts`
  - テスト: `src/lib/rb/logic.test.ts`（31件パス）
  - マイグレーション: `supabase/migrations/011_rebalance_tool.sql`
- **Phase 2 — MFエクセル取り込み**: MoneyForwardエクスポートExcelからアセットクラス別に自動集計
  - 解析: `src/lib/rb/mfParser.ts` — ブラウザ側SheetJS（サーバーにアップロードしない）
  - 按分: `src/lib/rb/allocator.ts` — fund_masterに基づく自動振り分け
  - テスト: `src/lib/rb/allocator.test.ts`（8件パス）
  - UI: `src/components/rb/MfImportFlow.tsx`
  - マイグレーション: `supabase/migrations/012_fund_master.sql`, `013_fund_master_seed.sql`
- **調整計算 3モード**: 積立のみ / 売却あり / 期間指定
  - 期間指定モード: 売却を期間全体に分散（毎月1/Nずつ売却）、現金は操作に出さず内部で取り崩し
  - 積立額→完了期間、または完了期間→必要積立額をリアルタイム計算
  - 売却資金+現金余剰で足りる場合は「追加積立不要」と表示
  - 内訳表示: 毎月の操作合計・売却資金の充当・現金の取り崩し・追加積立
- **月次推移シート**: `src/components/rb/MonthlyProjection.tsx`
  - 積み上げ面グラフ（recharts AreaChart）— 12ヶ月かけて徐々に目標比率に収束
  - 月別操作テーブル（横スクロール対応）— 売却=赤、積立=緑、千円単位表示
- **緊急資金設定**: 生活費×緊急避難枠（3/6/12/24ヶ月）を現金から除外してリバランス計算
  - マイグレーション: `supabase/migrations/016_rb_emergency_fund.sql`（user_rb_profile）
- **現金・預金の表示**: 売却リストに出さない。マイナス時「投資に回す」、プラス時「積み増し」
- **目標配分リセットバナー**: 旧モデル配分がプリセットと不一致の場合に再設定を促す
- **リバランス期間中の/maシグナル**: 4ヶ月以上の場合に「/rbの計画を優先、完了後に/maが有効」と表示
- **金額表示**: 調整計算・月次テーブル全体を千円単位に丸め（例: ¥2,130,000）

### リスクレベル・モデル配分統一（7段階）
- **GPIF第5期高成長実現ケースベース**: 効率的フロンティア計算による確定値
  - Lv1 超保守型（3.8%/3.1%）〜 Lv7 超積極型（8.5%/24.0%）
  - マイグレーション: `supabase/migrations/014_risk_model_portfolios.sql`, `015_asset_class_params_update.sql`
- **/rb**: モデル配分プリセットを7段階に更新、選択時に期待リターン・ボラティリティ表示
- **/risk**: 結果画面にモデル配分・期待リターン表示
- **Lv6・7集中リスク注記**: 株式高集中の警告テキスト
- **アセットクラス名称変更**: コモディティ → ゴールド（keyはcommodityのまま）

### 共通コンポーネント
- **UserStatusBar**: `src/components/UserStatusBar.tsx` — ログイン状態表示を全ページで統一
- **NicknameModal**: `src/components/NicknameModal.tsx` — /risk結果表示時にニックネーム任意取得
- **AllocationDisclaimer**: `src/components/AllocationDisclaimer.tsx` — 折りたたみ式「ⓘ この配分について」注記（/risk, /rb共通）

### 認証・登録
- `src/App.tsx`: `/rb` ルート追加、`/ma` を認証済み+メール確認済みユーザーのみに変更
- `src/components/auth/RegisterForm.tsx`: 名前入力フィールド削除（メールのみで登録）
- `src/components/Layout.tsx`: UserStatusBarに差し替え
- `src/pages/MonthlyAdvisorPage.tsx`: ヘッダーにUserStatusBar追加
- `src/pages/RiskSimplePage.tsx`: 結果表示時にNicknameModal表示

## 2026-04-09 — 月次投資アドバイザー（/ma）実装

### 追加
- **Supabaseテーブル**: `indicators`（市場指標）+ `user_ma_settings`（ユーザー設定）+ RLSポリシー
  - マイグレーション: `supabase/migrations/010_monthly_advisor.sql`
- **fetch_indicators.py**: Supabase upsert対応（ローカルJSON出力も維持）
  - リポジトリ内コピー: `scripts/market/fetch_indicators.py`
- **/ma ページ**: `src/pages/MonthlyAdvisorPage.tsx`
  - バリュエーション判定（CAPE / PBR / GSR）をindex.htmlから移植
  - モメンタム（10ヶ月MA）トグル
  - モード補正（強気 / 平常 / 慎重）— 新規追加
  - 投資設定（月次予算・各口座枠・銘柄名）— 折りたたみ、デフォルト展開
  - 待機資金管理（iBond）
  - 結果表示（NISA積立・成長・特定口座の配分計算結果）
- **ロジック**: `src/lib/ma/logic.ts` — calculateAllocation, getCapeMultiplier, getPbrMultiplier, getGsrMultiplier
- **DB層**: `src/lib/ma/db.ts` — Supabase CRUD
- **型定義**: `src/lib/ma/types.ts`
- **Vitest**: `src/lib/ma/logic.test.ts` — 21テスト（CAPE/PBR/GSR境界値）
- **GitHub Actions**: `.github/workflows/fetch-indicators.yml` — 毎月1日 00:00 JST に指標自動取得
- **legal-check**: 禁止ワードゼロ確認済み

### 変更
- `App.tsx`: `/ma` ルート追加（開発環境では認証バイパス）
- `vite.config.ts`: Vitest型参照追加（`/// <reference types="vitest/config" />`）

### 注意
- /ma は開発フェーズではログイン不要。本番ではStripe連携後に認証ゲート追加予定
- GitHub Actions実行には `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` のSecrets設定が必要
