# セミリタイア・シミュレーター

## プロジェクト概要
セミリタイアの資金計画をシミュレーションするWebアプリ。
元のExcelシミュレーター（V4.2）をWeb化し、フリーミアムモデルで提供する。
「セミリタイア資産運用パッケージ」の中核プロダクト。

- 本番URL: https://fire.largogk.jp
- パッケージ全体設計書: ../../Docs/設計書_v6_2_main.docx
- パッケージ全体の判断文脈: ../../CLAUDE.md

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
- `src/components/assessment/` — リスク診断系（Phase 4用、現在コメントアウト）
- `src/components/riskSimple/` — 簡易版リスク診断UI
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
- `public/robots.txt`, `public/sitemap.xml` — SEO 基盤
- `supabase/migrations/` — DBマイグレーション（22件。番号衝突あり、TODO参照）

## 制約
- Excel V4.2の計算ロジックを正確に再現すること
- 無料版は計算エンジンをフル提供（出し惜しみしない）
- 有料への導線は「機能制限」ではなく「判断基盤の提供」
- コンサルへの導線は一切ない。ユーザーが全部自分でできる
- 取り崩し優先順位: NISA → iDeCo（60歳以降）→ 課税口座 → 現金

## 現在のフェーズ
- Phase 1-2 完了（無料版シミュレーター + 認証ゲート + コンテンツパイプライン）
- Phase 3 完了（有料ツール群: /portfolio, /ma, /rb + 招待コード基盤）
- **SEO基盤 Phase 1 着手中**（2026-04-23〜）
  - Commit 1 完了（be2fc65）: Puppeteer 自作 prerender + React 19 ネイティブ metadata hoisting + schema.org 構造化データ基盤
  - Commit 2 完了（576f3a9, 2026-04-25）: 匿名シミュレーションログ基盤（`simulation_logs` テーブル + `anonSession.ts` + `simulationLogsDb.ts`）。RLS は INSERT-only / SELECT は service_role のみ、PII 非保存（IP・User-Agent なし、referrer はホスト名のみ）。実計測の配線は Commit 3 以降で実施
  - Commit 3 完了（c702b58〜dffc08f, 2026-04-26）: 信頼性ページ /about /privacy /tokushoho 実装、react-markdown 新規導入、`src/content/legal/` 配下に md 配置、`MarkdownContent.tsx`・`Footer.tsx` 新設、Layout に sticky-footer 組み込み、ヘッダーナビに「運営者について」追加、本文幅 max-w-5xl(1024px)、Google Search Console 認証 meta タグ追加（index.html 直書き）、sitemap.xml に 3 URL 追加 + xmlns タイポ修正（sitemap.org → sitemaps.org）。**Search Console 認証完了 + サイトマップ送信成功（5 URL 検出）**
  - Commit 4 進行中（2026-04-29〜2026-04-30）: リスク許容度診断 LP `/tools/risk` を先行実装（eaf559c〜d09dff3）、その後 4 段階のコンテンツ・デザイン改善を実施（2fcfa79 / 9363a17 / 1c29a75 / 06dc442）。
    - 初版: ヒーロー伊豆背景画像 + 黒オーバーレイ、交互背景セクション、強調ブロック3点（方程式 = bg-gray-900 / 孫子 = bg-emerald-900 / 安心して眠れる夜 = bg-blue-50）、3 InlineCTA、70% スクロールポップアップ
    - コンテンツ更新（2fcfa79）: 新規セクション「投資のつもりで、投機をやっていた」「急がない」（ジョージ・ソロス引用）を追加、「株価下落は避けられない」→「市場から出ない」改題、「孫子 — 己を知り敵を知る」→「己を知る、敵を知る」改題、見出し重複1行を3箇所削除
    - リズム要素追加（9363a17）: 装飾を全 LP で 黄色マーカー 11 + 青下線 6 + 青引用ブロック 3（投資/投機末尾 / 急がない中盤 / 複利末尾） に拡張、grid 内側の余白調整（各カラム space-y-3）
    - 余白調整（1c29a75 / 06dc442）: 全 12 セクションの縦パディングを py-20 md:py-28 → py-12 md:py-20 に縮小、リスト/引用ブロック自身の `my-2` を削除して外枠 `space-y-6 md:space-y-8` に余白制御を一任（L406「あなたが安心して眠れる夜は」のみ末尾で機能しているため維持）
    - `tone_guideline_lp.md` 準拠で本文 2 箇所微修正（「必ず来ます」→「来ます」、末尾「では、また。」削除）。指示書本文の追加要素（「— ジョージ・ソロス」など）は CC が独断追加せず削除
    - 残: `/tools/` ハブ + 残り LP 3本（simulation, age/50s, retirement）
  - Commit 5+: 内部リンク・品質チェック・Lighthouse
- **largogk.jp コーポレートサイト復活**（2026-04-30、設計書 v6.3 §13、別リポジトリ [10Kimi/largogk-corporate](https://github.com/10Kimi/largogk-corporate) として独立構築）: apex `largogk.jp` で合同会社ラルゴ corporate を配信、`/risk /pf /portfolio /ma /rb /tools/risk /about /terms` は `vercel.json` で `https://fire.largogk.jp/*` に 308 redirect。fire 側からは `/privacy` `/tokushoho` を削除し `https://largogk.jp/*.html` への 308 redirect を設置（コミット 17e3760 / a2337af / abe55a8）。Footer 内のリンクは `/privacy` `/tokushoho` 相対パスのまま維持（redirect で連続）
- **老後資産シミュレーション LP 新設**（2026-05-01、SEO Phase 1 Commit 4 の 2 本目 LP）: `/tools/retirement-simulation` を新設（コミット b0e05e3）。「老後資産 シミュレーション」キーワード（SEO 難易度 33・月間 170）狙い、8 セクション構成、装飾 11 箇所（黄色 4 + 青下線 3 + 引用ブロック 4）、§8 STEP 1/2 ブロック構造で `/risk` への送客。ニック・マジューリ・ジョージ・ソロス・橘玲などの引用を含む理論編。続いて CTA に「（無料）」表記を追加 + h2 下マージン拡大 (mb-4 → mb-6 md:mb-8)（コミット accf0a3）
- **LP 余白構造の本格整備とガイドライン v1.0→v1.3 整備**（2026-05-01、`Docs/lp_visual_text_guideline.md` 新規 + 3 回改訂、コミット a1bd444 / 8428fff）: simulation LP / risk LP の本番実機確認で「セクション間余白が空きすぎ」「背景の切り替わりと h2 位置のズレでぶつ切り感」「引用ブロック直後の段落が詰まる」を順次解消。最終的に v1.3 では section に `pt-12 md:pt-20` + 背景色、h2 から `mt-12 md:mt-16` 削除、引用ブロックから `my-2` 削除のパターンに統一。/about（A 型単一 main 構造）と LP（B 型複数 section 構造）の余白制御原則も整理。risk LP の不要な disclaimer「計測結果は投資の推奨ではありません」も削除
- **設計書 v6.5 関連の各種改修**（2026-05-01、4 コミット）:
  - `/tools/risk` LP「資産形成の構造」セクションに**橘玲『お金持ちになれる黄金の羽根の拾い方』の出典を明記**（0a405da）。式の左辺「資産」→「富」（右辺の `資産 × 利回り` は維持）、出典段落追加、「収入はすでにある」→「収入はある程度ある」（ターゲット層 世帯年収1500-4000万への配慮）
  - **ヘッダー モバイル overflow 修正**（4a269ab、設計書 v6.5 §13-12）: 375px viewport で 4 リンクが画面幅を超えていた問題を解消。`< 768px` でハンバーガーメニュー化（lucide-react の Menu / X アイコン使用）、メニュー 5 項目（シミュレーション / リスク診断 / PF診断 / 運営者について / ログイン）、ログインは強調 fill ボタン、ログイン済み時は gray 系ログアウトで色差別化、aria-label / aria-expanded 付与
  - **ヘッダーサービス名変更**（328591d、設計書 v6.5 §3-5 / §13-1 関連）: 「セミリタイア シミュレーター」→「**お金の仕組み化プログラム**」、「Semi-Retire Life & Money Simulator」→「**Wealth Program**」。flagship project 名に統一、ドメインリネーム前の事前整備
  - **`/about` ページ全面リライト**（9040914、設計書 v6.5 §3-4 / §9-3 / §4-3）: リード・経歴・このサイトを始めた理由・伊豆での暮らし・運営方針の 5 セクション構成。本人の実体験（数千万円突っ込んでの狼狽売り、リスク許容度との出会い、伊豆での朝のルーティン）を中心に再構成、`/tools/risk` LP との内容重複を整理（LP は理論、`/about` は人生経験で役割分担）。実装方式を **react-markdown + about.md → JSX 直書き** に変更し `src/content/legal/about.md` を削除。スタイルは v6.5 §4-3 基準（max-w-3xl / leading-loose / h2 mt-12 md:mt-16 / 段落間 space-y-6 md:space-y-8、p 自身に my-* なし）。「心穏やかに平常運行できていること」を黄色マーカーで強調。MarkdownContent.tsx + react-markdown 依存は他箇所での再利用余地として残置（別タスクで整理予定）
- **PF Step 2 完了**（46ef507, 2026-04-25）: リスク超過警告を 2回暴落シナリオに刷新（コロナ級1.7σ・リーマン級2.5σ、20年シミュ、3線チャート）+ `savePfWithSnapshot` で PF診断結果を `risk_gap_snapshots` と同トランザクション保存。`calculateRiskExcessImpact` の単体テストは別コミットで後追い予定
- 次の優先: Phase 3.5（ステップメール + リスク乖離の損失体感UI改善）
- 将来: Phase 4（詳細版リスク診断）

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
移行したため、現在の `PRERENDER_ROUTES` は **3 ルート（`/risk /about /tools/risk`）** のみ。

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
