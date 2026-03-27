-- ============================================================
-- Risk Assessment Simple (簡易版リスク許容度診断)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE risk_assessment_simple (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  capacity_score INTEGER NOT NULL CHECK (capacity_score BETWEEN 1 AND 7),
  tolerance_score INTEGER NOT NULL CHECK (tolerance_score BETWEEN 1 AND 7),
  final_level INTEGER NOT NULL CHECK (final_level BETWEEN 1 AND 7),
  answers JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_risk_assessment_simple_user ON risk_assessment_simple(user_id, created_at DESC);

ALTER TABLE risk_assessment_simple ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own simple assessments"
  ON risk_assessment_simple FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own simple assessments"
  ON risk_assessment_simple FOR INSERT WITH CHECK (auth.uid() = user_id);
