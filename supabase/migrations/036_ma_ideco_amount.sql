-- 036_ma_ideco_amount.sql
-- 月次予算に含めた iDeCo/401k の掛金を配分対象から除外するための列。
--
-- 背景: 「毎月15万円投資する」と考えるとき、その中に iDeCo の掛金が含まれるのが自然。
-- しかし /ma は monthly_budget からスロット合計を引いた差額を待機資金として積む設計のため、
-- iDeCo 分を含んだ予算を入れると、実際には手元に無いお金が毎月待機資金として累積し、
-- 割安時に「存在しない資金を投入せよ」と指示が出てしまう。
--
-- ideco_amount は表示・控除のみに使い、スロット配分やバリュエーション調整の対象にはしない
-- （掛金は年1回しか変更できず、商品ラインナップも運営管理機関ごとに異なるため）。
--
-- 適用: Supabase SQL Editor で実行（本プロジェクトは CLI 未使用）。

ALTER TABLE user_ma_settings ADD COLUMN ideco_amount numeric NOT NULL DEFAULT 0;
