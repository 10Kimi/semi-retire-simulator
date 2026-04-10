# CHANGELOG

## 2026-04-10 — リバランスツール（/rb）+ MFエクセル取り込み

### 追加
- **/rb リバランスツール（Phase 1）**: 11アセットクラス別残高入力、目標配分設定（リスクレベル別プリセット）、乖離表示（色分け付き）、調整計算（積立追加/売却ありモード）
  - ページ: `src/pages/RebalancePage.tsx`
  - ロジック: `src/lib/rb/logic.ts` — calculateDeviation, calculateAddAdjustment, calculateSellAdjustment
  - DB層: `src/lib/rb/db.ts` — 目標配分・スナップショットCRUD + fund_master検索 + 登録リクエスト送信
  - 型定義: `src/lib/rb/types.ts` — 11アセットクラス、モデル配分プリセット（Lv1〜5）
  - テスト: `src/lib/rb/logic.test.ts`（8件パス）
  - マイグレーション: `supabase/migrations/011_rebalance_tool.sql`（user_rb_settings, rb_snapshots + RLS）
- **MFエクセル取り込み（Phase 2）**: MoneyForwardエクスポートExcelからアセットクラス別に自動集計
  - 解析: `src/lib/rb/mfParser.ts` — ブラウザ側でSheetJSによる解析（サーバーにアップロードしない）
  - 按分: `src/lib/rb/allocator.ts` — fund_masterに基づく自動振り分け（銘柄名完全一致→ticker完全一致→未分類）
  - テスト: `src/lib/rb/allocator.test.ts`（8件パス）
  - UI: `src/components/rb/MfImportFlow.tsx` — ファイル選択→プレビュー→未分類手動振り分け→確定保存
  - マイグレーション: `supabase/migrations/012_fund_master.sql`（fund_master, fund_master_requests + RLS）
  - 初期データ: `supabase/migrations/013_fund_master_seed.sql`（投資信託16本・ETF6本・個別株18銘柄）
  - 未登録銘柄の登録リクエスト送信機能（fund_master_requests）
- **共通UserStatusBar**: `src/components/UserStatusBar.tsx` — ログイン状態表示を全ページで統一（light/darkバリアント）
- **ニックネーム取得モーダル**: `src/components/NicknameModal.tsx` — /risk結果表示時にfull_name未設定ユーザーへ任意取得

### 変更
- `src/App.tsx`: `/rb` ルート追加、`/ma` を認証済み+メール確認済みユーザーのみに変更
- `src/components/Layout.tsx`: UserStatusBarに差し替え
- `src/pages/MonthlyAdvisorPage.tsx`: ヘッダーにUserStatusBar追加
- `src/pages/RiskSimplePage.tsx`: 結果表示時にNicknameModal表示
- `src/components/auth/RegisterForm.tsx`: 名前入力フィールド削除（メールのみで登録）

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
