-- 039: indicators に指標ごとの基準日を持たせる（2026-11-02）
-- /ma 月次メール（Phase A）で「古いデータで黙って計算しない」ために使う。
-- キー: cape / cape_history / topix_pbr / gold_silver_ratio / momentum_us / momentum_jp / momentum_em / momentum_gold
-- 値: 'YYYY-MM-DD'（その指標が表す日付。取得に失敗したキーは前回の値と基準日を引き継ぐ）
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS as_of jsonb;
