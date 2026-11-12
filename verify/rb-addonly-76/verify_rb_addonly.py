"""#76 /rb「積立のみ」完了までの月数 n と毎月の配分の検算（src/ は読まずに spec76.md だけから計算）。
分数（Fraction）で厳密に計算。出力: expected.json（同じフォルダ）。
"""
import json, math, os
from fractions import Fraction as F

CLASSES = ["cash", "japan_equity", "us_equity", "developed_equity", "emerging_equity",
           "japan_bond", "developed_bond", "emerging_bond", "japan_reit", "developed_reit",
           "emerging_reit", "commodity", "gold"]


def num(x):
    x = F(x)
    return {"exact": str(x), "value": float(x)}


def plan(hold, w, M, n):
    """期間指定（完了期間 n、毎月 M）の計画"""
    T = sum(hold.values(), F(0))
    E = T + M * n
    tgt = {k: E * w[k] / 100 for k in CLASSES}
    buy = {k: max(F(0), tgt[k] - hold[k]) for k in CLASSES if k != "cash"}
    sell = {k: max(F(0), hold[k] - tgt[k]) for k in CLASSES if k != "cash"}
    draw = max(F(0), hold["cash"] - tgt["cash"])
    keep = max(F(0), tgt["cash"] - hold["cash"])
    return E, tgt, buy, sell, draw, keep


def solve(name, hold, w, M):
    hold = {k: F(hold.get(k, 0)) for k in CLASSES}
    w = {k: F(w.get(k, 0)) for k in CLASSES}
    M = F(M)
    T = sum(hold.values(), F(0))
    out = {"name": name,
           "input": {"holdings": {k: num(v) for k, v in hold.items() if v},
                     "target_pct": {k: num(v) for k, v in w.items() if v},
                     "M": num(M)},
           "checks": {"target_sum_100": sum(w.values()) == 100}}
    assert sum(w.values()) == 100, name
    out["T"] = num(T)
    if M <= 0:
        out["result"] = "M<=0: 出さない"; return out
    # 目標0%で保有あり（現金以外）
    stuck = [k for k in CLASSES if k != "cash" and w[k] == 0 and hold[k] > 0]
    if stuck:
        out["result"] = "not_reachable"; out["stuck_classes"] = stuck; return out
    tgtT = {k: T * w[k] / 100 for k in CLASSES}
    if all(abs(hold[k] - tgtT[k]) < 1 for k in CLASSES):
        out["result"] = "already"; out["n"] = 0; return out
    over = [k for k in CLASSES if k != "cash" and w[k] > 0 and hold[k] > tgtT[k]]
    ni = {}
    for k in over:
        # hold_k <= w_k/100*(T+M n)  <=>  n >= (100*hold_k/w_k - T)/M
        req = (100 * hold[k] / w[k] - T) / M
        ni[k] = {"formula": f"ceil((100*{hold[k]}/{w[k]} - {T}) / {M})",
                 "required_real": num(req), "n_i": max(1, math.ceil(req))}
    n = max([1] + [v["n_i"] for v in ni.values()])
    out["over_classes"] = ni
    out["decisive_class"] = max(ni, key=lambda k: ni[k]["n_i"]) if ni else None
    out["n"] = n
    E, tgt, buy, sell, draw, keep = plan(hold, w, M, n)
    assert sum(sell.values()) == 0
    out["E"] = num(E)
    out["monthly"] = {"buy": {k: num(v / n) for k, v in buy.items() if v},
                      "buy_total": num(sum(buy.values(), F(0)) / n),
                      "cash_drawdown": num(draw / n),
                      "cash_keep": num(keep / n)}
    lhs = sum(buy.values(), F(0)) / n + keep / n
    rhs = M + draw / n
    out["identity"] = {"lhs_buy_plus_keep": num(lhs), "rhs_M_plus_drawdown": num(rhs), "equal": lhs == rhs}
    after = {k: hold[k] + buy[k] for k in CLASSES if k != "cash"}
    after["cash"] = hold["cash"] - draw + keep
    out["after_n"] = {k: {"amount": num(after[k]), "target": num(tgt[k]), "equal": after[k] == tgt[k]}
                      for k in CLASSES if after[k] or tgt[k]}
    out["sell_total_n"] = num(sum(sell.values(), F(0)))
    if n >= 2:
        _, _, _, s1, _, _ = plan(hold, w, M, n - 1)
        out["n_minus_1"] = {"months": n - 1, "sell_total": num(sum(s1.values(), F(0))),
                            "sell_by_class": {k: num(v) for k, v in s1.items() if v},
                            "positive": sum(s1.values()) > 0}
    else:
        _, _, _, s0, _, _ = plan(hold, w, M, 0)
        out["n_minus_1"] = {"months": 0, "note": "n=1 のため n-1=0（期間0は計画にならない）。参考：E=T で今すぐ合わせた場合の売却",
                            "sell_total": num(sum(s0.values(), F(0)))}
    return out


EX2_HOLD = {"cash": 1234567, "japan_equity": 3456789, "us_equity": 5678901,
            "developed_bond": 987654, "gold": 123457}
EXAMPLES = [
    ("1 米国株100万→米50/先進国債50 M=10万",
     {"us_equity": 1000000}, {"us_equity": 50, "developed_bond": 50}, 100000),
    ("2 現金余り(目標0%)・超過2・不足2・端数",
     EX2_HOLD, {"japan_equity": 20, "us_equity": 30, "developed_bond": 30, "gold": 20}, 87654),
    ("3 例2で現金目標15%（現金のまま置く額あり）",
     EX2_HOLD, {"cash": 15, "japan_equity": 20, "us_equity": 25, "developed_bond": 25, "gold": 15}, 87654),
    ("4 目標0%で保有あり（エマージングREIT）→戻らない",
     {"cash": 300000, "us_equity": 1500001, "emerging_reit": 234567},
     {"us_equity": 60, "japan_bond": 40}, 43210),
    ("5 超過なし・現金の余りだけ→n=1",
     {"cash": 1111111, "us_equity": 2345678, "japan_bond": 1000001},
     {"us_equity": 60, "japan_bond": 40}, 55555),
    ("6 目標どおり→0",
     {"us_equity": 600000, "developed_bond": 400000},
     {"us_equity": 60, "developed_bond": 40}, 50000),
]

if __name__ == "__main__":
    res = [solve(*e) for e in EXAMPLES]
    # 例3: 現金の目標額 > 今の現金 の確認
    r3 = res[2]
    r3["checks"]["cash_target_gt_now"] = F(r3["after_n"]["cash"]["target"]["exact"]) > F(1234567)
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "expected.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)
    for r in res:
        print("==", r["name"], "T=", r["T"]["exact"], "n=", r.get("n", r.get("result")), r.get("stuck_classes", ""))
        for k, v in r.get("over_classes", {}).items():
            print("   over", k, v["required_real"]["exact"], "=", round(v["required_real"]["value"], 4), "-> n_i", v["n_i"])
        if "monthly" in r:
            m = r["monthly"]
            print("   E", r["E"]["exact"], "buy/m", {k: v["exact"] for k, v in m["buy"].items()},
                  "draw/m", m["cash_drawdown"]["exact"], "keep/m", m["cash_keep"]["exact"])
            print("   identity", r["identity"]["lhs_buy_plus_keep"]["exact"], r["identity"]["rhs_M_plus_drawdown"]["exact"], r["identity"]["equal"])
            print("   after==target", all(v["equal"] for v in r["after_n"].values()),
                  {k: v["target"]["exact"] for k, v in r["after_n"].items()})
            print("   n-1", r["n_minus_1"]["months"], "sell", r["n_minus_1"]["sell_total"]["exact"],
                  r["n_minus_1"].get("sell_by_class", {}) and {k: v["exact"] for k, v in r["n_minus_1"]["sell_by_class"].items()})
        print("   checks", r["checks"])
