#!/usr/bin/env python3
"""S&P500 の過去最高値と現在値だけを取得して、最後の行に JSON で出す（/ma 暴落ルールの通知用、FI_project #34）。

月次メールの送信日以外の日に scripts/ma-mail/run.ts が呼ぶ。DB には書かない（共有の indicators は月次の取得のまま）。
取得のしかたは fetch_indicators.py の fetch_drawdown と同じ（日足・全期間の終値）。ほかの指標・資産クラスは取らない。
出力（最後の行）：{"sp500_usd": {last, lastDate, ath, athDate} | null, "sp500_jpy": {...} | null}
"""
import contextlib
import json
import sys

from fetch_indicators import _daily_closes, _price_point


def main():
    out = {"sp500_usd": None, "sp500_jpy": None}
    with contextlib.redirect_stdout(sys.stderr):  # yfinance などの出力は stderr へ（stdout は JSON だけ）
        try:
            gspc = _daily_closes("^GSPC")
            out["sp500_usd"] = _price_point(gspc)
            try:
                fx = _daily_closes("USDJPY=X")
                out["sp500_jpy"] = _price_point((gspc * fx.reindex(gspc.index, method="ffill")).dropna())
            except Exception as e:
                print(f"  S&P500 円建てエラー: {e}")
        except Exception as e:
            print(f"  S&P500 ドル建てエラー: {e}")
    print(json.dumps(out))
    return 0 if out["sp500_usd"] else 1


if __name__ == "__main__":
    sys.exit(main())
