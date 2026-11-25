-- 本番と試験用の public スキーマの作りを比べる（読むだけ。FI_project #137、D-046）
-- 本番と試験用の SQL Editor で同じものを流し、結果を見比べる。データの中身は読まない（列の名前と型だけ）。
-- 1行目（table_name = '*ALL*'）の md5 が同じなら作りは同じ。違えば2行目以降で、どのテーブルが違うかを見る。
WITH t AS (
  SELECT c.table_name,
         string_agg(c.column_name || ' ' || c.data_type || CASE WHEN c.is_nullable = 'NO' THEN ' not null' ELSE '' END,
                    ', ' ORDER BY c.column_name) AS cols
  FROM information_schema.columns c
  JOIN information_schema.tables tb
    ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
  WHERE c.table_schema = 'public'
  GROUP BY c.table_name
),
p AS (
  SELECT tablename AS table_name,
         string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname) AS policies
  FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename
),
r AS (
  SELECT t.table_name, md5(t.cols || '|' || coalesce(p.policies, '')) AS md5, t.cols, coalesce(p.policies, '') AS policies
  FROM t LEFT JOIN p USING (table_name)
)
SELECT '*ALL*' AS table_name, md5(string_agg(table_name || md5, ',' ORDER BY table_name)) AS md5,
       count(*)::text AS cols, '' AS policies
FROM r
UNION ALL
SELECT * FROM (SELECT * FROM r ORDER BY table_name) x;
