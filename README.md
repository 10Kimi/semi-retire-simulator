# セミリタイア・シミュレーター

セミリタイアの資金計画をシミュレーションする Web アプリ。
リスク許容度 → ポートフォリオ構成 → 想定利回り → セミリタイア到達年数 を一気通貫で提供する。

本番: https://fire.largogk.jp

## 何を解決するか

「根拠のない利回りで積み立て → 暴落で狼狽売り → 計画破綻」を防ぐ。
利回りを願望で置くのではなく、自分のリスク許容度から逆算して決めるための道具群。

## ツール構成

| パス | 内容 | 区分 |
|---|---|---|
| `/` | セミリタイア資産シミュレーター（課税口座・NISA・iDeCo・現金の4資産） | 無料 |
| `/risk` | リスク許容度診断（Capacity + Tolerance） | 無料 |
| `/pf` | ポートフォリオ診断（13資産クラス、リスクレベルとの乖離分析） | 無料 |
| `/portfolio` | PF カスタマイズ ＋ モンテカルロ（1000回試行） | 招待コード制 |
| `/ma` | 月次投資アドバイザー（CAPE・PBR・GSR・モメンタムで積立配分を調整） | 招待コード制 |
| `/rb` | リバランスツール（目標配分との乖離、リバランス計画） | 招待コード制 |
| `/tools` | ツールハブ ＋ SEO ランディングページ群 | 無料 |

有料ツールは招待コード制（Stripe 未導入）。コードは `npm run invite` で発行する。

## 技術スタック

Vite + React + TypeScript / Tailwind CSS / Supabase（認証・DB）/ Vercel（ホスティング）。
グラフは recharts（型の都合でバージョン pin）。SEO 用に Puppeteer ベースの自作 prerender を通す。

## セットアップ

```bash
npm install
npm run dev
```

`.env` に以下が必要。

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

市場データ取得スクリプト（`scripts/market/`）は別途 Python 環境と `.env` を使う。
`scripts/market/.env.example` を参照。

## コマンド

```bash
npm run dev                    # 開発サーバー
npm run build                  # tsc -b + vite build + prerender
npm test                       # vitest run
npm test -- -t "名前"          # テスト名で絞る
npm run lint
npm run invite -- --count 3    # 招待コード発行
```

**型チェックは `npm run build` で行う。** `tsc -b`（project references）を使っており、
`tsc --noEmit` では検出できない型エラーがビルドで出る。

## データベース

Supabase。マイグレーションは `supabase/migrations/`。
**CLI は使わず Supabase SQL Editor で直接適用する運用**のため、コードを deploy する前に
該当するマイグレーションを適用すること（逆順だと保存時にエラーになる）。

## ドキュメント

- [CLAUDE.md](CLAUDE.md) — アーキテクチャの要点・作業履歴・TODO
- [CHANGELOG.md](CHANGELOG.md) — 変更履歴
- `../../Docs/設計書_v7_20_main.md` — パッケージ全体の設計書（最新版）
- `../../Docs/architecture.md` — 設計原則・技術方針
