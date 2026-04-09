-- ============================================================
-- 009: RLSポリシー修正
-- published_articles / session_logs / experience_nuggets
-- 2026-03-29
-- ============================================================

-- --------------------------------------------------------
-- 1. published_articles
--    INSERT/UPDATE を認証済みユーザーのみに制限
-- --------------------------------------------------------

DROP POLICY "Anyone can insert published articles" ON published_articles;
CREATE POLICY "Authenticated users can insert published articles"
  ON published_articles FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY "Anyone can update published articles" ON published_articles;
CREATE POLICY "Authenticated users can update published articles"
  ON published_articles FOR UPDATE USING (auth.role() = 'authenticated');

-- --------------------------------------------------------
-- 2. session_logs
--    SELECT/INSERT を認証済みユーザーのみに制限
-- --------------------------------------------------------

DROP POLICY "Anyone can read session logs" ON session_logs;
CREATE POLICY "Authenticated users can read session logs"
  ON session_logs FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY "Anyone can insert session logs" ON session_logs;
CREATE POLICY "Authenticated users can insert session logs"
  ON session_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- --------------------------------------------------------
-- 3. experience_nuggets
--    SELECT/INSERT を認証済みユーザーのみに制限
-- --------------------------------------------------------

DROP POLICY "Anyone can read experience nuggets" ON experience_nuggets;
CREATE POLICY "Authenticated users can read experience nuggets"
  ON experience_nuggets FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY "Anyone can insert experience nuggets" ON experience_nuggets;
CREATE POLICY "Authenticated users can insert experience nuggets"
  ON experience_nuggets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
