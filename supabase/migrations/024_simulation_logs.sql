-- ============================================================
-- 024: 匿名シミュレーションログ（SEO 計測基盤）
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================
-- 用途: 各ツール（/risk, /pf, /portfolio, /ma, /rb, /tools/* 等）の
-- 利用状況を匿名で記録し、SEO 流入導線・コンバージョンの分析に使う。
--
-- プライバシー設計:
-- - IP アドレス・User-Agent は保存しない（クライアントから送らない）
-- - anon_session_id は localStorage に保存される UUID v4 のみ。
--   ブラウザストレージ削除でリセット可能。個人特定情報を含まない
-- - referrer_host はホスト名のみ（クエリ文字列・パスを含まない）
--
-- RLS 設計:
-- - INSERT: anon キー（未ログインのブラウザ含む）から書き込み可能
-- - SELECT/UPDATE/DELETE: ポリシー無し = anon/authenticated は全拒否
-- - 集計・閲覧は service_role キー（サーバーサイド・管理ダッシュボード）のみ可能
-- ============================================================

CREATE TABLE simulation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- 匿名セッションID（localStorage 由来の UUID v4）
  anon_session_id UUID NOT NULL,
  -- ツールパス（'/risk', '/pf', '/tools/simulation' 等）
  tool_path TEXT NOT NULL,
  -- イベント種別（'page_view', 'simulation_complete', 'cta_click' 等を想定。
  -- 自由記述で運用しつつ、後続コミットで集計時に絞り込む）
  event_type TEXT NOT NULL,
  -- ツール固有の入出力サマリ等。匿名化済み数値・カテゴリのみ格納すること
  payload JSONB,
  -- 流入元ホスト名のみ（クライアント側で URL.hostname 抽出済み）。
  -- フルURLやクエリ文字列は含まない（検索クエリ漏洩防止）
  referrer_host TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- セッション単位の導線分析用
CREATE INDEX idx_simulation_logs_session ON simulation_logs(anon_session_id, created_at DESC);
-- ツール別・期間別集計用
CREATE INDEX idx_simulation_logs_path_created ON simulation_logs(tool_path, created_at DESC);
-- イベント別集計用
CREATE INDEX idx_simulation_logs_event_created ON simulation_logs(event_type, created_at DESC);

-- RLS 有効化
ALTER TABLE simulation_logs ENABLE ROW LEVEL SECURITY;

-- INSERT: 匿名・認証済みを問わず誰でも記録できる
CREATE POLICY "Anyone can insert simulation logs"
  ON simulation_logs FOR INSERT WITH CHECK (true);

-- SELECT/UPDATE/DELETE は明示ポリシー無し
-- → anon キー・authenticated キーから読み取り不可
-- → service_role キー（RLS バイパス）からのみ閲覧・集計可能
