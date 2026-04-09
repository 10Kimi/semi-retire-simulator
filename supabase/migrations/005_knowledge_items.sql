-- ============================================================
-- Knowledge Items (ナレッジベース)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE knowledge_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',  -- 'youtube' | 'article' | 'book' | 'manual'
  raw_text TEXT,
  essence JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- タグ検索用GINインデックス
CREATE INDEX idx_knowledge_items_tags ON knowledge_items USING GIN (tags);

-- エッセンスのsummary全文検索用
CREATE INDEX idx_knowledge_items_essence ON knowledge_items USING GIN (essence jsonb_path_ops);

ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read knowledge items"
  ON knowledge_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert knowledge items"
  ON knowledge_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update knowledge items"
  ON knowledge_items FOR UPDATE USING (auth.role() = 'authenticated');
