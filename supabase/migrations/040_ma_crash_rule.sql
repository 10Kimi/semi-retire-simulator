-- 040: 暴落ルールを /ma の計算に組み込む（2026-11-02）
-- 待機資金の出口を「CAPE が割安なら投入」から「暴落ルール」に一本化した。
-- SQL Editor では1文ずつ実行すること。

-- 過去最高値と現在値（S&P500 ドル建て・円建て、資産クラスごと）。fetch_indicators.py が書く
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS drawdown jsonb;

-- 暴落ルールの段階と基準残高。{ current, month, monthBase }（src/lib/ma/types.ts の CrashRecord）
ALTER TABLE user_ma_settings ADD COLUMN IF NOT EXISTS crash_state jsonb;
