-- =============================================
-- 025_remove_simple_and_align_assessment_source.sql
--
-- §13-35 簡易診断削除タスク Phase B-1
-- 詳細診断（20問）一本化に伴うデータ整理
--
-- 1. risk_assessment_simple から version='simple' のレコードを削除
--    （Phase A 確認: 6 件）
-- 2. risk_gap_snapshots の既存 'simple' レコードを 'detailed' に UPDATE
--    （Phase A 後 SQL ④' 確認: 'simple' 25 件 / 'detailed' 0 件）
--
-- 背景:
--    PfDiagnosisSimplePage.tsx:110 の固定値バグにより、
--    詳細診断ユーザーの PF 診断スナップショットも 'simple' で記録されていた。
--    詳細一本化後は assessmentId を持つユーザーは必ず詳細診断ユーザーになるため、
--    既存 25 件はすべて 'detailed' に整合させる。
--    書き込み元コード（PfDiagnosisSimplePage.tsx:110）も同フェーズで
--    'detailed' 固定に修正済み（B1-X）。
--
-- 注意:
--    risk_assessment_simple.version カラム自体は削除しない。
--    過去ユーザー誘導ロジック（B1-4 強制リダイレクト UI）で
--    'detail' を持つユーザーかどうかの判定に使うため。
-- =============================================

-- ステップ1: 簡易診断レコード削除
DELETE FROM risk_assessment_simple WHERE version = 'simple';

-- ステップ2: PF 診断スナップショットの assessment_source を整合させる
UPDATE risk_gap_snapshots
SET assessment_source = 'detailed'
WHERE assessment_source = 'simple';

-- =============================================
-- 実行後確認 SQL（実行は不要、結果検証用）
--
--   SELECT version, COUNT(*) FROM risk_assessment_simple GROUP BY version;
--   -- 期待: 'simple' 行が消え、'detail' のみ残る
--
--   SELECT assessment_source, COUNT(*) FROM risk_gap_snapshots GROUP BY assessment_source;
--   -- 期待: 'simple' 0 件 / 'detailed' 25 件
--
-- 実行後の schema_migrations 履歴記録（Docs/migration-repair-planA.md 参照）:
--
--   INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
--   VALUES ('025', 'remove_simple_and_align_assessment_source', ARRAY[]::text[]);
--
--   ※ 既存マイグレファイル（023, 024）と同様、schema_migrations への記録は
--     SQL Editor 実行とは別途、手動で行う運用。
-- =============================================
