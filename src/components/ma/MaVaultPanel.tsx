// /ma のパスフレーズの設定・入力・リセット（案B、FI_project #117）。
// 鍵は親（MonthlyAdvisorPage）のメモリだけに持つ。ここはパスフレーズの入力欄と文言だけ。
import { useState } from 'react';
import { validatePassphrase } from '../../lib/vault/vault';
import { passphraseIssueText, vaultErrorText, type VaultStatus } from '../../lib/ma/vaultAmounts';

interface Props {
  /** owner では出さない。unlocked は鍵をメモリに持っている状態 */
  status: Exclude<VaultStatus, 'owner'> | 'unlocked';
  onSetup: (passphrase: string) => Promise<string[] | null>; // 足りない条件か、失敗の文言の一覧。成功は null
  onUnlock: (passphrase: string) => Promise<void>; // 失敗は例外（VaultError）
  onReset: () => Promise<boolean>;
}

export default function MaVaultPanel({ status, onSetup, onUnlock, onReset }: Props) {
  const [open, setOpen] = useState(status === 'restore-needed');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);

  const issues = pass ? passphraseIssueText(validatePassphrase(pass)) : [];

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setMessages([]);
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };

  const submitSetup = () =>
    run(async () => {
      if (pass !== pass2) {
        setMessages(['2回の入力が一致しません']);
        return;
      }
      const errors = await onSetup(pass);
      if (errors) setMessages(errors);
      else {
        setPass('');
        setPass2('');
      }
    });

  const submitUnlock = () =>
    run(async () => {
      try {
        await onUnlock(pass);
        setPass('');
      } catch (e) {
        setMessages([vaultErrorText(e)]);
      }
    });

  const submitReset = () =>
    run(async () => {
      if (await onReset()) {
        setConfirmReset(false);
        setPass('');
      } else setMessages(['リセットできませんでした。時間をおいてもう一度お試しください']);
    });

  const box = 'bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4 text-sm';
  const input = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900';
  const button = 'px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white';
  const busyLine = busy && <p className="text-amber-700 mt-2">確認中…</p>;
  const messageLines = messages.map((m) => (
    <p key={m} className="text-red-600 mt-2">
      {m}
    </p>
  ));

  const resetBlock = (
    <div className="mt-3">
      {!confirmReset ? (
        <button type="button" className="text-xs text-gray-600 underline" onClick={() => setConfirmReset(true)} disabled={busy}>
          パスフレーズを忘れた
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-gray-700">
            サーバーに保存した暗号文を消して、パスフレーズを設定し直します。消した金額は戻せません。
            {status === 'restore-needed'
              ? 'この端末に残っている値は、ほかの端末で保存した値より古い可能性があります（待機資金と暴落ルールの段階を確かめてください）。'
              : 'この端末に残っている値はそのまま使えます。'}
          </p>
          <div className="flex gap-2 mt-2">
            <button type="button" className="px-3 py-1 rounded bg-red-700 text-white" onClick={submitReset} disabled={busy}>
              消してやり直す
            </button>
            <button type="button" className="px-3 py-1 rounded bg-gray-100 text-gray-900" onClick={() => setConfirmReset(false)} disabled={busy}>
              やめる
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (status === 'unavailable') {
    return <div className="text-xs text-gray-500 mb-4">サーバーに接続できませんでした。金額はこの端末の値です（パスフレーズの設定・入力は、つながってから）。</div>;
  }

  if (status === 'unlocked') {
    return (
      <div className="text-xs text-gray-600 mb-4">🔒 金額はこの端末と、暗号化してサーバーにも保存しています（パスフレーズはこのページを閉じると忘れます）</div>
    );
  }

  if (status === 'none') {
    return (
      <div className={box}>
        <button type="button" className="w-full text-left text-gray-700" onClick={() => setOpen(!open)}>
          🔒 金額を別の端末でも戻せるようにする（パスフレーズを設定）{open ? ' ▲' : ' ▼'}
        </button>
        {open && (
          <div className="mt-3 space-y-2">
            <p className="text-gray-600">
              金額をこの端末の中で暗号化してから、サーバーにも保存します。運営者を含め、パスフレーズを知らない人には中身が見えません。
              ログインのパスワードとは別のものにしてください。<strong className="text-gray-800">忘れると戻せません</strong>（消してやり直すことはできます）。
            </p>
            <p className="text-gray-500 text-xs">6文字以上で、英大文字・英小文字・数字をそれぞれ1文字以上</p>
            {/* パスワード管理がログインのパスワードと分けて扱うための名前（表示しない） */}
            <input type="text" name="username" autoComplete="username" value="ma-passphrase" readOnly hidden />
            <input type="password" autoComplete="off" className={input} placeholder="パスフレーズ" value={pass} onChange={(e) => setPass(e.target.value)} disabled={busy} />
            <input type="password" autoComplete="off" className={input} placeholder="もう一度" value={pass2} onChange={(e) => setPass2(e.target.value)} disabled={busy} />
            {issues.map((m) => (
              <p key={m} className="text-amber-700 text-xs">
                ・{m}
              </p>
            ))}
            <button type="button" className={button} onClick={submitSetup} disabled={busy || issues.length > 0 || !pass || !pass2}>
              設定する
            </button>
            {busyLine}
            {messageLines}
          </div>
        )}
      </div>
    );
  }

  // locked / restore-needed：パスフレーズを入れる
  return (
    <div className={box}>
      {status === 'restore-needed' ? (
        <p className="text-gray-800">
          サーバーに、この端末より新しい金額の暗号文があります。パスフレーズを入れると戻します（戻すまで計算はできません）。
        </p>
      ) : (
        <p className="text-gray-700">🔒 パスフレーズを入れると、変えた金額をサーバーにも暗号化して保存します（入れなくてもこの端末では使えます）。</p>
      )}
      <div className="flex gap-2 mt-3">
        <input type="text" name="username" autoComplete="username" value="ma-passphrase" readOnly hidden />
        <input
          type="password"
          autoComplete="off"
          className={input}
          placeholder="パスフレーズ"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && pass && !busy && submitUnlock()}
          disabled={busy}
        />
        <button type="button" className={button} onClick={submitUnlock} disabled={busy || !pass}>
          入れる
        </button>
      </div>
      {busyLine}
      {messageLines}
      {resetBlock}
    </div>
  );
}
