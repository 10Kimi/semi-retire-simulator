"""#74 期間指定リバランス・戻す目安 の検算（仕様 spec74.md のみから独自計算。src/ は読んでいない）
金額は Fraction で厳密計算し、JSON には厳密値(分数文字列)と float を両方出す。端数の丸めは仕様にないので行わない。
"""
import json, math
from fractions import Fraction as F
from pathlib import Path

KEYS = ["cash","japan_equity","us_equity","developed_equity","emerging_equity","japan_bond",
        "developed_bond","emerging_bond","japan_reit","developed_reit","emerging_reit","commodity","gold"]

def num(x):
    x = F(x)
    return {"exact": str(x), "value": float(x)}

def period_case(name, h, t, N, M):
    assert sum(F(v) for v in t.values()) == 100, f"{name}: 目標配分合計≠100"
    assert all(k in KEYS for k in list(h)+list(t))
    assert isinstance(N, int) and N >= 1 and M >= 0
    keys = [k for k in KEYS if k in h or k in t]
    H = {k: F(h.get(k, 0)) for k in keys}
    P = {k: F(t.get(k, 0)) for k in keys}
    T = sum(H.values()); E = T + M*N
    tgt = {k: E*P[k]/100 for k in keys}
    sell = {k: max(F(0), H[k]-tgt[k]) for k in keys if k != "cash"}
    buy  = {k: max(F(0), tgt[k]-H[k]) for k in keys if k != "cash"}
    draw = max(F(0), H["cash"]-tgt["cash"]); keep = max(F(0), tgt["cash"]-H["cash"])
    sell_tot, buy_tot = sum(sell.values()), sum(buy.values())
    ms = {k: v/N for k, v in sell.items()}; mb = {k: v/N for k, v in buy.items()}
    mdraw, mkeep = draw/N, keep/N
    lhs = buy_tot/N + mkeep; rhs = sell_tot/N + mdraw + M
    assert lhs == rhs, f"{name}: 恒等式不成立"
    def month_end(k_):
        tot = T + k_*M
        amt = {k: (H[k] + k_*(mkeep-mdraw)) if k=="cash" else (H[k] + k_*(mb[k]-ms[k])) for k in keys}
        assert sum(amt.values()) == tot
        return {"total": num(tot), "amount": {k: num(v) for k, v in amt.items()},
                "ratio_pct": {k: (float(v/tot*100) if tot else None) for k, v in amt.items()}}
    endN = month_end(N)
    for k in keys: assert F(endN["amount"][k]["exact"]) == tgt[k]
    reached = (sell_tot == 0 and buy_tot == 0 and draw == 0 and keep == 0 and M == 0)
    return {
        "name": name, "N": N, "M": M,
        "T": num(T), "E": num(E),
        "target_amount": {k: num(v) for k, v in tgt.items()},
        "sell_total_by_class": {k: num(v) for k, v in sell.items()}, "sell_total": num(sell_tot),
        "cash_draw_total": num(draw), "cash_keep_total": num(keep),
        "buy_total_by_class": {k: num(v) for k, v in buy.items()}, "buy_total": num(buy_tot),
        "monthly": {
            "sell_by_class": {k: num(v) for k, v in ms.items()}, "sell": num(sell_tot/N),
            "cash_draw": num(mdraw), "cash_keep": num(mkeep), "M": M,
            "buy_by_class": {k: num(v) for k, v in mb.items()}, "buy": num(buy_tot/N),
            "operation_total(sell+draw+M)": num(sell_tot/N + mdraw + M),
        },
        "identity": {"lhs(buy+keep)": num(lhs), "rhs(sell+draw+M)": num(rhs), "holds": lhs == rhs},
        "message_reached": reached,
        "month_end_1": month_end(1), "month_end_N": endN,
    }

def min_M_zero_sell(h, t, N):
    """売却(現金以外)が0になる最小M：全非現金クラスで H_k <= (T+M N) p_k  ⇔  M >= (H_k/p_k - T)/N。
    目標0%で保有>0のクラスがあれば不可能(∞)。現金の取り崩しは別扱い(売却に含めない)。"""
    T = sum(F(v) for v in h.values()); req = F(0); binding = None
    for k, v in h.items():
        if k == "cash" or v == 0: continue
        p = F(t.get(k, 0))
        if p == 0: return None, k
        m = (F(v)*100/p - T)/N
        if m > req: req, binding = m, k
    return req, binding

def stage(d):
    a = abs(d)
    return "ok" if a < 2 else "軽微" if a < 5 else "要注意" if a < 10 else "大きなズレ"

EPS = 1e-9
def flag_strict(d, th): return abs(d) >= th
def flag_eps(d, th): return abs(d) >= th - EPS

h1 = {"cash": 3_456_789, "japan_equity": 2_100_000, "us_equity": 7_350_000,
      "developed_bond": 1_234_567, "japan_bond": 980_000, "gold": 50_000}
t1 = {"cash": 10, "us_equity": 40, "emerging_equity": 15, "developed_bond": 25, "gold": 10}
# 例2（架空）：合計100%、現金に余り、超過・不足混在、端数あり、N=7
h2 = {"cash": 1_234_567, "japan_equity": 3_333_333, "us_equity": 4_876_543,
      "developed_equity": 777_777, "gold": 123_456}
t2 = {"cash": 5, "japan_equity": 15, "us_equity": 35, "developed_equity": 25, "emerging_bond": 10, "gold": 10}
N2 = 7

out = {"spec": "spec74.md", "money_rounding": "なし(厳密分数)。exactは分数文字列", "cases": []}
out["cases"].append(period_case("例1 M=0", h1, t1, 12, 0))
out["cases"].append(period_case("例1 M=123457", h1, t1, 12, 123_457))
mmin, bind = min_M_zero_sell(h2, t2, N2)
m_ceil = math.ceil(mmin)
out["example2_min_M_zero_sell"] = {
    "formula": "M_min = max_k (H_k*100/p_k - T)/N  over 非現金 k (H_k>0)。p_k=0 かつ H_k>0 なら到達不可",
    "binding_class": bind, "M_min": num(mmin), "M_min_integer_yen(ceil)": m_ceil}
out["cases"].append(period_case("例2 M=0", h2, t2, N2, 0))
out["cases"].append(period_case("例2 M=300000(売却一部残る)", h2, t2, N2, 300_000))
out["cases"].append(period_case(f"例2 M={m_ceil}(売却0, 最小整数円)", h2, t2, N2, m_ceil))
# 例1の売却0最小M（参考：目標0%の保有があり到達不可）
mm1, b1 = min_M_zero_sell(h1, t1, 12)
out["example1_min_M_zero_sell"] = {"M_min": None if mm1 is None else num(mm1), "reason_class": b1}

devs = [4.99, 5, -5, 4.9999999999, 9.99, 10, -12.3]
out["threshold_table"] = [{"deviation": d, "stage(strict)": stage(d),
    "flag5_strict": flag_strict(d,5), "flag5_eps": flag_eps(d,5),
    "flag10_strict": flag_strict(d,10), "flag10_eps": flag_eps(d,10)} for d in devs]
out["threshold_note"] = f"eps版は |d| >= 目安 - {EPS}。段階は仕様どおり厳密比較(eps無し)"

T1 = sum(h1.values()); rows = []
for k in KEYS:
    if k not in h1 and k not in t1: continue
    r = h1.get(k, 0)/T1*100; d = r - t1.get(k, 0)
    rows.append({"class": k, "now_pct": r, "target_pct": t1.get(k, 0), "deviation_pt": d,
                 "stage": stage(d), "flag5": flag_eps(d,5), "flag10": flag_eps(d,10)})
out["example1_deviation"] = {"T": T1, "rows": rows,
    "count_flag5": sum(r["flag5"] for r in rows), "count_flag10": sum(r["flag10"] for r in rows)}

p = Path(__file__).with_name("expected.json")
p.write_text(json.dumps(out, ensure_ascii=False, indent=2))
print(p)
