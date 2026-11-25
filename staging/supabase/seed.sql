-- 試験用（semi-retire-staging）だけに入れる架空のサンプル（FI_project #137）
-- 本番には入れない（本番の作業ディレクトリ supabase/ には seed.sql を置かない）。
-- 実データは写さない（D-065）。利用者はプレビューの画面から架空のメールアドレスで登録して作る。
-- 資産クラスの前提（asset_class_params）・モデル配分・fund_master は migration の中で入るので、ここでは足さない。

-- /ma が読む指標（数字は架空。本番の取得スクリプト fetch_indicators.py は試験用に向けない）
INSERT INTO indicators (fetched_at, cape, cape_history, topix_pbr, gold_silver_ratio, gold_price, silver_price, momentum, as_of)
SELECT now(), 30.0, '[]'::jsonb, 1.4, 80.0, 2000, 25,
       '{"us": {"above_ma": true, "last_price": 5000, "ma10": 4800}, "jp": {"above_ma": true, "last_price": 2500, "ma10": 2400}, "gold": {"above_ma": true, "last_price": 2000, "ma10": 1900}}'::jsonb,
       jsonb_build_object('cape', to_char(now(), 'YYYY-MM-DD'), 'topix_pbr', to_char(now(), 'YYYY-MM-DD'), 'gold_silver_ratio', to_char(now(), 'YYYY-MM-DD'))
WHERE NOT EXISTS (SELECT 1 FROM indicators);
