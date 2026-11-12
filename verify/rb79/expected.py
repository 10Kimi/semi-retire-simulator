"""#79 検算：/rb 積立のみ・期間指定の毎月の計画（仕様 spec79.md から独立に計算）"""
import json, math, sys
from fractions import Fraction as F

H = {"cash":1_200_000,"us":3_000_000,"em":1_000_000,"jb":600_000,"db":1_600_000,"gold":500_000,"other":0}
LV3 = {"cash":0,"us":F(25,100),"em":F(15,100),"jb":F(15,100),"db":F(40,100),"gold":F(5,100),"other":0}
CASHT = {"cash":F(5,100),"us":F(25,100),"em":F(15,100),"jb":F(15,100),"db":F(35,100),"gold":F(5,100),"other":0}

def r1000(x):  # 四捨五入（0.5 は切り上げ）。正の値のみ想定
    return int(math.floor(F(x)/1000 + F(1,2)))*1000

def months(h, w, M):
    T = sum(h.values()); n = 1
    while any(k!="cash" and w[k]>0 and h[k] > w[k]*(T+M*n) for k in h): n += 1
    return n

def alloc(B, d):
    tot = sum(d.values()); raw = {k: r1000(F(B)*v/tot) for k,v in d.items()}
    diff = B - sum(raw.values())
    if diff:
        top = max(raw, key=lambda k: raw[k]); raw[top] += diff  # 同額なら先に出たクラス
    return raw, diff

def plan(h, w, M, N):
    T = sum(h.values()); E = T + M*N
    sell_tot = {k: max(F(0), h[k]-w[k]*E) for k in h if k!="cash"}
    cash_out = max(F(0), h["cash"]-w["cash"]*E); cash_keep = max(F(0), w["cash"]*E-h["cash"])
    C, D = r1000(cash_out/N), r1000(cash_keep/N)
    S_k = {k: r1000(v/N) for k,v in sell_tot.items() if v>0}; S = sum(S_k.values())
    B = M + C + S - D
    targets = [k for k in h if k!="cash" and w[k]>0 and h[k] <= w[k]*T]
    d = {k: max(F(0), w[k]*E-h[k]) for k in targets}; d = {k:v for k,v in d.items() if v>0}
    fallback = False
    if not d:
        fallback = True; d = {k: w[k]*E-h[k] for k in h if k!="cash" and w[k]*E-h[k]>0}
    b, adj = alloc(B, d)
    after = dict(h)
    after["cash"] = h["cash"] - C*N + D*N
    for k,v in S_k.items(): after[k] -= v*N
    for k,v in b.items(): after[k] += v*N
    tot = sum(after.values())
    ratio = {k: float(F(v)/tot) for k,v in after.items()}
    gap = {k: round((ratio[k]-float(w[k]))*100, 3) for k in h}
    return {"M":M,"N":N,"T":T,"E":E,
        "sell_total": {k: float(v) for k,v in sell_tot.items() if v>0},
        "cash_out_total": float(cash_out), "cash_keep_total": float(cash_keep),
        "C_monthly_cash_out":C, "D_monthly_cash_keep":D, "S_monthly_sell":S_k, "S":S,
        "B":B, "buy_targets":targets, "deficit": {k: float(v) for k,v in d.items()}, "fallback":fallback,
        "b_monthly_buy": b, "round_adjust_to_largest": adj,
        "monthly_ops": {"sell":S, "buy":B, "cash_out":C, "cash_keep":D, "sell+buy":S+B},
        "after": after, "after_total": tot, "after_ratio_pct": {k: round(v*100,3) for k,v in ratio.items()},
        "gap_pt": gap, "all_within_2pt": all(abs(g)<=2 for g in gap.values())}

def this_month(h, w, M):
    T = sum(h.values()); T2 = T+M
    targets = [k for k in h if k!="cash" and w[k]>0 and h[k] <= w[k]*T]
    d = {k: max(F(0), w[k]*T2-h[k]) for k in targets}; d = {k:v for k,v in d.items() if v>0}
    b, adj = alloc(M, d)
    return {"deficit": {k: float(v) for k,v in d.items()}, "buy": b, "adjust": adj}

out = {}
for M in (200_000, 123_000):
    n = months(H, LV3, M)
    out[f"5-1_積立のみ_M{M}"] = {"n": n, **plan(H, LV3, M, n), "今月の積立先(項目4)": this_month(H, LV3, M)}
    out[f"5-3_期間指定_N6_M{M}"] = plan(H, LV3, M, 6)
out["追加_現金5%目標_期間指定_N6_M123000"] = plan(H, CASHT, 123_000, 6)
n = months(H, CASHT, 123_000)
out["追加_現金5%目標_積立のみ_M123000"] = {"n": n, **plan(H, CASHT, 123_000, n)}
json.dump(out, open(sys.argv[1] if len(sys.argv)>1 else "expected.json","w"), ensure_ascii=False, indent=1, default=float)
print(json.dumps(out, ensure_ascii=False, indent=1, default=float))
