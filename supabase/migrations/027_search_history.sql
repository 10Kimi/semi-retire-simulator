-- 027: 検索履歴テーブル
-- 用途: extract_material.py 実行時の検索 KW・ヒット件数・言語を蓄積し、
--       日本語 KW ↔ 英語 KW の対照表作成や素材プールの穴発見に使う。

CREATE TABLE IF NOT EXISTS search_history (
  id            SERIAL      PRIMARY KEY,
  searched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  keywords      TEXT[]      NOT NULL,                          -- 検索キーワード（複数可）
  language      TEXT        NOT NULL CHECK (language IN ('ja', 'en')),
  hit_count     INTEGER     NOT NULL DEFAULT 0,                -- source_materials のヒット件数
  article_theme TEXT,                                          -- 任意: どの記事テーマのために引いたか
  notes         TEXT                                           -- 任意: メモ（「英語素材はスルーされた」等）
);

CREATE INDEX idx_search_history_searched_at ON search_history(searched_at DESC);
CREATE INDEX idx_search_history_language     ON search_history(language);
CREATE INDEX idx_search_history_theme        ON search_history(article_theme);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read search_history"
  ON search_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert search_history"
  ON search_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update search_history"
  ON search_history FOR UPDATE USING (true);
