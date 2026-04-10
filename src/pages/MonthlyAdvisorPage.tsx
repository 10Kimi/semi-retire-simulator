import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserStatusBar from '../components/UserStatusBar';
import type { Indicators, UserMaSettings, MarketMode, AllocationResult } from '../lib/ma/types';
import { fetchLatestIndicators, fetchUserSettings, updateReserveBalance, updateUserSettings } from '../lib/ma/db';
import { calculateAllocation, formatCurrency, getCapeMultiplier } from '../lib/ma/logic';

export default function MonthlyAdvisorPage() {
  const { user } = useAuth();
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [settings, setSettings] = useState<UserMaSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // 入力値
  const [cape, setCape] = useState('');
  const [pbr, setPbr] = useState('');
  const [gsr, setGsr] = useState('');
  const [momentumUS, setMomentumUS] = useState(true);
  const [momentumJP, setMomentumJP] = useState(true);
  const [momentumGold, setMomentumGold] = useState(true);
  const [mode, setMode] = useState<MarketMode>('neutral');
  const [result, setResult] = useState<AllocationResult | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [fundNames, setFundNames] = useState({
    nisa_tsumitate: '',
    nisa_growth: '',
    tokutei_ac: '',
    tokutei_gold: '',
    tokutei_bond: '',
  });

  useEffect(() => {
    const load = async () => {
      // indicatorsは認証不要で取得
      const ind = await fetchLatestIndicators();
      setIndicators(ind);
      if (ind) {
        if (ind.cape) setCape(String(ind.cape));
        if (ind.topix_pbr) setPbr(String(ind.topix_pbr));
        if (ind.gold_silver_ratio) setGsr(String(ind.gold_silver_ratio));
        if (ind.momentum?.us) setMomentumUS(ind.momentum.us.above_ma);
        if (ind.momentum?.jp) setMomentumJP(ind.momentum.jp.above_ma);
        if (ind.momentum?.gold) setMomentumGold(ind.momentum.gold.above_ma);
      }

      // ユーザー設定はログイン時のみ取得、未ログインはデフォルト値
      if (user) {
        const sett = await fetchUserSettings(user.id);
        setSettings(sett);
      } else {
        const { DEFAULT_SETTINGS } = await import('../lib/ma/types');
        setSettings({ user_id: 'anonymous', ...DEFAULT_SETTINGS });
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

  const cape5yMA = indicators?.cape_history && indicators.cape_history.length > 0
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
    setResult(calculateAllocation(capeVal, pbrVal, gsrVal, momentumUS, momentumJP, momentumGold, cape5yMA, settings, mode));
  };

  const confirmAndUpdateReserve = async () => {
    if (!result || !user) return;
    await updateReserveBalance(user.id, result.newReserveBalance);
    setSettings({ ...settings, reserve_balance: result.newReserveBalance });
    alert('待機資金を更新しました');
  };

  const handleSettingsChange = async (key: keyof UserMaSettings, value: number) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    if (user) {
      await updateUserSettings(user.id, { [key]: value });
    }
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
                <div className="text-xs text-amber-300/70 uppercase tracking-wide">待機資金残高（iBond）</div>
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
                <input type="text" inputMode="numeric"
                  defaultValue={settings.monthly_budget.toLocaleString()}
                  key={`budget-${settings.monthly_budget}`}
                  onBlur={e => handleSettingsChange('monthly_budget', parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                  className="w-40 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* 各枠: 金額 + 銘柄名 */}
              {([
                { amountKey: 'nisa_tsumitate', nameKey: 'nisa_tsumitate', label: 'NISA積立枠', placeholder: '例: eMAXIS Slim 全世界株式' },
                { amountKey: 'nisa_growth', nameKey: 'nisa_growth', label: 'NISA成長枠', placeholder: '例: ニッセイ日経225' },
                { amountKey: 'tokutei_ac_base', nameKey: 'tokutei_ac', label: '特定口座（株式）ベース', placeholder: '例: eMAXIS Slim 全世界株式' },
                { amountKey: 'tokutei_gold_base', nameKey: 'tokutei_gold', label: '特定口座（ゴールド）ベース', placeholder: '例: SBI・iシェアーズ・ゴールド' },
                { amountKey: 'tokutei_bond', nameKey: 'tokutei_bond', label: '特定口座（債券）', placeholder: '例: eMAXIS Slim 先進国債券' },
              ] as const).map(({ amountKey, nameKey, label, placeholder }) => (
                <div key={amountKey} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-400">{label}</label>
                    <input type="text" inputMode="numeric"
                      defaultValue={settings[amountKey].toLocaleString()}
                      key={`${amountKey}-${settings[amountKey]}`}
                      onBlur={e => handleSettingsChange(amountKey, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                      className="w-36 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <input type="text"
                    value={fundNames[nameKey]}
                    onChange={e => setFundNames(prev => ({ ...prev, [nameKey]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 自動取得ステータス */}
        {indicators && (
          <div className="bg-emerald-900/30 border border-emerald-500/50 rounded-2xl p-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <div>
                <div className="text-xs text-emerald-300/70">自動取得済み</div>
                <div className="text-emerald-200 text-xs">
                  {new Date(indicators.fetched_at).toLocaleString('ja-JP')}
                </div>
              </div>
            </div>
            {indicators.momentum && (
              <div className="mt-2 flex gap-3 text-xs">
                {indicators.momentum.us && (
                  <span className="text-slate-400">
                    S&P: {indicators.momentum.us.last_price?.toLocaleString()}
                    <span className={indicators.momentum.us.above_ma ? 'text-green-400' : 'text-red-400'}>
                      {' '}({indicators.momentum.us.above_ma ? '↑MA上' : '↓MA下'})
                    </span>
                  </span>
                )}
                {indicators.gold_price && (
                  <span className="text-slate-400">Gold: ${indicators.gold_price.toLocaleString()}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* バリュエーション指標 */}
        <div className="bg-slate-900 rounded-2xl p-4 mb-4">
          <h2 className="text-sm text-slate-400 mb-4">バリュエーション指標</h2>

          {/* CAPE */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm">米国CAPE</label>
              <a href="https://www.multpl.com/shiller-pe" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">✓ 確認</a>
            </div>
            <input
              type="number" step="0.01" value={cape}
              onChange={e => setCape(e.target.value)}
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

          {/* PBR */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm">TOPIX PBR</label>
              <a href="https://www.jpx.co.jp/markets/statistics-equities/misc/04.html" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">✓ 確認</a>
            </div>
            <input
              type="number" step="0.01" value={pbr}
              onChange={e => setPbr(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-lg focus:border-blue-500 focus:outline-none"
              placeholder="1.69"
            />
          </div>

          {/* 金銀比率 */}
          <div className="mb-4">
            <label className="text-sm mb-2 block">金銀比率</label>
            <input
              type="number" step="0.1" value={gsr}
              onChange={e => setGsr(e.target.value)}
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
            { label: 'ゴールド', value: momentumGold, setter: setMomentumGold },
          ].map(({ label, value, setter }) => (
            <div key={label} className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
              <span>{label}</span>
              <button
                onClick={() => setter(!value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  value
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                    : 'bg-red-500/20 text-red-400 border border-red-500/50'
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
            {modeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`py-3 rounded-xl text-sm font-medium transition-all ${
                  mode === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
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

            <div className="bg-slate-800 rounded-xl p-4 mb-3 border-l-4 border-blue-500">
              <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-2">NISA積立枠</h3>
              <div className="flex justify-between">
                <span>{fundNames.nisa_tsumitate || 'NISA積立枠'}</span>
                <span className="text-green-400">{formatCurrency(settings.nisa_tsumitate)}</span>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 mb-3 border-l-4 border-blue-500">
              <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-2">NISA成長枠</h3>
              <div className="flex justify-between">
                <span>{fundNames.nisa_growth || 'NISA成長枠'}</span>
                <span className="text-green-400">{formatCurrency(settings.nisa_growth)}</span>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 mb-3 border-l-4 border-purple-500">
              <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-2">特定口座</h3>
              <div className="flex justify-between py-1">
                <span>{fundNames.tokutei_ac || '株式'}</span>
                <span className="text-green-400">{formatCurrency(result.acAmount)}</span>
              </div>
              {result.reserveDeployment > 0 && (
                <div className="text-xs text-amber-400 ml-2">└ うち待機資金から: +{formatCurrency(result.reserveDeployment)}</div>
              )}
              <div className="flex justify-between py-1">
                <span>{fundNames.tokutei_gold || 'ゴールド'}</span>
                <span className="text-green-400">{formatCurrency(result.goldAmount)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>{fundNames.tokutei_bond || '債券'}</span>
                <span className="text-green-400">{formatCurrency(settings.tokutei_bond)}</span>
              </div>
            </div>

            {result.monthlyReserve > 0 && (
              <div className="bg-slate-800 rounded-xl p-4 mb-3 border-l-4 border-amber-500">
                <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-2">今月の待機分 → iBond</h3>
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
                { label: 'ゴールド 最終倍率', value: `${result.details.goldMultiplier.toFixed(2)}x` },
                { label: 'AC 調整倍率', value: `${result.details.acMultiplier.toFixed(2)}x` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-800 rounded-lg px-4 py-3 flex justify-between">
                  <span className="text-slate-400 text-sm">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center py-4 text-slate-500 text-xs">
          ※ 本ツールの出力は計算結果の表示であり、投資の目安としてご利用ください
        </div>
      </div>
    </div>
  );
}
