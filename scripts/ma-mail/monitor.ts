/**
 * /ma 月次メールの実行記録と healthchecks.io への合図（run.ts から使う）。
 *
 * 順序が大事：送信と state.json（送信済みの記録）は main の中で済ませ、合図と記録ファイルはそのあとに書く。
 * 合図・記録ファイルの失敗は実行結果を変えない（送信済みなのに error・終了コード1 にすると、次回また送ってしまうため）。
 */

export type RunResult = 'sent' | 'force_sent' | 'dry_run' | 'not_due' | 'already_sent' | 'error';

/** 1回の実行の記録（ファイルと healthchecks.io に送る。金額は含めない） */
export interface RunRecord {
  startedAt: string;
  finishedAt: string;
  result: RunResult;
  today: string;
  targetMonth: string | null;
  recordedMonths: string[]; // 台帳方式（未着手）で使う。今は常に空
  catchup: boolean;
  mailSent: boolean;
  error: string | null;
  /** 暴落ルールの通知（#34）の結果。送信日でない日だけ。結果（result）と合図には影響しない */
  alert?: string | null;
  ping?: string;
}

export interface RunDeps {
  /** 判定・送信・state.json の更新まで。送らない日も結果を返す */
  main: () => Promise<{ result: RunResult; targetMonth: string; catchup: boolean; alert?: string | null }>;
  ping: (record: RunRecord) => Promise<string>;
  write: (record: RunRecord) => void;
  now?: () => string;
}

export async function runOnce(today: string, deps: RunDeps): Promise<{ record: RunRecord; exitCode: number }> {
  const now = deps.now ?? (() => new Date().toISOString());
  const record: RunRecord = {
    startedAt: now(), finishedAt: '', result: 'error', today,
    targetMonth: null, recordedMonths: [], catchup: false, mailSent: false, error: null,
  };
  let exitCode = 0;
  try {
    const r = await deps.main();
    record.result = r.result;
    record.targetMonth = r.targetMonth;
    record.catchup = r.catchup;
    record.alert = r.alert ?? null;
    record.mailSent = r.result === 'sent' || r.result === 'force_sent';
  } catch (e) {
    record.error = e instanceof Error ? e.message : String(e);
    exitCode = 1;
  }
  // ここから下は、結果（record.result）と終了コードを変えない
  record.finishedAt = now();
  try {
    record.ping = await deps.ping(record);
  } catch (e) {
    record.ping = `送れず: ${e instanceof Error ? e.message : e}`;
  }
  try {
    deps.write(record);
  } catch (e) {
    console.error(`  記録ファイルを書けませんでした: ${e instanceof Error ? e.message : e}`);
  }
  return { record, exitCode };
}

/** 本番の送信は url、エラーは url/fail。それ以外の結果では送らない。届かなくても例外は投げない */
export async function sendPing(
  record: RunRecord,
  url: string | undefined,
  timeoutMs = 10_000,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (record.result !== 'sent' && record.result !== 'error') return 'なし（送信・エラー以外）';
  if (!url) return 'skipped（HEALTHCHECK_URL 未設定）';
  const target = record.result === 'error' ? `${url.replace(/\/$/, '')}/fail` : url;
  try {
    const res = await fetchImpl(target, { method: 'POST', body: JSON.stringify(record), signal: AbortSignal.timeout(timeoutMs) });
    return `${record.result === 'error' ? 'fail' : 'success'} ${res.status}`;
  } catch (e) {
    return `送れず: ${e instanceof Error ? e.message : e}`;
  }
}
