-- ============================================================
-- Session Logs (掘り起こしセッション履歴)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE session_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_type TEXT NOT NULL,       -- 'note' | 'x'
  theme TEXT NOT NULL,
  angle TEXT,
  conversation JSONB NOT NULL,      -- [{role, content}, ...]
  copied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_session_logs_theme ON session_logs(theme, created_at DESC);

ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read session logs"
  ON session_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert session logs"
  ON session_logs FOR INSERT WITH CHECK (true);
