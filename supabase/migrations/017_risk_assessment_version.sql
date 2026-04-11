-- ============================================================
-- risk_assessment_simple テーブルに version カラムを追加
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

ALTER TABLE risk_assessment_simple
ADD COLUMN IF NOT EXISTS version text DEFAULT 'simple';
