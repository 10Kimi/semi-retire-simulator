# マイグレーション番号衝突修復手順書（案A' 改訂版）

> **改訂履歴**
> - 初版（案A）: schema_migrations 011 = rebalance_tool 前提で起案
> - 案A' 改訂版（本版）: 実際の schema_migrations 011 は risk_gap_snapshots であることが事前確認 SQL で判明したため、Phase 2 を DELETE + INSERT 方式に修正。Phase 1 / Phase 3 / 完了後検証はそのまま流用

---

## 1. 背景と修復方針

### 現状の問題

#### ローカルマイグレーションファイル

| 種別 | ファイル | 内容 |
|---|---|---|
| ❌ 未tracked・番号衝突 | `011_risk_gap_snapshots.sql` | `risk_gap_snapshots` テーブル + `save_pf_with_snapshot` RPC + `risk_level_5_to_7` 関数 + `v_latest_risk_gap` ビュー |
| ❌ 未tracked・番号衝突・重複 | `012_invite_codes.sql` | `invite_codes` + `profiles`（**RLS なし**の不完全版） |
| ✅ committed | `011_rebalance_tool.sql` | リバランスツール |
| ✅ committed | `012_fund_master.sql` | 投信マスタ |
| ✅ committed | `018_invite_codes_profiles.sql` | `invite_codes` + `profiles`（**RLS あり完全版** ← 012_invite_codes の上位互換） |

#### 本番 `supabase_migrations.schema_migrations` の現状（事前確認で判明）

| version | name | ローカル正規ファイルとの一致 |
|---|---|---|
| 001..010 | （各ファイル名と一致） | ✅ 完全一致 |
| **011** | **risk_gap_snapshots** | 🔴 **不整合**（ローカル正規 011 は `rebalance_tool`、`risk_gap_snapshots` は untracked 後付け版） |
| 012..024 | （未登録） | 🟡 未登録（本番 DB には全オブジェクト適用済み、メタテーブルだけ追従していない） |

→ schema_migrations 011 行は「ローカルで untracked、Phase 1 で 023 にリネーム予定のファイル」を指している状態。

### 修復後の最終形

```
011_rebalance_tool.sql           （変更なし、メタにも 011 = rebalance_tool として登録）
012_fund_master.sql              （変更なし）
013..018                         （変更なし、018 が invite_codes/profiles の正式版）
019..022                         （変更なし）
023_risk_gap_snapshots.sql       ← 旧 011_risk_gap_snapshots.sql をリネーム
024_simulation_logs.sql          （Commit (c) で追加済み）
```

- `012_invite_codes.sql` は削除（018 で代替済み・本番にも 018 経由で適用されている前提）
- `023_risk_gap_snapshots.sql` の中身は無編集でリネームのみ
- 本番 DB の **テーブル・カラム・関数は一切変更しない**（schema_migrations メタテーブルだけ書き戻す）
- schema_migrations は最終的に 001..024 の連続 24 行になる

---

## 2. 事前確認（実行前に必須）

### 2-1. ローカル git 状態
```bash
cd "セミリタイア・シュミレーター/semi-retire-app"
git status
git log --oneline origin/main..HEAD
```
期待：作業ツリーに想定外の変更がないこと、未push のローカルコミットがないこと。

### 2-2. 本番 schema_migrations の現状確認

Supabase Dashboard → SQL Editor で：

```sql
-- (a) schema_migrations テーブルのスキーマ確認
SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'supabase_migrations'
    AND table_name = 'schema_migrations'
  ORDER BY ordinal_position;

-- (b) 現在の登録内容
SELECT version, name
  FROM supabase_migrations.schema_migrations
  ORDER BY version;
```

期待結果（事前調査で確認済み）：
- (a) 主要カラム `version (text)`, `name (text)`, `statements (text[])`
- (b) 11 行返却。001..010 は各ファイルと一致、**011 = `risk_gap_snapshots`**、012 以降は未登録

**もしこの実態と異なる結果が出たら作業中止**。本手順書の前提が崩れているため、再分析が必要。

### 2-3. 本番DBに該当オブジェクトが存在することの再確認

```sql
SELECT 'table' AS kind, 'risk_gap_snapshots' AS name,
       to_regclass('public.risk_gap_snapshots') IS NOT NULL AS exists
UNION ALL SELECT 'function', 'save_pf_with_snapshot',
       to_regprocedure('public.save_pf_with_snapshot(jsonb,numeric,numeric,numeric,integer,text,text,text,uuid,integer,timestamptz)') IS NOT NULL
UNION ALL SELECT 'function', 'risk_level_5_to_7',
       to_regprocedure('public.risk_level_5_to_7(integer)') IS NOT NULL
UNION ALL SELECT 'view', 'v_latest_risk_gap',
       to_regclass('public.v_latest_risk_gap') IS NOT NULL
UNION ALL SELECT 'table', 'invite_codes',
       to_regclass('public.invite_codes') IS NOT NULL
UNION ALL SELECT 'table', 'profiles',
       to_regclass('public.profiles') IS NOT NULL
UNION ALL SELECT 'table', 'simulation_logs',
       to_regclass('public.simulation_logs') IS NOT NULL
UNION ALL SELECT 'table', 'rebalance_user_targets',
       to_regclass('public.rebalance_user_targets') IS NOT NULL
UNION ALL SELECT 'table', 'fund_master',
       to_regclass('public.fund_master') IS NOT NULL;
```

期待：全行 `exists = true`。**1 つでも false なら作業中止して原因調査**。

---

## 3. Phase 1 — ローカルファイル整理

```bash
cd "セミリタイア・シュミレーター/semi-retire-app"

# (1) 011_risk_gap_snapshots.sql → 023_risk_gap_snapshots.sql にリネーム
#     untracked なので git mv ではなく素のリネーム → 後で git add
mv supabase/migrations/011_risk_gap_snapshots.sql supabase/migrations/023_risk_gap_snapshots.sql

# (2) 012_invite_codes.sql 削除（018 で代替済み）
rm supabase/migrations/012_invite_codes.sql

# (3) 結果確認
ls supabase/migrations/ | sort
```

期待：011_rebalance_tool, 012_fund_master, ..., 022, 023_risk_gap_snapshots, 024_simulation_logs が連続して並ぶ。重複番号なし。

```bash
# (4) 番号重複チェック（無音なら OK）
ls supabase/migrations/ | sed -E 's/^([0-9]+)_.*/\1/' | sort | uniq -d
```

---

## 4. Phase 2 — schema_migrations 同期（本番 DB）

⚠️ Phase 2 は **Phase 1 完了後**に実行。Phase 1 でリネームしたファイル名と一致させる必要があるため。

⚠️ 案A' 改訂のポイント：従来案 A の単純 INSERT では schema_migrations 011 の不整合行（`risk_gap_snapshots`）が孤児として残る。本改訂では **DELETE 先行 → INSERT** で 011 行を入れ替える。

Supabase Dashboard → SQL Editor で以下を実行：

```sql
-- ============================================================
-- 案A' Phase 2: schema_migrations 同期
-- ============================================================

-- Step 1: 不整合な 011 = risk_gap_snapshots を削除
--         （後で 023 として再登録するため、このタイミングで一旦消す）
DELETE FROM supabase_migrations.schema_migrations
  WHERE version = '011' AND name = 'risk_gap_snapshots';

-- Step 2: 011..024 を一括 INSERT
--         011 は本来の rebalance_tool として、023 は元 011 の risk_gap_snapshots として登録。
--         statements は本来「適用された SQL の配列」だが、メタ整合だけが目的なので空配列で OK
--         （Supabase CLI の migration repair も同様の挙動）
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('011', 'rebalance_tool',             ARRAY[]::text[]),
  ('012', 'fund_master',                ARRAY[]::text[]),
  ('013', 'fund_master_seed',           ARRAY[]::text[]),
  ('014', 'risk_model_portfolios',      ARRAY[]::text[]),
  ('015', 'asset_class_params_update',  ARRAY[]::text[]),
  ('016', 'rb_emergency_fund',          ARRAY[]::text[]),
  ('017', 'risk_assessment_version',    ARRAY[]::text[]),
  ('018', 'invite_codes_profiles',      ARRAY[]::text[]),
  ('019', 'asset_class_unify',          ARRAY[]::text[]),
  ('020', 'optimal_portfolios',         ARRAY[]::text[]),
  ('021', 'fund_master_asset_class_fix',ARRAY[]::text[]),
  ('022', 'approve_pending_review',     ARRAY[]::text[]),
  ('023', 'risk_gap_snapshots',         ARRAY[]::text[]),
  ('024', 'simulation_logs',            ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;

-- 検証
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```

期待：001..024 の連続 24 行が返る（重複・欠番なし、name は全てローカルファイル名のサフィックス部と一致）。

### Phase 2 のロールバック（不整合発生時のみ）

```sql
-- 本改訂で追加した 011..024 を全削除し、元の不整合な 011 = risk_gap_snapshots を復元
DELETE FROM supabase_migrations.schema_migrations
  WHERE version IN ('011','012','013','014','015','016','017','018',
                    '019','020','021','022','023','024');
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
  VALUES ('011', 'risk_gap_snapshots', ARRAY[]::text[]);
```

### なぜ DELETE + INSERT で UPDATE ではないか

- UPDATE で `version='011'` → `version='023'` に変えるのも可能だが、PK 変更の SQL は意図が読みにくい
- DELETE + INSERT の方が「不整合を消して、正しい状態を作り直す」と意図が明示的
- ロールバックも DELETE + INSERT で統一できて理解しやすい

---

## 5. Phase 3 — Git コミット

```bash
cd "セミリタイア・シュミレーター/semi-retire-app"

# 023 を tracked に追加
git add supabase/migrations/023_risk_gap_snapshots.sql

# 削除した 012_invite_codes.sql は元々 untracked なので git op 不要
git status

# コミット
git commit -m "chore(migrations): 番号衝突修復（案A'）— 011_risk_gap_snapshots を 023 にリネーム

CLAUDE.md TODO「マイグレーション番号衝突の修復」を案A'（改訂版）として実施。

## 変更
- 011_risk_gap_snapshots.sql → 023_risk_gap_snapshots.sql にリネーム
  （既存の 011_rebalance_tool.sql との番号衝突を解消）
  本ファイルは risk_gap_snapshots テーブル・risk_level_5_to_7 関数・
  save_pf_with_snapshot RPC（Commit b の savePfWithSnapshot 依存先）・
  v_latest_risk_gap ビューを定義
- 012_invite_codes.sql を削除
  （018_invite_codes_profiles.sql が RLS 付き完全版として代替済み）

## 本番 DB 側の対応
- 事前確認で schema_migrations 011 = risk_gap_snapshots（後付け版を指していた）
  と判明したため、DELETE + INSERT で 011 を rebalance_tool に置き換え、
  012..024 を applied として追記
- テーブル・カラム・関数の実体は一切変更していない

## 残タスク
- マイグレーション未管理テーブル（english_subscribers / market_data /
  scene_cache）の補完マイグレーションは別途対応（CLAUDE.md TODO 参照）"
```

最後に push：
```bash
git push origin main
```

---

## 6. 完了後の検証

### 6-1. ローカル
```bash
ls supabase/migrations/ | wc -l        # 24 ファイル
ls supabase/migrations/ | sed -E 's/^([0-9]+)_.*/\1/' | sort | uniq -d  # 無音
git status                              # clean
```

### 6-2. 本番 DB（SQL Editor）
```sql
WITH versions AS (SELECT version FROM supabase_migrations.schema_migrations)
SELECT
  (SELECT COUNT(*) FROM versions) AS total_count,
  (SELECT MIN(version) FROM versions) AS min_v,
  (SELECT MAX(version) FROM versions) AS max_v;
-- 期待: total_count=24, min_v=001, max_v=024

-- name とローカルファイル名の対応を最終確認
SELECT version, name FROM supabase_migrations.schema_migrations
  ORDER BY version;
-- 期待: 各 name がローカル NNN_<name>.sql と一致
```

### 6-3. アプリの実動確認
- `/pf` で診断実行 → savePfWithSnapshot が成功すること（Network タブで RPC レスポンス 2xx）
- `/portfolio` `/ma` `/rb` の招待コード認証が通ること
- 本リポジトリの Vercel preview で全画面が回ること

---

## 7. CLAUDE.md TODO の更新

修復完了後、`CLAUDE.md` の TODO セクションから「マイグレーション番号衝突の修復（案A）」のブロックを削除する（または「YYYY-MM-DD 完了」と注記）。これは Phase 3 のコミットに含めても、別 chore コミットに分けてもどちらでも可。

---

## 8. リスクとロールバック

| リスク | 対策 |
|---|---|
| schema_migrations への DELETE + INSERT が他の機能を壊す | Supabase の `db push` を本プロジェクトでは使用していない（マイグレーションは全て SQL Editor 適用）ため影響なし。万一に備え Phase 2 ロールバック SQL を準備済み |
| リネーム後の 023 の中身が本番と乖離 | 中身は無編集（`mv` のみ）。本番には既に同内容が適用済みで再適用なし |
| 012_invite_codes.sql 削除で参照漏れ | 削除対象は untracked かつ 018 の subset。アプリコードは 018 経由のテーブルを参照中（変更なし） |
| 011 の DELETE 先行で一瞬「011 が存在しない」状態になる | 同一トランザクション（同一 SQL Editor 実行）内で DELETE→INSERT を行うため外部から見えない。仮に途中で失敗しても schema_migrations の不整合だけで本番アプリは動作継続 |

---

## 9. 補足：採用しなかった案

- **案A''：schema_migrations を全 DELETE → 001..024 全 INSERT 再構築**
  - 事前確認 SQL #2 で 001..010 がローカルと完全一致していると確認済み。触る必要のない 10 行を消すリスクを取る理由がない
- **案B：本番 DB を作り直して migrations を順番に再適用**
  - 既存ユーザーデータが消える。論外
- **案C：`011_risk_gap_snapshots.sql` の中身を `011_rebalance_tool.sql` にマージ**
  - ファイルサイズと責務が肥大化、責務が不明瞭になる
- **案D：番号体系を timestamp（`YYYYMMDDHHMMSS_xxx.sql`）に全面移行**
  - 既存 22 ファイルすべてのリネームと schema_migrations の全書き換えが必要。コスト過大

→ 影響範囲最小・本番 DB の実体に手を入れない案A' を採用。
