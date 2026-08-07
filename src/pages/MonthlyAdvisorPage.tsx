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
import { fetchLatestIndicators, fetchUserSettings, updateReserveBalance, updateSettings } from '../lib/ma/db';
import { calculateAllocation, formatCurrency, getCapeMultiplier, estimateNikkeiPbr, resolveReserveBase } from '../lib/ma/logic';

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
  const [showSettings, setShowSettings] = useState(true);

  useEffect(() => {
    const load = async () => {
      // 先にユーザー設定を取得（jp_index で PBR 自動補完の可否が変わるため）
      let sett: UserMaSettings;
      if (user) {
        sett = await fetchUserSettings(user.id);
      } else {
        const { DEFAULT_SETTINGS } = await import('../lib/ma/types');
        sett = { user_id: 'anonymous', ...DEFAULT_SETTINGS };
      }
      setSettings(sett);

      // indicatorsは認証不要で取得
      const ind = await fetchLatestIndicators();
      setIndicators(ind);
      if (ind) {
        if (ind.cape) setCape(String(ind.cape));
        // PBR の自動補完: TOPIX=取得値、日経225=基準×株価比の近似推定
        if (sett.jp_index === 'topix') {
          if (ind.topix_pbr) setPbr(String(ind.topix_pbr));
        } else {
          const now = ind.momentum?.jp?.last_price;
          if (sett.nikkei_pbr_anchor != null && sett.nikkei_price_anchor && now) {
            setPbr(String(estimateNikkeiPbr(sett.nikkei_pbr_anchor, sett.nikkei_price_anchor, now)));
          }
        }
        if (ind.gold_silver_ratio) setGsr(String(ind.gold_silver_ratio));
        if (ind.momentum?.us) setMomentumUS(ind.momentum.us.above_ma);
        if (ind.momentum?.jp) setMomentumJP(ind.momentum.jp.above_ma);
        if (ind.momentum?.em) setMomentumEM(ind.momentum.em.above_ma);
        if (ind.momentum?.gold) setMomentumGold(ind.momentum.gold.above_ma);
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

  const cape5yMA =
    indicators?.cape_history && indicators.cape_history.length > 0
      ? indicators.cape_history.reduce((sum, h) => sum + h.cape, 0) / indicators.cape_history.length
      : null;

  const currentDate = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });

  const calculate = () => {
    const capeVal = parseFloat(cape);
    const pbrVal = parseFloat(pbr);
    const gsrVal = parseFloat(gsr);
    if (isNaN(capeVal) || isNaN(pbrVal) || isNaN(gsrVal)) {
      alert('すべての数値を入力してください');
      return;
    }
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
      ),
    );
  };

  const confirmAndUpdateReserve = async () => {
    if (!result || !user) return;
    // 同月内は月初base + 今月分で上書き（複数回実行しても最後の1回だけが反映される）
    await updateReserveBalance(user.id, result.newReserveBalance, currentMonth, reserveMonthBase);
    setSettings({
      ...settings,
      reserve_balance: result.newReserveBalance,
      reserve_month: currentMonth,
      reserve_month_base: reserveMonthBase,
    });
    alert('待機資金を更新しました');
  };

  const handleMonthlyBudgetChange = async (value: number) => {
    const updated = { ...settings, monthly_budget: value };
    setSettings(updated);
    if (user) await updateSettings(user.id, { monthly_budget: value });
  };

  const handleSlotFieldChange = async <K extends keyof MaSlot>(slotKey: SlotKey, field: K, value: MaSlot[K]) => {
    const currentSlot = settings[slotKey];
    const updatedSlot: MaSlot = { ...currentSlot, [field]: value };
    const updated = { ...settings, [slotKey]: updatedSlot };
    setSettings(updated);
    if (user) {
      await updateSettings(user.id, { slot: slotKey, field, value: value as number | string | MaAssetClass | MaAccount });
    }
  };

  // 待機資金: 同月内は最後の実行で上書き（月初baseから再計算）
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const reserveMonthBase = resolveReserveBase(
    settings.reserve_balance, settings.reserve_month, settings.reserve_month_base, currentMonth,
  );

  const n225Now = indicators?.momentum?.jp?.last_price ?? null;
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
    if (user) await updateSettings(user.id, { jp_index: idx });
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
    if (user) await updateSettings(user.id, { nikkei_pbr_anchor: v, nikkei_price_anchor: n225Now });
  };

  const modeOptions: { value: MarketMode; label: string; desc: string }[] = [
    { value: 'bullish', label: '強気', desc: '+0.25' },
    { value: 'neutral', label: '平常', desc: '補正なし' },
    { value: 'cautious', label: '慎重', desc: '−0.25' },
  ];

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

        {/* 待機資金残高 */}
        <div className="bg-amber-900/30 border-2 border-amber-500/50 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <div>
                <div className="text-xs text-amber-300/70 uppercase tracking-wide">待機資金残高</div>
                <div className="text-amber-200 text-sm mt-0.5">割安時に投入 -10%→1/4, -20%→1/2</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-300">{formatCurrency(settings.reserve_balance)}</div>
          </div>
        </div>

        {/* 投資設定 */}
        <div className="bg-slate-900 rounded-2xl p-4 mb-4">
          <button onClick={() => setShowSettings(!showSettings)} className="w-full flex items-center justify-between">
            <h2 className="text-sm text-slate-400">⚙️ 投資設定</h2>
            <span className="text-slate-500 text-sm">{showSettings ? '▲ 閉じる' : '▼ 開く'}</span>
          </button>

          {showSettings && (
            <div className="mt-4 space-y-4">
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
                  指標が古い可能性があります。`fetch_indicators.py` を再実行して更新してください。
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
                  <span className="text-slate-400">5年MA比較</span>
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
              const firstUsIdx = SLOT_KEYS.findIndex((k) => settings[k].asset_class === 'us');
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
                    {idx === firstUsIdx && result.reserveDeployment > 0 && (
                      <div className="text-xs text-amber-400 ml-2 mt-1">└ うち待機資金から: +{formatCurrency(result.reserveDeployment)}</div>
                    )}
                  </div>
                );
              });
            })()}

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
              {result.reserveDeployment > 0 && (
                <div className="flex justify-between py-1 text-sm text-amber-400">
                  <span>└ 待機資金から投入</span>
                  <span>{formatCurrency(result.reserveDeployment)}</span>
                </div>
              )}
              {result.monthlyReserve > 0 && (
                <div className="flex justify-between py-1 text-sm text-slate-400">
                  <span>今月の待機分</span>
                  <span>+{formatCurrency(result.monthlyReserve)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 mt-2 border-t border-slate-700">
                <span>待機資金 更新後残高</span>
                <span className="text-amber-300 font-bold">{formatCurrency(result.newReserveBalance)}</span>
              </div>
            </div>

            <button
              onClick={confirmAndUpdateReserve}
              className="w-full mt-4 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold transition-colors"
            >
              ✅ 投資実行＆待機資金を更新
            </button>
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
