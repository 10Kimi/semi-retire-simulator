# セミリタイア・シミュレーター

## プロジェクト概要
セミリタイアの資金計画をシミュレーションするWebアプリ。
元のExcelシミュレーター（V4.2）をWeb化し、フリーミアムモデルで提供する。
「セミリタイア資産運用パッケージ」の中核プロダクト。

- 本番URL: https://fire.largogk.jp
- パッケージ全体設計書: ../../Docs/設計書_v7_20_main.md（最新版。過去版は ../../Docs/archive/）
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
- 再設定＝`/reset-password`、ログイン中の変更＝`PasswordChangeModal`（ともに `updateUser({password})`）
- Supabase クライアントは `flowType: 'implicit'`（デフォルト）。リカバリのトークンは URL ハッシュで戻る

### 有料ゲート
`PremiumGate` が `profiles.is_premium` を見る（`/ma` `/rb` `/portfolio`）。
付与は招待コード（`lib/inviteDb.ts` が `invite_codes` を使用済みにして `profiles` を upsert）。
**パスワードは `auth.users`、有料状態は `profiles` と別テーブル**なので、パスワード変更で有料状態は失われない。

### 計算ロジックの置き場
- `src/logic/` — 診断・シミュレーション（`simulator` / `riskScoring` / `riskDetailScoring` / `pfSimple` / `monteCarlo`）
- `src/lib/ma/`, `src/lib/rb/` — ツール単位で `logic` / `types` / `db` を1セット

DB 層は `rowToSettings` / `settingsToRow` でフラットな行と入れ子の型を相互変換する。
**カラムを足すときは types・db の両方＋テストのフィクスチャを直す**（片方だけだと `tsc -b` が落ちる）。

### `/ma` の設計原則
「税制優遇枠は満額／タイミング調整は課税口座で／自分が買ってる指数で割高感を測る」。
- `logic.ts` の `NISA_SLOT_COUNT=2` により slot1/2（NISA）は補正・待機投入の対象外＝満額固定
- iDeCo/401k は `ideco_amount` で予算から差し引くだけで配分対象外
  （掛金は年1回しか変更できず、商品ラインナップも運営管理機関ごとに異なるため）
- スロット金額は 1 万円単位に丸められる（テストの期待値を書くときに注意）

### マイグレーション
`supabase/migrations/`（〜037）。**CLI は使わず Supabase SQL Editor で直接適用する。**
コード側を push する前に適用すること（逆順だと保存時にエラーになる）。

---

## ターゲット像
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
- `src/pages/` — ページ単位コンポーネント（6ページ稼働中）
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
  - **cron（2026-06-23 追加、2026-07-27 `--fetch-only` 追加）**: 毎月 1・15 日 9:00 に自動実行（≒隔週）。crontab 行は `cd <dir> && set -a && . ./.env && set +a && .venv/bin/python fetch_indicators.py --fetch-only >> cron.log 2>&1`。ローカル cron なので Mac 起動時のみ走る。ログは `scripts/market/cron.log`
  - **2026-07-27 修正**: `gold_silver_ratio` に `-0.5`（過去の壊れた値）が残り `/ma` が異常値を自動補完していた問題を再取得で解消（→68.4, 適正）。同時に openpyxl 未導入で PBR がずっと取得失敗していたのを requirements に追加して解消（→1.8）。`/ma` の「自動取得済み」ブロックに CAPE/PBR/金銀比率の数値＋20日超で⚠️警告を表示するUIも追加（`MonthlyAdvisorPage.tsx`）
  - **gotcha**: プロジェクトを `~/semi-retire-app` → 現パスへ移動した影響で `.venv/bin/pip` の shebang が旧パス参照で壊れている。pip 操作は `.venv/bin/python -m pip ...` で回避（python 本体は動作する）
- `public/robots.txt`, `public/sitemap.xml` — SEO 基盤
- `supabase/migrations/` — DBマイグレーション（〜035。番号衝突あり、TODO参照。適用は SQL Editor 直接。032〜035 は /ma 拡張）

## 制約
- Excel V4.2の計算ロジックを正確に再現すること
- 無料版は計算エンジンをフル提供（出し惜しみしない）
- 有料への導線は「機能制限」ではなく「判断基盤の提供」
- コンサルへの導線は一切ない。ユーザーが全部自分でできる
- 取り崩し優先順位: NISA → iDeCo（60歳以降）→ 課税口座 → 現金

## 現在のフェーズ
- Phase 1-2 完了（無料版シミュレーター + 認証ゲート + コンテンツパイプライン）
- Phase 3 完了（有料ツール群: /portfolio, /ma, /rb + 招待コード基盤）
- **SEO基盤 Phase 1 / LP 群の詳細（2026-04〜05）** → [Docs/phase-history-2026H1.md](Docs/phase-history-2026H1.md) に退避
- **PF診断〜最適PFの一本化 + データ品質修正 完了**（2026-06-21、semi-retire-app 6 commit + FI_project 2 commit + SQL Editor 適用）:
  - **PF診断ラベル修正**（`4bc7857`）: PF診断結果のスコア表示ラベル「あなたのリスク許容度（簡易診断結果）」→「あなたのリスク許容度」。`PfDiagnosisSimplePage.tsx:172` の 1 行のみ
  - **PF診断 → /portfolio 導線追加**（`54c3ea3` match / `3a62545` pf_lower）: ギャップ分析で `gapType==='match'`（合っている）と `'pf_lower'`（保守的すぎ）の場合に「ポートフォリオを最適化する」CTA（`<a href="/portfolio">`、薄緑/黄でケース別配色）を追加。`/portfolio` は `PremiumGate` で有料・招待制のため、無料ユーザーには 🔒 招待画面が出る**アップセル導線**として意図的に設置。`pf_higher` は既存 `RiskExcessWarning`（暴落シミュ + 調整導線）を維持。リスクレベルは `/portfolio` 側が DB から取得するため素リンクで OK
  - **最適PF再設計**（`9b6f7b6`、`scripts/optimize_portfolios.py`）: 旧実装は「5アセット以上・乱択200試行・vol帯下限張り付き」で 8〜9 資産に分散しがちだった。**①上限5資産（サイズ2〜5の部分集合を総当たり）②vol目標を実効上限の90%（上部帯狙い）③新興債≤25%・新興株≤50%（全レベル）④Lv7 のみ新興株≤65%・新興REIT≤15%・最低4資産・vol下限20%（VOL_UPPER[7]=50 はセンチネルで実効上限24%を採用しても0.9×24=21.6%が到達不能なため）⑤--apply 無しは dry-run** に刷新。検証で「分散はLv4で5資産が頭打ち（9資産はシャープ+0.006のみ）」を実測した上での設計判断
  - **optimal_portfolios テーブル更新**（SQL Editor 直接適用、7 レベル upsert）: 上記の確定配分を反映。vol が帯上部へ・資産数すっきり5以下・Lv4 の新興債40%偏重も解消
  - **MODEL_ALLOCATIONS/MODEL_META を一本化**（`687ba68`、`src/lib/rb/types.ts`）: 初期表示用のハードコード配分を optimal_portfolios の確定値と一致させ、`/risk`（無料・RiskResultDisplay）/ `/portfolio` 初期表示 / `/rb` プリセット の値ズレを解消。MODEL_META の期待リターン/ボラ/シャープも同一PFの計算結果に同期（旧 MODEL_META のシャープ Lv1=0.75 等は根拠不明だった）
  - **「理論上の最適PF」ボタン→「初期配分に戻す」**（`833ebcb`、`PortfolioCustomizePage.tsx`）: 一本化で初期表示=optimal_portfolios になり DB フェッチボタンが同値を返すだけになったため、同期で MODEL_ALLOCATIONS を復元するリセットボタンに変更。不要な `supabase` import / `optimalLoading` state を削除
  - **日本株ボラ逆転バグ修正**（FI_project `50a65ce`、`content-pipeline/fetch_volatility.py`）: PF診断で「日本株+現金=Lv5、米国株+現金=Lv3」と逆転していた根本原因は、`asset_class_params.japan_equity.volatility=27.40%`（全資産で最大という異常値）。1306.T(TOPIX ETF)の **2026-03 10:1株式分割が Yahoo データで未調整のまま -91% の偽月次リターンとして混入**し、年率ボラを ~17%→27.4% に押し上げていた（`auto_adjust=True` でも未補正）。月次±50%超を分割等の価格不連続とみなして除外する `clean_monthly_returns` を追加し、vol と相関の両方をクリーンに再計算。再実行で japan_equity vol 16.96% に正常化、両ケースとも Lv3 に収束（cron 毎月1日も以後クリーン）
  - **期待リターンを全13資産GPIFベースに統一**（FI_project `9b7a97e`、同スクリプト）: 従来は GPIF4資産以外が Yahoo 実現リターンにフォールバックし gold 13.4%・emerging_equity 16.1%・developed_reit 11.5% 等が過大だった。`GPIF_EXPECTED_RETURNS` を全13資産に拡張し `optimize_portfolios.py` の RETURNS と一致させ、診断の期待リターンと最適PF/モデル配分の前提を整合（ボラは引き続き Yahoo 実績、リターンのみ前向き推計）
- **/portfolio 金額入力 + /tools 招待コード導線 + 現PF vs 最適配分の比較**（2026-07-07〜08、設計書 v7.15〜v7.16、3 commit）:
  - **金額入力**（`1d77a06`）: アセット配分を %／金額で切替可能に（金額→自動%換算、合計額をモンテカルロ初期資産へ反映）。金額モードは 'cash' を activeKeys に含め、余剰現金の入力を促す
  - **/tools 招待コード導線**（`11701fa`, `ToolsHubPage.tsx`）: 有料ロックカードのモーダルから招待コード入力（ログイン済→`InviteCodeModal`、未ログイン→トップ誘導）、成功で is_premium refresh し全ツール解放
  - **現PF vs 最適配分の比較 + MC比較**（`3a2dbd0`, `PortfolioCustomizePage.tsx`）: ボタン「初期配分に戻す」→「**最適配分に戻す**」に改称。分析結果に「今の配分／最適配分（`MODEL_ALLOCATIONS[baseLevel]`）」の指標比較（期待リターン・ボラ・シャープ）を並記。最適の指標は `MODEL_META` の生値ではなく現PFと同じ `calcExpectedReturn`/`calcVolatility` で算出し同一基準に。モンテカルロも最適配分で同条件実行し 3シナリオ＋中央値差を並記（`mcOptimalResult` state 追加、表示は `mcResult && mcOptimalResult` でゲート）。未使用化した `getRiskLevelDef` import 削除。tsc 0エラー・vite build 成功
- **/portfolio 金額モードの最適配分 + 比較左列の出し分け**（2026-07-10〜11、設計書 v7.17、`PortfolioCustomizePage.tsx`、4 commit）:
  - **金額モードで「最適配分にする／戻す」を機能**（`f8fc558`）: 従来は金額入力時にボタンを押すと `amounts` が消え %モードへ飛ぶだけだった。金額モードでは**保有総額を維持したまま最適配分（`MODEL_ALLOCATIONS[baseLevel]`）の比率で各アセット金額に再割り当て**（丸め誤差は最大配分アセットで吸収し合計を厳密一致）。ボタン文言は `amountOptimalApplied` で未適用「最適配分にする」／適用後「最適配分に戻す」を出し分け
  - **tsc -b 型エラー修正**（`0a0edd1`）: `reduce` の string キーで `Record<AssetClassKey,number>` を添字アクセスし TS7053 で Vercel ビルド失敗。`newKeys` を `AssetClassKey[]` 型に。**教訓＝このリポは `tsc -b`（project references、`tsc --noEmit` より厳格）を使うので確認は `npm run build` で行う**
  - **比較左列を保有PF/調整後で出し分け**（`f9dd2f8`→`0b8ec1d`）: `heldWeights` スナップショットを保持し、「最適配分にする」で入力欄を最適に置換しても比較の左列は保有PFのまま。金額を編集するとスナップショット破棄→以降は `調整後 vs 最適配分`（※この weights スナップショット方式は下記 v7.18 で `heldAmounts`＋カードに作り直し）
- **/portfolio 保有PFデータ化＋明示カード＋3列比較＋DB化**（2026-07-11〜12、設計書 v7.18、`PortfolioCustomizePage.tsx`、5 commit）:
  - **保有PFを編集可能データ化＋明示カード＋すり替わりバグ修正**（`7d5d048`）: 状態モデルを `heldAmounts`（保有PF金額スナップショット）＋`editingHeld`＋`adjustedOptimal` に作り直し。折りたたみ式📌保有中のPFカード（内訳・合計・4指標・「✏️修正」で入力欄へ復元）を新設。**バグ根治**＝「最適配分に戻す」2度押しで保有PFが最適にすり替わる不具合を、入力欄が保有PFを表す `editingHeld` のときだけ撮り直す方式で解消。以降は入力欄で書き換え→分析で保有PF更新（＝将来のデータ修正）。カード指標追加`9ebefc0`／開閉式`1802273`
  - **比較表を3列に**（`42900c8`）: 調整後があるとき（保有PFあり＋調整済み）は「保有中／調整後／最適配分」の3列で並列表示。未調整時は2列
  - **ボラ計算のDB化**（`b11adbc`）: 従来 /portfolio だけ古いフォールバック定数（米国株ボラ20%等）を直接使い 2026-06 補正済みDB値（米国株16.58%等）とズレて vol・Lv が過大だった（同PFで 9.2%/Lv4→DB値なら約8.1%/Lv3）。`/pf` と同じ `loadAssetClassParams()` でDB取得し `calcVolatility`/`calcExpectedReturn`/`computeResult`/`optimal`/`heldInfo` に `MarketParams` を渡す方式に。取得失敗時のみフォールバック。保有中・調整後・最適の全列がDB基準になり `/pf` と一致
  - **残TODO**: `MODEL_META`（types.ts）は /risk・/rb で静的表示され毎月cronのDB更新と乖離しうる（別途 optimize_portfolios.py 再実行で再同期）。`AllocationSlider.tsx` はフォールバック直だが未使用デッドコード
- **/risk「このPFを採用する」ボタン ＋ 採用PF＝全ツールのアンカー確定**（2026-07-14、設計書 v7.19、semi-retire-app 1 commit `98534b5`・push 済み）:
  - **採用ボタン**（`RiskResultDisplay.tsx` のみ、+54/-8）: /risk 診断結果のモデル配分カード直下に「このPFを採用する」を新設。タップで `MODEL_ALLOCATIONS[finalLevel]` を `saveTargetAllocation` で `user_rb_settings`（＝/rb が `fetchTargetAllocation` で自動読み込みする目標配分）に保存。採用後は「✓ 採用しました。あなたの目標配分に設定されました」＋次の一歩（口座別リバランス）のテキスト案内のみ（**A案・最小**、/rb への hard CTA は「順番が飛ぶ」ため撤去）。`useAuth()` の user で保存し未ログイン時はボタン無効。`npm run build`（tsc -b + vite + prerender）通過。これで「診断→最適PF→ワンタップ採用（＝目標配分アンカー生成）」が一本化
  - **ツールのライフサイクル確定**: 初回移行リバランス＝口座別ワークシート（講座配布物・Google Sheet）／普段の積立（毎月）＝/ma／定期リバランス（6ヶ月〜1年に一度）＝/rb
  - **「採用PF＝全ツールのアンカー」構想＝採用（Yes）**。大半は実現済み（採用＝保存、/rb が参照）。唯一の新規候補「**/ma の積立リバランス**（採用PFを読んで積立を不足アセットに寄せる／ノーセル・リバランス）」の go/no-go は**実践4-2（維持リバランス）の脚本着手時にレビュー確定**（脚本と機能の一致が必須＝棚上げ防止トリガー）。/ma は現状 holdings も target も読まず指標＋積立設定のみのため、実装するなら現在保有の配管が要る
- **/ma 月次投資アドバイザーの大改修**（2026-07-27、semi-retire-app 6 commit＋migration 032〜035・全 push 済み）: `src/lib/ma/*` と `MonthlyAdvisorPage.tsx` が中心。
  - **指標取得の信頼性修正**（`2cf1424`）: `indicators.gold_silver_ratio` に過去の壊れた値 `-0.5` が残り /ma が異常補完していたのを再取得で解消（→68.4）。`openpyxl` 未導入で TOPIX PBR がずっと取得失敗していたのを `scripts/market/requirements.txt` に openpyxl/lxml 追加で解消（→1.8）。`fetch_indicators.py` は `--fetch-only` 必須（無いと `serve_and_open` の HTTP サーバーで永久ハング）を明記＋crontab 修正。「自動取得済み」ブロックに CAPE/PBR/金銀比率の数値＋20日超で⚠️表示を追加
  - **積立スロット 5→7（特定口座 3→5）**（`a8ede6a`、migration 032）: slot6/7 追加。`SLOT_KEYS`/`slots` 配列/`_row`/`UpdatePatch` を7スロット対応
  - **バリュエーション調整を特定口座オンリー・NISA枠は満額固定**（`e0f1aab`）: `logic.ts` の `NISA_SLOT_COUNT=2` で slot1/2(NISA)は係数・mode・待機投入の対象外＝満額。税制優遇枠は満額が確実に有利という原則（iDeCo/401k も同様）。UIに「満額」バッジ＋注記
  - **日本株の指標を TOPIX / 日経225 で選択**（`11aacef`、migration 033）: `UserMaSettings.jp_index`。`PBR_THRESHOLDS[jpIndex]`（TOPIX 割高≥1.8 / 日経225 割高≥2.0）。TOPIX は自動取得、日経225 は日経公式が自動取得不可のため手入力
  - **日経225 PBR の近似オートフィル**（`ce3c1e7`、migration 034）: 実測PBRを一度「基準」入力→以降は既取得の日経225株価で `estimateNikkeiPbr = 基準PBR × 現在株価/基準時株価`。`nikkei_pbr_anchor`/`nikkei_price_anchor` に保存、数ヶ月ごと再基準
  - **待機資金は同月内は最後の実行で上書き**（`03fe4e6`、migration 035）: `reserve_month`/`reserve_month_base`（月初base）を記録し `resolveReserveBase()` で同月再実行時は base から計算＝二重加算しない。カレンダー月境界。翌月は現残高が新base
  - **設計の芯**: 「税制優遇枠は満額／タイミング調整は課税口座で／自分が買ってる指数で割高感を測る」。講座コンテンツの骨子にもなる。テストは `logic.test.ts` 37件パス
- **認証まわりの不具合修正 ＋ リポジトリ整理**（2026-08-03、semi-retire-app 6 commit・全 push 済み）:
  - **パスワードリセットが完了できずループする問題を修正**（`accdc9e`）: `resetPasswordForEmail` の `redirectTo` が `window.location.origin`（＝トップ）で、しかも新パスワードを設定する画面自体が存在しなかった。未ログインのトップはログイン画面のため「忘れた方→メール→リンク→ログイン画面」を無限に繰り返す状態だった。`ResetPasswordPage.tsx` を新設（`/reset-password`）し、implicit フローで戻るリカバリセッション（`PASSWORD_RECOVERY`）を待って `updateUser({password})` で再設定。リンク期限切れ／使用済みは専用メッセージで案内。ルートは**未ログイン・メール未確認・ログイン済みの3分岐すべて**に登録（リカバリ時にセッションが張られるかで到達分岐が変わるため）。Supabase の Redirect URLs は既存の `fire.largogk.jp/**` でカバー済み（追加設定は不要だった）
  - **ログイン中のパスワード変更画面を追加**（`61cf592`）: 変更手段がリセットメールしかなく、リカバリリンクでログインした人は「ログインできたがパスワードは分からない」まま、もう一度メールを発行する往復が必要だった。`PasswordChangeModal.tsx` を新設し `UserStatusBar` のログアウト横に導線（`Layout` 経由で全ページ）。**現在のパスワードは要求しない**——リカバリ直後は本人が現在のパスワードを知らないため、要求すると変更できず同じ往復に戻る。厳格化する場合は Supabase 側の Secure password change を有効にすればこの画面はエラー表示で対応する。パスワードは `auth.users`、有料状態は `profiles.is_premium` と別テーブルのため、**変更しても招待コードで付与した有料状態は維持される**
  - **招待コード生成スクリプトを追跡対象に**（`724e714`）: `scripts/generate-invite-code.ts` は有料ツールの招待コード発行の唯一の手段だが git 未追跡でローカルにしか存在しなかった。追跡し `npm run invite -- --count N` で実行できるよう `package.json` に追加。キーは `scripts/market/.env`（gitignore 済み）から読むためスクリプト本体に秘密は含まない
  - **/ma の待機資金ラベルから iBond 表記を削除**（`12bee19`）: 「待機資金残高（iBond）」「今月の待機分 → iBond」は運営者個人の運用先で一般ユーザーには当てはまらないため汎用表現に変更
  - **未追跡ファイルの整理**（`e359e5c` / `d451720`）: `__pycache__` と `scripts/market/indicators.json`（`fetch_indicators.py` の生成物）を gitignore、`Docs/lp_draft_age50s_v1.md` を追跡（CHANGELOG:295・CLAUDE.md:90 に「ドラフト保管」と書かれているのに未追跡だった）、`src/content/legal/privacy.md` を物理削除（CHANGELOG:661 で削除済みのローカル残骸。`/privacy` は `vercel.json` で largogk.jp へリダイレクトしており正本ではない。`tokushoho.md` と同じ処理）。これで `git status` はクリーン
- 次の優先: Phase 3.5（ステップメール + リスク乖離の損失体感UI改善）

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

実施タイミング: Phase 3.5 の合間や、別件で `riskScoring.ts` を触る際の「ついで」で
よい。緊急性なし。

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
