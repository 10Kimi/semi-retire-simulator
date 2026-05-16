import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ASSET_CLASSES } from '../../lib/rb/types';
import type { Holdings } from '../../lib/rb/types';
import { parseMfExcel } from '../../lib/rb/mfParser';
import type { MfHolding } from '../../lib/rb/mfParser';
import { allocateHoldings, summarizeAllocations } from '../../lib/rb/allocator';
import type { AllocatedHolding } from '../../lib/rb/allocator';
import { fetchFundMaster, submitFundRequest, fetchSubmittedRequestTickers, saveSnapshot } from '../../lib/rb/db';
import { formatCurrency } from '../../lib/rb/logic';

type ImportStep = 'select' | 'preview' | 'unclassified' | 'confirm';

interface Props {
  onImportComplete: (holdings: Holdings) => void;
  onCancel: () => void;
}

const ASSET_CLASS_OPTIONS = [
  ...ASSET_CLASSES.map(ac => ({ value: ac.key, label: ac.label })),
  { value: 'exclude', label: '保有資産に含めない' },
];

export default function MfImportFlow({ onImportComplete, onCancel }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [rawHoldings, setRawHoldings] = useState<MfHolding[]>([]);
  const [allocated, setAllocated] = useState<AllocatedHolding[]>([]);
  const [submittedTickers, setSubmittedTickers] = useState<Set<string>>(new Set());
  const [requestedTickers, setRequestedTickers] = useState<Set<string>>(new Set());
  const [verifyingTicker, setVerifyingTicker] = useState<string | null>(null);
  const [confirmTicker, setConfirmTicker] = useState<{ ticker: string; name: string; assetClass: string } | null>(null);

  const unclassified = allocated.filter(a => !a.matched);
  const classified = allocated.filter(a => a.matched);

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      setError('.xlsx ファイルのみ対応しています');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const data = await file.arrayBuffer();
      const parsed = parseMfExcel(data);
      setRawHoldings(parsed);

      const [fundMaster, submitted] = await Promise.all([
        fetchFundMaster(),
        user ? fetchSubmittedRequestTickers(user.id) : Promise.resolve(new Set<string>()),
      ]);
      setSubmittedTickers(submitted);

      const result = allocateHoldings(parsed, fundMaster);
      setAllocated(result);

      const hasUnclassified = result.some(a => !a.matched);
      setStep(hasUnclassified ? 'preview' : 'preview');
    } catch {
      setError('Excelの解析に失敗しました。MoneyForwardからエクスポートしたファイルか確認してください。');
    }
    setLoading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
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
    } else if (result.status === 'needs_confirm') {
      setConfirmTicker({ ticker, name: item.holding.name, assetClass: item.manualClass });
    }
  }, [user]);

  const handleForceSubmit = useCallback(async () => {
    if (!user || !confirmTicker) return;
    setVerifyingTicker(confirmTicker.ticker);
    await submitFundRequest(user.id, confirmTicker.ticker, confirmTicker.name, confirmTicker.assetClass, true);
    setVerifyingTicker(null);
    setRequestedTickers(prev => new Set([...prev, confirmTicker.ticker]));
    setConfirmTicker(null);
  }, [user, confirmTicker]);

  const allUnclassifiedHandled = unclassified.every(a => a.manualClass);

  const handleConfirm = async () => {
    const summary = summarizeAllocations(allocated);
    if (user) await saveSnapshot(user.id, summary);
    onImportComplete(summary);
  };

  return (
    <div className="space-y-4">
      {/* STEP 1: ファイル選択 */}
      {step === 'select' && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-slate-600 rounded-2xl p-8 text-center cursor-pointer hover:border-emerald-500/50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
          <div className="text-3xl mb-3">📁</div>
          <p className="text-slate-300 text-sm mb-1">MoneyForwardのExcelをアップロード</p>
          <p className="text-slate-500 text-xs">ドラッグ＆ドロップ または クリックで選択（.xlsx）</p>
          {loading && <p className="text-emerald-400 text-sm mt-3">解析中...</p>}
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        </div>
      )}

      {/* STEP 2: プレビュー */}
      {step === 'preview' && (
        <>
          <div className="bg-slate-900 rounded-2xl p-4">
            <h3 className="text-sm text-slate-400 mb-3">
              解析結果（{rawHoldings.length}銘柄 / {classified.length}件自動振り分け / {unclassified.length}件未分類）
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

            {/* 未分類 */}
            {unclassified.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs text-orange-400 font-medium">未分類（手動でアセットクラスを選択してください）</h4>
                {unclassified.map((item, idx) => {
                  const globalIdx = allocated.indexOf(item);
                  const ticker = item.holding.ticker || item.holding.name;
                  const alreadyRequested = submittedTickers.has(ticker) || requestedTickers.has(ticker);

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
                          alreadyRequested ? (
                            <span className="text-xs text-slate-500 shrink-0">登録済み</span>
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
              onClick={() => { setStep('select'); setAllocated([]); setRawHoldings([]); }}
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
          <div className="bg-slate-900 rounded-2xl p-4">
            <h3 className="text-sm text-slate-400 mb-3">アセットクラス別 合計</h3>
            {(() => {
              const summary = summarizeAllocations(allocated);
              // [diagnostic] revert予定 — 年金合計問題の真因特定用、本番反映後 console で 1 行取得して即削除
              console.log('[diag/MfImport/confirm]', {
                allocatedCount: allocated.length,
                classifiedCount: allocated.filter(a => a.matched).length,
                pensionEntries: allocated
                  .filter(a => a.holding.section === '年金')
                  .map(a => ({
                    name: a.holding.name,
                    nameLength: a.holding.name.length,
                    amount: a.holding.amount,
                    matched: a.matched,
                    manualClass: a.manualClass,
                    allocations: a.allocations,
                  })),
                summary_us_equity: summary.us_equity,
                summary,
              });
              return ASSET_CLASSES.filter(ac => summary[ac.key] > 0).map(ac => (
                <div key={ac.key} className="flex justify-between py-2 border-b border-slate-800 last:border-0">
                  <span className="text-sm">{ac.label}</span>
                  <span className="text-emerald-400 text-sm">{formatCurrency(summary[ac.key])}</span>
                </div>
              ));
            })()}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('preview')}
              className="flex-1 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-sm text-slate-400 hover:bg-slate-700"
            >
              戻る
            </button>
            <button
              onClick={handleConfirm}
              className="flex-[2] py-4 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl font-bold text-lg hover:opacity-90"
            >
              この内容で保存する
            </button>
          </div>
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
