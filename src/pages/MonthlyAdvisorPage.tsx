import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserStatusBar from '../components/UserStatusBar';
import type {
  Indicators,
  UserMaSettings,
  MarketMode,
  AllocationResult,
  MaSlot,
  MaAssetClass,
  MaAccount,
  SlotKey,
  JpIndex,
} from '../lib/ma/types';
import { MA_ASSET_CLASS_OPTIONS, MA_ACCOUNT_OPTIONS, ACCOUNT_MONTHLY_CAP, SLOT_LABELS, SLOT_KEYS, isTaxAdvantaged } from '../lib/ma/types';
import {
  checkVaultUnchanged, fetchLatestIndicators, loadUserSettingsWithVault, pushVault, resetVault, setupVault, unlockVault,
  updateReserveBalance, updateSettings,
} from '../lib/ma/db';
import { EMPTY_VAULT, passphraseIssueText, vaultErrorText, type VaultColumns, type VaultStatus } from '../lib/ma/vaultAmounts';
import type { VaultKey } from '../lib/vault/vault';
import MaVaultPanel from '../components/ma/MaVaultPanel';
import { calculateAllocation, formatCurrency, getCapeMultiplier, estimateNikkeiPbr, resolveReserveBase, deriveMonthlyInputs, computeCape5yMA, monthKey, nikkeiNow, evaluateCrashForMonth } from '../lib/ma/logic';
import { resolveCrashBase, type CrashEvaluation } from '../lib/ma/crash';
import { draftLedgerMonth, ledgerMonthlyCalc, latestRow, nextMonth, seedFromLegacy, type LedgerInputs, type LedgerRow } from '../lib/ma/ledger';
import { fetchLedger, insertSeedWithOverride, setLedgerOverride } from '../lib/ma/ledgerDb';
import MaLedgerPanel from '../components/ma/MaLedgerPanel';

export default function MonthlyAdvisorPage() {
  const { user } = useAuth();
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [settings, setSettings] = useState<UserMaSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // 入力値
  const [cape, setCape] = useState('');
  const [pbr, setPbr] = useState('');
  const [anchorInput, setAnchorInput] = useState('');
  const [gsr, setGsr] = useState('');
  const [momentumUS, setMomentumUS] = useState(true);
  const [momentumJP, setMomentumJP] = useState(true);
  const [momentumEM, setMomentumEM] = useState(true);
  const [momentumGold, setMomentumGold] = useState(true);
  const [mode, setMode] = useState<MarketMode>('neutral');
  const [result, setResult] = useState<AllocationResult | null>(null);
  const [crash, setCrash] = useState<CrashEvaluation | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  // 金額をブラウザに保存できなかった（プライベートブラウズ・容量超過など）。D-065
  const [localSaveFailed, setLocalSaveFailed] = useState(false);
  // 案B（#117）：鍵はこのページのメモリだけに持つ。パスフレーズ・鍵はどこにも保存しない
  const [vault, setVault] = useState<VaultColumns>(EMPTY_VAULT);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>('none');
  const [vaultKey, setVaultKey] = useState<VaultKey | null>(null);
  const [vaultNotice, setVaultNotice] = useState<string | null>(null);
  // 台帳方式（オーナー本人の行だけ、FI_project #140）。null = 読んでいない（オーナー以外、または読み込み中）
  const [ledger, setLedger] = useState<{ rows: LedgerRow[]; failed: boolean } | null>(null);
  // 表示中の結果が今月の記録か（false = 下書き）
  const [ledgerRecorded, setLedgerRecorded] = useState(false);

  useEffect(() => {
    const load = async () => {
      // 先にユーザー設定を取得（jp_index で PBR 自動補完の可否が変わるため）
      let sett: UserMaSettings;
      if (user) {
        // 金額はブラウザから（オーナー本人の行だけサーバーから）。サーバーに残っていればここで一度ブラウザへ移す（D-065）
        const loaded = await loadUserSettingsWithVault(user.id);
        sett = loaded.settings;
        setVault(loaded.vault);
        setVaultStatus(loaded.status);
      } else {
        const { DEFAULT_SETTINGS } = await import('../lib/ma/types');
        sett = { user_id: 'anonymous', ...DEFAULT_SETTINGS };
      }
      setSettings(sett);
      if (user && sett.amounts_on_server) setLedger(await fetchLedger(user.id));

      // indicatorsは認証不要で取得
      const ind = await fetchLatestIndicators();
      setIndicators(ind);
      if (ind) {
        // 自動補完の規則は logic.ts（/ma 月次メールと共通）。PBR は TOPIX=取得値、日経225=基準×株価比の近似推定
        const inp = deriveMonthlyInputs(ind, sett);
        if (inp.cape != null) setCape(String(inp.cape));
        if (inp.pbr != null) setPbr(String(inp.pbr));
        if (inp.gsr != null) setGsr(String(inp.gsr));
        if (inp.momentum.us != null) setMomentumUS(inp.momentum.us);
        if (inp.momentum.jp != null) setMomentumJP(inp.momentum.jp);
        if (inp.momentum.em != null) setMomentumEM(inp.momentum.em);
        if (inp.momentum.gold != null) setMomentumGold(inp.momentum.gold);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p className="text-slate-400">読み込み中...</p>
      </div>
    );
  }

  const cape5yMA = computeCape5yMA(indicators?.cape_history);
  // 金額をサーバーに置く行か（オーナー本人だけ。D-065）
  const onServer = settings.amounts_on_server === true;

  // ── パスフレーズ（案B、#117）。オーナー本人の行（onServer）では使わない ──
  const reloadFromVault = async () => {
    if (!user) return;
    const loaded = await loadUserSettingsWithVault(user.id);
    setSettings(loaded.settings);
    setVault(loaded.vault);
    setVaultStatus(loaded.status);
  };
  const handleVaultSetup = async (passphrase: string): Promise<string[] | null> => {
    if (!user) return null;
    try {
      const r = await setupVault(user.id, passphrase, window.localStorage);
      if ('issues' in r) return passphraseIssueText(r.issues);
      if ('error' in r) {
        if (r.error === 'already-set') {
          await reloadFromVault();
          return ['ほかの端末でパスフレーズが設定されています。そのパスフレーズを入れてください'];
        }
        return [r.error === 'local' ? vaultErrorText({ name: 'LocalSaveError' } as Error) : '設定できませんでした。時間をおいてもう一度お試しください'];
      }
      setVaultNotice(null);
      await reloadFromVault();
      setVaultKey(r.key);
      return null;
    } catch (e) {
      return [vaultErrorText(e)];
    }
  };
  const handleVaultUnlock = async (passphrase: string) => {
    if (!user) return;
    const r = await unlockVault(user.id, passphrase, vault, window.localStorage);
    await reloadFromVault();
    setVaultKey(r.key);
    if (r.discarded) setVaultNotice('ほかの端末で保存した値に戻しました。この端末で変えた金額は使っていません。必要なら入れ直してください');
    else if (r.push === 'conflict') {
      setVaultKey(null);
      await reloadFromVault();
    } else if (r.push === 'error') setVaultNotice('サーバーの暗号文への保存に失敗しました。次に金額を保存したときにもう一度送ります');
    else setVaultNotice(null);
  };
  const handleVaultReset = async (): Promise<boolean> => {
    if (!user || !(await resetVault(user.id))) return false;
    setVaultKey(null);
    setVaultNotice(null);
    await reloadFromVault();
    return true;
  };
  /** 保存のあと：鍵があれば暗号文もサーバーに置く。ぶつかったら（ほかの端末が保存した）戻す画面に。成功か鍵が無ければ true */
  const syncVault = async (): Promise<boolean> => {
    if (!user || onServer || !vaultKey || !vault.vault_verifier) return true;
    const r = await pushVault(user.id, vaultKey, vault.vault_verifier, window.localStorage);
    if (r === 'conflict') {
      setVaultKey(null);
      await reloadFromVault();
      return false;
    }
    if (r === 'error') {
      setVaultNotice('サーバーの暗号文への保存に失敗しました（この端末には保存済み）。次に金額を保存したときにもう一度送ります');
      return false;
    }
    setVaultNotice(null);
    return true;
  };
  const panelStatus = vaultStatus === 'restore-needed' || !vaultKey ? vaultStatus : 'unlocked';
  const vaultPanel =
    user && !onServer ? (
      <>
        {vaultNotice && <p className="text-amber-300 text-sm mb-2">{vaultNotice}</p>}
        <MaVaultPanel
          key={panelStatus}
          status={panelStatus as Exclude<VaultStatus, 'owner'> | 'unlocked'}
          onSetup={handleVaultSetup}
          onUnlock={handleVaultUnlock}
          onReset={handleVaultReset}
        />
      </>
    ) : null;

  const currentDate = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });

  const calculate = () => {
    const capeVal = parseFloat(cape);
    const pbrVal = parseFloat(pbr);
    const gsrVal = parseFloat(gsr);
    if (isNaN(capeVal) || isNaN(pbrVal) || isNaN(gsrVal)) {
      alert('すべての数値を入力してください');
      return;
    }
    if (onServer && ledger && !ledger.failed) {
      // 台帳方式（#140）：今月がもう記録済みなら、その記録を出す（月次メールと同じ値）
      const recorded = ledgerMonthlyCalc(ledger.rows, currentMonth);
      if (recorded) {
        setCrash(recorded.crash);
        setResult(recorded.result);
        setLedgerRecorded(true);
        return;
      }
      // まだなら、月次メールが今月に作る記録と同じ計算をする（抜けた月は追いつきで積む）。保存しない（下書き）
      const inputs: LedgerInputs = {
        cape: capeVal, pbr: pbrVal, gsr: gsrVal,
        momentum: { us: momentumUS, jp: momentumJP, em: momentumEM, gold: momentumGold },
        cape5yMA,
        as_of: indicators?.as_of ?? {},
        sp500_usd: indicators?.drawdown?.sp500_usd ?? null,
        mode,
        monthly_budget: settings.monthly_budget,
        jp_index: settings.jp_index,
        slots: SLOT_KEYS.map((k) => settings[k]),
      };
      // 今月の行が seed（送信日のあとに画面で合わせた）なら、メールと同じく暴落ルールは判定しない（台帳に残らないため）
      const seededThisMonth = ledger.rows.some((r) => r.month === currentMonth && r.kind === 'seed');
      const { calc } = draftLedgerMonth(ledger.rows, settings, currentMonth, seededThisMonth ? { ...inputs, sp500_usd: null } : inputs);
      setLedgerRecorded(false);
      setCrash(calc.crash);
      setResult(calc.result);
      return;
    }
    // 暴落ルール（待機資金の唯一の出口）。S&P500 の高値データが無ければ判定しない
    const crashEval = evaluateCrashForMonth(indicators, settings, new Date(), reserveMonthBase);
    setCrash(crashEval);
    setResult(
      calculateAllocation(
        capeVal,
        pbrVal,
        gsrVal,
        momentumUS,
        momentumJP,
        momentumEM,
        momentumGold,
        cape5yMA,
        { ...settings, reserve_balance: reserveMonthBase }, // 同月は月初baseを基点に（再実行で上書き）
        mode,
        crashEval?.total ?? 0,
      ),
    );
  };

  const confirmAndUpdateReserve = async () => {
    if (!result || !user) return;
    // 案B（#117）：投資実行の直前に、ほかの端末がそのあとに保存していないかを確かめる（鍵が無くても確かめられる）。
    // 古い値のまま投資実行すると、暴落ルールの投入が二重になりうる（§13-69、レビュー役の指摘・高1）
    if (!onServer) {
      const check = await checkVaultUnchanged(user.id, window.localStorage);
      if (check === 'changed') {
        // ほかの端末の新しい暗号文を読み直してから、戻す画面に（読み直さないと古い暗号文で戻してしまう）
        setVaultNotice('ほかの端末で、この端末よりあとに保存された値があります。パスフレーズを入れて戻してから、もう一度お試しください');
        setVaultKey(null);
        await reloadFromVault();
        return;
      }
      if (check === 'error') {
        alert('サーバーを確かめられませんでした（通信の失敗など）。ほかの端末で保存した値と食い違わないよう、つながってからもう一度お試しください');
        return;
      }
    }
    // 同月内は月初base + 今月分で上書き（複数回実行しても最後の1回だけが反映される）
    // 暴落ルールの段階も同じタイミングで確定（同月の再計算に備えて月初の状態も残す）
    const crashState = crash
      ? { current: crash.nextState, month: currentMonth, monthBase: resolveCrashBase(settings.crash_state, currentMonth) }
      : undefined;
    const saved = await updateReserveBalance(user.id, result.newReserveBalance, currentMonth, reserveMonthBase, crashState, onServer);
    if (!saved && !onServer) {
      // 保存できないまま「更新しました」と出すと、次に開いたとき同じ投入額をもう一度勧めてしまう
      setLocalSaveFailed(true);
      alert('このブラウザに待機資金を保存できませんでした（プライベートブラウズなど）。次に開くと元の残高に戻ります');
      return;
    }
    setSettings({
      ...settings,
      reserve_balance: result.newReserveBalance,
      reserve_month: currentMonth,
      reserve_month_base: reserveMonthBase,
      ...(crashState ? { crash_state: crashState } : {}),
    });
    const synced = await syncVault();
    alert(synced ? '待機資金を更新しました' : '待機資金をこのブラウザに保存しました（サーバーの暗号文への保存は、上の表示をご覧ください）');
  };

  // 台帳の最後の行に実際の残高を上書きする（台帳が空なら、選んだ月の最初の行を旧列から作って上書きする）。#140
  const handleLedgerOverride = async (month: string, amount: number | null): Promise<boolean> => {
    if (!user || !ledger) return false;
    const latest = latestRow(ledger.rows);
    const ok = latest
      ? await setLedgerOverride(user.id, latest.month, amount)
      : amount != null && (await insertSeedWithOverride({ ...seedFromLegacy(settings, nextMonth(month)), user_id: user.id, month }, amount));
    if (ok) setLedger(await fetchLedger(user.id));
    return ok;
  };

  const handleMonthlyBudgetChange = async (value: number) => {
    const updated = { ...settings, monthly_budget: value };
    setSettings(updated);
    if (!user) return;
    if (!(await updateSettings(user.id, { monthly_budget: value }, onServer))) {
      if (!onServer) setLocalSaveFailed(true);
    } else await syncVault();
  };

  const handleSlotFieldChange = async <K extends keyof MaSlot>(slotKey: SlotKey, field: K, value: MaSlot[K]) => {
    const currentSlot = settings[slotKey];
    const updatedSlot: MaSlot = { ...currentSlot, [field]: value };
    const updated = { ...settings, [slotKey]: updatedSlot };
    setSettings(updated);
    if (user) {
      const ok = await updateSettings(user.id, { slot: slotKey, field, value: value as number | string | MaAssetClass | MaAccount }, onServer);
      if (!ok && !onServer && field === 'amount') setLocalSaveFailed(true);
      else if (ok && field === 'amount') await syncVault();
    }
  };

  // 待機資金: 同月内は最後の実行で上書き（月初baseから再計算）
  const currentMonth = monthKey(new Date());
  const todayYmd = `${currentMonth}-${String(new Date().getDate()).padStart(2, '0')}`;
  const reserveMonthBase = resolveReserveBase(
    settings.reserve_balance, settings.reserve_month, settings.reserve_month_base, currentMonth,
  );

  const n225Now = nikkeiNow(indicators);
  const nikkeiEstimate =
    settings.nikkei_pbr_anchor != null && settings.nikkei_price_anchor && n225Now
      ? estimateNikkeiPbr(settings.nikkei_pbr_anchor, settings.nikkei_price_anchor, n225Now)
      : null;

  const handleJpIndexChange = async (idx: JpIndex) => {
    if (settings.jp_index === idx) return;
    setSettings({ ...settings, jp_index: idx });
    // TOPIX=取得値を補完、日経225=基準があれば推定値、無ければ手入力
    if (idx === 'topix') {
      setPbr(indicators?.topix_pbr ? String(indicators.topix_pbr) : '');
    } else {
      setPbr(nikkeiEstimate != null ? String(nikkeiEstimate) : '');
    }
    if (user) await updateSettings(user.id, { jp_index: idx }, onServer);
  };

  // 日経225 PBR の「基準」を実測値で更新（以降は株価変動で自動追従）
  const saveAnchor = async () => {
    const v = parseFloat(anchorInput);
    if (isNaN(v) || !n225Now) {
      alert('実測PBRを入力してください（株価データ取得後に設定できます）');
      return;
    }
    const updated = { ...settings, nikkei_pbr_anchor: v, nikkei_price_anchor: n225Now };
    setSettings(updated);
    setPbr(String(v));
    setAnchorInput('');
    if (user) await updateSettings(user.id, { nikkei_pbr_anchor: v, nikkei_price_anchor: n225Now }, onServer);
  };

  const modeOptions: { value: MarketMode; label: string; desc: string }[] = [
    { value: 'bullish', label: '強気', desc: '+0.25' },
    { value: 'neutral', label: '平常', desc: '補正なし' },
    { value: 'cautious', label: '慎重', desc: '−0.25' },
  ];

  // サーバーの暗号文の方が新しい（またはこの端末に値が無い）ときは、戻すまで計算の画面を出さない。
  // 古い値のまま「投資実行」すると、暴落ルールの投入が二重になりうる（§13-69、#117）
  if (user && !onServer && vaultStatus === 'restore-needed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              📊 月次投資配分（計算）
            </h1>
            <UserStatusBar variant="dark" />
          </div>
          {vaultPanel}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              📊 月次投資配分（計算）
            </h1>
            <p className="text-slate-400 text-sm mt-1">{currentDate}</p>
          </div>
          <UserStatusBar variant="dark" />
        </div>

        {vaultPanel}

        {/* 待機資金残高（オーナー本人は台帳の想定の累計と「実際の残高に合わせる」、#140） */}
        {onServer && ledger ? (
          <MaLedgerPanel
            rows={ledger.rows}
            failed={ledger.failed}
            legacyBalance={settings.reserve_balance}
            currentMonth={currentMonth}
            today={todayYmd}
            onOverride={handleLedgerOverride}
          />
        ) : (
        <div className="bg-amber-900/30 border-2 border-amber-500/50 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <div>
                <div className="text-xs text-amber-300/70 uppercase tracking-wide">待機資金残高</div>
                <div className="text-amber-200 text-sm mt-0.5">暴落時に投入 高値比 −20%・−30%→1/3、−40%→全額</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-300">{formatCurrency(settings.reserve_balance)}</div>
          </div>
        </div>
        )}

        {/* 投資設定 */}
        <div className="bg-slate-900 rounded-2xl p-4 mb-4">
          <button onClick={() => setShowSettings(!showSettings)} className="w-full flex items-center justify-between">
            <h2 className="text-sm text-slate-400">⚙️ 投資設定</h2>
            <span className="text-slate-500 text-sm">{showSettings ? '▲ 閉じる' : '▼ 開く'}</span>
          </button>

          {showSettings && (
            <div className="mt-4 space-y-4">
              {user && !onServer && (
                <p className="text-xs text-slate-500">
                  {vault.vault_verifier
                    ? '金額（月次予算・積立額・待機資金）はこのブラウザに保存し、パスフレーズを入れたときだけ暗号化してサーバーにも保存します（運営者にも中身は見えません）。'
                    : '金額（月次予算・積立額・待機資金）はこのブラウザにだけ保存し、サーバーには送りません。上の 🔒 でパスフレーズを設定すると、暗号化してサーバーにも保存し、別の端末でも戻せます。'}
                </p>
              )}
              {user && !onServer && localSaveFailed && (
                <p className="text-xs text-amber-400">
                  ⚠️ このブラウザに金額を保存できませんでした（プライベートブラウズなど）。ページを開き直すと入力した金額は消えます。
                </p>
              )}
              {/* 月次予算 */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-400">月次予算</label>
                <div className="relative w-40">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">¥</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    defaultValue={settings.monthly_budget.toLocaleString()}
                    key={`budget-${settings.monthly_budget}`}
                    onBlur={(e) => handleMonthlyBudgetChange(parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                各積立に口座を選んでください。同じ枠に複数の商品を入れられます。非課税枠（NISA・iDeCo/401k）は満額で積み立て、割高／割安によるバリュエーション調整は<span className="text-slate-400">特定口座のみ</span>に効きます。
              </p>

              {/* 各スロット: 口座 + 金額 + 銘柄名 + 資産クラス */}
              {SLOT_KEYS.map((slotKey) => {
                const slot = settings[slotKey];
                const isNisa = isTaxAdvantaged(slot.account);
                return (
                  <div key={slotKey} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-400">{SLOT_LABELS[slotKey]}</label>
                        {isNisa && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">満額</span>
                        )}
                      </div>
                      <div className="relative w-36">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">¥</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          defaultValue={slot.amount.toLocaleString()}
                          key={`${slotKey}-amount-${slot.amount}`}
                          onBlur={(e) => handleSlotFieldChange(slotKey, 'amount', parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <select
                      value={slot.account}
                      onChange={(e) => handleSlotFieldChange(slotKey, 'account', e.target.value as MaAccount)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
                    >
                      {MA_ACCOUNT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      defaultValue={slot.fund_name}
                      key={`${slotKey}-name-${slot.fund_name}`}
                      onBlur={(e) => handleSlotFieldChange(slotKey, 'fund_name', e.target.value)}
                      placeholder="銘柄名（メモ）"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                    {/* NISA枠は logic.ts で満額固定（バリュエーション調整の対象外）。
                        選んでも結果が変わらないセレクタを出すと誤解を生むため、固定表示にする */}
                    {isNisa ? (
                      <div className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs text-slate-500">
                        満額固定（バリュエーション調整なし）
                      </div>
                    ) : (
                      <select
                        value={slot.asset_class}
                        onChange={(e) => handleSlotFieldChange(slotKey, 'asset_class', e.target.value as MaAssetClass)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
                      >
                        {MA_ASSET_CLASS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}

              {/* 口座ごとの小計。枠の上限があるものは超過を警告する */}
              {(() => {
                const byAccount = MA_ACCOUNT_OPTIONS.map((opt) => ({
                  ...opt,
                  total: SLOT_KEYS.reduce(
                    (sum, k) => sum + (settings[k].account === opt.value ? settings[k].amount : 0), 0),
                  cap: ACCOUNT_MONTHLY_CAP[opt.value],
                })).filter((a) => a.total > 0);
                const slotTotal = SLOT_KEYS.reduce((sum, k) => sum + settings[k].amount, 0);
                if (byAccount.length === 0) return null;
                return (
                  <div className="border-t border-slate-700/60 pt-3 space-y-1">
                    {byAccount.map((a) => (
                      <div key={a.value} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">
                          {a.label}
                          {a.cap && a.total > a.cap && (
                            <span className="ml-2 text-amber-400">⚠️ 月{formatCurrency(a.cap)}を超過</span>
                          )}
                        </span>
                        <span className={a.cap && a.total > a.cap ? 'text-amber-400' : 'text-slate-300'}>
                          {formatCurrency(a.total)}
                          {a.cap && <span className="text-slate-600"> / {formatCurrency(a.cap)}</span>}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-sm pt-1">
                      <span className="text-slate-400">積立合計</span>
                      <span className={slotTotal > settings.monthly_budget ? 'text-amber-400' : 'text-slate-200'}>
                        {formatCurrency(slotTotal)}
                        {slotTotal > settings.monthly_budget && <span className="ml-2 text-xs">⚠️ 月次予算を超過</span>}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* 自動取得ステータス */}
        {indicators && (() => {
          const days = Math.floor((Date.now() - new Date(indicators.fetched_at).getTime()) / 86400000)
          const stale = days > 20   // cron は毎月1・15日（≒隔週）。それより古ければ要再取得
          return (
            <div className={`rounded-2xl p-3 mb-4 border ${stale ? 'bg-amber-900/30 border-amber-500/50' : 'bg-emerald-900/30 border-emerald-500/50'}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{stale ? '⚠️' : '🤖'}</span>
                <div>
                  <div className={`text-xs ${stale ? 'text-amber-300/80' : 'text-emerald-300/70'}`}>
                    自動取得済み{stale && `（${days}日前・古い可能性）`}
                  </div>
                  <div className={`text-xs ${stale ? 'text-amber-200' : 'text-emerald-200'}`}>
                    {new Date(indicators.fetched_at).toLocaleString('ja-JP')}
                  </div>
                </div>
              </div>
              {/* 入力欄に自動反映される指標の数値（-0.5 等の異常値に気づけるように） */}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-300">
                <span>米国CAPE <b className="text-slate-100">{indicators.cape ?? '—'}</b></span>
                <span>TOPIX PBR <b className="text-slate-100">{indicators.topix_pbr ?? '—'}</b></span>
                <span>金銀比率 <b className="text-slate-100">{indicators.gold_silver_ratio ?? '—'}</b></span>
              </div>
              {indicators.momentum && (
                <div className="mt-1 flex gap-3 text-xs">
                  {indicators.momentum.us && (
                    <span className="text-slate-400">
                      S&P: {indicators.momentum.us.last_price?.toLocaleString()}
                      <span className={indicators.momentum.us.above_ma ? 'text-green-400' : 'text-red-400'}>
                        {' '}
                        ({indicators.momentum.us.above_ma ? '↑MA上' : '↓MA下'})
                      </span>
                    </span>
                  )}
                  {indicators.gold_price && <span className="text-slate-400">Gold: ${indicators.gold_price.toLocaleString()}</span>}
                </div>
              )}
              {stale && (
                <div className="mt-2 text-xs text-amber-200/90">
                  指標の自動更新が遅れています。表示中の数値は上記の取得日時点のものです。
                </div>
              )}
            </div>
          )
        })()}

        {/* バリュエーション指標 */}
        <div className="bg-slate-900 rounded-2xl p-4 mb-4">
          <h2 className="text-sm text-slate-400 mb-4">バリュエーション指標</h2>

          {/* CAPE */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm">米国CAPE</label>
              <a href="https://www.multpl.com/shiller-pe" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                ✓ 確認
              </a>
            </div>
            <input
              type="number"
              step="0.01"
              value={cape}
              onChange={(e) => setCape(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-lg focus:border-blue-500 focus:outline-none"
              placeholder="40.65"
            />
            {cape && cape5yMA && (
              <div className="mt-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{getCapeMultiplier(parseFloat(cape), cape5yMA).deviation === undefined ? '絶対水準（CAPE 38超）' : '5年MA比較'}</span>
                  <span style={{ color: getCapeMultiplier(parseFloat(cape), cape5yMA).color }}>
                    {getCapeMultiplier(parseFloat(cape), cape5yMA).label} ({getCapeMultiplier(parseFloat(cape), cape5yMA).multiplier}x)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 日本株 PBR（TOPIX / 日経225 を選択） */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm">{settings.jp_index === 'nikkei' ? '日経225 PBR' : 'TOPIX PBR'}</label>
              <a
                href={settings.jp_index === 'nikkei'
                  ? 'https://indexes.nikkei.co.jp/nkave/index/profile?cid=4'
                  : 'https://www.jpx.co.jp/markets/statistics-equities/misc/04.html'}
                target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                ✓ 確認
              </a>
            </div>
            {/* 指数トグル */}
            <div className="flex gap-2 mb-2">
              {(['topix', 'nikkei'] as JpIndex[]).map((val) => (
                <button
                  key={val}
                  onClick={() => handleJpIndexChange(val)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    settings.jp_index === val
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 ring-1 ring-slate-700'
                  }`}
                >
                  {val === 'topix' ? 'TOPIX' : '日経225'}
                </button>
              ))}
            </div>
            <input
              type="number"
              step="0.01"
              value={pbr}
              onChange={(e) => setPbr(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-lg focus:border-blue-500 focus:outline-none"
              placeholder={settings.jp_index === 'nikkei' ? '例: 1.90' : '1.69'}
            />
            {settings.jp_index === 'nikkei' && (
              <div className="mt-2 p-2.5 rounded-lg bg-slate-800/50 text-xs space-y-2">
                {settings.nikkei_pbr_anchor != null && nikkeiEstimate != null ? (
                  <p className="text-slate-400">
                    推定PBR <b className="text-slate-100">{nikkeiEstimate}</b>
                    <span className="text-slate-500">
                      （基準 PBR{settings.nikkei_pbr_anchor}・日経{Math.round(settings.nikkei_price_anchor!).toLocaleString()}
                      {n225Now && ` → 現在 ${Math.round(n225Now).toLocaleString()}（${((n225Now / settings.nikkei_price_anchor! - 1) * 100).toFixed(1)}%）`}）
                    </span>
                  </p>
                ) : (
                  <p className="text-amber-300">
                    日経225 PBRの基準を一度設定してください（「✓ 確認」で実測値を見て入力）。以降は株価変動で自動推定します。
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={anchorInput}
                    onChange={(e) => setAnchorInput(e.target.value)}
                    placeholder="実測PBR 例: 1.90"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={saveAnchor}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium active:bg-blue-700 whitespace-nowrap"
                  >
                    基準にする
                  </button>
                </div>
                <p className="text-slate-500">判定は日経225用しきい値（割高 ≥ 2.0）。上の欄は今月だけ手で上書きもできます。</p>
              </div>
            )}
          </div>

          {/* 金銀比率 */}
          <div className="mb-4">
            <label className="text-sm mb-2 block">金銀比率</label>
            <input
              type="number"
              step="0.1"
              value={gsr}
              onChange={(e) => setGsr(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-lg focus:border-blue-500 focus:outline-none"
              placeholder="46.5"
            />
          </div>
        </div>

        {/* モメンタム */}
        <div className="bg-slate-900 rounded-2xl p-4 mb-4">
          <h2 className="text-sm text-slate-400 mb-4">モメンタム（10ヶ月MA比較）</h2>
          {[
            { label: '米国株', value: momentumUS, setter: setMomentumUS },
            { label: '日本株', value: momentumJP, setter: setMomentumJP },
            { label: '新興国株', value: momentumEM, setter: setMomentumEM },
            { label: 'ゴールド', value: momentumGold, setter: setMomentumGold },
          ].map(({ label, value, setter }) => (
            <div key={label} className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
              <span>{label}</span>
              <button
                onClick={() => setter(!value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  value ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'
                }`}
              >
                {value ? '↑ 上昇' : '↓ 下落'}
              </button>
            </div>
          ))}
        </div>

        {/* モード補正 */}
        <div className="bg-slate-900 rounded-2xl p-4 mb-4">
          <h2 className="text-sm text-slate-400 mb-3">モード補正</h2>
          <div className="grid grid-cols-3 gap-2">
            {modeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`py-3 rounded-xl text-sm font-medium transition-all ${
                  mode === opt.value ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                <div>{opt.label}</div>
                <div className="text-xs opacity-70 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 計算ボタン */}
        <button
          onClick={calculate}
          className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl font-bold text-lg mb-4 hover:opacity-90 transition-opacity"
        >
          💹 投資配分を計算
        </button>

        {/* 結果 */}
        {result && (
          <div className="bg-slate-900 rounded-2xl p-4 mb-4">
            <h2 className="text-sm text-slate-400 mb-4">今月の投資配分（計算結果）</h2>

            {(() => {
              return SLOT_KEYS.map((slotKey, idx) => {
                const slot = settings[slotKey];
                const amount = result.perSlotAmount[idx];
                if (amount <= 0) return null;
                const acLabel = MA_ASSET_CLASS_OPTIONS.find((o) => o.value === slot.asset_class)?.label ?? slot.asset_class;
                return (
                  <div key={slotKey} className="bg-slate-800 rounded-xl p-4 mb-3 border-l-4 border-blue-500">
                    <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                      {SLOT_LABELS[slotKey]} <span className="text-slate-500">/ {acLabel}</span>
                    </h3>
                    <div className="flex justify-between">
                      <span>{slot.fund_name || SLOT_LABELS[slotKey]}</span>
                      <span className="text-green-400">{formatCurrency(amount)}</span>
                    </div>
                  </div>
                );
              });
            })()}

            {crash && crash.total > 0 && (
              <div className="bg-slate-800 rounded-xl p-4 mb-3 border-l-4 border-red-500">
                <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-2">暴落ルールによる投入（待機資金から）</h3>
                {crash.deployments.map((d) => (
                  <div key={d.stage} className="flex justify-between text-sm py-0.5">
                    <span>第{d.stage / 10 - 1}段階（S&amp;P500 高値比 −{d.stage}%）{d.stage === 40 ? '：残高の全額' : '：基準残高の1/3'}</span>
                    <span className="text-red-300">{formatCurrency(d.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold mt-1">
                  <span>暴落ルールによる投入額</span>
                  <span className="text-red-300">{formatCurrency(crash.total)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">何を買うかはご自身で選んでください。資産クラスごとの高値からの下落率：</p>
                <ul className="text-xs text-slate-300 mt-1">
                  {Object.values(indicators?.drawdown?.classes ?? {}).map((c) => (
                    <li key={c.label}>
                      {c.label}：{c.last != null && c.ath != null ? `${((Math.min(0, c.last / c.ath - 1)) * 100).toFixed(1)}%（高値 ${c.athDate}）` : '取得できず'}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.monthlyReserve > 0 && (
              <div className="bg-slate-800 rounded-xl p-4 mb-3 border-l-4 border-amber-500">
                <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-2">今月の待機分</h3>
                <div className="flex justify-between">
                  <span>待機に追加</span>
                  <span className="text-amber-400">+{formatCurrency(result.monthlyReserve)}</span>
                </div>
              </div>
            )}

            <div className="border-t-2 border-slate-700 pt-4 mt-4">
              <div className="flex justify-between py-1">
                <span>今月の投資額</span>
                <span className="text-green-400 font-bold">{formatCurrency(result.totalInvest)}</span>
              </div>
              {result.crashDeployment > 0 && (
                <div className="flex justify-between py-1 text-sm text-red-300">
                  <span>暴落ルールによる投入（待機資金から）</span>
                  <span>{formatCurrency(result.crashDeployment)}</span>
                </div>
              )}
              {result.monthlyReserve > 0 && (
                <div className="flex justify-between py-1 text-sm text-slate-400">
                  <span>今月の待機分</span>
                  <span>+{formatCurrency(result.monthlyReserve)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 mt-2 border-t border-slate-700">
                <span>{onServer && ledger ? (ledgerRecorded ? '今月の想定残高（記録済み）' : '今月の想定残高（下書き）') : '待機資金 更新後残高'}</span>
                <span className="text-amber-300 font-bold">{formatCurrency(result.newReserveBalance)}</span>
              </div>
            </div>

            {onServer && ledger ? (
              <p className="text-xs text-slate-400 mt-4">
                {ledgerRecorded
                  ? '今月はもう台帳に記録しました（月次メールと同じ値。上の入力は使っていません）。暴落ルールの投入額は想定の残高から計算しています。'
                  : 'この計算は下書きで、保存しません。今月の記録は送信日（25日）の月次メールで作ります。暴落ルールの投入額は想定の残高から計算しています。'}
              </p>
            ) : (
              <button
                onClick={confirmAndUpdateReserve}
                className="w-full mt-4 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold transition-colors"
              >
                ✅ 投資実行＆待機資金を更新
              </button>
            )}
          </div>
        )}

        {/* 判定詳細 */}
        {result && (
          <div className="bg-slate-900 rounded-2xl p-4 mb-4">
            <h2 className="text-sm text-slate-400 mb-4">判定詳細</h2>
            <div className="space-y-2">
              {[
                { label: '米国株 最終倍率', value: `${result.details.usMultiplier.toFixed(2)}x` },
                { label: '日本株 最終倍率', value: `${result.details.jpMultiplier.toFixed(2)}x` },
                { label: '新興国株 最終倍率', value: `${result.details.emMultiplier.toFixed(2)}x` },
                { label: 'ゴールド 最終倍率', value: `${result.details.goldMultiplier.toFixed(2)}x` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-800 rounded-lg px-4 py-3 flex justify-between">
                  <span className="text-slate-400 text-sm">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center py-4 text-slate-500 text-xs">※ 本ツールの出力は計算結果の表示であり、投資の目安としてご利用ください</div>
      </div>
    </div>
  );
}
