#!/usr/bin/env python3
"""
fetch_indicators.py — 月次投資アドバイザー用の指標を自動取得してJSONに保存

取得データ:
  1. 米国CAPE (Shiller PE) — Yale公開Excel
  2. TOPIX PBR — yfinance (1306.T ETF proxy)
  3. 金銀比率 — yfinance (GC=F / SI=F)
  4. モメンタム（10ヶ月MA比較）— yfinance (^GSPC, ^N225, GC=F)

出力: indicators.json（HTMLと同じディレクトリ）
"""

import json
import os
import sys
from datetime import datetime

import pandas as pd
import yfinance as yf

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "indicators.json")

# Supabase設定（環境変数から取得）
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


def fetch_cape():
    """米国CAPE (Shiller PE) を multpl.com からスクレイピング"""
    print("  CAPE: multpl.com から取得中...")
    try:
        import re
        import requests
        from bs4 import BeautifulSoup
        resp = requests.get("https://www.multpl.com/shiller-pe", timeout=10,
                           headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(resp.text, "lxml")
        text = soup.get_text()
        match = re.search(r"Current\s+Shiller PE Ratio:\s*([\d.]+)", text)
        if match:
            cape = float(match.group(1))
            print(f"  CAPE: {cape}")
            return cape
        print("  CAPE: パース失敗")
        return None
    except Exception as e:
        print(f"  CAPEエラー: {e}")
        return None


def fetch_cape_history(months=60):
    """CAPE月次履歴を取得（5年分=60ヶ月）"""
    print(f"  CAPE履歴: multpl.com から過去{months}ヶ月分を取得中...")
    try:
        import requests
        from bs4 import BeautifulSoup

        resp = requests.get("https://www.multpl.com/shiller-pe/table/by-month",
                           timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(resp.text, "lxml")
        table = soup.find("table")
        if not table:
            print("  CAPE履歴: テーブルが見つかりません")
            return []

        rows = table.find_all("tr")
        history = []
        for row in rows[1:]:  # ヘッダー行をスキップ
            cells = [c.get_text(strip=True) for c in row.find_all("td")]
            if len(cells) >= 2:
                try:
                    date_str = cells[0]
                    cape_val = float(cells[1])
                    # "Mar 1, 2026" → "2026年3月" に変換
                    dt = datetime.strptime(date_str, "%b %d, %Y")
                    label = dt.strftime("%Y年%-m月")
                    history.append({"date": label, "cape": cape_val})
                except (ValueError, IndexError):
                    continue

            if len(history) >= months:
                break

        # 月初のデータのみ残す（月末の速報値と重複回避）
        seen_months = set()
        deduped = []
        for h in history:
            month_key = h["date"]
            if month_key not in seen_months:
                seen_months.add(month_key)
                deduped.append(h)

        # 古い順に並べる
        deduped.reverse()

        if deduped:
            avg = sum(h["cape"] for h in deduped) / len(deduped)
            print(f"  CAPE履歴: {len(deduped)}ヶ月分取得（5年MA: {avg:.2f}）")
        return deduped
    except Exception as e:
        print(f"  CAPE履歴エラー: {e}")
        return []


def fetch_topix_pbr():
    """TOPIX PBR を JPX公式Excel（規模別・業種別PER・PBR）から取得"""
    print("  TOPIX PBR: JPX Excelから取得中...")
    try:
        import re
        import requests
        from bs4 import BeautifulSoup
        from io import BytesIO

        # JPXページから最新ExcelのURLを取得
        page_url = "https://www.jpx.co.jp/markets/statistics-equities/misc/04.html"
        resp = requests.get(page_url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(resp.text, "lxml")

        # perpbrYYYYMM.xlsx リンクを探す（最新月）
        xlsx_links = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            match = re.search(r"perpbr(\d{6})\.xlsx", href)
            if match:
                xlsx_links.append((match.group(1), href))

        if not xlsx_links:
            print("  JPX Excelリンクが見つかりません")
            return None

        # 最新月のExcelを取得
        xlsx_links.sort(key=lambda x: x[0], reverse=True)
        latest_month, latest_href = xlsx_links[0]

        if latest_href.startswith("/"):
            latest_href = "https://www.jpx.co.jp" + latest_href

        print(f"  最新Excel: {latest_month} ({latest_href.split('/')[-1]})")
        resp = requests.get(latest_href, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        df = pd.read_excel(BytesIO(resp.content), engine="openpyxl", header=None)

        # プライム市場・総合の行を探す（加重PBR）
        for i, row in df.iterrows():
            vals = [str(v) for v in row.values if pd.notna(v)]
            joined = " ".join(vals)
            if "プライム" in joined and "総合" in joined and "金融" not in joined:
                # 加重PBR は12列目（0始まりで11）
                pbr_val = row.iloc[11]
                if pd.notna(pbr_val):
                    pbr = round(float(pbr_val), 2)
                    print(f"  TOPIX PBR (プライム総合・加重): {pbr}")
                    return pbr

        print("  TOPIX PBR: Excelから抽出できませんでした")
        return None
    except Exception as e:
        print(f"  TOPIX PBRエラー: {e}")
        return None


def fetch_gold_silver_ratio():
    """金銀比率を取得"""
    print("  金銀比率: yfinance (GC=F / SI=F)...")
    try:
        gold = yf.download("GC=F", period="5d", progress=False)
        silver = yf.download("SI=F", period="5d", progress=False)

        gold_close = gold["Close"].dropna()
        silver_close = silver["Close"].dropna()
        # MultiIndex対応（yfinance 1.x）
        if hasattr(gold_close, 'columns'):
            gold_close = gold_close.iloc[:, 0]
        if hasattr(silver_close, 'columns'):
            silver_close = silver_close.iloc[:, 0]
        gold_price = float(gold_close.iloc[-1])
        silver_price = float(silver_close.iloc[-1])

        ratio = round(gold_price / silver_price, 1)
        print(f"  金: ${gold_price:.2f}, 銀: ${silver_price:.2f}, 比率: {ratio}")
        return ratio, gold_price, silver_price
    except Exception as e:
        print(f"  金銀比率エラー: {e}")
        return None, None, None


def fetch_momentum():
    """10ヶ月MA比較でモメンタム判定"""
    print("  モメンタム: yfinance...")
    targets = {
        "us": {"ticker": "^GSPC", "label": "S&P 500"},
        "jp": {"ticker": "^N225", "label": "日経225"},
        "em": {"ticker": "VWO", "label": "新興国(VWO)"},
        "gold": {"ticker": "GC=F", "label": "ゴールド"},
    }

    results = {}
    for key, info in targets.items():
        try:
            df = yf.download(info["ticker"], period="2y", interval="1mo", progress=False)
            if df.empty or len(df) < 11:
                print(f"  {info['label']}: データ不足")
                results[key] = {"above_ma": True, "label": info["label"]}
                continue

            close = df["Close"].dropna()
            # MultiIndex対応
            if hasattr(close, 'columns'):
                close = close.iloc[:, 0]

            last_price = float(close.iloc[-1])
            ma10 = float(close.rolling(10).mean().iloc[-1])
            above = last_price > ma10

            print(f"  {info['label']}: {last_price:.0f} vs MA10 {ma10:.0f} → {'上昇' if above else '下落'}")
            results[key] = {
                "above_ma": above,
                "last_price": round(last_price, 2),
                "ma10": round(ma10, 2),
                "label": info["label"],
            }
        except Exception as e:
            print(f"  {info['label']}エラー: {e}")
            results[key] = {"above_ma": True, "label": info["label"]}

    return results


def main():
    print("=" * 50)
    print(f"指標自動取得 — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 50)

    cape = fetch_cape()
    cape_history = fetch_cape_history()
    pbr = fetch_topix_pbr()
    gsr, gold_price, silver_price = fetch_gold_silver_ratio()
    momentum = fetch_momentum()

    data = {
        "fetched_at": datetime.now().isoformat(),
        "cape": cape,
        "cape_history": cape_history,
        "topix_pbr": pbr,
        "gold_silver_ratio": gsr,
        "gold_price": gold_price,
        "silver_price": silver_price,
        "momentum": momentum,
    }

    # ローカルJSON出力（動作確認用に残す）
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\nローカル保存: {OUTPUT_FILE}")

    # Supabase upsert
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        upsert_to_supabase(data)
    else:
        print("⚠️ SUPABASE_URL/SUPABASE_SERVICE_KEY が未設定。ローカルのみ保存。")

    print()
    print("サマリー:")
    print(f"  CAPE:      {cape or '取得失敗'}")
    print(f"  TOPIX PBR: {pbr or '取得失敗'}")
    print(f"  金銀比率:  {gsr or '取得失敗'}")
    if momentum:
        for key, m in momentum.items():
            status = "上昇" if m.get("above_ma") else "下落"
            print(f"  {m['label']}: {status}")


def upsert_to_supabase(data: dict):
    """indicatorsテーブルにupsert（最新1行を上書き）"""
    import requests

    print("\nSupabase upsert中...")

    # 既存レコードを確認
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    # 最新1件を取得
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/indicators?select=id&order=fetched_at.desc&limit=1",
        headers=headers,
        timeout=10,
    )
    existing = resp.json() if resp.status_code == 200 else []

    row = {
        "fetched_at": data["fetched_at"],
        "cape": data.get("cape"),
        "cape_history": data.get("cape_history", []),
        "topix_pbr": data.get("topix_pbr"),
        "gold_silver_ratio": data.get("gold_silver_ratio"),
        "gold_price": data.get("gold_price"),
        "silver_price": data.get("silver_price"),
        "momentum": data.get("momentum", {}),
    }

    if existing:
        # 既存レコードを更新
        record_id = existing[0]["id"]
        resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/indicators?id=eq.{record_id}",
            headers=headers,
            json=row,
            timeout=10,
        )
    else:
        # 新規挿入
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/indicators",
            headers=headers,
            json=row,
            timeout=10,
        )

    if resp.status_code in (200, 201, 204):
        print(f"✅ Supabase upsert完了")
    else:
        print(f"❌ Supabase upsertエラー: {resp.status_code} {resp.text[:200]}")


def serve_and_open():
    """HTTPサーバーを起動してブラウザで開く"""
    import http.server
    import socketserver
    import threading
    import webbrowser

    PORT = 8765
    os.chdir(SCRIPT_DIR)

    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print(f"サーバー起動: {url}")
        print("終了するには Ctrl+C")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nサーバー停止")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--serve", action="store_true", help="データ取得後にHTTPサーバーを起動してブラウザで開く")
    parser.add_argument("--fetch-only", action="store_true", help="データ取得のみ（サーバー起動しない）")
    args = parser.parse_args()

    main()

    if args.serve or not args.fetch_only:
        serve_and_open()
