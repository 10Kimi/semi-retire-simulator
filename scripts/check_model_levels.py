"""
モデル配分のレベル照合（月次パラメータ更新後に実行）

各リスクレベルのモデル配分（src/lib/rb/types.ts の MODEL_ALLOCATIONS）を
DB の最新 asset_class_params で再計算し、アプリと同じ判定（classifyRiskLevel7）で
ラベルどおりのレベルになるかを照合する。不一致なら通知して exit 1。

背景：2026-10-30 のパラメータ更新で Lv7 のモデル配分が 16.5026% になり、
アプリの丸め後 16.50 が境界 <=16.5 に掛かって Lv6 と判定される矛盾が本番で起きた。
パラメータは毎月動くので、更新のたびに機械的に照合する。

- 判定しきい値は pfSimple.ts の classifyRiskLevel7 から読み取る（定数を二重管理しない）
- 丸めはアプリに合わせて2通り（/pf 等＝小数2桁、/portfolio＝小数1桁）で判定する
- 境界まで MARGIN_PT 未満のレベルは警告（不一致ではないが次の更新で崩れうる）
- 標準ライブラリのみ（launchd から venv なしで動かすため）

使い方:
  python3 scripts/check_model_levels.py            # 照合のみ
  python3 scripts/check_model_levels.py --notify   # 結果を macOS 通知でも出す（launchd の月次ジョブ用）
"""
import json
import math
import os
import re
import subprocess
import sys
import urllib.request
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TYPES_TS = os.path.join(ROOT, 'src/lib/rb/types.ts')
PF_SIMPLE_TS = os.path.join(ROOT, 'src/logic/pfSimple.ts')
ENV_FILE = os.path.join(ROOT, 'scripts/market/.env')

MARGIN_PT = 0.2  # 境界までの余裕がこれ未満なら警告


def load_env(path):
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip().removeprefix('export ').strip()] = v.strip().strip('"\'')
    return env


def load_model_allocations():
    src = open(TYPES_TS).read()
    block = re.search(r'MODEL_ALLOCATIONS[^=]*=\s*\{(.*?)\n\};', src, re.S).group(1)
    models = {}
    for lv, body in re.findall(r'(\d+):\s*\{([^}]*)\}', block):
        models[int(lv)] = {k: float(v) for k, v in re.findall(r'(\w+):\s*([\d.]+)', body)}
    if sorted(models) != list(range(1, 8)):
        raise RuntimeError(f'MODEL_ALLOCATIONS の読み取りに失敗: levels={sorted(models)}')
    return models


def load_thresholds():
    """classifyRiskLevel7 の `if (volatility <= X) return N;` を読み取る。"""
    src = open(PF_SIMPLE_TS).read()
    body = re.search(r'function classifyRiskLevel7\(.*?\n\}', src, re.S).group(0)
    pairs = [(float(x), int(n)) for x, n in re.findall(r'volatility <= ([\d.]+)\) return (\d+)', body)]
    if [n for _, n in pairs] != list(range(1, 7)):
        raise RuntimeError(f'classifyRiskLevel7 の読み取りに失敗: {pairs}')
    return pairs


def classify(vol, thresholds):
    for upper, level in thresholds:
        if vol <= upper:
            return level
    return 7


def load_params(env):
    url = env['SUPABASE_URL'].rstrip('/') + '/rest/v1/asset_class_params?select=asset_class,volatility,correlation,updated_at'
    key = env['SUPABASE_SERVICE_KEY']
    req = urllib.request.Request(url, headers={'apikey': key, 'Authorization': f'Bearer {key}'})
    with urllib.request.urlopen(req, timeout=30) as r:
        rows = json.load(r)
    if not rows:
        raise RuntimeError('asset_class_params が空')
    return rows


def portfolio_vol(alloc, rows):
    """pfSimple.ts と同じ式。ウェイトは配分合計で正規化する。"""
    risks = {r['asset_class']: r['volatility'] for r in rows}
    corr = {r['asset_class']: r['correlation'] or {} for r in rows}
    total = sum(alloc.values())
    w = {k: v / total for k, v in alloc.items()}
    var = 0.0
    for ki, wi in w.items():
        for kj, wj in w.items():
            rho = corr.get(ki, {}).get(kj, 1 if ki == kj else 0)
            var += wi * wj * risks.get(ki, 0) / 100 * risks.get(kj, 0) / 100 * rho
    return math.sqrt(max(var, 0)) * 100


def notify(message):
    # ensure_ascii=False：\uXXXX 形式は AppleScript が読めず構文エラーになる
    script = f'display notification {json.dumps(message, ensure_ascii=False)} with title "モデル配分のレベル照合"'
    subprocess.run(['osascript', '-e', script], check=False)


def main():
    send_notify = '--notify' in sys.argv
    thresholds = load_thresholds()
    models = load_model_allocations()
    rows = load_params(load_env(ENV_FILE))
    updated = max(r['updated_at'] for r in rows)[:10]
    bounds = [u for u, _ in thresholds]

    print(f'[{datetime.now():%Y-%m-%d %H:%M}] params 更新日 {updated} / 境界 {bounds}')
    mismatches, warnings = [], []
    for lv in range(1, 8):
        raw = portfolio_vol(models[lv], rows)
        v2, v1 = round(raw, 2), round(raw, 1)
        l2, l1 = classify(v2, thresholds), classify(v1, thresholds)
        margin = min(abs(raw - b) for b in bounds)
        status = 'OK'
        if l2 != lv or l1 != lv:
            status = 'NG'
            mismatches.append(f'Lv{lv}: vol {raw:.4f}% → 判定 Lv{l2}(2桁)/Lv{l1}(1桁)')
        elif margin < MARGIN_PT:
            status = '注意'
            warnings.append(f'Lv{lv}: vol {raw:.4f}% 境界まで {margin:.2f}pt')
        print(f'  Lv{lv}: vol={raw:.4f}%  判定 2桁=Lv{l2} 1桁=Lv{l1}  境界まで {margin:.2f}pt  {status}')

    if mismatches:
        print('不一致あり: ' + ' / '.join(mismatches))
        if send_notify:
            notify('ラベルと判定が不一致: ' + ' / '.join(mismatches))
        sys.exit(1)
    if warnings:
        print('警告: ' + ' / '.join(warnings))
        if send_notify:
            notify('境界に接近: ' + ' / '.join(warnings))
    print('全レベル一致')
    # 一致した月も通知する。通知が来なければジョブ自体が動いていないと分かるように。
    if send_notify and not warnings:
        notify(f'全レベル一致（params 更新日 {updated}）')


if __name__ == '__main__':
    main()
