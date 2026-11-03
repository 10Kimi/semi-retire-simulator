"""#12 ステップ1 検算：/portfolio の分析とモンテカルロの期待値を仕様だけから計算する。
標準ライブラリのみ。実装（src/）は読んでいない。
出力: verify/portfolio/expected_step1.json
"""
import json
import math
from fractions import Fraction
from pathlib import Path

KEYS = ['cash', 'japan_equity', 'us_equity', 'developed_equity', 'emerging_equity',
        'japan_bond', 'developed_bond', 'emerging_bond',
        'japan_reit', 'developed_reit', 'emerging_reit', 'commodity', 'gold']
RET = dict(cash=0.1, japan_equity=5.6, us_equity=7.2, developed_equity=6.5, emerging_equity=7.8,
           japan_bond=0.7, developed_bond=2.6, emerging_bond=4.2, japan_reit=4.5,
           developed_reit=5.8, emerging_reit=6.5, commodity=3.5, gold=3.0)
RISK = dict(cash=0.5, japan_equity=18.0, us_equity=20.0, developed_equity=19.0, emerging_equity=24.0,
            japan_bond=2.5, developed_bond=8.0, emerging_bond=12.0, japan_reit=16.0,
            developed_reit=18.0, emerging_reit=22.0, commodity=18.0, gold=15.0)
FLAT = [
    [1.00, 0.00, -0.05, 0.00, 0.00, 0.30, 0.20, 0.10, 0.05, 0.00, 0.00, 0.05, 0.10],
    [0.00, 1.00, 0.65, 0.70, 0.55, -0.10, 0.05, 0.20, 0.45, 0.40, 0.35, 0.15, 0.05],
    [-0.05, 0.65, 1.00, 0.85, 0.65, -0.15, 0.10, 0.30, 0.40, 0.65, 0.50, 0.20, 0.00],
    [0.00, 0.70, 0.85, 1.00, 0.70, -0.10, 0.15, 0.35, 0.40, 0.55, 0.45, 0.20, 0.05],
    [0.00, 0.55, 0.65, 0.70, 1.00, -0.05, 0.10, 0.50, 0.30, 0.45, 0.60, 0.25, 0.10],
    [0.30, -0.10, -0.15, -0.10, -0.05, 1.00, 0.30, 0.15, 0.20, 0.05, 0.00, 0.05, 0.10],
    [0.20, 0.05, 0.10, 0.15, 0.10, 0.30, 1.00, 0.50, 0.15, 0.20, 0.15, 0.10, 0.25],
    [0.10, 0.20, 0.30, 0.35, 0.50, 0.15, 0.50, 1.00, 0.20, 0.30, 0.40, 0.20, 0.15],
    [0.05, 0.45, 0.40, 0.40, 0.30, 0.20, 0.15, 0.20, 1.00, 0.55, 0.40, 0.10, 0.10],
    [0.00, 0.40, 0.65, 0.55, 0.45, 0.05, 0.20, 0.30, 0.55, 1.00, 0.55, 0.15, 0.05],
    [0.00, 0.35, 0.50, 0.45, 0.60, 0.00, 0.15, 0.40, 0.40, 0.55, 1.00, 0.20, 0.10],
    [0.05, 0.15, 0.20, 0.20, 0.25, 0.05, 0.10, 0.20, 0.10, 0.15, 0.20, 1.00, 0.40],
    [0.10, 0.05, 0.00, 0.05, 0.10, 0.10, 0.25, 0.15, 0.10, 0.05, 0.10, 0.40, 1.00],
]
# 対称性チェック
for i in range(13):
    for j in range(13):
        assert FLAT[i][j] == FLAT[j][i], (KEYS[i], KEYS[j])

MODEL = {
    1: dict(cash=35, us_equity=10, japan_bond=35, developed_bond=15, gold=5),
    2: dict(us_equity=15, emerging_equity=10, japan_bond=45, developed_bond=25, gold=5),
    3: dict(us_equity=25, emerging_equity=15, japan_bond=15, developed_bond=40, gold=5),
    4: dict(us_equity=30, emerging_equity=20, developed_bond=35, japan_reit=5, gold=10),
    5: dict(us_equity=45, emerging_equity=30, developed_bond=15, gold=10),
    6: dict(us_equity=45, emerging_equity=45, japan_equity=5, gold=5),  # #12 で新興国REIT→日本株
    7: dict(us_equity=35, developed_equity=5, emerging_equity=60),
}
for lv, a in MODEL.items():
    assert sum(a.values()) == 100, lv

MODEL_META = {1: (1.54, 2.94), 2: (2.98, 5.71), 3: (4.27, 8.52), 4: (5.16, 10.47),
              5: (6.27, 13.2), 6: (7.22, 15.4), 7: (7.53, 16.91)}
VOL_UPPER = {1: 3, 2: 6, 3: 9, 4: 12, 5: 15, 6: 16, 7: 100}


def js_round(x: float) -> int:
    """JS Math.round：.5 は +∞ 方向。floor(x+0.5) の誤差を避けて厳密に。"""
    f = math.floor(x)
    return f + 1 if x - f >= 0.5 else f


def round1(x):
    return js_round(x * 10) / 10


def round2(x):
    return js_round(x * 100) / 100


def near_half(x_scaled: float, tol=1e-6):
    """x_scaled の小数部が 0.5 に近いか（丸め境界）"""
    frac = x_scaled - math.floor(x_scaled)
    return abs(frac - 0.5) < tol


def risk_level(v):
    for lv, ub in ((1, 3), (2, 6), (3, 9), (4, 12), (5, 15), (6, 16)):
        if v <= ub:
            return lv
    return 7


def analyze(weights_pct: dict, base_level=4, divide=True):
    w = {k: (v / 100 if divide else v) for k, v in weights_pct.items() if k in KEYS}
    # float（JS と同じ倍精度）
    var = 0.0
    for i, ki in enumerate(KEYS):
        for j, kj in enumerate(KEYS):
            wi, wj = w.get(ki, 0), w.get(kj, 0)
            var += wi * wj * (RISK[ki] / 100) * (RISK[kj] / 100) * FLAT[i][j]
    vol_raw = math.sqrt(max(0.0, var)) * 100
    er_raw = 0.0
    for k in KEYS:
        er_raw += w.get(k, 0) * RET[k]
    # 厳密計算（10進の値を有理数として）
    F = lambda x: Fraction(str(x))
    wf = {k: (F(v) / 100 if divide else F(v)) for k, v in weights_pct.items() if k in KEYS}
    er_exact = sum((wf.get(k, 0) * F(RET[k]) for k in KEYS), Fraction(0))
    var_exact = sum((wf.get(ki, 0) * wf.get(kj, 0) * F(RISK[ki]) * F(RISK[kj]) * F(FLAT[i][j])
                     for i, ki in enumerate(KEYS) for j, kj in enumerate(KEYS)), Fraction(0))  # 単位 %^2
    vol = round1(vol_raw)
    er = round1(er_raw)
    sharpe_raw = (er - 0.5) / vol if vol > 0 else 0.0
    sharpe = round2(sharpe_raw) if vol > 0 else 0
    lv = risk_level(vol)
    notes = []
    if near_half(vol_raw * 10, 1e-3):
        notes.append('ボラが小数1桁丸めの境界(.x5)付近')
    if near_half(er_raw * 10, 1e-9):
        notes.append(f'期待リターンが .x5 ちょうど（厳密値 {float(er_exact)}、float {er_raw!r}）')
    if vol > 0 and near_half(sharpe_raw * 100, 1e-9):
        notes.append(f'シャープが .xx5 ちょうど付近（float {sharpe_raw!r}）')
    for ub in (3, 6, 9, 12, 15, 16):
        if abs(vol_raw - ub) < 0.1:
            notes.append(f'丸め前ボラがレベル境界 {ub} に近い')
    return {
        'riskLevel': lv,
        'expectedReturn': er,
        'volatility': vol,
        'sharpeRatio': sharpe,
        'overLimit': vol > VOL_UPPER.get(base_level, 100),
        'baseLevel': base_level,
        'raw': {
            'volatility': vol_raw,
            'volatility_exact_sqrt': math.sqrt(float(var_exact)),
            'expectedReturn': er_raw,
            'expectedReturn_exact': str(er_exact) + f' (= {float(er_exact)})',
            'sharpe_before_round': sharpe_raw,
        },
        'notes': notes,
    }


def monte_carlo(initial, monthly, years, ret_pct, vol_pct, trials=1000):
    assert vol_pct == 0
    mu = ret_pct / 100
    a = initial
    for _ in range(years):
        r = mu + 0 * 0.0  # σ=0 なので Z に依らない
        a = (a + monthly * 12) * (1 + r)
    final = max(0, js_round(a))
    finals = sorted([final] * trials)
    pct = lambda p: finals[math.floor(trials * p)]
    mn, mx = finals[0], finals[-1]
    width = max(1, math.ceil((mx - mn) / 20))
    counts = [0] * 20
    for v in finals:
        counts[min(19, math.floor((v - mn) / width))] += 1
    hist = [{'bin': mn + i * width, 'count': counts[i]} for i in range(20)]
    return {
        'final_before_round': a,
        'median': pct(0.5), 'percentile25': pct(0.25), 'percentile75': pct(0.75),
        'histogram': hist, 'trials': trials,
    }


def main():
    out = {'analysis': {}, 'monteCarlo': {}, 'modelMetaComparison': {}}
    for lv in range(1, 8):
        r = analyze(MODEL[lv])
        out['analysis'][f'A{lv}'] = r
        er_m, vol_m = MODEL_META[lv]
        out['modelMetaComparison'][f'A{lv}'] = {
            'calc': {'ER': r['expectedReturn'], 'vol': r['volatility'], 'sharpe': r['sharpeRatio'],
                     'riskLevel': r['riskLevel']},
            'meta': {'ER': er_m, 'vol': vol_m, 'riskLevel_from_meta_vol': risk_level(vol_m)},
            'diff': {'ER': round(r['raw']['expectedReturn'] - er_m, 4),
                     'vol': round(r['raw']['volatility'] - vol_m, 4)},
            'levelMatchesLv': r['riskLevel'] == lv,
        }
    out['analysis']['B'] = analyze({'us_equity': 100})
    out['analysis']['C'] = analyze({'cash': 100})
    out['analysis']['D'] = analyze({})
    out['analysis']['E'] = analyze({'us_equity': 50, 'japan_bond': 50}, base_level=1)
    out['analysis']['F'] = analyze({'us_equity': 50, 'japan_bond': 50, 'foo': 50})
    out['analysis']['G'] = analyze({'japan_equity': 33.3, 'developed_bond': 33.3, 'gold': 33.4}, base_level=7)

    out['monteCarlo']['MC1'] = monte_carlo(1000, 5, 10, 5, 0, 1000)
    out['monteCarlo']['MC2'] = monte_carlo(0, 0, 10, 5, 0, 1000)
    out['monteCarlo']['MC3'] = monte_carlo(1000, 0, 0, 5, 0, 1000)
    out['monteCarlo']['MC4'] = monte_carlo(1000, 10, 5, -150, 0, 1000)
    out['monteCarlo']['MC5'] = monte_carlo(2345, 3, 7, 3.3, 0, 10)

    p = Path(__file__).with_name('expected_step1.json')
    p.write_text(json.dumps(out, ensure_ascii=False, indent=2))

    print('case  lv  ER    vol   sharpe overLimit | ER_raw              vol_raw')
    for k, r in out['analysis'].items():
        print(f"{k:4s} {r['riskLevel']:3d} {r['expectedReturn']:5} {r['volatility']:5} {r['sharpeRatio']:6} "
              f"{str(r['overLimit']):5s} | {r['raw']['expectedReturn']!r:20} {r['raw']['volatility']!r} {r['notes']}")
    for k, r in out['modelMetaComparison'].items():
        print(k, r)
    for k, r in out['monteCarlo'].items():
        nz = [(h['bin'], h['count']) for h in r['histogram'] if h['count']]
        print(k, 'final_raw', repr(r['final_before_round']), 'med', r['median'], 'p25', r['percentile25'],
              'p75', r['percentile75'], 'bins', [h['bin'] for h in r['histogram']], 'nonzero', nz)


if __name__ == '__main__':
    main()
