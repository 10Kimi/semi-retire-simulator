# Migration 028 / 029 設計書

**作成日**: 2026-05-16
**ステータス**: 設計（未実装）— きみさん承認後に着手

## 0. 背景と目的

2026-05-16 のリバランス計算で発覚した 2 問題を、Supabase マイグレーションで修正する。

| 問題 | 該当箇所 | 原因 | 修正 |
|---|---|---|---|
| **JEPI コモディティ誤分類** | `fund_master.asset_class` | migration 021 で JEPI/QYLD/RYLD を `alternative → commodity` に一括更新したのが誤判断 | migration 028 で `commodity → us_equity` に戻す |
| **日本個別株 16 銘柄 未分類** | `fund_master` に 4 桁数字 ticker が 0 件 | seed (013) は投信 + 米国 ETF + 米国個別株のみで日本個別株を含まない | migration 029 で 16 銘柄を `japan_equity` で INSERT |

## 1. Phase A 結論サマリ（設計の前提）

### 1-1. mfParser.ts に分類ロジックは存在しない
- `src/lib/rb/mfParser.ts` (191 行) は Excel から `{ name, ticker, amount }` を抽出するだけ
- アセットクラス判定は **`fund_master` テーブルとの照合**（`MfImportFlow.tsx` の allocator 経由）
- → **修正は SQL 側（fund_master データ）で完結する。コード変更は不要**

### 1-2. fund_master の制約
- PK は `id` (uuid)、**ticker に UNIQUE 制約なし**（migration 012 L7-14）
- → 同じ ticker が複数行存在し得る。INSERT 系は SELECT-then-skip パターン（db.ts:163-170）

### 1-3. UI 経由で既存行を訂正する手段なし
- `submitFundRequest()` (db.ts:146) は **fund_master に該当 ticker が既に存在すれば INSERT スキップ**
- → JEPI/QYLD/RYLD の誤分類は **UI からは絶対に直せない**。SQL UPDATE 必須

### 1-4. ticker 保存形式（A-6 実測）
- `mfParser.ts:88-108` `parseStockRow` は col0 を `String().trim()` で返す
- 日本株は MF 元データで col0 が数値（1605）→ 文字列 `"1605"`（`.T` サフィックス無し）
- 現在の fund_master 内に 4 桁数字 ticker は 0 件（`1605` / `1605.T` どちらも該当なし）

### 1-5. 既存 fund_master の asset_class 列挙（A-6 実測）
`commodity / developed_bond / developed_equity / emerging_equity / gold / japan_bond / japan_equity / us_equity`

→ **米国株 ETF は `us_equity`**、**日本個別株は `japan_equity`** を使う（`foreign_stock` は存在しない）。

### 1-6. fund_master の JEPI/QYLD/RYLD/その他の現状（A-6 実測 2026-05-16 時点）
```
JEPI:  commodity  | JPモルガン エクイティ プレミアム ETF
QYLD:  commodity  | グローバルX NASDAQ100 カバードコールETF
RYLD:  commodity  | GLX Russell 2000 カバードコール ETF
JEPQ:  未登録
XYLD:  未登録
SCHD:  未登録
VYM:   未登録
NUSI:  未登録
```

---

## 2. migration 028: fund_master JEPI 誤分類修正

**ファイル名**: `supabase/migrations/028_fund_master_jepi_fix.sql`

### 2-1. UPDATE 内容（誤分類 3 銘柄）

```sql
UPDATE fund_master
SET asset_class = 'us_equity', updated_at = now()
WHERE ticker IN ('JEPI', 'QYLD', 'RYLD')
  AND asset_class = 'commodity';
```

| ticker | 現在 | 修正後 | 根拠 |
|---|---|---|---|
| JEPI | commodity | us_equity | 米国大型株 + ELN にカバードコール戦略。実体は米国株 ETF |
| QYLD | commodity | us_equity | Nasdaq-100 にカバードコール。実体は米国株 ETF |
| RYLD | commodity | us_equity | Russell 2000 にカバードコール。実体は米国株 ETF |

### 2-2. INSERT 内容（予防的 seed 4 銘柄）

```sql
INSERT INTO fund_master (ticker, fund_name, asset_class, ratio)
VALUES
  ('JEPQ', 'JPモルガン Nasdaq エクイティ プレミアム インカム ETF', 'us_equity', 1.0),
  ('XYLD', 'グローバルX S&P 500 カバードコール ETF',                'us_equity', 1.0),
  ('SCHD', 'シュワブ 米国配当株式 ETF',                              'us_equity', 1.0),
  ('VYM',  'バンガード 米国高配当株式 ETF',                          'us_equity', 1.0);
```

| ticker | カテゴリ根拠 | 出典 |
|---|---|---|
| JEPQ | Asset Class = Equity, Category = Derivative Income。Nasdaq-100 大型株 + ELN にカバードコール | stockanalysis.com/etf/jepq/ |
| XYLD | Asset Class = Equity / Income。S&P 500 銘柄保有 + 同インデックスのコール売り | globalxetfs.com/funds/xyld（発行元公式） |
| SCHD | Asset Class = Equity, Category = Large Value。Dow Jones U.S. Dividend 100 連動 | stockanalysis.com/etf/schd/ |
| VYM | Asset Class = Equity, Category = Large Value。FTSE Custom High Dividend Yield 連動 | stockanalysis.com/etf/vym/ |

**4 銘柄すべて**:
- Asset Class（資産クラス）= Equity
- Region = North America / U.S.
- 原資産 = 米国大型株
- → fund_master の `us_equity` が妥当

### 2-3. NUSI を除外する理由

- 公式発行元ページ (`etfs.nationwide.com/funds/nusi/`) は接続不能、stockanalysis.com には該当 ticker なし、Morningstar は 403。**現在の発行体・運用状態を確信を持って確認できなかった**
- 「推測で書かない」原則に従い、本マイグレーションからは除外
- 将来 NUSI が MF インポートに登場した場合、その時点で個別調査して別マイグレーションで追加する

### 2-4. 想定影響範囲

| 範囲 | 影響 |
|---|---|
| fund_master | 3 行 UPDATE + 4 行 INSERT（計 7 行差分） |
| fund_master_requests | 影響なし（このテーブルは触らない） |
| rb_snapshots | **過去スナップショットは再計算されない**（既に確定保存済み）。次回 MF 取込から正しい分類で集計される |
| アプリケーションコード | 影響なし（コード変更を伴わない SQL のみ） |
| 他ユーザーの体験 | JEPI/QYLD/RYLD 保有ユーザー全員が「コモディティ」から「米国株式」に分類変更される。きみさん以外のユーザーには事前周知が必要（**現状は実質的にきみさん 1 名のため不要**） |

### 2-5. ロールバック手順

```sql
-- ロールバック SQL
UPDATE fund_master SET asset_class = 'commodity', updated_at = now()
WHERE ticker IN ('JEPI', 'QYLD', 'RYLD') AND asset_class = 'us_equity';

DELETE FROM fund_master
WHERE ticker IN ('JEPQ', 'XYLD', 'SCHD', 'VYM');
```

※ 外部キー参照は無いため DELETE は単純に効く。

---

## 3. migration 029: 日本個別株 16 銘柄 seed

**ファイル名**: `supabase/migrations/029_fund_master_japan_stock_seed.sql`

### 3-1. INSERT 内容

```sql
INSERT INTO fund_master (ticker, fund_name, asset_class, ratio)
VALUES
  ('1605', 'INPEX',          'japan_equity', 1.0),
  ('2914', 'JT',             'japan_equity', 1.0),
  ('3003', 'ヒューリック',    'japan_equity', 1.0),
  ('4792', '山田コンサル',    'japan_equity', 1.0),
  ('4967', '小林製薬',        'japan_equity', 1.0),
  ('5938', 'LIXIL',          'japan_equity', 1.0),
  ('6365', '電業社',          'japan_equity', 1.0),
  ('6652', 'IDEC',           'japan_equity', 1.0),
  ('8267', 'イオン',          'japan_equity', 1.0),
  ('8395', '佐賀銀',          'japan_equity', 1.0),
  ('8630', 'SOMPOHD',        'japan_equity', 1.0),
  ('8697', 'JPX',            'japan_equity', 1.0),
  ('8725', 'MS&AD',          'japan_equity', 1.0),
  ('8871', 'ゴールドクレ',    'japan_equity', 1.0),
  ('8894', 'REVOLUTION',     'japan_equity', 1.0),
  ('9651', '日プロ',          'japan_equity', 1.0);
```

### 3-2. ticker 形式の根拠

- `mfParser.ts:88-108` `parseStockRow` が col0 を `String().trim()` で返却
- Money Forward の日本株セクションは col0 が **数値の証券コード**（例: 1605）
- 文字列化結果 = `"1605"`（**`.T` サフィックスは付かない**）
- → 同じ形式（4 桁数字のみ）で seed する

### 3-3. asset_class = `japan_equity` の根拠

- 全 16 銘柄は東京証券取引所上場の **普通株式**（J-REIT / インフラファンド ではない）
- 業種は石油・タバコ・不動産・コンサル・製薬・住宅機器・銀行・損保・取引所・建設等で多岐に渡るが、いずれも普通株式
- fund_master の既存値で日本株普通株を表すのは `japan_equity`（A-6 実測の distinct 列挙より）

### 3-4. fund_name の表記

- きみさんから提示された通称（INPEX / JT / ヒューリック 等）をそのまま採用
- MF 元データの「銘柄名」と完全一致しないが、`fund_name` カラムは表示用で**マッチング判定には ticker のみ使用**するため動作上問題なし
- 必要なら後で UPDATE で正式名（例: `「ヒューリック株式会社」`）に置き換え可能

### 3-5. 想定影響範囲

| 範囲 | 影響 |
|---|---|
| fund_master | 16 行 INSERT |
| 既存ユーザー | 16 銘柄を保有している全ユーザー（**現状は実質的にきみさん 1 名**）が次回 MF 取込から「未分類」→「自動で `japan_equity`」になる |
| rb_snapshots | 過去スナップショットは変わらない |
| アプリケーションコード | 変更なし |

### 3-6. ロールバック手順

```sql
DELETE FROM fund_master
WHERE ticker IN (
  '1605','2914','3003','4792','4967','5938','6365','6652',
  '8267','8395','8630','8697','8725','8871','8894','9651'
)
AND asset_class = 'japan_equity';
```

---

## 4. schema_migrations 運用手順

### 4-1. 現状（2026-05-16 時点）

- 過去（〜migration 024）: `schema_migrations` テーブルで 011..024 を管理
- 直近（migration 025〜027）: PostgREST 経由で 42P01（テーブル未存在）が返るため **案A 採用 = `schema_migrations` は触らない**
- 直近 027（search_history）も schema_migrations 記録は行わず、SQL Editor 直接適用のみ

### 4-2. 028 / 029 の適用手順

migration 027 と同じ案 A を継続する:

1. ローカルに `supabase/migrations/028_*.sql` と `029_*.sql` を作成しコミット（ファイル履歴を git に残す）
2. **Supabase Dashboard > SQL Editor で 028 を実行**
3. 実行後 SELECT で 7 行差分（3 UPDATE + 4 INSERT）を確認
4. 続けて **029 を実行**
5. SELECT で 16 行 INSERT を確認
6. `schema_migrations` テーブルは触らない
7. CHANGELOG.md と `FI_project/Docs/changelog.md` に適用記録

### 4-3. 検証用 SELECT クエリ

028 適用後:
```sql
SELECT ticker, asset_class FROM fund_master
WHERE ticker IN ('JEPI','QYLD','RYLD','JEPQ','XYLD','SCHD','VYM')
ORDER BY ticker;
-- 期待: 7 行すべて asset_class = 'us_equity'
```

029 適用後:
```sql
SELECT ticker, fund_name, asset_class FROM fund_master
WHERE asset_class = 'japan_equity' AND ticker ~ '^[0-9]{4}$'
ORDER BY ticker;
-- 期待: 16 行すべて asset_class = 'japan_equity'、ticker は 4 桁数字
```

### 4-4. schema_migrations 運用復活は別タスク

- `schema_migrations` テーブルの再構築・運用復活は本マイグレーションのスコープ外
- 別途 Docs/ に運用復活手順書を起こすタスクとして切り出し（`content-pipeline-design-v1.0.md §6-4` と同じスコープアウト方針）

---

## 5. 適用順序とリスク確認チェックリスト

### 適用順序
1. `028_fund_master_jepi_fix.sql` (UPDATE 3 + INSERT 4)
2. `029_fund_master_japan_stock_seed.sql` (INSERT 16)

依存関係なし。順序は逆でも動くが、028 → 029 の番号順を推奨。

### 着手前チェックリスト
- [ ] 本設計書のレビュー完了（きみさん）
- [ ] 028/029 の SQL ファイルをローカル git に作成
- [ ] Supabase Dashboard で `fund_master` の現状バックアップ（CSV エクスポートで十分）
- [ ] SQL Editor で 028 を実行 → 7 行差分確認
- [ ] SQL Editor で 029 を実行 → 16 行差分確認
- [ ] 本番 `/rb` で MF Excel を再度 import → JEPI が「米国株式」、16 銘柄が「日本株」に自動分類されるか UI で目視確認
- [ ] CHANGELOG.md 記録

### リスク
- 低リスク: テーブル構造変更なし、FK 参照なし、ロールバック SQL 明示済み
- 最大の影響範囲は「JEPI 等保有ユーザー全員の分類が変わる」だが、現状の利用者数を考えると無視できる

---

## 6. 変更履歴

| 日付 | 変更 |
|---|---|
| 2026-05-16 | 初版作成（Phase A 調査結果を踏まえた設計） |
