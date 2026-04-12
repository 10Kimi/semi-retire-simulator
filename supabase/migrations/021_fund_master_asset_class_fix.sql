-- ============================================================
-- fund_master アセットクラス紐付け修正（13クラス統一対応）
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. 米国株系ファンド: developed_equity → us_equity
-- S&P500系
UPDATE fund_master SET asset_class = 'us_equity'
WHERE ticker = 'eMAXIS Slim 米国株式(S&P500)' AND asset_class = 'developed_equity';

UPDATE fund_master SET asset_class = 'us_equity'
WHERE ticker = 'eMAXIS NASDAQ100インデックス' AND asset_class = 'developed_equity';

UPDATE fund_master SET asset_class = 'us_equity'
WHERE ticker = 'ニッセイNASDAQ100インデックスファンド<購入・換金手数料なし>' AND asset_class = 'developed_equity';

UPDATE fund_master SET asset_class = 'us_equity'
WHERE ticker = 'SBI・V・S&P500インデックス・ファンド' AND asset_class = 'developed_equity';

-- VTI（米国トータル）
UPDATE fund_master SET asset_class = 'us_equity'
WHERE ticker = 'VTI' AND asset_class = 'developed_equity';

-- 2. 米国個別株: developed_equity → us_equity
UPDATE fund_master SET asset_class = 'us_equity'
WHERE ticker IN ('ABBV','BKH','BTI','CSCO','CVX','JNJ','KO','LEG','MO','NWN','PEP','PM','TROW','UGI','UVV','VZ','MMM','SOLV')
AND asset_class = 'developed_equity';

-- 3. eMAXIS Slim 全世界株式: 按分修正（米国60%を分離）
-- 旧: developed_equity 0.84 → 新: us_equity 0.60, developed_equity 0.24
UPDATE fund_master SET ratio = 0.24
WHERE ticker = 'eMAXIS Slim 全世界株式(オール・カントリー)' AND asset_class = 'developed_equity';

INSERT INTO fund_master (ticker, fund_name, asset_class, ratio)
VALUES ('eMAXIS Slim 全世界株式(オール・カントリー)', 'eMAXIS Slim 全世界株式(オール・カントリー)', 'us_equity', 0.60)
ON CONFLICT DO NOTHING;

-- 4. セゾン・グローバルバランスファンド: 先進国株の米国比率を分離
-- 旧: developed_equity 0.45 → 新: us_equity 0.27, developed_equity 0.18
UPDATE fund_master SET ratio = 0.18
WHERE ticker = 'セゾン・グローバルバランスファンド' AND asset_class = 'developed_equity';

INSERT INTO fund_master (ticker, fund_name, asset_class, ratio)
VALUES ('セゾン・グローバルバランスファンド', 'セゾン・グローバルバランスファンド', 'us_equity', 0.27)
ON CONFLICT DO NOTHING;

-- 5. カバードコール系: alternative → commodity
UPDATE fund_master SET asset_class = 'commodity'
WHERE ticker IN ('JEPI', 'QYLD', 'RYLD') AND asset_class = 'alternative';

-- 6. ゴールドファンド: commodity → gold
UPDATE fund_master SET asset_class = 'gold'
WHERE ticker IN (
  'SBI・iシェアーズ・ゴールドファンド(為替ヘッジなし)',
  'iシェアーズ ゴールドインデックス・ファンド(為替ヘッジなし)'
) AND asset_class = 'commodity';
