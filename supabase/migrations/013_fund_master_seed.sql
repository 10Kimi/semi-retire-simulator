-- ============================================================
-- fund_master 初期データ投入
-- Run this in Supabase SQL Editor AFTER 012_fund_master.sql
-- ============================================================

-- 投資信託
INSERT INTO fund_master (ticker, fund_name, asset_class, ratio) VALUES
  -- eMAXIS Slim 全世界株式(オール・カントリー)
  ('eMAXIS Slim 全世界株式(オール・カントリー)', 'eMAXIS Slim 全世界株式(オール・カントリー)', 'developed_equity', 0.84),
  ('eMAXIS Slim 全世界株式(オール・カントリー)', 'eMAXIS Slim 全世界株式(オール・カントリー)', 'emerging_equity', 0.10),
  ('eMAXIS Slim 全世界株式(オール・カントリー)', 'eMAXIS Slim 全世界株式(オール・カントリー)', 'japan_equity', 0.06),
  -- eMAXIS Slim 米国株式(S&P500)
  ('eMAXIS Slim 米国株式(S&P500)', 'eMAXIS Slim 米国株式(S&P500)', 'developed_equity', 1.00),
  -- eMAXIS NASDAQ100インデックス
  ('eMAXIS NASDAQ100インデックス', 'eMAXIS NASDAQ100インデックス', 'developed_equity', 1.00),
  -- ニッセイNASDAQ100
  ('ニッセイNASDAQ100インデックスファンド<購入・換金手数料なし>', 'ニッセイNASDAQ100インデックスファンド', 'developed_equity', 1.00),
  -- SBI・V・S&P500
  ('SBI・V・S&P500インデックス・ファンド', 'SBI・V・S&P500インデックス・ファンド', 'developed_equity', 1.00),
  -- SBI・iシェアーズ・日経225
  ('SBI・iシェアーズ・日経225インデックス・ファンド', 'SBI・iシェアーズ・日経225インデックス・ファンド', 'japan_equity', 1.00),
  -- eMAXIS 国内物価連動国債
  ('eMAXIS 国内物価連動国債インデックス', 'eMAXIS 国内物価連動国債インデックス', 'japan_bond', 1.00),
  -- SBI・iシェアーズ・全世界債券
  ('SBI・iシェアーズ・全世界債券インデックス・ファンド', 'SBI・iシェアーズ・全世界債券インデックス・ファンド', 'japan_bond', 0.10),
  ('SBI・iシェアーズ・全世界債券インデックス・ファンド', 'SBI・iシェアーズ・全世界債券インデックス・ファンド', 'developed_bond', 0.90),
  -- SBI・iシェアーズ・ゴールド
  ('SBI・iシェアーズ・ゴールドファンド(為替ヘッジなし)', 'SBI・iシェアーズ・ゴールドファンド(為替ヘッジなし)', 'commodity', 1.00),
  -- iシェアーズ ゴールド
  ('iシェアーズ ゴールドインデックス・ファンド(為替ヘッジなし)', 'iシェアーズ ゴールドインデックス・ファンド(為替ヘッジなし)', 'commodity', 1.00),
  -- セゾン・グローバルバランスファンド
  ('セゾン・グローバルバランスファンド', 'セゾン・グローバルバランスファンド', 'japan_equity', 0.15),
  ('セゾン・グローバルバランスファンド', 'セゾン・グローバルバランスファンド', 'developed_equity', 0.45),
  ('セゾン・グローバルバランスファンド', 'セゾン・グローバルバランスファンド', 'emerging_equity', 0.10),
  ('セゾン・グローバルバランスファンド', 'セゾン・グローバルバランスファンド', 'japan_bond', 0.15),
  ('セゾン・グローバルバランスファンド', 'セゾン・グローバルバランスファンド', 'developed_bond', 0.15)
ON CONFLICT DO NOTHING;

-- 米国ETF
INSERT INTO fund_master (ticker, fund_name, asset_class, ratio) VALUES
  ('VTI',  'バンガード・トータル・ストック・マーケットETF', 'developed_equity', 1.00),
  ('BND',  'バンガード 米国トータル債券市場ETF', 'developed_bond', 1.00),
  ('JEPI', 'JPモルガン エクイティ プレミアム ETF', 'alternative', 1.00),
  ('QYLD', 'グローバルX NASDAQ100 カバードコールETF', 'alternative', 1.00),
  ('RYLD', 'GLX Russell 2000 カバードコール ETF', 'alternative', 1.00),
  ('DBA',  'インベスコDBアグリカルチャー・ファンド', 'commodity', 1.00)
ON CONFLICT DO NOTHING;

-- 米国個別株（全て先進国株式 100%）
INSERT INTO fund_master (ticker, fund_name, asset_class, ratio) VALUES
  ('ABBV', 'アッヴィ', 'developed_equity', 1.00),
  ('BKH',  'ブラック ヒルズ', 'developed_equity', 1.00),
  ('BTI',  'ブリティッシュ アメリカン タバコ ADR', 'developed_equity', 1.00),
  ('CSCO', 'シスコ システムズ', 'developed_equity', 1.00),
  ('CVX',  'シェブロン', 'developed_equity', 1.00),
  ('JNJ',  'ジョンソン & ジョンソン', 'developed_equity', 1.00),
  ('KO',   'コカ-コーラ', 'developed_equity', 1.00),
  ('LEG',  'レゲット アンド プラット', 'developed_equity', 1.00),
  ('MO',   'アルトリア グループ', 'developed_equity', 1.00),
  ('NWN',  'ノースウェスト ナチュラル', 'developed_equity', 1.00),
  ('PEP',  'ペプシコ', 'developed_equity', 1.00),
  ('PM',   'フィリップ モリス インターナショナル', 'developed_equity', 1.00),
  ('TROW', 'T ロウ プライス グループ', 'developed_equity', 1.00),
  ('UGI',  'UGI', 'developed_equity', 1.00),
  ('UVV',  'ユニバーサル', 'developed_equity', 1.00),
  ('VZ',   'ベライゾン コミュニケーションズ', 'developed_equity', 1.00),
  ('MMM',  'スリーエム', 'developed_equity', 1.00),
  ('SOLV', 'ソルベンタム', 'developed_equity', 1.00)
ON CONFLICT DO NOTHING;
