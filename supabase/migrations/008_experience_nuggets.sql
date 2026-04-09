-- 008: 体験エッセンスの構造化テーブル
-- 掘り起こしセッションから抽出した「きみの体験」を構造化して蓄積
-- knowledge_items（外部素材）とは別に、体験（記事の骨格素材）を管理する

CREATE TABLE experience_nuggets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES session_logs(id),  -- 元セッション
  theme TEXT NOT NULL,                           -- セッションのテーマ
  experience TEXT NOT NULL,                      -- 体験の要約（1〜2文）
  emotion TEXT,                                  -- その時の感情
  use_as TEXT NOT NULL,                          -- 記事でどう使えるか
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_experience_nuggets_tags ON experience_nuggets USING GIN (tags);
CREATE INDEX idx_experience_nuggets_theme ON experience_nuggets(theme);
CREATE INDEX idx_experience_nuggets_session ON experience_nuggets(session_id);

ALTER TABLE experience_nuggets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read experience nuggets"
  ON experience_nuggets FOR SELECT USING (true);
CREATE POLICY "Anyone can insert experience nuggets"
  ON experience_nuggets FOR INSERT WITH CHECK (true);
