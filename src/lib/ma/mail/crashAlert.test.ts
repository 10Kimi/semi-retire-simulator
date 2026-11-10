import { describe, it, expect } from 'vitest';
import { buildCrashAlert, decideCrashAlert, markNotified, type CrashAlertState } from './crashAlert';
import { evaluateCrash } from '../crash';
import type { CrashState, PricePoint } from '../types';

const ATH = 7000;
const at = (dd: number, ath = ATH, athDate = '2026-10-06'): PricePoint => ({
  last: ath * (1 + dd), lastDate: '2026-11-11', ath, athDate,
});

describe('暴落ルールの通知の判定（#34）', () => {
  it('① 段階に新たに達した → 通知する', () => {
    const d = decideCrashAlert(at(-0.21), null, null);
    expect(d.stages).toEqual([20]);
    expect(d.next).toEqual({ athValue: ATH, athDate: '2026-10-06', notified: [20] });
  });

  it('−20% に届かなければ通知しない', () => {
    expect(decideCrashAlert(at(-0.1), null, null).stages).toEqual([]);
    expect(decideCrashAlert(at(-0.1999), null, null).stages).toEqual([]);
  });

  it('② 通知済み → しない。次の段階だけ通知する', () => {
    const prev: CrashAlertState = { athValue: ATH, athDate: '2026-10-06', notified: [20] };
    expect(decideCrashAlert(at(-0.25), null, prev).stages).toEqual([]);
    const d = decideCrashAlert(at(-0.31), null, prev);
    expect(d.stages).toEqual([30]);
    expect(d.next.notified).toEqual([20, 30]);
  });

  it('③ 高値を更新したあと再び達した → 通知する', () => {
    const prev: CrashAlertState = { athValue: ATH, athDate: '2026-10-06', notified: [20, 30] };
    const d = decideCrashAlert(at(-0.22, 7500, '2027-03-01'), null, prev);
    expect(d.stages).toEqual([20]);
    expect(d.next).toEqual({ athValue: 7500, athDate: '2027-03-01', notified: [20] });
  });

  it('④ crash_state で確定済み → しない（高値を更新したら確定済みも数え直す）', () => {
    const confirmed: CrashState = { athValue: ATH, athDate: '2026-10-06', triggered: [20], baseReserve: 300000 };
    expect(decideCrashAlert(at(-0.25), confirmed, null).stages).toEqual([]);
    expect(decideCrashAlert(at(-0.32), confirmed, null).stages).toEqual([30]);
    expect(decideCrashAlert(at(-0.25, 7500), confirmed, null).stages).toEqual([20]);
  });

  it('⑤ 一度に −30% まで落ちた → −20%・−30% を1通にまとめて通知する', () => {
    const d = decideCrashAlert(at(-0.33), null, null);
    expect(d.stages).toEqual([20, 30]);
    const crash = evaluateCrash(at(-0.33), null, 300000);
    const mail = buildCrashAlert({ today: '2026-11-11', stages: d.stages, sp500Usd: at(-0.33), sp500Jpy: null, crash });
    expect(mail.subject).toContain('第1段階（高値比 −20%）・第2段階（高値比 −30%）');
    expect(mail.text).toContain('基準残高の1/3 ¥100,000');
    expect(mail.text).toContain('合計：¥200,000');
    expect(mail.text).toContain('終値 4,690、最高値 7,000');
    const odd = buildCrashAlert({ today: '2026-11-11', stages: [20], sp500Usd: { ...at(-0.21), last: 6176.955 }, sp500Jpy: null, crash: null });
    expect(odd.text).toContain('終値 6,176.96');
  });

  it('月次メールで知らせた段階は通知済みになる', () => {
    const s = markNotified(at(-0.21), [20], null);
    expect(decideCrashAlert(at(-0.22), null, s).stages).toEqual([]);
  });

  it('本文：下落率・投入額の見込み・/ma の案内、禁止語を含まない', () => {
    const crash = evaluateCrash(at(-0.41), null, 450000);
    const mail = buildCrashAlert({
      today: '2026-11-11', stages: [20, 30, 40], sp500Usd: at(-0.41),
      sp500Jpy: { last: 600000, lastDate: '2026-11-11', ath: 1000000, athDate: '2026-08-13' }, crash,
    });
    expect(mail.text).toContain('−41.0%');
    expect(mail.text).toContain('参考：S&P500（円建て）の高値からの位置 −40.0%');
    expect(mail.text).toContain('待機資金の残高の全額');
    expect(mail.text).toContain('/ma を開いて');
    for (const w of [/提案/, /推奨/, /お勧め/, /おすすめ/, /アドバイス/, /買うべき/]) {
      expect(mail.text).not.toMatch(w);
      expect(mail.html).not.toMatch(w);
    }
  });
});
