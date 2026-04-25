# CHANGELOG

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
