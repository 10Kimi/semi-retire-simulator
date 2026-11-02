import { describe, it, expect } from 'vitest';
import { runOnce, sendPing } from './monitor';

describe('送信のあとに合図が失敗しても、送信済みの扱いは変わらない', () => {
  it('合図がタイムアウトしても state.json は書かれ、結果は sent・終了コードは 0', async () => {
    const order: string[] = [];
    const state = { sentMonths: [] as string[] };
    // 応答しない healthchecks.io（中断の合図だけは受け取る＝本物の fetch と同じ）
    const hangingFetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('timeout')));
      })) as typeof fetch;

    const { record, exitCode } = await runOnce('2026-11-25', {
      main: async () => {
        order.push('send');
        state.sentMonths.push('2026-11'); // run.ts の main は送信成功の直後に state.json を書く
        order.push('state');
        return { result: 'sent', targetMonth: '2026-11', catchup: false };
      },
      ping: async (r) => {
        order.push('ping');
        return sendPing(r, 'https://hc.example/abc', 50, hangingFetch);
      },
      write: () => {
        order.push('write');
      },
    });

    expect(order).toEqual(['send', 'state', 'ping', 'write']);
    expect(state.sentMonths).toEqual(['2026-11']);
    expect(record.result).toBe('sent');
    expect(record.mailSent).toBe(true);
    expect(record.ping).toMatch(/^送れず/);
    expect(exitCode).toBe(0);
  });
});
