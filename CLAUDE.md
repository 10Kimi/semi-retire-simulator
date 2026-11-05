# セミリタイア・シミュレーター

## プロジェクト概要
セミリタイアの資金計画をシミュレーションするWebアプリ。
元のExcelシミュレーター（V4.2）をWeb化し、フリーミアムモデルで提供する。
「セミリタイア資産運用パッケージ」の中核プロダクト。

- 本番URL: https://fire.largogk.jp
- パッケージ全体設計書: ../../Docs/設計書_v7_25_main.md（最新版。過去版は ../../Docs/archive/）
- パッケージ全体の判断文脈: ../../CLAUDE.md

## コマンド

```bash
npm run dev                    # 開発サーバー
npm run build                  # tsc -b + vite build + prerender（型チェックはこれで行う）
npm run build:spa-only         # prerender なし
npm test                       # vitest run（全テスト）
npm test -- ma/logic           # ファイル名で絞る
npm test -- -t "iDeCo"         # テスト名で絞る
npm run lint
npm run invite -- --count 3    # 招待コード発行（scripts/market/.env を読む）
npm run legal-check            # 法的表現チェック（baseline 7 件）
```

**型チェックは必ず `npm run build` で行う。** このリポは `tsc -b`（project references）を使っており、
`tsc --noEmit` では通るコードが Vercel ビルドで落ちる（実例: TS7053、コミット `0a0edd1`）。

---

## アーキテクチャの要点

多数のファイルを読まないと分からない事柄のみを記載する。

### ルーティングは3分岐（`App.tsx`）
`!user` ／ `!user.email_confirmed_at` ／ ログイン済み の3ブロックに分かれており、
**同じ Route を必要な分岐すべてに書く必要がある**。1箇所だけの追加は状況次第で到達不能になる
（例: `/reset-password` はリカバリ時にセッションが張られるかどうかで到達分岐が変わるため3箇所すべてに登録）。

### 公開ルート追加時の3点セット
1. `App.tsx` の該当分岐に Route
2. `scripts/prerender.ts` の `PRERENDER_ROUTES`
3. `public/sitemap.xml`

### 認証は用途別
- メインのログインゲート＝**パスワード認証**（`components/auth/LoginForm.tsx`）
- `/risk` 等のメアドゲート＝**マジックリンク**（`components/risk/RiskAuthGate.tsx`）
- 再設定＝`/reset-password`、ログイン中の変更＝`PasswordChangeModal`（ともに `updateUser({password})`）。
  現在のパスワードは要求しない（リカバリ直後は本人が知らないため）
- Supabase クライアントは `flowType: 'implicit'`（デフォルト）。リカバリのトークンは URL ハッシュで戻る

### 有料ゲート
`PremiumGate` が `profiles.is_premium` を見る（`/ma` `/rb` `/portfolio`）。
付与は招待コード（`lib/inviteDb.ts` が `invite_codes` を使用済みにして `profiles` を upsert）。
**パスワードは `auth.users`、有料状態は `profiles` と別テーブル**なので、パスワード変更で有料状態は失われない。
PF診断の `/portfolio` への CTA は、無料ユーザーには招待画面が出る**意図的なアップセル導線**。

### 計算ロジックの置き場
- `src/logic/` — 診断・シミュレーション（`simulator` / `riskScoring` / `riskDetailScoring` / `pfSimple` / `monteCarlo`）
- `src/lib/ma/`, `src/lib/rb/` — ツール単位で `logic` / `types` / `db` を1セット

DB 層は `rowToSettings` / `settingsToRow` でフラットな行と入れ子の型を相互変換する。
**カラムを足すときは types・db の両方＋テストのフィクスチャを直す**（片方だけだと `tsc -b` が落ちる）。

### 計算ロジックを変えるとき（3役のサブエージェント、2026-11-03）
/ma・/rb・/portfolio の計算、資産クラス、目標配分・モデル配分を変えるときは、統括役（メインの CC）が
**`Docs/計算ロジックの地図.md` を最初に読み**、該当部分だけを渡して `.claude/agents/` の3役を使う。
実装役（`app-implementer`）→ 検算役（`app-verifier`、実装のコードを見ずに期待値を出す）→ レビュー役（`app-reviewer`、他ツールとの食い違いを見る）。
**表示だけの変更では使わない。** DB の変更・外部 API への支出・commit/push は3役ともやらずに統括役へ返す。統括役は、DB の変更と外部 API への支出はオーナーの承認を待つ。commit・push は統括役が行ってよい（下の「push」）。

### `/ma` の設計原則
「税制優遇枠は満額／タイミング調整は課税口座で／自分が買ってる指数で割高感を測る」。
- **非課税枠かどうかはスロットの口座属性で判定する**（`isTaxAdvantaged(slot.account)`）。
  migration 038 でスロットに `account` を持たせて以降、`NISA_SLOT_COUNT` は存在しない。
  スロット番号で判定していた頃は「1つの非課税枠に複数商品」を表現できなかった
- iDeCo/401k もスロットの1つ（`account: 'ideco'`）。migration 038 で `ideco_amount` は廃止
- **つみたて投資枠で買えるのは株式のみ**。債券インデックス・REIT・ゴールドは成長投資枠でのみ購入可（SBI実機で確認）。
  バランス型で代用する案は、配分を自分で決められずリバランスもできないため不採用
- **非課税枠の金額は丸めない**（2026-08-09 修正、commit `2f4c949`）。
  ユーザーが入力した確定額（iDeCo の掛金など）をそのまま使う。
  丸めるのは特定口座だけ（`amount × multiplier` で端数が出るため）。
  以前は非課税枠も 1 万円単位に丸めており、入力合計15万が計算結果16万になる不具合があった
  （37,500→40,000 / 45,000→50,000 / 15,000→20,000 / 22,500→20,000 で相殺せず +1万）。
  **テストの期待値を1万円の倍数だけで書かない**こと。既存テストが全て倍数だったため
  このバグが素通りしていた
- **指標 → 計算の入力値の組み立ては `logic.ts` に1か所**（`deriveMonthlyInputs` / `calculateMonthlyFromIndicators`、2026-11-02）。
  以前は `MonthlyAdvisorPage.tsx` の中にあった。画面と月次メールが同じ関数を通るので、**ここを変えると両方が変わる**

### `/ma` 待機資金の出口＝暴落ルール（2026-11-02 オーナー決定）
- **CAPE が割安なときの待機資金投入は廃止**（旧 `getReserveDeployment`）。米国株の特定口座スロットが無い人は投入先が無く、
  待機資金が積み上がる一方だった。毎月の倍率と待機資金への積み増しはそのまま
- **判定と投入額は `src/lib/ma/crash.ts`**（画面とメールで共通）：S&P500 ドル建ての高値比 −20% に入った時点の残高を基準残高とし、
  −20%・−30% は基準残高の1/3、−40% は残高の全額。各段階1回、最高値更新でリセット
- **投入額はスロットに足さない**（`AllocationResult.crashDeployment`、`totalInvest` に含めない）。何を買うかは本人が選ぶ。
  「投資実行＆待機資金を更新」で待機資金から差し引き、`user_ma_settings.crash_state` に段階を確定する
- **同じ月に計算し直しても二重に発動しない**：`crash_state` は `{ current, month, monthBase }`。待機資金の `reserve_month_base` と同じ考え方
- 高値データは `fetch_indicators.py` が取得して `indicators.drawdown` に書く（migration 040。未適用ならその列だけ書かない）

### `/ma` 月次メール（Phase A：オーナー個人向け、2026-11-02）
毎月の送信日（`sendDay`＝25。土日祝は直前の営業日）に指標を取得し、/ma と同じ計算結果をメールで送る。
- **構成**：計算・送信日判定・古さ判定・暴落ルール・本文は `src/lib/ma/` と `src/lib/ma/mail/`（実行環境に依存しない。Phase B でそのまま使う）。
  ローカル固有の部分（設定・状態ファイル、Python での取得、Resend 送信）だけが `scripts/ma-mail/run.ts`
- **起動**：launchd `jp.largogk.fi.ma-mail`（毎日 9:00 ＋ RunAtLoad、2026-11-02 に20〜31日から変更）。送るかどうか・二重送信の防止・キャッチアップはスクリプトが判定
- **実行の記録と監視**：実行のたびに `~/Library/Logs/jp.largogk.fi/ma-mail-runs.jsonl`（1行追記・直近400行）と `ma-mail-last.json` に結果を書く（try/finally）。
  healthchecks.io への合図は本番の送信（`HEALTHCHECK_URL`）とエラー（`/fail`）のときだけ。Mac は毎日起動しないので監視は月単位（設計書 §13-69）。
  `HEALTHCHECK_URL`（`scripts/market/.env`）が未設定なら記録だけ書く。失敗側の確認は `--simulate-error`
  **順序**：送信と `state.json`（送信済みの記録）は `main` の中、合図と記録ファイルはそのあと（`scripts/ma-mail/monitor.ts` の `runOnce`）。
  合図の失敗・タイムアウト（10秒）は結果と終了コードを変えない（送信済みを error 扱いにすると次回また送るため。`monitor.test.ts`）。元の plist は `~/Library/Logs/jp.largogk.fi/` に退避
- **ローカルファイル（gitignore）**：`scripts/ma-mail/config.local.json`（userId・宛先・sendDay・mode）、
  `state.json`（送信済みの月）、`out/`（HTML の書き出し）。秘密は `scripts/market/.env` の `RESEND_API_KEY`
- **古いデータで黙って計算しない**：`indicators.as_of`（migration 039）の基準日で判定し、未更新なら件名に【データ未更新あり】、本文の指標と倍率の横に明記。
  `fetch_indicators.py` は取得に失敗した値を null で上書きせず、前回の値と基準日を残す
- **待機資金はメールでは書き換えない**（確定は /ma の画面）。市場モードは `config.local.json` の `mode`（初期値 neutral＝画面の「平常」）
- **暴落ルール**は /ma 本体の機能（下の「待機資金の出口」）。メールは画面と同じ判定を表示するだけで、段階は書き換えない
- **本文の最後に「待機資金」の表**（現在の残高／今月の積み増し／暴落ルールによる投入／計算後の残高）。計算後の残高は「投資実行」をしたときの値と一致する
- **使い方**：`npx tsx scripts/ma-mail/run.ts --dry-run`（HTML だけ書き出す）／`--force-send`（テスト送信。送信済みの記録は残さない）。
  テスト用に `--today=` `--no-fetch` `--simulate-drawdown=` `--simulate-fail=` `--state=`
- **gotcha**：launchd から node が `~/Documents` を読むには macOS の許可が要る（初回にダイアログ）。node は nvm のパスを plist の PATH で渡しているので、
  node のバージョンを上げたら plist の PATH も直す

### `/rb` の口座注記
`/rb` は資産クラス単位で計算し、**口座（iDeCo/NISA/特定）の概念を一切持たない**。
一方 実践4-1 では「売るなら税優遇口座から」という口座別の原則を教えているため、
売却が発生するときだけ `SellAccountNote`（`RebalancePage.tsx`）で判断の型を示す
（2026-08-10、commit `be19b52`）。計算はせず静的な注記のみ。
口座別の入力（13クラス×4口座）を持たせるとUXが重く、iDeCo の取扱商品は
運営管理機関ごとに異なり汎用ツールでは判定できないため、この設計にした。
大きく動かすときは実践4-1の口座別ワークシートへ誘導する。

### 採用PF＝全ツールのアンカー
`/risk` の「このPFを採用する」が `MODEL_ALLOCATIONS[finalLevel]` を `user_rb_settings` に保存し、`/rb` が目標配分として読む（`Docs/計算ロジックの地図.md`）。
- ツールの役割：初回移行＝口座別ワークシート（講座配布物）／毎月の積立＝`/ma`／定期リバランス（6ヶ月〜1年に一度）＝`/rb`
- `/ma` は holdings も target も読まない。「/ma の積立リバランス」の go/no-go は**実践4-2 の脚本着手時に確定する**（脚本と機能の一致が必須）。実装するなら現在保有の配管が要る

### 最適PFの再計算（`scripts/optimize_portfolios.py`）
```bash
set -a && . scripts/market/.env && set +a
scripts/market/.venv/bin/python scripts/optimize_portfolios.py          # dry-run
scripts/market/.venv/bin/python scripts/optimize_portfolios.py --apply  # DB反映
```
- **パラメータは `asset_class_params`（DB）から読む**。スクリプト内の定数は
  DB取得に失敗したときのフォールバックで、**正ではない**（2026-08-12 以前は定数を使っており
  cron で更新されるDB値とズレ続けていた）
- 実行には2〜3分かかる（サイズ2〜5の全部分集合を総当たり）
- **反映後は `types.ts` の `MODEL_ALLOCATIONS` / `MODEL_META` も必ず同期する**。
  `/risk` の採用ボタンが保存するのはこちらの値で、DBだけ直しても採用される中身は変わらない。
  `MODEL_META` は /risk・/rb で静的に表示されるので、月次の DB 更新とはズレうる（再実行で同期する）
- **全資産に上限（`DEFAULT_CAP = 0.45`）と最低資産数（`MIN_ASSETS`）を置くのは、シャープ最大化より分散を優先する価値判断**。
  外すと「Lv6 = 新興国株＋新興国REIT」のように同じ地域リスクの2資産に寄る
- **リスクレベルの帯（`EFF_UPPER`）を変えたら `classifyRiskLevel7` も対で変える**。
  片方だけ動かすと「Lv7 のモデル配分を採用した人が診断すると Lv6 と出る」等の矛盾が起きる
- **パラメータが変わると、配分を変えなくても判定がずれる**（2026-11-02 に Lv6・Lv7 で実際に発生）。
  `scripts/check_model_levels.py` が `MODEL_ALLOCATIONS` と `classifyRiskLevel7` のしきい値をソースから読み、
  DB の最新パラメータで全レベルを照合する。月次のボラ更新ジョブ（launchd）が更新直後に `--notify` 付きで実行する。
  再最適化やしきい値の変更のあとも手で流して確認する（`python3 scripts/check_model_levels.py`、exit 1 なら不一致）

### マイグレーション
`supabase/migrations/`（〜040）。**適用は Supabase CLI の `supabase db push`**（2026-11-04、#17。SQL Editor への貼り付けはやめた）。
CC がマイグレーションを書き、SQL をオーナーに見せ、**オーナーの OK のあと** CC が `npx supabase db push --remote --yes` する。`db push`・`migration repair` は settings.json の ask、`supabase db query`・`psql` は deny。`supabase login`・`link` はオーナーが行う。Supabase MCP は使わない。CLI は `npx supabase …` で使う（brew は不可）。`db push`・`migration repair`・`migration list` は既定でローカル（Docker）を見るので**必ず `--remote` を付ける**。本番を変える操作はエージェントからだと CLI が `--yes` を求めて止まる（`HostedMutationConsentRequiredError`、何も変わらない）。`--yes` はオーナーの直接の OK のあとだけ付ける。
コード側を push する前に適用すること（逆順だと保存時にエラーになる）。適用の OK が出るまでコードは push しない。

---

## ターゲット像
- メインペルソナ＝氷河期世代の高収入層（現在40代半ば〜50代半ば）。定義は「状態」で切る（設計書 §1-3、`../../Docs/brand.md`）
- セミリタイアに憧れているが「自分には無理」と思っている人
- 世帯年収1,500万〜4,000万円の日本人サラリーマン・共働き夫婦
- 投資はしている（or始めたい）が、運用方針に自信がない
- 「とりあえず積み立て」で利回りの根拠がない

## コアバリュー
リスク許容度 → PF構成 → 想定利回り → セミリタイア到達年数
この因果関係を一気通貫で提供する。
「根拠のない利回りで狼狽売り → 計画破綻」を防ぐのが核心価値。

## ドメイン用語
- **投資許容度（Tolerance）**: リスクをどこまで受け入れられるか（心理面）
- **投資余力（Capacity）**: 実際に投資に回せる金額（家計面）
- **4資産クラス**: 課税口座・NISA・iDeCo・現金（取り崩し優先順位あり）
- **認証ゲート**: 未認証ユーザーに価値提案→登録を促すページ
- **ROI**: 無料版はユーザー手入力。有料版はリスク診断から自動導出

## 技術スタック
- フロント: Vite + React + TypeScript
- 認証・DB: Supabase（メール確認付き・日本語化済み）
- ホスティング: Vercel
- ドメイン: fire.largogk.jp（お名前.com DNS）
- 決済（予定）: Stripe
- Markdown レンダリング: react-markdown（信頼性ページの本文表示用、`MarkdownContent.tsx` で Tailwind カスタムスタイルを適用）
- グラフ: recharts 3.7.0（**pin**。3.8.x で `Formatter` の型が厳格化されて既存 `MonthlyProjection.tsx` / `PortfolioCustomizePage.tsx` が型エラーになるため固定。recharts 上げ時は型修正を別タスクで実施）

## フォルダ構成
- `reference/` — 元Excel V4.2、解析スクリプト、解析結果（加工前）
- `src/pages/` — ページ単位コンポーネント（ルートは `App.tsx` が正）
- `src/logic/` — 計算エンジン（simulator, riskScoring, pfSimple, monteCarlo等）
- `src/components/` — UIコンポーネント
- `src/components/assessment/` — 旧 v1 リスク診断（App.tsx でコメントアウト中、デッドコード扱い）
- `src/components/risk/` — リスク診断UI（2026-05-09 §13-35 Phase B-2 で `riskSimple/` からリネーム）
- `src/components/rb/` — リバランスツールUI
- `src/components/auth/` — 認証UI
- `src/components/seo/` — SEO 共通コンポーネント（SEOHead・JsonLd、React 19 ネイティブ metadata hoisting）
- `src/lib/` — Supabase接続・DB操作
- `src/lib/rb/` — リバランスツールのロジック・型定義・DB
- `src/lib/ma/` — 月次アドバイザーのロジック・型定義
- `src/lib/seo/` — schema.org ファクトリ（SoftwareApplication・Organization・BreadcrumbList）
- `src/hooks/` — カスタムフック（useIsPremium等）
- `src/types/` — 型定義
- `scripts/` — 招待コード生成、法的チェック、prerender
- `scripts/prerender.ts` — Puppeteer ベース post-build prerender（SEO用、各公開ルートのHTML静的化）
- `scripts/market/` — 市場データ取得スクリプト（fetch_and_optimize.py, fetch_indicators.py）
  - `fetch_indicators.py` — `/ma`（月次投資アドバイザー）用の指標を取得し Supabase `indicators` テーブルへ upsert（画面の「自動取得済み」ブロックの元データ）。取得: 米国CAPE（multpl.com スクレイプ, lxml 必須）/ TOPIX PBR（JPX Excel, **openpyxl 必須**）/ 金銀比率（yfinance GC=F÷SI=F）/ モメンタムは yfinance。専用 `.venv` + `.env`（SUPABASE_URL / SUPABASE_SERVICE_KEY）。**スクリプト自身は dotenv を読まない**ため手動実行時は `set -a; source .env; set +a` で env を渡す。依存は `scripts/market/requirements.txt`（openpyxl / lxml 含む）
  - **必ず `--fetch-only` を付ける**: 付けないと取得後に **HTTPサーバー(`serve_and_open`, :8765)を永久起動**してプロセスが終わらない（cron が溜まる / 手動実行がハングする）。取得のみなら常に `--fetch-only`
  - **定期実行（2026-06-23 cron で追加、2026-07-27 `--fetch-only` 追加、2026-11-02 launchd `jp.largogk.fi.fetch-indicators` に移行）**: 毎月 1・15 日 9:00 に自動実行（≒隔週）。旧 crontab 行は `cd <dir> && set -a && . ./.env && set +a && .venv/bin/python fetch_indicators.py --fetch-only >> cron.log 2>&1`。launchd はスリープ中に過ぎた実行を復帰後に1回走らせる（電源オフ中の分は走らない）。ログは `scripts/market/cron.log`
  - **gotcha**: プロジェクトを `~/semi-retire-app` → 現パスへ移動した影響で `.venv/bin/pip` の shebang が旧パス参照で壊れている。pip 操作は `.venv/bin/python -m pip ...` で回避（python 本体は動作する）
- `public/robots.txt`, `public/sitemap.xml` — SEO 基盤
- `supabase/migrations/` — DBマイグレーション（〜040。適用は `supabase db push`、#17。032〜035 は /ma 拡張）

## 制約
- Excel V4.2の計算ロジックを正確に再現すること
- 無料版は計算エンジンをフル提供（出し惜しみしない）
- 有料への導線は「機能制限」ではなく「判断基盤の提供」
- コンサルへの導線は一切ない。ユーザーが全部自分でできる
- 取り崩し優先順位: NISA → iDeCo（60歳以降）→ 課税口座 → 現金

## 現在のフェーズ
- Phase 1-2 完了（無料版シミュレーター + 認証ゲート + コンテンツパイプライン）
- Phase 3 完了（有料ツール群: /portfolio, /ma, /rb + 招待コード基盤）
- 2026-06〜11 に完了：PF診断〜最適PFの一本化、/portfolio の金額入力・保有PF・比較、採用PF、/ma の改修（口座属性・月次メール・暴落ルール）、認証の修正、リスクレベル境界の見直し、定期ジョブの launchd 移行
- 詳細は `CHANGELOG.md`、2026-04〜05 は [Docs/phase-history-2026H1.md](Docs/phase-history-2026H1.md)
- 現在地と次の一手は FI_project の `Docs/STATUS.md` を見る（`../../Docs/STATUS.md`）

### SEO基盤 Phase 1 の設計方針（サマリ）
- URL 構造: ハブ型 `/tools/*`。既存 `/risk /pf /portfolio` はそのまま残す
- ホスティング: `fire.largogk.jp` に集約、新規ドメインなし
- 戦略: 記事量産ではなく「ツール群として SEO に乗せる」
- ゲート構造: 3層（ゲートなし層＝新設LP／診断誘導層＝`/risk /pf`／本格ツール層＝`/portfolio /ma /rb`）
- 権威性: YMYL 対応のため `/about` で運営者プロフィール明示
- 運営上限: LP は 15〜20 本までを目安

## GitHubリポジトリ
https://github.com/10Kimi/semi-retire-simulator
※ Vercelと連携済み。pushで自動デプロイ

### push（2026-11-04、FI_project #17、決定台帳 D-024）
- **オーナーの OK なしで push してよい**。条件：完了条件のテストが通り（`npm test`・`npm run build`）、計算の変更では3役の判定がそろっていること
- push のあと、本番の該当画面で反映を確かめて報告する（保存・送信はしない。画面に出ない変更はデプロイが通りページが開くことまで）
- 本番で不具合が出たら `git revert` して push し、Issue に書いて止まる（強制 push・`reset --hard` は deny）
- **DB の変更（`migration repair`・`db push`）はオーナーの OK を待つ。マイグレーションが要る変更は、適用の OK が出るまでコードを push しない**
- 範囲外で見つけて直した修正は別のコミットにする（D-025）

---

## TODO（後続対応）

### マイグレーション未管理テーブルの補完
本番 DB には以下のテーブルが存在するが、どのマイグレーションファイルにも定義がない。
Supabase Dashboard で手動作成された可能性が高い。

- `english_subscribers`
- `market_data`
- `scene_cache`

**対応予定**: Phase 1〜2 の SEO 基盤実装では触らない。将来的に
「補完マイグレーション（例: `XXX_dashboard_created_tables_backfill.sql`）」で
これらの現在スキーマを記録し、履歴として残すこと。

**確認方法**:
```bash
# PostgREST OpenAPI 経由（本番の public スキーマ全テーブルを列挙）
curl -s -H "apikey: $SUPABASE_SERVICE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
     "$SUPABASE_URL/rest/v1/" | jq -r '.definitions | keys[]'
```

### prerender を Vercel build に戻す（中期対応）

✅ **2026-04-29 完了**（コミット 196e5f0）

`puppeteer ^24` → **`@sparticuz/chromium ^148 + puppeteer-core ^24`** に置換、
ローカル(macOS)/Vercel(Linux Lambda) 両対応の launch 分岐を `scripts/prerender.ts` に実装、
`vercel.json` の `buildCommand: "npm run build:spa-only"` を削除して通常の `npm run build`
に復帰。Vercel build で prerender 成功確認済み。

※ 2026-04-30 の corporate サイト復活作業で `/privacy /tokushoho` を `largogk-corporate` に
移行、その後 `/tools/retirement-simulation`（2026-05-01）/ `/tools/age50s`（2026-05-03）/
`/tools/retirement`（2026-05-14）/ `/tools`（2026-05-19、ハブ）を追加したため、現在の
`PRERENDER_ROUTES` は **7 ルート（`/risk /about /tools /tools/risk
/tools/retirement-simulation /tools/age50s /tools/retirement`）**。

**ローカル/Vercel 切替の要点**:
- Vercel/Lambda: `chromium.args` + `chromium.executablePath()` + `chromium.headless`
- ローカル (macOS): 既存の最小 args (`--no-sandbox` 等) + Mac Chrome の executablePath
- ※ `chromium.args` には `--single-process` 等の Lambda 用フラグが含まれており、デスクトップ
  Chrome に渡すと即クラッシュするため、ローカルでは args/headless も既存の値に切替

元の暫定停止記録（2026-04-25〜2026-04-29）は履歴のみ。

---

### マイグレーション番号衝突の修復（案A）

✅ **2026-04-25 完了（案A' で実施）**

実行時の事前確認 SQL で「schema_migrations 011 = risk_gap_snapshots」と判明
（元の案A 前提と異なる）。Phase 2 を DELETE + INSERT 方式に修正した
**案A'** に切り替えて実施。手順詳細・改訂理由・ロールバック SQL は
[Docs/migration-repair-planA.md](Docs/migration-repair-planA.md) 参照。

実施結果：
- ローカル: `011_risk_gap_snapshots.sql` を `023_risk_gap_snapshots.sql` にリネーム、
  `012_invite_codes.sql` を削除（018 で代替済み）
- 本番 schema_migrations: 011 不整合行を削除した上で 011..024 を一括 INSERT。
  最終 24 行（001..024 連続、各 name はローカルファイル名と完全一致）

---

#### 元の修復方針（参考・履歴）
`011_risk_gap_snapshots.sql`（未tracked）と `012_invite_codes.sql`（未tracked）が
既 commit 済みの `011_rebalance_tool.sql` / `012_fund_master.sql` と番号衝突中。

**修復方針**: `supabase migration repair --status applied 012..023` で schema_migrations
を書き戻す + 未tracked ファイルを `023_risk_gap_snapshots.sql` へリネーム + `012_invite_codes.sql`
は `018_invite_codes_profiles.sql` の重複なので削除。

---

### §13-42 候補: `calculateRiskSimpleResult` デッドコード削除

🔲 **未対応（後続タスク）**

`src/logic/riskScoring.ts:52` に定義されている `calculateRiskSimpleResult` 関数は、
2026-05-08 §13-35 Phase B-1 で `RiskSimplePage.tsx` の import が削除されて以降、
**実プロダクトコードからは参照されない**。残る参照は `src/logic/riskScoring.test.ts`
のテスト 5 ケースのみ（define 1 + describe 1 + 関数呼び出し 3）。

§13-35 Phase B-2 では「機能変更しない」鉄則のため温存したが、後続タスクで
**関数本体 + テスト 5 ケースをまとめて削除可能**。削除しても build / typecheck /
test に影響なし（テストごと消えるため）。リスクゼロ。

実施タイミング: 別件で `riskScoring.ts` を触る際の「ついで」で
よい。緊急性なし。

---

### `src/components/risk/AllocationSlider.tsx` デッドコード削除

🔲 **未対応（後続タスク）**

どこからも import されていない未使用コンポーネント。ボラのフォールバック定数を直接使っている。

---

### §13-43 候補: `src/components/assessment/` 旧 v1 リスク診断デッドコード整理

🔲 **未対応（後続タスク）**

`src/components/assessment/` 配下の 16 ファイル（`AssessmentResultPage.tsx`,
`StepBasicInfo.tsx` など）と `src/pages/AssessmentPage.tsx` / `PortfolioDiagnosisPage.tsx`
/ `PortfolioDiagnosisResultPage.tsx` は、`App.tsx` の Routes でコメントアウトされ
（L86-88: `// <Route path="/assessment" ... />` など）デッドコード化している。

設計書の文言は「Phase 4 用、現在コメントアウト」だったが、§13-35 Phase B-1 で
詳細版リスク診断（20問）が稼働開始したため、**Phase 4 を待つ必要はなくなった**。
旧 v1 系は完全な不要コードとなる。

実施: フォルダ削除 + import 元（コメントアウト中）削除 + 関連マイグレ
（`001_assessment_tables.sql` の対象テーブル `assessment` 系の扱い）の再整理。
DB テーブルは外部キー参照を確認してから慎重に削除する必要あり。
