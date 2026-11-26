// /ma の待機資金（想定）と「実際の残高に合わせる」の入口。オーナー本人の行（台帳方式、FI_project #140、§13-69「伝え方」）だけ。
// 上書きできるのは台帳の最後の行だけ。台帳が空のときは、最後に送信日を過ぎた月の月末で合わせる（その月を最初の行にする）。
// 送信日の前に今月末で合わせると、今月の記録（配分）が作られなくなるため（#140 のレビュー）。
import { useState } from 'react';
import { formatCurrency } from '../../lib/ma/logic';
import { effectiveClosing, lastOverride, latestRow, prevMonth, type LedgerRow } from '../../lib/ma/ledger';
import { scheduledSendDate } from '../../lib/ma/mail/schedule';

/** 月次メールの送信日（scripts/ma-mail/config.local.json の sendDay と同じ。§13-69） */
const SEND_DAY = 25;

interface Props {
  rows: LedgerRow[];
  failed: boolean;
  /** 台帳が空のときに表示する旧列の残高（reserve_balance） */
  legacyBalance: number;
  currentMonth: string;
  /** 今日 'YYYY-MM-DD'（台帳が空のとき、合わせる月を決める） */
  today: string;
  /** 上書き（amount が null なら取り消し）。month は上書きする月 */
  onOverride: (month: string, amount: number | null) => Promise<boolean>;
}

const monthLabel = (m: string) => `${Number(m.slice(0, 4))}年${Number(m.slice(5, 7))}月`;

export default function MaLedgerPanel({ rows, failed, legacyBalance, currentMonth, today, onOverride }: Props) {
  const latest = latestRow(rows);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const firstMonth = today >= scheduledSendDate(currentMonth, SEND_DAY) ? currentMonth : prevMonth(currentMonth);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const balance = latest ? effectiveClosing(latest) : legacyBalance;
  const matched = lastOverride(rows);
  const targetMonth = latest?.month ?? firstMonth;

  const save = async (value: number | null) => {
    setBusy(true);
    setMessage(null);
    const ok = await onOverride(targetMonth, value);
    setBusy(false);
    if (!ok) {
      setMessage('保存できませんでした。時間をおいてもう一度お試しください');
      return;
    }
    setAmount('');
    setOpen(false);
    setMessage(value == null ? '上書きを取り消しました' : `${monthLabel(targetMonth)}末の実際の残高に合わせました`);
  };

  const submit = () => {
    const v = Number(amount.replace(/[,，\s]/g, ''));
    if (!amount.trim() || !Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
      setMessage('0 以上の金額（円、整数）を入れてください');
      return;
    }
    save(v);
  };

  return (
    <div className="bg-amber-900/30 border-2 border-amber-500/50 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💰</span>
          <div>
            <div className="text-xs text-amber-300/70 uppercase tracking-wide">待機資金（想定）</div>
            <div className="text-amber-200 text-sm mt-0.5">暴落時に投入 高値比 −20%・−30%→1/3、−40%→全額</div>
          </div>
        </div>
        <div className="text-2xl font-bold text-amber-300">{formatCurrency(balance)}</div>
      </div>
      <p className="text-xs text-amber-200/80 mt-2">
        {latest ? `${monthLabel(latest.month)}末の時点。` : ''}
        配分どおりに積み立てた前提の累計です。毎月の記録は25日の月次メールで作ります（この画面の計算は下書きで、保存しません）。
      </p>
      <p className="text-xs text-amber-200/80 mt-1">
        最後に実際の残高で合わせた月：
        {matched
          ? `${monthLabel(matched.month)}末 ${formatCurrency(matched.override_balance ?? 0)}（想定との差 ${(matched.override_balance ?? 0) - matched.closing_balance >= 0 ? '+' : '−'}${formatCurrency(Math.abs((matched.override_balance ?? 0) - matched.closing_balance))}）`
          : 'まだ合わせていません'}
      </p>
      {failed && <p className="text-xs text-red-300 mt-1">台帳を読めませんでした（通信の失敗など）。表示は保存済みの残高です。</p>}

      {!failed && (
        <div className="mt-3">
          {!open ? (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setOpen(true)} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-bold">
                実際の残高に合わせる
              </button>
              {latest?.override_balance != null && (
                <button onClick={() => save(null)} disabled={busy} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">
                  {monthLabel(latest.month)}末の上書きを取り消す
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-amber-100">{monthLabel(targetMonth)}末の実際の待機資金の残高</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="例 1234567"
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white"
                />
                <button onClick={submit} disabled={busy} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-bold">
                  保存
                </button>
                <button onClick={() => setOpen(false)} className="px-3 py-1.5 bg-slate-700 rounded-lg text-sm">
                  やめる
                </button>
              </div>
              <p className="text-xs text-slate-400">想定の残高は残します。翌月からはこの額から積み直します。暴落ルールの段階と基準残高は変えません。</p>
            </div>
          )}
        </div>
      )}
      {message && <p className="text-xs text-amber-100 mt-2">{message}</p>}
    </div>
  );
}
