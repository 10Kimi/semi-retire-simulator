-- ============================================================
-- 043: 作業用テーブル（note・X のパイプライン用）をサービスロールだけにする（FI_project #45）
-- アプリからは使っていない。パイプラインはサービスロールのキーで読み書きする
-- Apply: the owner runs `npx supabase db push --remote --yes` after approving the SQL
-- ============================================================

-- 名前の違うポリシー（ダッシュボードで足したもの）も残さないよう、対象テーブルのポリシーをすべて外す。
-- RLS は有効のままなので、ポリシーが無ければ anon・authenticated は読めない・書けない
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'session_logs',
        'search_history',
        'published_articles',
        'experience_nuggets',
        'knowledge_items',
        'source_materials'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END;
$$;

ALTER TABLE session_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_nuggets ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_materials   ENABLE ROW LEVEL SECURITY;
