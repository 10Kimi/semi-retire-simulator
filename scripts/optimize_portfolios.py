"""
最適ポートフォリオ計算スクリプト
13アセット・相関行列あり・シャープレシオ最大化
各リスクレベル（Lv1〜7）のボラティリティ上限内で最適化

使い方:
  pip install numpy scipy
  export SUPABASE_URL=xxx
  export SUPABASE_SERVICE_KEY=xxx
  python scripts/optimize_portfolios.py
"""

import json
import os
import sys
import itertools
import numpy as np
from scipy.optimize import minimize

# --- 13アセットクラス定義 ---
ASSET_KEYS = [
    'cash', 'japan_equity', 'us_equity', 'developed_equity', 'emerging_equity',
    'japan_bond', 'developed_bond', 'emerging_bond',
    'japan_reit', 'developed_reit', 'emerging_reit', 'commodity', 'gold',
]

# 期待リターン（%）
RETURNS = {
    'cash': 0.1, 'japan_equity': 5.6, 'us_equity': 7.2, 'developed_equity': 6.5,
    'emerging_equity': 7.8, 'japan_bond': 0.7, 'developed_bond': 2.6,
    'emerging_bond': 4.2, 'japan_reit': 4.5, 'developed_reit': 5.8,
    'emerging_reit': 6.5, 'commodity': 3.5, 'gold': 3.0,
}

# ボラティリティ（%）
RISKS = {
    'cash': 0.5, 'japan_equity': 18.0, 'us_equity': 20.0, 'developed_equity': 19.0,
    'emerging_equity': 24.0, 'japan_bond': 2.5, 'developed_bond': 8.0,
    'emerging_bond': 12.0, 'japan_reit': 16.0, 'developed_reit': 18.0,
    'emerging_reit': 22.0, 'commodity': 18.0, 'gold': 15.0,
}

# 相関行列（13x13）
CORR_FLAT = [
    # cash  jp_eq  us_eq  dev_eq em_eq  jp_bd  dev_bd em_bd  jp_rt  dev_rt em_rt  commo  gold
    [ 1.00,  0.00, -0.05,  0.00,  0.00,  0.30,  0.20,  0.10,  0.05,  0.00,  0.00,  0.05,  0.10],
    [ 0.00,  1.00,  0.65,  0.70,  0.55, -0.10,  0.05,  0.20,  0.45,  0.40,  0.35,  0.15,  0.05],
    [-0.05,  0.65,  1.00,  0.85,  0.65, -0.15,  0.10,  0.30,  0.40,  0.65,  0.50,  0.20,  0.00],
    [ 0.00,  0.70,  0.85,  1.00,  0.70, -0.10,  0.15,  0.35,  0.40,  0.55,  0.45,  0.20,  0.05],
    [ 0.00,  0.55,  0.65,  0.70,  1.00, -0.05,  0.10,  0.50,  0.30,  0.45,  0.60,  0.25,  0.10],
    [ 0.30, -0.10, -0.15, -0.10, -0.05,  1.00,  0.30,  0.15,  0.20,  0.05,  0.00,  0.05,  0.10],
    [ 0.20,  0.05,  0.10,  0.15,  0.10,  0.30,  1.00,  0.50,  0.15,  0.20,  0.15,  0.10,  0.25],
    [ 0.10,  0.20,  0.30,  0.35,  0.50,  0.15,  0.50,  1.00,  0.20,  0.30,  0.40,  0.20,  0.15],
    [ 0.05,  0.45,  0.40,  0.40,  0.30,  0.20,  0.15,  0.20,  1.00,  0.55,  0.40,  0.10,  0.10],
    [ 0.00,  0.40,  0.65,  0.55,  0.45,  0.05,  0.20,  0.30,  0.55,  1.00,  0.55,  0.15,  0.05],
    [ 0.00,  0.35,  0.50,  0.45,  0.60,  0.00,  0.15,  0.40,  0.40,  0.55,  1.00,  0.20,  0.10],
    [ 0.05,  0.15,  0.20,  0.20,  0.25,  0.05,  0.10,  0.20,  0.10,  0.15,  0.20,  1.00,  0.40],
    [ 0.10,  0.05,  0.00,  0.05,  0.10,  0.10,  0.25,  0.15,  0.10,  0.05,  0.10,  0.40,  1.00],
]

RISK_FREE_RATE = 0.5  # %

VOL_UPPER = {1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 20, 7: 50}

N = len(ASSET_KEYS)
mu = np.array([RETURNS[k] / 100 for k in ASSET_KEYS])
sigma = np.array([RISKS[k] / 100 for k in ASSET_KEYS])
corr = np.array(CORR_FLAT)
cov = np.outer(sigma, sigma) * corr
rf = RISK_FREE_RATE / 100


def portfolio_vol(w):
    return np.sqrt(w @ cov @ w)


def portfolio_ret(w):
    return w @ mu


def neg_sharpe(w):
    vol = portfolio_vol(w)
    if vol < 1e-10:
        return 0
    return -(portfolio_ret(w) - rf) / vol


# --- 最適化方針（2026-06-20 改修） ---
# 1. 資産数は最大5（"5前後に絞る"）。SLSQP の乱択初期値では疎な解にならないため、
#    サイズ2〜5の全部分集合を総当たりし、各集合内で連続ウェイト最適化する確実な方式に変更。
# 2. vol 目標を帯の上部（実効上限の90%）に据える＝下限を 0.9×上限 に設定し上部帯を狙う。
# 3. L7 の VOL_UPPER=50 はセンチネル（アセット universe の実ボラ上限を超える）。
#    実効上限をアセット最大ボラ相当の 24% とする。
MAX_ASSETS = 5
VOL_TARGET_RATIO = 0.90  # 実効上限の90%を vol 下限に据えて上部帯を狙う
EFF_UPPER = {1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 20, 7: 24}

# 単一アセット上限（ウェイト割合）。基本は全レベル共通。
CAPS = {'emerging_bond': 0.25, 'emerging_equity': 0.50}
# レベル別の上限オーバーライド（指定キーは基本値を上書き／新規追加）。
# Lv7（超積極）のみ：新興株を 65% まで許容して vol≥20% 帯に到達させつつ、新興REIT を 15% に抑える。
LEVEL_CAPS = {7: {'emerging_equity': 0.65, 'emerging_reit': 0.15}}


def _caps_for(level):
    merged = dict(CAPS)
    merged.update(LEVEL_CAPS.get(level, {}))
    return {ASSET_KEYS.index(k): v for k, v in merged.items()}


# レベル別の最低アセット数（指定なきレベルは下限2）。Lv7 は集中回避のため最低4。
MIN_ASSETS = {7: 4}

# レベル別の vol 下限オーバーライド（絶対値）。指定なきレベルは 実効上限×VOL_TARGET_RATIO。
# Lv7：実効上限24%×0.9=21.6% は caps 下で到達不能なため、Lv7 定義の下限 20% を採用。
LEVEL_VOL_MIN = {7: 0.20}


def _solve_subset(idx, vol_min, vol_max, floor, caps_idx):
    """部分集合 idx 内で max sharpe（sum=1, floor<=w<=cap, vol∈[vol_min,vol_max]）。連続解を返す。"""
    sub_mu = mu[idx]
    sub_cov = cov[np.ix_(idx, idx)]
    n = len(idx)

    def vol(w):
        return float(np.sqrt(w @ sub_cov @ w))

    def neg_sharpe(w):
        v = vol(w)
        return 0.0 if v < 1e-10 else -(w @ sub_mu - rf) / v

    cons = [
        {'type': 'eq', 'fun': lambda w: np.sum(w) - 1},
        {'type': 'ineq', 'fun': lambda w: vol_max - vol(w)},
        {'type': 'ineq', 'fun': lambda w: vol(w) - vol_min},
    ]
    bounds = [(floor, caps_idx.get(idx[p], 1.0)) for p in range(n)]
    # floor の合計が1を超える / caps の合計が1未満 なら実行不能
    if floor * n > 1.0 + 1e-9 or sum(b[1] for b in bounds) < 1.0 - 1e-9:
        return None, -np.inf
    best_w, best_s = None, -np.inf
    rng = np.random.default_rng(12345)
    for t in range(4):
        w0 = np.ones(n) / n if t == 0 else rng.dirichlet(np.ones(n))
        res = minimize(
            neg_sharpe, w0,
            method='SLSQP', bounds=bounds, constraints=cons,
            options={'maxiter': 2000, 'ftol': 1e-12},
        )
        if not res.success:
            continue
        w = np.maximum(res.x, 0)
        if w.sum() <= 0:
            continue
        w /= w.sum()
        v = vol(w)
        if v < vol_min * 0.99 or v > vol_max * 1.01:
            continue
        s = -neg_sharpe(w)
        if s > best_s:
            best_s, best_w = s, w
    return best_w, best_s


def _finalize_pct(w, caps_idx):
    """5%刻みの整数%（合計100）に丸め、caps を満たすよう調整して返す。"""
    pct = (np.round(w * 20) * 5).astype(int)  # 5の倍数%
    pct = np.maximum(pct, 0)
    # 上限クランプ
    for g, cv in caps_idx.items():
        capp = int(round(cv * 100))
        if pct[g] > capp:
            pct[g] = capp
    # 合計100へ調整（差分は5の倍数）
    diff = 100 - int(pct.sum())
    guard = 0
    while diff != 0 and guard < 100:
        guard += 1
        order = np.argsort(-pct)
        if diff > 0:
            placed = False
            for g in order:  # 既存の非ゼロ資産で上限に触れないものへ加算
                capp = int(round(caps_idx.get(g, 1.0) * 100))
                if pct[g] > 0 and pct[g] + 5 <= capp:
                    pct[g] += 5; diff -= 5; placed = True; break
            if not placed:
                break
        else:
            removed = False
            for g in order:  # まず 5% 超の資産から減算（資産数を保つ）
                if pct[g] > 5:
                    pct[g] -= 5; diff += 5; removed = True; break
            if not removed:
                for g in order:
                    if pct[g] >= 5:
                        pct[g] -= 5; diff += 5; removed = True; break
            if not removed:
                break
    return pct


def optimize_for_level(level):
    vol_max = EFF_UPPER[level] / 100
    vol_min = LEVEL_VOL_MIN.get(level, vol_max * VOL_TARGET_RATIO)  # 既定は上限の90%を狙う
    min_assets = MIN_ASSETS.get(level, 2)
    floor = 0.05 if level in MIN_ASSETS else 0.0  # 最低資産数を課すレベルは各5%以上で確実に残す
    caps_idx = _caps_for(level)

    best = None  # (pct, vol, ret, sharpe, active)
    best_score = -np.inf
    for size in range(min_assets, MAX_ASSETS + 1):
        for combo in itertools.combinations(range(N), size):
            idx = list(combo)
            w, _ = _solve_subset(idx, vol_min, vol_max, floor, caps_idx)
            if w is None:
                continue
            full = np.zeros(N)
            full[idx] = w
            pct = _finalize_pct(full, caps_idx)  # 制約はすべて最終(丸め後)PFで判定
            wv = pct / 100.0
            v = portfolio_vol(wv) * 100
            r = portfolio_ret(wv) * 100
            active = int((pct > 0).sum())
            # 最終PFでの制約チェック
            if v > vol_max * 100 + 1e-9:          # vol 上限クランプ（Lv1 の丸め超過もここで排除）
                continue
            if active < min_assets or active > MAX_ASSETS:
                continue
            if any(pct[g] > int(round(cv * 100)) for g, cv in caps_idx.items()):
                continue
            sharpe = (r - RISK_FREE_RATE) / v if v > 0 else 0
            if sharpe > best_score:
                best_score = sharpe
                best = (pct.copy(), v, r, sharpe, active)

    if best is None:
        print(f"  Lv{level}: 実行可能解なし (band={vol_min*100:.1f}-{vol_max*100:.1f}%, min_assets={min_assets})")
        return None

    pct, vol, ret, sharpe, active = best
    alloc = {ASSET_KEYS[i]: int(pct[i]) for i in range(N) if pct[i] > 0}
    print(f"  Lv{level}: vol={vol:.1f}% ret={ret:.1f}% sharpe={sharpe:.2f} assets={active} alloc={alloc}")
    return {
        'risk_level': level,
        'allocations': alloc,
        'expected_return': round(float(ret), 2),
        'volatility': round(float(vol), 2),
        'sharpe_ratio': round(float(sharpe), 2),
    }


def main():
    apply = '--apply' in sys.argv
    print(f"=== 最適ポートフォリオ計算 (上限{MAX_ASSETS}資産 / vol目標=実効上限の{int(VOL_TARGET_RATIO*100)}%) ===")
    results = []
    for lv in range(1, 8):
        r = optimize_for_level(lv)
        if r:
            results.append(r)

    # --apply 無しは dry-run（DB 未反映）。報告→承認→反映の順を担保する。
    if not apply:
        print("\n[dry-run] DB には未反映です。反映するには --apply を付けて実行してください。")
        return

    # Supabaseにupsert
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_KEY')

    if url and key:
        import requests
        headers = {
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
        }
        for r in results:
            payload = {
                'risk_level': r['risk_level'],
                'allocations': r['allocations'],
                'expected_return': r['expected_return'],
                'volatility': r['volatility'],
                'sharpe_ratio': r['sharpe_ratio'],
            }
            resp = requests.post(
                f'{url}/rest/v1/optimal_portfolios',
                headers=headers,
                json=payload,
            )
            if resp.status_code in (200, 201):
                print(f"  Lv{r['risk_level']}: Supabaseにupsert完了")
            else:
                print(f"  Lv{r['risk_level']}: upsert失敗 {resp.status_code} {resp.text}")
    else:
        print("\n--- Supabase未設定。SQL出力: ---")
        for r in results:
            alloc_json = json.dumps(r['allocations'])
            print(f"INSERT INTO optimal_portfolios (risk_level, allocations, expected_return, volatility, sharpe_ratio)")
            print(f"VALUES ({r['risk_level']}, '{alloc_json}', {r['expected_return']}, {r['volatility']}, {r['sharpe_ratio']})")
            print(f"ON CONFLICT (risk_level) DO UPDATE SET allocations=EXCLUDED.allocations, expected_return=EXCLUDED.expected_return, volatility=EXCLUDED.volatility, sharpe_ratio=EXCLUDED.sharpe_ratio, updated_at=now();")
            print()


if __name__ == '__main__':
    main()
