"""FI_project #140 /ma 待機資金の台帳方式 — 検算役の独自計算。

仕様: 統括役の 140_spec.md と 設計書 v7.25 §13-69「台帳方式」。src/ は読んでいない。
実行: python3 verify/ma-ledger-140/verify.py  → 同じフォルダに expected.json、標準出力に途中の値。

前提（統括役が渡した定義）:
- dd = min(0, last/ath - 1)。ath は今の sp500_usd.ath（読み方A。C4d に読み方Bも併記）
- 段階 20/30/40、各1回。最初に発動した月の基準残高 = その月の opening
- -20/-30 の投入 = min(残り, floor(基準/3))、-40 = 残り全額。残りの初期値 = opening
- 高値の更新は ath > prev.athValue かつ athDate > prev.athDate のときだけ。更新ならリセットしてから判定
- スロットは全部非課税枠 → 倍率なし。monthly_reserve = max(0, 予算 - スロット合計)
- closing = opening + monthly_reserve - 投入合計。翌月の opening = override ?? closing
"""
import json
import copy
from math import floor
from pathlib import Path

STAGES = [(20, -0.20), (30, -0.30), (40, -0.40)]

# ---------- 共通の入力 ----------
BUDGET = 523_456
SLOTS = [
    # 非課税枠だけ。端数入り。合計 310,000
    {"account": "nisa_tsumitate", "amount": 98_765, "name": "全世界株式インデックス", "assetClass": "global_stock"},
    {"account": "nisa_growth", "amount": 188_235, "name": "S&P500インデックス", "assetClass": "us_stock"},
    {"account": "ideco", "amount": 23_000, "name": "先進国株式インデックス", "assetClass": "dev_stock"},
] + [{"account": "nisa_growth", "amount": 0, "name": "", "assetClass": None} for _ in range(7)]


def sp(last, ath, ath_date):
    return {"last": last, "ath": ath, "athDate": ath_date}


def make_inputs(sp500):
    return {
        # 指標は倍率に効かない（全スロット非課税枠）。実装が要求する形に合わせて統括役が置き換えてよい値
        "cape": 30.0, "pbr": 1.4, "gsr": 80.0,
        "momentum": {"us": True, "jp": True, "em": True, "gold": True},
        "cape5yMA": None,
        "as_of": {},
        "sp500_usd": sp500,
        "mode": "neutral",
        "monthly_budget": BUDGET,
        "jp_index": "topix",
        "slots": SLOTS,
    }


def check_inputs():
    tot = sum(s["amount"] for s in SLOTS)
    assert tot == 310_000, tot
    tsumi = sum(s["amount"] for s in SLOTS if s["account"] == "nisa_tsumitate")
    growth = sum(s["amount"] for s in SLOTS if s["account"] == "nisa_growth")
    assert tsumi * 12 <= 1_200_000 and growth * 12 <= 2_400_000 and (tsumi + growth) * 12 <= 3_600_000
    assert BUDGET - tot == 213_456
    return {"slot_total": tot, "nisa_tsumitate_year": tsumi * 12, "nisa_growth_year": growth * 12,
            "nisa_year_total": (tsumi + growth) * 12, "ideco_month": 23_000,
            "monthly_reserve": BUDGET - tot}


# ---------- 月の計算 ----------
def next_month(m):
    y, mo = map(int, m.split("-"))
    mo += 1
    if mo == 13:
        y, mo = y + 1, 1
    return f"{y:04d}-{mo:02d}"


def prev_month(m):
    y, mo = map(int, m.split("-"))
    mo -= 1
    if mo == 0:
        y, mo = y - 1, 12
    return f"{y:04d}-{mo:02d}"


def effective_closing(row):
    return row["override_balance"] if row.get("override_balance") is not None else row["closing_balance"]


def evaluate_crash(sp500, prev_state, reserve, dd_ref="current_ath", log=None):
    """戻り値: (投入合計, 新しく発動した段階, 新しい状態)"""
    log = log if log is not None else []
    if sp500 is None:
        log.append("sp500 なし → 判定しない")
        return 0, [], copy.deepcopy(prev_state)
    if prev_state is None:
        state = {"triggered": [], "baseReserve": None, "athValue": sp500["ath"], "athDate": sp500["athDate"]}
        log.append("前の状態なし → 今の高値で状態を作る")
    else:
        state = copy.deepcopy(prev_state)
        new_high = sp500["ath"] > state["athValue"] and sp500["athDate"] > state["athDate"]
        log.append(f"高値の更新? ath {sp500['ath']} > {state['athValue']} = {sp500['ath'] > state['athValue']}, "
                   f"athDate {sp500['athDate']} > {state['athDate']} = {sp500['athDate'] > state['athDate']} → {new_high}")
        if new_high:
            state = {"triggered": [], "baseReserve": None, "athValue": sp500["ath"], "athDate": sp500["athDate"]}
            log.append("リセット")
    ref = sp500["ath"] if dd_ref == "current_ath" else state["athValue"]
    dd = min(0.0, sp500["last"] / ref - 1)
    log.append(f"dd = {sp500['last']}/{ref} - 1 = {dd:.6f}")
    remaining = reserve
    total = 0
    newly = []
    for stage, th in STAGES:
        if dd <= th and stage not in state["triggered"]:
            if state["baseReserve"] is None:
                state["baseReserve"] = reserve
                log.append(f"基準残高 = {reserve}")
            if stage == 40:
                amt = remaining
            else:
                amt = min(remaining, floor(state["baseReserve"] / 3))
            remaining -= amt
            total += amt
            newly.append(stage)
            state["triggered"].append(stage)
            log.append(f"段階{stage}: 投入 {amt}（残り {remaining}）")
    return total, newly, state


def compute_ledger_month(prev, month, inputs, catchup, dd_ref="current_ath"):
    log = []
    opening = effective_closing(prev)
    log.append(f"opening = {opening}（prev {prev['month']} の closing {prev['closing_balance']}, override {prev.get('override_balance')}）")
    if catchup:
        crash, trig, state = 0, [], copy.deepcopy(prev["crash_state"])
        log.append("追いつきの月 → 暴落は判定しない")
    else:
        crash, trig, state = evaluate_crash(inputs["sp500_usd"], prev["crash_state"], opening, dd_ref, log)
    slot_total = sum(s["amount"] for s in inputs["slots"])
    reserve = max(0, inputs["monthly_budget"] - slot_total)
    closing = opening + reserve - crash
    log.append(f"monthly_reserve = max(0, {inputs['monthly_budget']} - {slot_total}) = {reserve}")
    log.append(f"closing = {opening} + {reserve} - {crash} = {closing}")
    row = {
        "month": month, "kind": "record", "catchup": catchup,
        "opening_balance": opening, "monthly_reserve": reserve,
        "crash_deployment": crash, "crash_triggered": trig, "crash_state": state,
        "closing_balance": closing, "override_balance": None, "override_at": None,
    }
    return row, log


def catch_up(rows, target, inputs, dd_ref="current_ath"):
    rows = sorted(rows, key=lambda r: r["month"])
    last = rows[-1]
    if last["month"] >= target:
        return [], ["記録済み → 空"]
    out, logs = [], []
    prev = last
    m = next_month(last["month"])
    while m <= target:
        row, log = compute_ledger_month(prev, m, inputs, catchup=(m < target), dd_ref=dd_ref)
        out.append(row)
        logs.append({m: log})
        prev = row
        m = next_month(m)
    return out, logs


def seed_row(month, balance, crash_state=None):
    return {"month": month, "kind": "seed", "catchup": False, "inputs": None,
            "opening_balance": None, "monthly_reserve": 0, "crash_deployment": 0,
            "crash_triggered": [], "crash_state": crash_state, "closing_balance": balance,
            "override_balance": None, "override_at": None}


def seed_from_legacy(settings, before):
    rm = settings.get("reserve_month")
    if rm is not None and rm >= before:
        base = settings.get("reserve_month_base")
        bal = base if base is not None else settings["reserve_balance"]
        month = prev_month(before)
    else:
        bal = settings["reserve_balance"]
        month = rm if rm is not None else prev_month(before)
    cs = settings.get("crash_state")
    if cs is None:
        state = None
    elif cs.get("month") is not None and cs["month"] >= before:
        state = cs.get("monthBase")
    else:
        state = cs.get("current")
    return seed_row(month, bal, state)


# ---------- ケース ----------
def strip(row):
    keys = ["month", "kind", "catchup", "opening_balance", "monthly_reserve", "crash_deployment",
            "crash_triggered", "crash_state", "closing_balance", "override_balance"]
    return {k: row[k] for k in keys}


def run_catchup_case(cid, desc, rows, target, sp500, dd_ref="current_ath", note=None):
    inputs = make_inputs(sp500)
    out, logs = catch_up(rows, target, inputs, dd_ref)
    case = {"id": cid, "desc": desc, "call": "catchUpLedger",
            "input": {"rows": rows, "targetMonth": target, "inputs": inputs},
            "expected": [strip(r) for r in out], "trace": logs}
    if note:
        case["note"] = note
    return case, out


ATH0 = (6000, "2026-10-01")
STATE20 = {"triggered": [20], "baseReserve": 2_400_000, "athValue": 6000, "athDate": "2026-10-01"}

cases = []

c, _ = run_catchup_case("K1", "通常の1か月（dd -5%）", [seed_row("2026-10", 1_234_567)], "2026-11", sp(5700, *ATH0))
cases.append(c)

k2_rows = [seed_row("2026-09", 1_234_567)]
c, k2_out = run_catchup_case("K2", "追いつき2か月抜け（10・11月 catchup、12月 dd -10%）", k2_rows, "2026-12", sp(5400, *ATH0))
cases.append(c)

c, _ = run_catchup_case("C1", "-32% でまとめて発動（20・30）", [seed_row("2026-11", 3_000_001)], "2026-12", sp(4080, *ATH0),
                        note="4080/6000-1 は浮動小数で -0.32000000000000006。-0.30 の境界には掛からない")
cases.append(c)

c, _ = run_catchup_case("C2", "-45% で3段階まとめて", [seed_row("2026-11", 2_345_679)], "2026-12", sp(3300, *ATH0))
cases.append(c)

c, _ = run_catchup_case("C3", "20 発動済み・基準 2,400,000、今 -32% → 30 だけ", [seed_row("2026-11", 1_654_321, STATE20)],
                        "2026-12", sp(4080, *ATH0))
cases.append(c)

c, _ = run_catchup_case("C3b", "C3 と同じだが残りが floor(基準/3) より少ない → 残り全部", [seed_row("2026-11", 500_001, STATE20)],
                        "2026-12", sp(4080, *ATH0))
cases.append(c)

c, _ = run_catchup_case("C4a", "高値の更新（値も日付も後）→ リセットしてから判定（-18.03% で発動なし）",
                        [seed_row("2026-11", 1_600_000, STATE20)], "2026-12", sp(5000, 6100, "2026-11-20"))
cases.append(c)

c, _ = run_catchup_case("C4b", "値だけ大きく日付が同じ → リセットしない", [seed_row("2026-11", 1_600_000, STATE20)],
                        "2026-12", sp(5000, 6100, "2026-10-01"),
                        note="dd の分母を今の ath(6100) にしても前の athValue(6000) にしても新しい段階は無い（-18.03% / -16.67%）")
cases.append(c)

c, _ = run_catchup_case("C4c", "リセットのあと同じ月に -20% を越える → 基準は今の opening（2,400,000 ではない）",
                        [seed_row("2026-11", 1_600_000, STATE20)], "2026-12", sp(4800, 6100, "2026-11-20"))
cases.append(c)

c4d_note = ("曖昧な点：リセットしないとき dd の分母を今の sp500.ath(6100) にするか、状態の athValue(6000) にするか。"
            "expected は読み方A（今の ath、統括役の定義 dd = last/ath どおり）。読み方B は expected_alt")
c, _ = run_catchup_case("C4d", "値だけ大きいとき dd の分母で結果が変わる例（last 4250）", [seed_row("2026-11", 1_600_000, STATE20)],
                        "2026-12", sp(4250, 6100, "2026-10-01"), note=c4d_note)
alt, alt_logs = catch_up([seed_row("2026-11", 1_600_000, STATE20)], "2026-12", make_inputs(sp(4250, 6100, "2026-10-01")), "state_ath")
c["expected_alt"] = [strip(r) for r in alt]
c["trace_alt"] = alt_logs
cases.append(c)

c, _ = run_catchup_case("C5", "2か月抜け、今 -15% → 発動なし（抜けた間に越えて戻った段階は発動しない）",
                        [seed_row("2026-09", 1_234_567)], "2026-12", sp(5100, *ATH0))
cases.append(c)

# C6: K2 を2回
second, log2 = catch_up(k2_rows + k2_out, "2026-12", make_inputs(sp(5400, *ATH0)))
cases.append({"id": "C6", "desc": "K2 を2回実行 → 2回目は空", "call": "catchUpLedger",
              "input": {"rows": k2_rows + k2_out, "rows_reversed_also_empty": True, "targetMonth": "2026-12",
                        "inputs": make_inputs(sp(5400, *ATH0))},
              "expected": [strip(r) for r in second], "trace": log2})
assert second == []
rev, _ = catch_up(list(reversed(k2_rows + k2_out)), "2026-12", make_inputs(sp(5400, *ATH0)))
assert rev == []

c, _ = run_catchup_case("C7", "抜けた月の投入 0、12月 -25% で 20 発動・基準 = 12月の opening",
                        [seed_row("2026-09", 1_234_567)], "2026-12", sp(4500, *ATH0))
cases.append(c)

# O1: 上書き
o_seed = seed_row("2026-10", 1_786_544)
o_nov, o_nov_log = compute_ledger_month(o_seed, "2026-11", make_inputs(sp(5700, *ATH0)), False)
assert o_nov["closing_balance"] == 2_000_000
o_nov_over = dict(o_nov, override_balance=1_500_000, override_at="(任意の時刻)")
dec_over, log_over = catch_up([o_seed, o_nov_over], "2026-12", make_inputs(sp(5700, *ATH0)))
dec_cancel, log_cancel = catch_up([o_seed, o_nov], "2026-12", make_inputs(sp(5700, *ATH0)))
cases.append({"id": "O1", "desc": "11月の closing 2,000,000 に override 1,500,000 → 12月 opening 1,500,000。取り消すと 2,000,000",
              "call": "catchUpLedger",
              "input": {"rows_override": [o_seed, o_nov_over], "rows_cancel": [o_seed, o_nov], "targetMonth": "2026-12",
                        "inputs": make_inputs(sp(5700, *ATH0))},
              "expected_nov_row": strip(o_nov),
              "expected_override": [strip(r) for r in dec_over],
              "expected_cancel": [strip(r) for r in dec_cancel],
              "diff_override_minus_closing": 1_500_000 - 2_000_000,
              "trace": {"nov": o_nov_log, "override": log_over, "cancel": log_cancel}})

# S1-S3
LEG_CS_CUR = {"triggered": [20], "baseReserve": 1_000_000, "athValue": 6000, "athDate": "2026-10-01"}
LEG_CS_BASE = {"triggered": [], "baseReserve": None, "athValue": 6000, "athDate": "2026-10-01"}
s_inputs = [
    ("S1", {"reserve_balance": 1_100_000, "reserve_month": "2026-12", "reserve_month_base": 900_000,
            "crash_state": {"current": LEG_CS_CUR, "month": "2026-12", "monthBase": LEG_CS_BASE}}),
    ("S2", {"reserve_balance": 800_000, "reserve_month": "2026-10", "reserve_month_base": 750_000,
            "crash_state": {"current": LEG_CS_CUR, "month": "2026-11", "monthBase": LEG_CS_BASE}}),
    ("S3", {"reserve_balance": 0, "reserve_month": None, "reserve_month_base": None, "crash_state": None}),
]
for sid, st in s_inputs:
    r = seed_from_legacy(st, "2026-12")
    cases.append({"id": sid, "desc": "seedFromLegacy(beforeMonth 2026-12)", "call": "seedFromLegacy",
                  "input": {"settings": st, "beforeMonth": "2026-12"}, "expected": strip(r)})

out = {"spec": "140_spec.md + 設計書 v7.25 §13-69 台帳方式", "input_check": check_inputs(),
       "crash_state_shape": "{triggered, baseReserve, athValue, athDate}（台帳の行の crash_state。ボタン方式の {current, month, monthBase} の current と同じ形を想定）",
       "cases": cases}
p = Path(__file__).with_name("expected.json")
p.write_text(json.dumps(out, ensure_ascii=False, indent=2))

# ---------- 途中の値の一覧 ----------
print("入力の確認:", out["input_check"])
for c in cases:
    print(f"\n== {c['id']}: {c['desc']}")
    if c["call"] == "seedFromLegacy":
        e = c["expected"]
        print(f"  month {e['month']} closing {e['closing_balance']:,} crash_state {e['crash_state']}")
        continue
    if c["id"] == "O1":
        print("  11月:", c["expected_nov_row"]["opening_balance"], "→", c["expected_nov_row"]["closing_balance"])
        for k in ("expected_override", "expected_cancel"):
            r = c[k][0]
            print(f"  {k}: 12月 opening {r['opening_balance']:,} closing {r['closing_balance']:,}")
        continue
    for t in c["trace"]:
        if not isinstance(t, dict):
            continue
        for m, lines in t.items():
            print(f"  [{m}]")
            for l in lines:
                print("    ", l)
    for r in c["expected"]:
        print(f"  => {r['month']} catchup={r['catchup']} open {r['opening_balance']:,} +{r['monthly_reserve']:,} "
              f"-{r['crash_deployment']:,} = {r['closing_balance']:,} trig {r['crash_triggered']} state {r['crash_state']}")
    if "expected_alt" in c:
        for r in c["expected_alt"]:
            print(f"  (読み方B) => {r['month']} -{r['crash_deployment']:,} = {r['closing_balance']:,} trig {r['crash_triggered']}")
    if not c["expected"]:
        print("  => 空", c["trace"])
