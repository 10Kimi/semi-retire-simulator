import { useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ASSET_CLASSES } from '../../lib/rb/types';
import type { Holdings } from '../../lib/rb/types';
import { parseMfText, clampNegativeHoldings } from '../../lib/rb/mfParser';
import type { MfHolding } from '../../lib/rb/mfParser';
import { allocateHoldings, summarizeAllocations, sumExcludedCrypto, excludedCryptoNames } from '../../lib/rb/allocator';
import type { AllocatedHolding } from '../../lib/rb/allocator';
import { fetchFundMaster, submitFundRequest, fetchSubmittedRequestTickers, saveSnapshot, fundRequestBadge } from '../../lib/rb/db';
import { formatCurrency } from '../../lib/rb/logic';

type ImportStep = 'paste' | 'preview' | 'unclassified' | 'confirm';

interface Props {
  onImportComplete: (holdings: Holdings, saved: boolean) => void;
  onCancel: () => void;
}

const ASSET_CLASS_OPTIONS = [
  ...ASSET_CLASSES.map(ac => ({ value: ac.key, label: ac.label })),
  { value: 'exclude', label: '保有資産に含めない' },
];

function CryptoNote({ amount, names }: { amount: number; names: string[] }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
      <p className="text-xs text-slate-400 mb-1">計算の対象外：暗号資産 {formatCurrency(amount)}</p>
      {names.length > 0 && (
        <p className="text-xs text-slate-500 mb-1">対象外にした行：{names.join('、')}</p>
      )}
      <p className="text-sm text-slate-300">
        暗号資産は値動きが大きいため、配分の計算の対象外です（保存する残高と緊急資金にも含めません）
      </p>
    </div>
  );
}

function WarningList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div role="alert" className="bg-amber-900/30 border border-amber-500/50 rounded-2xl p-4 space-y-1">
      {items.map((w, i) => (
        <p key={i} className="text-sm text-amber-200">{w}</p>
      ))}
    </div>
  );
}

export default function MfImportFlow({ onImportComplete, onCancel }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<ImportStep>('paste');
  const [pastedText, setPastedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [rawHoldings, setRawHoldings] = useState<MfHolding[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [allocated, setAllocated] = useState<AllocatedHolding[]>([]);
  const [requestedTickers, setRequestedTickers] = useState<Set<string>>(new Set());
  const [pendingTickers, setPendingTickers] = useState<Set<string>>(new Set()); // 審査待ち（#38）
  const [verifyingTicker, setVerifyingTicker] = useState<string | null>(null);
  const [confirmTicker, setConfirmTicker] = useState<{ ticker: string; name: string; assetClass: string } | null>(null);

  const unclassified = allocated.filter(a => !a.matched);
  const classified = allocated.filter(a => a.matched && !a.excluded);
  const excludedCount = allocated.filter(a => a.excluded).length;
  const excludedCrypto = sumExcludedCrypto(allocated);
  const excludedNames = excludedCryptoNames(allocated);
  const { holdings: summary, clamped } = clampNegativeHoldings(summarizeAllocations(allocated));
  const hasBalance = Object.values(summary).some(v => v > 0);
  const clampedLabels = ASSET_CLASSES.filter(ac => clamped.includes(ac.key)).map(ac => ac.label);

  const handleRead = async () => {
    const { holdings, warnings: parseWarnings } = parseMfText(pastedText);
    setPastedText(''); // 貼ったテキストは読んだら持たない
    setError('');
    setWarnings(parseWarnings);

    if (holdings.length === 0) {
      setError('読み取れる区分がありませんでした。マネーフォワードの「資産」ページの全体をコピーして貼り付けてください。');
      return;
    }

    setLoading(true);
    try {
      const [fundMaster, submitted] = await Promise.all([
        fetchFundMaster(),
        user ? fetchSubmittedRequestTickers(user.id) : Promise.resolve({ all: new Set<string>(), pending: new Set<string>() }),
      ]);
      setRequestedTickers(submitted.all);
      setPendingTickers(submitted.pending);
      setRawHoldings(holdings);
      setAllocated(allocateHoldings(holdings, fundMaster));
      setStep('preview');
    } catch {
      setError('読み込みに失敗しました。時間をおいて、もう一度貼り付けてください。');
    }
    setLoading(false);
  };

  const handleManualClass = (index: number, assetClass: string) => {
    setAllocated(prev => prev.map((a, i) => {
      if (i !== index) return a;
      return { ...a, manualClass: assetClass };
    }));
  };

  const handleSubmitRequest = useCallback(async (item: AllocatedHolding) => {
    if (!user || !item.manualClass || item.manualClass === 'exclude') return;
    const ticker = item.holding.ticker || item.holding.name;
    setVerifyingTicker(ticker);

    const result = await submitFundRequest(user.id, ticker, item.holding.name, item.manualClass);
    setVerifyingTicker(null);

    if (result.status === 'auto_approved' || result.status === 'already_sent') {
      setRequestedTickers(prev => new Set([...prev, ticker]));
    } else if (result.status === 'pending_review') {
      setRequestedTickers(prev => new Set([...prev, ticker]));
      setPendingTickers(prev => new Set([...prev, ticker]));
    } else if (result.status === 'needs_confirm') {
      setConfirmTicker({ ticker, name: item.holding.name, assetClass: item.manualClass });
    }
  }, [user]);

  const handleForceSubmit = useCallback(async () => {
    if (!user || !confirmTicker) return;
    setVerifyingTicker(confirmTicker.ticker);
    const result = await submitFundRequest(user.id, confirmTicker.ticker, confirmTicker.name, confirmTicker.assetClass, true);
    setVerifyingTicker(null);
    if (result.status !== 'error') {
      setRequestedTickers(prev => new Set([...prev, confirmTicker.ticker]));
      if (result.status === 'pending_review') setPendingTickers(prev => new Set([...prev, confirmTicker.ticker]));
    }
    setConfirmTicker(null);
  }, [user, confirmTicker]);

  const allUnclassifiedHandled = unclassified.every(a => a.manualClass);

  const handleConfirm = async () => {
    const saved = user ? await saveSnapshot(user.id, summary) : true;
    onImportComplete(summary, saved);
  };

  return (
    <div className="space-y-4">
      {/* STEP 1: テキストの貼り付け */}
      {step === 'paste' && (
        <div className="bg-slate-900 rounded-2xl p-4 space-y-3">
          <ol className="text-slate-300 text-sm space-y-1">
            <li>① マネーフォワード ME で「資産」→「資産内訳」を開く</li>
            <li>② ⌘A（Windows は Ctrl＋A）でページ全体を選び、⌘C（Ctrl＋C）でコピー</li>
            <li>③ 下の欄に ⌘V（Ctrl＋V）で貼り付け。範囲を選ぶ必要はありません</li>
          </ol>
          <textarea
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            rows={8}
            spellCheck={false}
            autoComplete="off"
            aria-label="MoneyForwardの資産ページのテキスト"
            placeholder="ここに貼り付け"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
          />
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          <WarningList items={warnings} />
          <button
            onClick={handleRead}
            disabled={loading || !pastedText.trim()}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-40"
          >
            {loading ? '読み取り中...' : '読み取る'}
          </button>
        </div>
      )}

      {/* STEP 2: プレビュー */}
      {step === 'preview' && (
        <>
          <WarningList items={warnings} />

          <div className="bg-slate-900 rounded-2xl p-4">
            <h3 className="text-sm text-slate-400 mb-3">
              解析結果（{rawHoldings.length}件 / {classified.length}件自動振り分け / {unclassified.length}件未分類{excludedCount > 0 && ` / ${excludedCount}件対象外`}）
            </h3>

            {/* 自動振り分け済み */}
            {classified.length > 0 && (
              <div className="space-y-1 mb-4">
                {classified.map((item, i) => (
                  <div key={i} className="bg-slate-800 rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <span className="text-slate-300 truncate block">{item.holding.name}</span>
                      {item.holding.ticker && (
                        <span className="text-slate-500 text-xs">{item.holding.ticker}</span>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-emerald-400">{formatCurrency(item.holding.amount)}</div>
                      <div className="text-slate-500 text-xs">
                        {item.allocations.map(a => {
                          const cls = ASSET_CLASSES.find(ac => ac.key === a.assetClass);
                          return cls?.label ?? a.assetClass;
                        }).join(' / ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {excludedCrypto !== 0 && (
              <div className="mb-4">
                <CryptoNote amount={excludedCrypto} names={excludedNames} />
              </div>
            )}

            {/* 未分類 */}
            {unclassified.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs text-orange-400 font-medium">未分類（手動でアセットクラスを選択してください）</h4>
                {unclassified.some(a => pendingTickers.has(a.holding.ticker || a.holding.name)) && (
                  <p className="text-xs text-slate-500">
                    「審査中」の銘柄は、審査が終わるまで次の取り込みでも未分類のままになることがあります。
                  </p>
                )}
                {unclassified.map((item, idx) => {
                  const globalIdx = allocated.indexOf(item);
                  const ticker = item.holding.ticker || item.holding.name;
                  const badge = fundRequestBadge(ticker, requestedTickers, pendingTickers);

                  return (
                    <div key={idx} className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-sm text-slate-300">{item.holding.name}</span>
                          {item.holding.ticker && (
                            <span className="text-slate-500 text-xs ml-2">{item.holding.ticker}</span>
                          )}
                        </div>
                        <span className="text-orange-400 text-sm">{formatCurrency(item.holding.amount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={item.manualClass ?? ''}
                          onChange={e => handleManualClass(globalIdx, e.target.value)}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">選択してください</option>
                          {ASSET_CLASS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {item.manualClass && item.manualClass !== 'exclude' && (
                          badge ? (
                            <span className="text-xs text-slate-500 shrink-0">{badge}</span>
                          ) : verifyingTicker === ticker ? (
                            <span className="text-xs text-blue-400 shrink-0">検証中...</span>
                          ) : (
                            <button
                              onClick={() => handleSubmitRequest(item)}
                              className="text-xs text-blue-400 hover:text-blue-300 shrink-0 whitespace-nowrap"
                            >
                              登録リクエスト
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setStep('paste'); setAllocated([]); setRawHoldings([]); setWarnings([]); }}
              className="flex-1 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm text-slate-400 hover:bg-slate-700"
            >
              やり直す
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={unclassified.length > 0 && !allUnclassifiedHandled}
              className="flex-[2] py-3 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-40"
            >
              {unclassified.length > 0 && !allUnclassifiedHandled
                ? '未分類を全て選択してください'
                : '確定して保存'}
            </button>
          </div>
        </>
      )}

      {/* STEP 3: 確認（プレビューから直接確定） */}
      {step === 'confirm' && (
        <>
          {clampedLabels.length > 0 && (
            <WarningList items={[`${clampedLabels.join('・')}は合計がマイナスのため、0円にしました`]} />
          )}

          <div className="bg-slate-900 rounded-2xl p-4">
            <h3 className="text-sm text-slate-400 mb-3">アセットクラス別 合計</h3>
            {ASSET_CLASSES.filter(ac => summary[ac.key] > 0).map(ac => (
              <div key={ac.key} className="flex justify-between py-2 border-b border-slate-800 last:border-0">
                <span className="text-sm">{ac.label}</span>
                <span className="text-emerald-400 text-sm">{formatCurrency(summary[ac.key])}</span>
              </div>
            ))}
          </div>

          {excludedCrypto !== 0 && <CryptoNote amount={excludedCrypto} names={excludedNames} />}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('preview')}
              className="flex-1 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm text-slate-400 hover:bg-slate-700"
            >
              戻る
            </button>
            <button
              onClick={handleConfirm}
              disabled={!hasBalance}
              className="flex-[2] py-4 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl font-bold text-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              この内容で保存する
            </button>
          </div>
          {!hasBalance && (
            <p role="alert" className="text-sm text-amber-300 text-center">
              保存できる残高がありません
            </p>
          )}
        </>
      )}

      {/* Yahoo Finance検証NG確認ダイアログ */}
      {confirmTicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm bg-slate-900 rounded-xl border border-slate-700 p-5">
            <p className="text-sm text-orange-300 mb-3">
              ティッカー「{confirmTicker.ticker}」はYahoo Financeで確認できませんでした。
            </p>
            <p className="text-xs text-slate-400 mb-4">
              正しい場合はそのまま送信できますが、管理者の確認が必要になります。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmTicker(null)}
                className="flex-1 py-2.5 text-sm text-slate-400 border border-slate-600 rounded-lg hover:bg-slate-800"
              >
                キャンセル
              </button>
              <button
                onClick={handleForceSubmit}
                className="flex-1 py-2.5 text-sm text-white bg-orange-600 rounded-lg hover:bg-orange-500"
              >
                それでも送信する
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onCancel}
        className="w-full py-2 text-xs text-slate-500 hover:text-slate-300"
      >
        手動入力に戻る
      </button>
    </div>
  );
}
