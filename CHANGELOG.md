# CHANGELOG

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
