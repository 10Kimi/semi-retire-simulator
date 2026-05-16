-- ============================================================
-- fund_master 日本個別株 16 銘柄 seed
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
--
-- 背景:
--   seed 013 は投信 + 米国 ETF + 米国個別株のみで、日本個別株は未登録だった。
--   2026-05-16 のリバランス計算で「日本個別株 16 銘柄が全て未分類」になり
--   毎回手動振り分けする状況になっていたため、本マイグレーションで一括 seed。
--
--   ticker 形式: mfParser.ts:88-108 の parseStockRow が col0 を String().trim() で
--   返却 → MF Excel の日本株 col0 は数値証券コードのため、文字列化結果は
--   "1605" のような裸の 4 桁（.T サフィックス無し）。本テーブルも同形式で投入。
--
--   fund_name: 2026-05-16 のきみさん MF Excel 出力（R21-R36）の表記そのまま。
--   将来 MF 側の表記が変わったら別マイグレーションで UPDATE する想定。
--
-- 設計書: Docs/migration_028_029_plan.md
-- ============================================================

INSERT INTO fund_master (ticker, fund_name, asset_class, ratio) VALUES
  ('1605', 'INPEX',        'japan_equity', 1.0),
  ('2914', 'JT',           'japan_equity', 1.0),
  ('3003', 'ヒューリック', 'japan_equity', 1.0),
  ('4792', '山田コンサル', 'japan_equity', 1.0),
  ('4967', '小林製薬',     'japan_equity', 1.0),
  ('5938', 'LIXIL',        'japan_equity', 1.0),
  ('6365', '電業社',       'japan_equity', 1.0),
  ('6652', 'IDEC',         'japan_equity', 1.0),
  ('8267', 'イオン',       'japan_equity', 1.0),
  ('8395', '佐賀銀',       'japan_equity', 1.0),
  ('8630', 'SOMPOHD',      'japan_equity', 1.0),
  ('8697', 'JPX',          'japan_equity', 1.0),
  ('8725', 'MS&AD',        'japan_equity', 1.0),
  ('8871', 'ゴールドクレ', 'japan_equity', 1.0),
  ('8894', 'REVOLUTION',   'japan_equity', 1.0),
  ('9651', '日プロ',       'japan_equity', 1.0);
