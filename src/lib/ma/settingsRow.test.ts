import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './types';
import { ownerAmountsProblem, rowToSettings, settingsToRow } from './settingsRow';

const base = { ...settingsToRow('owner', DEFAULT_SETTINGS), monthly_budget: 500000 };

describe('ownerAmountsProblem（/ma 月次メールがオーナーの金額を読めるか、D-065）', () => {
  it('migration 045 の前（目印の列が無い）で金額があれば読める', () => {
    expect(ownerAmountsProblem(base)).toBeNull();
  });
  it('目印が付いていて金額があれば読める', () => {
    expect(ownerAmountsProblem({ ...base, keep_amounts_on_server: true })).toBeNull();
  });
  it('目印が false なら送らない（金額がブラウザに移る行）', () => {
    expect(ownerAmountsProblem({ ...base, keep_amounts_on_server: false })).toMatch(/目印/);
  });
  it('目印があっても予算が null なら送らない', () => {
    expect(ownerAmountsProblem({ ...base, keep_amounts_on_server: true, monthly_budget: null })).toMatch(/予算/);
  });
});

describe('rowToSettings：金額が null の行', () => {
  it('null の金額は 0 として読み、目印を amounts_on_server に写す', () => {
    const s = rowToSettings({ ...base, monthly_budget: null, reserve_balance: null, slot1_amount: null, keep_amounts_on_server: false });
    expect(s.monthly_budget).toBe(0);
    expect(s.reserve_balance).toBe(0);
    expect(s.slot1.amount).toBe(0);
    expect(s.amounts_on_server).toBe(false);
  });
});
