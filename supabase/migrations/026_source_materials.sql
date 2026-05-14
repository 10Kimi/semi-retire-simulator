-- ============================================================
-- 026_source_materials.sql
-- 人間が手で投入する長文「掘り下げ素材」の汎用テーブル
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================
-- 用途: Glasp（YouTube transcript）/ ウェブ記事本文 / Kindle ハイライト /
-- 他者の note 記事 など、「人間が手で投入した長文テキスト」を一元蓄積し、
-- note 半自動化パイプライン（content-pipeline/note_generate.py）の
-- Phase 1（素材収集・掘り下げ）で、テーマ関連度を Claude が自動判定して
-- 掘り下げ素材として使う。
--
-- 投入: content-pipeline/import_source.py（ローカル .txt ファイル → INSERT）
-- 参照: content-pipeline/note_pipeline.py phase1_gather()
--
-- 設計方針:
--   - テーマタグは付けない（投入時の手タグ付け不要）。関連付けはランタイムで
--     Claude が判定する
--   - source_type で種別管理。v0.1 は 'youtube' のみ実装。
--     将来 'web_article' / 'kindle_highlight' / 'note_article' を順次追加
--   - 一度投入したら以降は note_generate.py が自動で参照する
--   - RLS は knowledge_items / experience_nuggets と同パターン
-- ============================================================

CREATE TABLE source_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- 種別: 'youtube' / 'web_article' / 'kindle_highlight' / 'note_article' 等
  -- v0.1 は 'youtube' のみ
  source_type TEXT NOT NULL,
  title TEXT NOT NULL,
  -- YouTube ならチャンネル名、記事なら著者名、Kindle なら著者名等
  author_or_channel TEXT,
  -- Kindle ハイライト等で URL が無いケースを許容するため nullable
  url TEXT,
  -- 長文本体: transcript / 記事本文 / ハイライト全文 が入る
  content TEXT NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- URL での重複チェック高速化（部分インデックス: url が NULL でない行のみ対象）
CREATE INDEX idx_source_materials_url
  ON source_materials (url)
  WHERE url IS NOT NULL;

-- 取得日時順での全件取得高速化（Phase 1 の SELECT で使用）
CREATE INDEX idx_source_materials_created_at
  ON source_materials (created_at DESC);

-- 種別絞り込み用（v0.2 以降で 'youtube' 以外の種別が増えたときに使う）
CREATE INDEX idx_source_materials_source_type
  ON source_materials (source_type);

-- RLS（knowledge_items と同パターン）
ALTER TABLE source_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read source materials"
  ON source_materials FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert source materials"
  ON source_materials FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update source materials"
  ON source_materials FOR UPDATE USING (auth.role() = 'authenticated');

-- =============================================
-- 実行後確認 SQL（実行は不要、検証用）:
--
--   SELECT COUNT(*) FROM source_materials;
--   -- 期待: 0（投入前）
--
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'source_materials'
--   ORDER BY ordinal_position;
--
-- 実行後の schema_migrations 履歴記録:
--
--   INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
--   VALUES ('026', 'source_materials', ARRAY[]::text[]);
--
--   ※ 既存マイグレ（023, 024, 025）と同様、schema_migrations への記録は
--     SQL Editor 実行とは別途、手動で行う運用（FI_project 標準）。
-- =============================================
