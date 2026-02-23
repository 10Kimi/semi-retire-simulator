#!/usr/bin/env python3
"""
ETF価格データ取得 + 効率的フロンティア最適化スクリプト

期待リターン: GPIF第5期（2025-2029年度）基準の固定値
リスク・相関: 過去のETF月次データから計算

Usage:
    cd scripts/market
    pip install -r requirements.txt
    cp .env.example .env  # SUPABASE_URL, SUPABASE_SERVICE_KEY を設定
    python fetch_and_optimize.py
    python fetch_and_optimize.py --dry-run  # Supabase保存をスキップ
"""

import argparse
import json
import os
from datetime import datetime

import numpy as np
import pandas as pd
import yfinance as yf
from scipy.optimize import minimize

# ─── Configuration ───

# ETF tickers (japan_bond excluded: 2510.T only dates from 2017-12, too short)
TICKERS_JPY = {
    'japan_equity': '1306.T',   # TOPIX連動
    'japan_reit': '1343.T',     # 東証REIT指数連動
}

TICKERS_USD = {
    'us_equity': 'SPY',         # S&P 500 (SPY: 1993年上場, VOOより長い)
    'developed_equity': 'EFA',  # MSCI EAFE
    'emerging_equity': 'EEM',   # MSCI Emerging Markets
    'developed_bond': 'BWX',    # SPDR World Bond ex-US
    'emerging_bond': 'EMB',     # JP Morgan EMBI+
    'developed_reit': 'RWX',    # SPDR Dow Jones Intl Real Estate
    'gold': 'GLD',              # SPDR Gold
}

FX_TICKER = 'USDJPY=X'

# ── GPIF-based expected returns (固定値) ──
# GPIF第5期中期目標期間（2025-2029年度）の「過去30年投影ケース」をベースに設定。
# GPIFが公表していない資産クラスはリスクプレミアム等から推計。
EXPECTED_RETURNS = {
    'japan_equity':     0.050,  # 5.0%  GPIF国内株式 4.8%ベース
    'us_equity':        0.070,  # 7.0%  GPIF外国株式 6.4% + 米国プレミアム
    'developed_equity': 0.055,  # 5.5%  GPIF外国株式 6.4% - 米国除外で若干低い
    'emerging_equity':  0.060,  # 6.0%  高リスクプレミアム + 政治リスク考慮
    'japan_bond':       0.007,  # 0.7%  GPIF国内債券 過去30年投影ケース
    'developed_bond':   0.030,  # 3.0%  GPIF外国債券 3.3%をやや保守的に
    'emerging_bond':    0.045,  # 4.5%  先進国債券 + 新興国スプレッド
    'japan_reit':       0.040,  # 4.0%  日本株式よりやや低い、配当利回りベース
    'developed_reit':   0.045,  # 4.5%  先進国株式よりやや低い、配当利回りベース
    'gold':             0.030,  # 3.0%  長期的にインフレ率程度
    'cash':             0.001,  # 0.1%  日本短期金利
}

# ── Fixed-risk assets (not from ETF data) ──
# japan_bond: 2510.T only dates from 2017-12, use GPIF values for risk/correlation
# cash: near-zero risk
FIXED_RISK_ASSETS = {
    'japan_bond': {
        'annual_risk': 0.022,    # 2.2% (myINDEX 20年平均)
        'correlations': {
            'japan_equity': -0.254,      # GPIF: 国内株式
            'us_equity': -0.125,         # GPIF: 外国株式
            'developed_equity': -0.125,  # GPIF: 外国株式
            'emerging_equity': -0.125,   # GPIF: 外国株式 (proxy)
            'developed_bond': 0.073,     # GPIF: 外国債券
            'emerging_bond': 0.073,      # GPIF: 外国債券 (proxy)
            'japan_reit': 0.1,           # 低い正の相関 (仮定)
            'developed_reit': 0.1,       # 低い正の相関 (仮定)
            'gold': -0.08,              # WGC研究論文
            'cash': 0.2,                # 低い正の相関 (仮定)
        },
    },
    'cash': {
        'annual_risk': 0.001,    # 0.1%
        'correlations': {
            'japan_bond': 0.2,
        },
    },
}

# Asset class ordering (must match frontend ASSET_CLASSES)
ASSET_KEYS = [
    'japan_equity', 'us_equity', 'developed_equity', 'emerging_equity',
    'japan_bond', 'developed_bond', 'emerging_bond',
    'japan_reit', 'developed_reit', 'gold', 'cash',
]

ASSET_LABELS = {
    'japan_equity': '日本株式',
    'us_equity': '米国株式',
    'developed_equity': '先進国株式',
    'emerging_equity': '新興国株式',
    'japan_bond': '日本債券',
    'developed_bond': '先進国債券',
    'emerging_bond': '新興国債券',
    'japan_reit': '日本REIT',
    'developed_reit': '先進国REIT',
    'gold': '金',
    'cash': '現金',
}

# ── Per-asset weight bounds (下限〜上限) ──
ASSET_BOUNDS = {
    'japan_equity':     (0.03, 0.30),
    'us_equity':        (0.05, 0.35),
    'developed_equity': (0.03, 0.25),
    'emerging_equity':  (0.02, 0.20),
    'japan_bond':       (0.02, 0.40),
    'developed_bond':   (0.02, 0.30),
    'emerging_bond':    (0.00, 0.15),
    'japan_reit':       (0.00, 0.15),
    'developed_reit':   (0.00, 0.15),
    'gold':             (0.02, 0.15),
    'cash':             (0.05, 0.30),
}

# ── Asset group keys (for summary display only, no group constraints) ──
EQUITY_KEYS = ['japan_equity', 'us_equity', 'developed_equity', 'emerging_equity']
BOND_KEYS = ['japan_bond', 'developed_bond', 'emerging_bond']

# ── Risk levels (vol_cap only; individual asset bounds handle diversification) ──
RISK_LEVELS = {
    'conservative':            {'vol_cap': 0.06},
    'moderately_conservative': {'vol_cap': 0.09},
    'balanced':                {'vol_cap': 0.12},
    'moderately_aggressive':   {'vol_cap': 0.15},
    'aggressive':              {'vol_cap': 0.18},
}

# ── GPIF第5期公表リスク (検証用) ──
GPIF_RISK_REFERENCE = {
    'japan_equity':  19.07,  # 国内株式
    'developed_bond': 11.59, # 外国債券 (proxy for our developed_bond)
    'japan_bond':     2.56,  # 国内債券
}
# 外国株式はus_equity + developed_equity + emerging_equityの混合に相当
GPIF_FOREIGN_EQUITY_RISK = 23.14


# ─── Step 1: Fetch ETF Prices ───

def fetch_etf_prices():
    """Fetch monthly closing prices for all ETFs and USD/JPY."""
    print("  Fetching JPY-denominated ETFs...")
    jpy_prices = {}
    for key, ticker in TICKERS_JPY.items():
        data = yf.download(ticker, period='max', interval='1mo', progress=False)
        if data.empty:
            print(f"    WARNING: No data for {ticker} ({key})")
            continue
        if isinstance(data.columns, pd.MultiIndex):
            prices = data['Close'].iloc[:, 0]
        else:
            prices = data['Close']
        jpy_prices[key] = prices
        print(f"    {key} ({ticker}): {len(prices)} months"
              f" from {prices.index[0].strftime('%Y-%m')}"
              f" to {prices.index[-1].strftime('%Y-%m')}")

    print("  Fetching USD-denominated ETFs...")
    usd_prices = {}
    for key, ticker in TICKERS_USD.items():
        data = yf.download(ticker, period='max', interval='1mo', progress=False)
        if data.empty:
            print(f"    WARNING: No data for {ticker} ({key})")
            continue
        if isinstance(data.columns, pd.MultiIndex):
            prices = data['Close'].iloc[:, 0]
        else:
            prices = data['Close']
        usd_prices[key] = prices
        print(f"    {key} ({ticker}): {len(prices)} months"
              f" from {prices.index[0].strftime('%Y-%m')}"
              f" to {prices.index[-1].strftime('%Y-%m')}")

    print("  Fetching USD/JPY exchange rate...")
    fx_data = yf.download(FX_TICKER, period='max', interval='1mo', progress=False)
    if isinstance(fx_data.columns, pd.MultiIndex):
        fx_prices = fx_data['Close'].iloc[:, 0]
    else:
        fx_prices = fx_data['Close']
    print(f"    USDJPY: {len(fx_prices)} months"
          f" from {fx_prices.index[0].strftime('%Y-%m')}"
          f" to {fx_prices.index[-1].strftime('%Y-%m')}")

    return jpy_prices, usd_prices, fx_prices


# ─── Step 2: Convert to JPY Returns ───

def compute_monthly_returns(jpy_prices, usd_prices, fx_prices):
    """Compute monthly returns in JPY for all market-based assets."""
    all_returns = {}

    for key, prices in jpy_prices.items():
        all_returns[key] = prices.pct_change().dropna()

    fx_returns = fx_prices.pct_change().dropna()
    for key, prices in usd_prices.items():
        usd_ret = prices.pct_change().dropna()
        common_idx = usd_ret.index.intersection(fx_returns.index)
        usd_r = usd_ret.loc[common_idx]
        fx_r = fx_returns.loc[common_idx]
        jpy_ret = (1 + usd_r) * (1 + fx_r) - 1
        all_returns[key] = jpy_ret

    df = pd.DataFrame(all_returns)
    df = df.dropna()

    print(f"\n  Common period: {df.index[0].strftime('%Y-%m')}"
          f" to {df.index[-1].strftime('%Y-%m')} ({len(df)} months)")

    all_tickers = {**TICKERS_JPY, **TICKERS_USD}
    all_starts = {}
    for key in all_returns:
        s = all_returns[key].dropna().index[0]
        all_starts[key] = s
    bottleneck = max(all_starts, key=lambda k: all_starts[k])
    ticker = all_tickers.get(bottleneck, '(fixed)')
    print(f"  Bottleneck: {bottleneck} ({ticker})"
          f" starts {all_starts[bottleneck].strftime('%Y-%m')}")

    return df


# ─── Step 3: Calculate Risk & Correlation from Market Data ───

def calculate_risk_and_correlation(monthly_returns):
    """Calculate annualized risk (std dev) and correlation from market data.

    Returns both:
    - historical_returns: for comparison output only (NOT used in optimization)
    - annual_risks: used in covariance matrix for optimization
    - correlation/covariance: used in optimization
    """
    n_months = len(monthly_returns)
    n_years = n_months / 12

    # Historical returns (for comparison output only)
    historical_returns = {}
    annual_risks = {}
    for col in monthly_returns.columns:
        cumulative = (1 + monthly_returns[col]).prod()
        historical_returns[col] = cumulative ** (1 / n_years) - 1
        annual_risks[col] = monthly_returns[col].std() * np.sqrt(12)

    # Market-based monthly correlation
    market_corr = monthly_returns.corr()

    # Add fixed-risk assets
    for fixed_key, conf in FIXED_RISK_ASSETS.items():
        annual_risks[fixed_key] = conf['annual_risk']
        historical_returns[fixed_key] = EXPECTED_RETURNS.get(fixed_key, 0)

    # Build full correlation matrix
    ordered_keys = [k for k in ASSET_KEYS if k in annual_risks]
    n = len(ordered_keys)
    full_corr = pd.DataFrame(np.eye(n), index=ordered_keys, columns=ordered_keys)

    market_keys = list(monthly_returns.columns)
    for ki in market_keys:
        for kj in market_keys:
            if ki in ordered_keys and kj in ordered_keys:
                full_corr.loc[ki, kj] = market_corr.loc[ki, kj]

    for fixed_key, conf in FIXED_RISK_ASSETS.items():
        if fixed_key not in ordered_keys:
            continue
        for other_key, c in conf.get('correlations', {}).items():
            if other_key in ordered_keys:
                full_corr.loc[fixed_key, other_key] = c
                full_corr.loc[other_key, fixed_key] = c

    # Build covariance matrix
    full_cov = pd.DataFrame(0.0, index=ordered_keys, columns=ordered_keys)
    for ki in ordered_keys:
        for kj in ordered_keys:
            full_cov.loc[ki, kj] = (
                full_corr.loc[ki, kj] * annual_risks[ki] * annual_risks[kj]
            )

    return historical_returns, annual_risks, full_corr, full_cov, ordered_keys


# ─── Step 4: Portfolio Optimization ───

def optimize_portfolio(expected_returns_arr, cov_matrix, max_volatility,
                       asset_keys):
    """Maximize expected return subject to volatility cap and per-asset bounds."""
    n = len(asset_keys)

    def neg_return(w):
        return -np.dot(w, expected_returns_arr)

    bounds = [ASSET_BOUNDS.get(k, (0.0, 0.40)) for k in asset_keys]

    constraints = [
        {'type': 'eq', 'fun': lambda w: np.sum(w) - 1.0},
        {'type': 'ineq', 'fun': lambda w: max_volatility - np.sqrt(
            np.dot(w.T, np.dot(cov_matrix, w)))},
    ]

    x0 = np.full(n, 1.0 / n)

    result = minimize(
        neg_return, x0,
        method='SLSQP',
        bounds=bounds,
        constraints=constraints,
        options={'maxiter': 1000, 'ftol': 1e-10},
    )

    if result.success:
        weights = result.x.copy()
        weights[weights < 0.005] = 0
        if weights.sum() > 0:
            weights = weights / weights.sum()
        port_return = np.dot(weights, expected_returns_arr)
        port_risk = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        return {
            'weights': weights,
            'return': port_return,
            'risk': port_risk,
            'success': True,
        }

    return {'success': False, 'message': result.message}


def optimize_all_levels(cov_df, asset_keys):
    """Run optimization for all 5 risk levels using GPIF expected returns."""
    # Use EXPECTED_RETURNS (GPIF-based), NOT historical returns
    returns_arr = np.array([EXPECTED_RETURNS[k] for k in asset_keys])
    cov_arr = cov_df.values

    results = {}
    for level_name, params in RISK_LEVELS.items():
        max_vol = params['vol_cap']
        attempted_vol = max_vol
        result = None
        for attempt in range(5):
            result = optimize_portfolio(
                returns_arr, cov_arr, attempted_vol, asset_keys)
            if result['success']:
                break
            print(f"    {level_name}: failed at vol={attempted_vol:.0%}, relaxing...")
            attempted_vol += 0.01

        if result and result['success']:
            alloc = {}
            for i, key in enumerate(asset_keys):
                pct = round(result['weights'][i] * 100, 1)
                alloc[key] = pct
            results[level_name] = {
                'allocation': alloc,
                'expected_return': round(result['return'] * 100, 2),
                'volatility': round(result['risk'] * 100, 2),
            }
        else:
            msg = result.get('message', 'unknown') if result else 'no result'
            print(f"    ERROR: {level_name} optimization failed: {msg}")
            results[level_name] = None

    return results


# ─── Step 5: Validation ───

def validate_results(results, annual_risks):
    """Validate optimization results and check risk vs GPIF."""
    issues = []
    levels = list(RISK_LEVELS.keys())
    valid_results = {k: v for k, v in results.items() if v is not None}

    if len(valid_results) < 5:
        issues.append(f"Only {len(valid_results)}/5 levels optimized successfully")

    # Monotonic increase of returns
    returns = [valid_results[l]['expected_return']
               for l in levels if l in valid_results]
    for i in range(1, len(returns)):
        if returns[i] < returns[i - 1]:
            issues.append(f"Returns not monotonically increasing: {returns}")
            break

    # Adjacent levels should differ meaningfully
    # Note: with GPIF's conservative returns, the frontier is flat at high risk levels,
    # so the gap between mod_aggressive and aggressive may be small (<0.3%).
    # This is expected — the differentiation is mainly in volatility and equity concentration.
    for i in range(1, len(returns)):
        diff = returns[i] - returns[i - 1]
        if diff < 0.05:
            lvl_a = levels[i - 1]
            lvl_b = levels[i]
            issues.append(
                f"Tiny gap: {lvl_a}({returns[i-1]}%) → {lvl_b}({returns[i]}%)"
                f" = {diff:.2f}%")
        elif diff < 0.3:
            lvl_a = levels[i - 1]
            lvl_b = levels[i]
            print(f"  INFO: Small gap (expected with GPIF returns): "
                  f"{lvl_a}({returns[i-1]}%) → {lvl_b}({returns[i]}%) = {diff:.2f}%")

    for level_name, data in valid_results.items():
        alloc = data['allocation']
        total = sum(alloc.values())
        if abs(total - 100.0) > 0.5:
            issues.append(f"{level_name}: sum = {total:.1f}%")

        for key, pct in alloc.items():
            lo, hi = ASSET_BOUNDS.get(key, (0.0, 0.40))
            if pct > hi * 100 + 0.5:
                issues.append(f"{level_name}: {key} = {pct}% > {hi*100}%")

        # Per-asset lower bound check
        for key, pct in alloc.items():
            lo, _ = ASSET_BOUNDS.get(key, (0.0, 0.40))
            if lo > 0 and pct < lo * 100 - 0.5:
                issues.append(f"{level_name}: {key} = {pct}% < min {lo*100}%")

    # Return range checks
    if valid_results.get('conservative'):
        r = valid_results['conservative']['expected_return']
        if not (1.0 <= r <= 4.0):
            issues.append(f"conservative return {r}% outside 1-4% range")
    if valid_results.get('balanced'):
        r = valid_results['balanced']['expected_return']
        if not (3.0 <= r <= 5.5):
            issues.append(f"balanced return {r}% outside 3-5.5% range")
    if valid_results.get('aggressive'):
        r = valid_results['aggressive']['expected_return']
        if not (5.0 <= r <= 8.0):
            issues.append(f"aggressive return {r}% outside 5-8% range")

    if issues:
        print("\n  VALIDATION ISSUES:")
        for issue in issues:
            print(f"    - {issue}")
    else:
        print("\n  All validation checks passed.")

    # GPIF risk comparison (informational, not blocking)
    print("\n  Risk vs GPIF公表値:")
    for key, gpif_risk in GPIF_RISK_REFERENCE.items():
        if key in annual_risks:
            our_risk = annual_risks[key] * 100
            diff = our_risk - gpif_risk
            status = "OK" if abs(diff) < 5 else "WARN"
            label = ASSET_LABELS.get(key, key)
            print(f"    {label}: {our_risk:.1f}% (GPIF: {gpif_risk:.1f}%,"
                  f" Δ={diff:+.1f}%) [{status}]")

    # Foreign equity composite check
    foreign_eq_keys = ['us_equity', 'developed_equity', 'emerging_equity']
    foreign_risks = [annual_risks.get(k, 0) * 100 for k in foreign_eq_keys
                     if k in annual_risks]
    if foreign_risks:
        avg_risk = sum(foreign_risks) / len(foreign_risks)
        diff = avg_risk - GPIF_FOREIGN_EQUITY_RISK
        status = "OK" if abs(diff) < 5 else "WARN"
        print(f"    外国株式(平均): {avg_risk:.1f}% (GPIF: {GPIF_FOREIGN_EQUITY_RISK:.1f}%,"
              f" Δ={diff:+.1f}%) [{status}]")

    return len(issues) == 0


# ─── Step 6: Save to Supabase ───

def save_to_supabase(annual_risks, corr_df, results, start_date, end_date):
    """Save results to Supabase market_data table."""
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_KEY')

    if not url or not key:
        print("\n  ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        return False

    try:
        from supabase import create_client
        client = create_client(url, key)
    except Exception as e:
        print(f"\n  ERROR: Failed to connect to Supabase: {e}")
        return False

    try:
        client.table('market_data').update(
            {'is_current': False}).eq('is_current', True).execute()
    except Exception as e:
        print(f"  WARNING: Failed to update existing records: {e}")

    # Save GPIF expected returns (not historical)
    returns_dict = {k: round(v * 100, 2) for k, v in EXPECTED_RETURNS.items()}
    risks_dict = {k: round(v * 100, 2) for k, v in annual_risks.items()}
    corr_dict = {}
    for row in corr_df.index:
        corr_dict[row] = {
            col: round(corr_df.loc[row, col], 4) for col in corr_df.columns}

    data = {
        'data_period': f"{start_date}_{end_date}",
        'asset_returns': json.dumps(returns_dict),
        'asset_risks': json.dumps(risks_dict),
        'correlation_matrix': json.dumps(corr_dict),
        'optimal_allocations': json.dumps(results),
        'is_current': True,
    }

    try:
        client.table('market_data').insert(data).execute()
        print("  Saved to Supabase successfully.")
        return True
    except Exception as e:
        print(f"  ERROR: Failed to save to Supabase: {e}")
        return False


# ─── Summary Output ───

def print_summary(results, historical_returns, annual_risks):
    """Print full results with GPIF vs historical comparison."""

    # ── Expected Returns: GPIF vs Historical ──
    print("\n" + "=" * 100)
    print("EXPECTED RETURNS (GPIF基準) vs HISTORICAL RETURNS (過去実績)")
    print("=" * 100)
    hdr = (f"  {'資産クラス':<16} {'GPIF期待':>8} {'過去実績':>8} {'Δ':>6}"
           f"  {'Risk(実績)':>10} {'GPIF公表':>8}  {'Sharpe':>6}")
    print(hdr)
    print("  " + "-" * 92)
    for key in ASSET_KEYS:
        gpif_ret = EXPECTED_RETURNS.get(key, 0) * 100
        hist_ret = historical_returns.get(key, 0) * 100
        risk = annual_risks.get(key, 0) * 100
        d_ret = hist_ret - gpif_ret
        sharpe = (gpif_ret / risk) if risk > 0 else 0
        label = ASSET_LABELS.get(key, key)
        gpif_risk_ref = GPIF_RISK_REFERENCE.get(key)
        gpif_risk_str = f"{gpif_risk_ref:.1f}%" if gpif_risk_ref else "  ---"
        mark = '*' if key in FIXED_RISK_ASSETS else ' '
        print(f"  {label:<15}{mark}"
              f" {gpif_ret:>7.1f}% {hist_ret:>7.1f}% {d_ret:>+5.1f}"
              f"  {risk:>9.1f}% {gpif_risk_str:>8}"
              f"  {sharpe:>6.2f}")
    print("  (* = リスク固定値, ETFデータ非使用)")
    print("  Sharpe = GPIF期待リターン / 過去実績リスク")

    # ── Full allocation table ──
    print("\n" + "=" * 100)
    print("OPTIMAL ALLOCATIONS (全11資産クラス, GPIF期待リターンベース)")
    print("=" * 100)

    level_names = list(RISK_LEVELS.keys())
    short = ['保守的', 'やや保守', 'バランス', 'やや積極', '積極的']

    hdr = f"  {'資産クラス':<16}"
    for s in short:
        hdr += f"  {s:>8}"
    print(hdr)
    print("  " + "-" * (16 + 10 * 5))

    for key in ASSET_KEYS:
        label = ASSET_LABELS.get(key, key)
        row = f"  {label:<16}"
        for lname in level_names:
            d = results.get(lname)
            if d:
                pct = d['allocation'].get(key, 0)
                if pct > 0:
                    row += f"  {pct:>7.1f}%"
                else:
                    row += f"  {'  ---':>8}"
            else:
                row += f"  {'FAIL':>8}"
        print(row)

    print("  " + "-" * (16 + 10 * 5))

    for group_name, group_keys in [('株式合計', EQUITY_KEYS),
                                    ('債券合計', BOND_KEYS)]:
        row = f"  {group_name:<16}"
        for lname in level_names:
            d = results.get(lname)
            if d:
                t = sum(d['allocation'].get(k, 0) for k in group_keys)
                row += f"  {t:>7.1f}%"
            else:
                row += f"  {'FAIL':>8}"
        print(row)

    print("  " + "-" * (16 + 10 * 5))

    for metric, key_name in [('期待リターン', 'expected_return'),
                              ('ボラティリティ', 'volatility')]:
        row = f"  {metric:<16}"
        for lname in level_names:
            d = results.get(lname)
            if d:
                row += f"  {d[key_name]:>7.2f}%"
            else:
                row += f"  {'FAIL':>8}"
        print(row)

    print("\n  期待リターン: GPIF第5期（2025-2029年度）基準")
    print("  リスク・相関: 市場データから算出")


# ─── Main ───

def main():
    parser = argparse.ArgumentParser(
        description='Fetch ETF data and optimize portfolios')
    parser.add_argument('--dry-run', action='store_true',
                        help='Skip Supabase save')
    args = parser.parse_args()

    print("=" * 60)
    print("Phase 4b: Market Data Fetch & Efficient Frontier Optimization")
    print("  期待リターン: GPIF第5期基準 (固定値)")
    print("  リスク・相関: 過去のETFデータから計算")
    print("=" * 60)

    print("\n[Step 1] Fetching ETF price data (for risk/correlation)...")
    jpy_prices, usd_prices, fx_prices = fetch_etf_prices()

    print("\n[Step 2] Computing monthly returns (JPY-based)...")
    monthly_returns = compute_monthly_returns(jpy_prices, usd_prices, fx_prices)

    start_date = monthly_returns.index[0].strftime('%Y-%m')
    end_date = monthly_returns.index[-1].strftime('%Y-%m')

    print(f"\n[Step 3] Calculating risk & correlation ({start_date} to {end_date})...")
    print("  (japan_bond, cash = fixed risk values)")
    print("  ★ Historical returns computed for comparison only, NOT used in optimization")
    historical_returns, annual_risks, corr_df, cov_df, asset_keys = \
        calculate_risk_and_correlation(monthly_returns)

    print("\n[Step 4] Running optimization with GPIF expected returns...")
    print("  Constraints: per-asset bounds only (no group constraints)")
    results = optimize_all_levels(cov_df, asset_keys)

    print("\n[Step 5] Validating results...")
    is_valid = validate_results(results, annual_risks)

    if not is_valid:
        print("\n  WARNING: Validation issues found. Review results.")

    print_summary(results, historical_returns, annual_risks)

    if args.dry_run:
        print("\n[Step 6] Dry run - skipping Supabase save.")
        print("  To save, run without --dry-run flag.")
    else:
        print("\n[Step 6] Saving to Supabase...")
        save_to_supabase(annual_risks, corr_df, results, start_date, end_date)

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == '__main__':
    main()
