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

VOL_UPPER = {1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 20, 7: 30}

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


def count_active(w, threshold=0.01):
    return np.sum(w > threshold)


VOL_LOWER = {1: 0, 2: 3, 3: 6, 4: 9, 5: 12, 6: 15, 7: 20}

def optimize_for_level(level):
    vol_max = VOL_UPPER[level] / 100
    vol_min = VOL_LOWER[level] / 100
    # 目標: ボラティリティ帯域の中間〜上限付近でシャープレシオ最大化
    vol_target = (vol_min + vol_max) / 2

    bounds = [(0, 1) for _ in range(N)]
    constraints = [
        {'type': 'eq', 'fun': lambda w: np.sum(w) - 1},
        {'type': 'ineq', 'fun': lambda w: vol_max - portfolio_vol(w)},
        {'type': 'ineq', 'fun': lambda w: portfolio_vol(w) - vol_min},
    ]

    best_result = None
    best_score = -np.inf

    for trial in range(100):
        if trial == 0:
            w0 = np.ones(N) / N
        else:
            w0 = np.random.dirichlet(np.ones(N))

        res = minimize(
            neg_sharpe, w0,
            method='SLSQP', bounds=bounds, constraints=constraints,
            options={'maxiter': 2000, 'ftol': 1e-12}
        )

        if res.success:
            w = res.x
            w = np.maximum(w, 0)
            w /= w.sum()

            vol = portfolio_vol(w)
            if vol < vol_min * 0.95 or vol > vol_max * 1.05:
                continue

            active = count_active(w)
            sharpe = -neg_sharpe(w)

            # 5アセット未満ペナルティ（強め）
            score = sharpe
            if active < 5:
                score -= (5 - active) * 0.5

            if score > best_score:
                best_score = score
                best_result = w

    if best_result is None:
        print(f"  Lv{level}: 最適化失敗")
        return None

    w = best_result
    # 5%刻みに丸め
    w_rounded = np.round(w * 20) / 20  # 5%刻み
    # 丸め後の合計を100%に調整
    diff = 1.0 - w_rounded.sum()
    max_idx = np.argmax(w_rounded)
    w_rounded[max_idx] += diff
    w_rounded = np.maximum(w_rounded, 0)

    vol = portfolio_vol(w_rounded) * 100
    ret = portfolio_ret(w_rounded) * 100
    sharpe = (ret - RISK_FREE_RATE) / vol if vol > 0 else 0

    alloc = {}
    for i, key in enumerate(ASSET_KEYS):
        pct = round(w_rounded[i] * 100)
        if pct > 0:
            alloc[key] = pct

    active = len(alloc)
    print(f"  Lv{level}: vol={vol:.1f}% ret={ret:.1f}% sharpe={sharpe:.2f} assets={active} alloc={alloc}")
    return {
        'risk_level': level,
        'allocations': alloc,
        'expected_return': round(ret, 2),
        'volatility': round(vol, 2),
        'sharpe_ratio': round(sharpe, 2),
    }


def main():
    print("=== 最適ポートフォリオ計算 ===")
    results = []
    for lv in range(1, 8):
        r = optimize_for_level(lv)
        if r:
            results.append(r)

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
