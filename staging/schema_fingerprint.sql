-- 本番と試験用の public スキーマの作りを比べる（読むだけ。FI_project #137・#138、D-046）
-- 本番と試験用の SQL Editor で同じものを流し、結果を CSV でダウンロードして見比べる。データの中身は読まない（作りだけ）。
-- 1行目（name = '*ALL*'）の md5 が同じなら作りは同じ。違えば2行目以降で、どのテーブルのどの種類が違うかを見る。
-- 種類：1 列（型・NOT NULL）／2 DEFAULT／3 RLS／4 ポリシー（コマンド・PERMISSIVE・ロール・USING・WITH CHECK）／
--       5 インデックス／6 制約（NOT NULL を除く）／7 トリガー／8 権限（anon・authenticated）／
--       9 関数（中身は md5 だけ）／10 ビュー（中身は md5 だけ）。拡張機能が入れた関数は数えない。
-- #138 で広げた（#137 の版は列とポリシー名だけ）。
WITH tb AS (
  SELECT c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
),
items AS (
  SELECT c.table_name::text AS name, '01 columns' AS kind,
         string_agg(c.column_name || ' ' || c.data_type || CASE WHEN c.is_nullable = 'NO' THEN ' not null' ELSE '' END,
                    ', ' ORDER BY c.column_name) AS detail
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name IN (SELECT relname FROM tb)
  GROUP BY c.table_name
  UNION ALL
  SELECT c.table_name::text, '02 defaults',
         string_agg(c.column_name || ' = ' || c.column_default, ', ' ORDER BY c.column_name)
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.column_default IS NOT NULL AND c.table_name IN (SELECT relname FROM tb)
  GROUP BY c.table_name
  UNION ALL
  SELECT relname::text, '03 rls', 'enabled=' || relrowsecurity || ' forced=' || relforcerowsecurity
  FROM tb
  UNION ALL
  SELECT tablename::text, '04 policies',
         string_agg(policyname || ' [' || cmd || ' ' || permissive || ' ' || array_to_string(roles, '+') || ']'
                    || ' using(' || coalesce(qual, '') || ') check(' || coalesce(with_check, '') || ')',
                    ' ; ' ORDER BY policyname)
  FROM pg_policies WHERE schemaname = 'public'
  GROUP BY tablename
  UNION ALL
  SELECT tablename::text, '05 indexes', string_agg(indexdef, ' ; ' ORDER BY indexname)
  FROM pg_indexes WHERE schemaname = 'public'
  GROUP BY tablename
  UNION ALL
  SELECT tb.relname::text, '06 constraints',
         string_agg(co.conname || ': ' || pg_get_constraintdef(co.oid), ' ; ' ORDER BY co.conname)
  FROM pg_constraint co JOIN tb ON tb.oid = co.conrelid
  WHERE co.contype IN ('p', 'u', 'f', 'c', 'x')
  GROUP BY tb.relname
  UNION ALL
  SELECT tb.relname::text, '07 triggers', string_agg(pg_get_triggerdef(t.oid), ' ; ' ORDER BY t.tgname)
  FROM pg_trigger t JOIN tb ON tb.oid = t.tgrelid
  WHERE NOT t.tgisinternal
  GROUP BY tb.relname
  UNION ALL
  SELECT g.table_name::text, '08 grants',
         string_agg(g.grantee || ':' || g.privilege_type, ', ' ORDER BY g.grantee, g.privilege_type)
  FROM information_schema.role_table_grants g
  WHERE g.table_schema = 'public' AND g.grantee IN ('anon', 'authenticated') AND g.table_name IN (SELECT relname FROM tb)
  GROUP BY g.table_name
  UNION ALL
  SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', '09 function',
         md5(pg_get_functiondef(p.oid))
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
  UNION ALL
  SELECT viewname::text, '10 view', md5(definition)
  FROM pg_views WHERE schemaname = 'public'
),
rows AS (
  SELECT '*ALL*' AS name, '00' AS kind,
         md5(string_agg(name || '|' || kind || '|' || md5(detail), ',' ORDER BY name, kind)) AS md5,
         count(*)::text || ' 行、Postgres ' || current_setting('server_version') AS detail
  FROM items
  UNION ALL
  SELECT name, kind, md5(detail), detail FROM items
)
SELECT * FROM rows ORDER BY (name = '*ALL*') DESC, name, kind;
