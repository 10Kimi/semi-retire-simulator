-- 007: 完成記事の蓄積テーブル（noteの公開済み記事）
-- 用途: 文体の正解例参照、テーマ重複回避、スキ数による「刺さるテーマ」分析

CREATE TABLE published_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id TEXT UNIQUE NOT NULL,             -- noteの記事ID（重複防止キー）
  note_url TEXT NOT NULL,                   -- 記事URL
  title TEXT NOT NULL,
  body TEXT,                                -- 記事本文（プレーンテキスト）
  theme TEXT,                               -- session_logsのthemeと紐付け用（手動）
  published_at TIMESTAMPTZ,                 -- note上の公開日
  like_count INTEGER DEFAULT 0,             -- スキ数
  like_count_updated_at TIMESTAMPTZ,        -- スキ数の最終更新日時
  word_count INTEGER,                       -- 文字数
  tags TEXT[] DEFAULT '{}',                 -- noteのタグ
  session_id UUID REFERENCES session_logs(id), -- 元セッションへのリンク（nullable）
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_published_articles_theme ON published_articles(theme);
CREATE INDEX idx_published_articles_published ON published_articles(published_at DESC);
CREATE INDEX idx_published_articles_likes ON published_articles(like_count DESC);

ALTER TABLE published_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read published articles"
  ON published_articles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert published articles"
  ON published_articles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update published articles"
  ON published_articles FOR UPDATE USING (true);
