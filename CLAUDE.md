# セミリタイア・シミュレーター

## プロジェクト概要
セミリタイアの資金計画をシミュレーションするWebアプリ。
元のExcelシミュレーター（V4.2）をWeb化し、フリーミアムモデルで提供する。
「セミリタイア資産運用パッケージ」の中核プロダクト。

- 本番URL: https://fire.largogk.jp
- パッケージ全体設計書: ../Docs/semi-retire-package-design-v4_4.docx
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
  - Commit 3 予定: 信頼性ページ（/about, /privacy, /tokushoho）
  - Commit 4 予定: `/tools/` ハブ + 先行LP 3本（simulation, age/50s, retirement）
  - Commit 5+: 内部リンク・品質チェック・Lighthouse
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

⚠️ **暫定停止中**（2026-04-25〜）

Vercel build 環境で `puppeteer.launch()` が Chromium 起動失敗したため、
`vercel.json` で Build Command を `npm run build:spa-only` に切替えて prerender を
一時停止中（commit 377fde2）。

**影響**:
- AI クローラー（ChatGPT/Perplexity 等の JS 非実行エージェント）への prerender
  HTML 配信が無効。検索エンジン SEO（Google/Bing 等の JS 実行クローラー）は
  SPA エントリーで対応できているため影響軽微
- `SEOHead` / `JsonLd` / `robots.txt` / `sitemap.xml` の本体は SPA でも有効

**復旧方針**: `puppeteer` → **`@sparticuz/chromium` + `puppeteer-core`** に置換。
Lambda/Vercel 向けに最適化された軽量 Chromium バイナリで、Vercel build 環境でも
起動可能になる想定。

```ts
// scripts/prerender.ts 改修案
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  args: chromium.args,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
})
```

復旧手順：
1. `npm i -D @sparticuz/chromium puppeteer-core`、`npm uninstall puppeteer`
2. `scripts/prerender.ts` を上記パターンに書き換え
3. `vercel.json` の `buildCommand` を削除（フル `npm run build` に戻す）
4. push → Vercel build で prerender が走ることを確認
5. `dist/risk/index.html` 等に prerender HTML が焼き付くことを確認

タイミング: SEO Phase 1 Commit 3〜4（信頼性ページ・/tools/* LP）の前に対応推奨。
LP を増やす段階で prerender が無いと SEO 戦略の効果が出にくいため。

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
