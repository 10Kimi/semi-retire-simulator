-- ============================================================
-- fund_master JEPI 誤分類修正 + 予防的 seed 追加
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
--
-- 背景:
--   021 でカバードコール 3 銘柄 (JEPI/QYLD/RYLD) を alternative → commodity に
--   一括変更したが、実体は米国株 ETF（カバードコール戦略でも原資産は米国株式）。
--   2026-05-16 のリバランス計算で「コモディティ合計に JEPI ¥5,681,506 が混入」
--   する事象が発覚したため、本マイグレーションで us_equity に訂正する。
--
--   同時に、未登録のカバードコール / 高配当系米国 ETF 4 銘柄を予防的に seed。
--   NUSI は発行元公式情報を確認できなかったため除外（推測排除原則）。
--
-- 設計書: Docs/migration_028_029_plan.md
-- ============================================================

-- 1. JEPI/QYLD/RYLD: commodity → us_equity（021 の誤判断を訂正）
UPDATE fund_master
SET asset_class = 'us_equity', updated_at = now()
WHERE ticker IN ('JEPI', 'QYLD', 'RYLD')
  AND asset_class = 'commodity';

-- 2. 予防的 seed 追加（fund_name は既存の US ETF と同じ日本語表記規約）
--    JEPQ: stockanalysis.com/etf/jepq 確認、Nasdaq-100 covered call
--    XYLD: globalxetfs.com/funds/xyld 確認、S&P 500 covered call
--    SCHD: stockanalysis.com/etf/schd 確認、Dow Jones US Dividend 100 連動
--    VYM:  stockanalysis.com/etf/vym 確認、FTSE US High Dividend Yield 連動
--    全 4 銘柄とも asset class = Equity / region = US → fund_master の us_equity 該当
INSERT INTO fund_master (ticker, fund_name, asset_class, ratio) VALUES
  ('JEPQ', 'JPモルガン Nasdaq エクイティ プレミアム ETF', 'us_equity', 1.0),
  ('XYLD', 'グローバルX S&P500 カバードコール ETF',        'us_equity', 1.0),
  ('SCHD', 'シュワブ 米国配当株式ETF',                       'us_equity', 1.0),
  ('VYM',  'バンガード・米国高配当株式ETF',                  'us_equity', 1.0);
