# Migration 031 / MA リファクタリング設計書

**作成日**: 2026-05-16
**ステータス**: 設計（未実装）— きみさん承認後に着手
**スコープ**: 月次投資アドバイザー (`/ma`) の 5 枠を「資産クラス選択式」に再構築

## 0. 背景と目的

### 現状の問題
- 5 枠のうち 2 つ（`tokutei_ac_base` / `tokutei_gold_base`）に**資産クラス固定の乗数**がハードコードされている
  - `tokutei_ac_base` → `acMultiplier = 0.666 × usMultiplier + 0.334 × 1.0`（66% US + 33% その他）
  - `tokutei_gold_base` → `goldMultiplier`（GSR + Gold モメンタム）
- ユーザーが PF リバランス目的で「日経225 + 新興国株のみ」に絞ろうとしたが、ゴールド枠に日経225 を入れると **月次投資額が GSR で振れる**意味不明な動きになる
- UI ラベルもハードコード（`MonthlyAdvisorPage.tsx:154-160`）で 銘柄名以外変えられない
- 銘柄名は **localStorage / DB 保存されず**リロードで消える

### 目標
- 5 枠を**資産クラス選択式**にする（各枠に dropdown：米国株 / 日本株 / 新興国株 / ゴールド / 債券 / 補正なし）
- 銘柄名を**DB 永続化**（リロードで消えない）
- 新興国に対しても**動的乗数**を効かせる（モメンタムのみ、バリュエーションは Phase 2 で拡張余地）
- 既存の `acMultiplier`（US+JP 混合）は廃止、純粋な asset_class ベースの単一乗数に統一

### Phase A 判断結果（2026-05-16、きみさん）
- **Q1: 新興国指標 = 案A モメンタムのみ**（VWO の 10ヶ月 MA 比較）
- **Q2: スロット数 = 案A 5 枠維持**
- **Q3: モード補正範囲 = 案B 株 + Gold に適用、債券は除外**
- **Q4: DB スキーマ = 案B リネーム + asset_class 列追加**

---

## 1. アーキテクチャ変更概要

### 旧構造（before）
```
枠           amount カラム        乗数               資産クラス
NISA積立枠   nisa_tsumitate       固定（×1.0）       固定: 暗黙的に株式想定
NISA成長枠   nisa_growth          固定（×1.0）       固定: 暗黙的に株式想定
特定口座(株) tokutei_ac_base      acMultiplier       固定: 66% US + 33% その他
特定口座(金) tokutei_gold_base    goldMultiplier     固定: ゴールド
特定口座(債) tokutei_bond         固定（×1.0）       固定: 債券

銘柄名:       local state のみ（揮発）
```

### 新構造（after）
```
枠              amount         fund_name          asset_class（選択式）
NISA積立枠      slot1_amount   slot1_fund_name    slot1_asset_class  ('us'|'jp'|'em'|'gold'|'bond'|'none')
NISA成長枠      slot2_amount   slot2_fund_name    slot2_asset_class
特定口座 1      slot3_amount   slot3_fund_name    slot3_asset_class
特定口座 2      slot4_amount   slot4_fund_name    slot4_asset_class
特定口座 3      slot5_amount   slot5_fund_name    slot5_asset_class

monthly_budget / reserve_balance は変更なし

各 asset_class の乗数:
- 'us'   → CAPE × momentum.us × (mode 補正)
- 'jp'   → PBR  × momentum.jp × (mode 補正)
- 'em'   → momentum.em × (mode 補正)            ← 新規（バリュエーション無し）
- 'gold' → GSR  × momentum.gold × (mode 補正)
- 'bond' → 1.0（mode 補正なし）
- 'none' → 1.0（mode 補正なし、純粋固定）
```

### ラベル変更
| 旧ラベル | 新ラベル |
|---|---|
| NISA 積立枠 | NISA 積立枠（変更なし、税制で固定） |
| NISA 成長枠 | NISA 成長枠（変更なし、税制で固定） |
| 特定口座（株式）ベース | **特定口座 1** |
| 特定口座（ゴールド）ベース | **特定口座 2** |
| 特定口座（債券） | **特定口座 3** |

特定口座系の資産クラス紐付けが取れるので、ラベルから「（株式）」「（ゴールド）」「（債券）」を除去して中立化。

---

## 2. migration 031: DB スキーマ変更

**ファイル名**: `supabase/migrations/031_ma_slots_refactor.sql`

### 2-1. 構造（rename + add）

```sql
-- 1. 既存 amount 列を slot{N}_amount にリネーム
ALTER TABLE user_ma_settings
  RENAME COLUMN nisa_tsumitate   TO slot1_amount;
ALTER TABLE user_ma_settings
  RENAME COLUMN nisa_growth      TO slot2_amount;
ALTER TABLE user_ma_settings
  RENAME COLUMN tokutei_ac_base  TO slot3_amount;
ALTER TABLE user_ma_settings
  RENAME COLUMN tokutei_gold_base TO slot4_amount;
ALTER TABLE user_ma_settings
  RENAME COLUMN tokutei_bond     TO slot5_amount;

-- 2. fund_name 列を 5 個追加（銘柄名永続化）
ALTER TABLE user_ma_settings ADD COLUMN slot1_fund_name TEXT NOT NULL DEFAULT '';
ALTER TABLE user_ma_settings ADD COLUMN slot2_fund_name TEXT NOT NULL DEFAULT '';
ALTER TABLE user_ma_settings ADD COLUMN slot3_fund_name TEXT NOT NULL DEFAULT '';
ALTER TABLE user_ma_settings ADD COLUMN slot4_fund_name TEXT NOT NULL DEFAULT '';
ALTER TABLE user_ma_settings ADD COLUMN slot5_fund_name TEXT NOT NULL DEFAULT '';

-- 3. asset_class 列を 5 個追加 + CHECK 制約
ALTER TABLE user_ma_settings ADD COLUMN slot1_asset_class TEXT NOT NULL DEFAULT 'none'
  CHECK (slot1_asset_class IN ('us', 'jp', 'em', 'gold', 'bond', 'none'));
ALTER TABLE user_ma_settings ADD COLUMN slot2_asset_class TEXT NOT NULL DEFAULT 'none'
  CHECK (slot2_asset_class IN ('us', 'jp', 'em', 'gold', 'bond', 'none'));
ALTER TABLE user_ma_settings ADD COLUMN slot3_asset_class TEXT NOT NULL DEFAULT 'us'
  CHECK (slot3_asset_class IN ('us', 'jp', 'em', 'gold', 'bond', 'none'));
ALTER TABLE user_ma_settings ADD COLUMN slot4_asset_class TEXT NOT NULL DEFAULT 'gold'
  CHECK (slot4_asset_class IN ('us', 'jp', 'em', 'gold', 'bond', 'none'));
ALTER TABLE user_ma_settings ADD COLUMN slot5_asset_class TEXT NOT NULL DEFAULT 'bond'
  CHECK (slot5_asset_class IN ('us', 'jp', 'em', 'gold', 'bond', 'none'));
```

### 2-2. 既存データの backfill（旧挙動を近似）

DEFAULT で旧挙動を概ね再現:
- slot1 (旧 NISA 積立) → `asset_class='none'`（旧: 固定 ×1.0）
- slot2 (旧 NISA 成長) → `asset_class='none'`（旧: 固定 ×1.0）
- slot3 (旧 特定口座 株式) → `asset_class='us'`（旧: 66% US + 33% その他 → 100% US で近似、**僅かな挙動変化**）
- slot4 (旧 特定口座 ゴールド) → `asset_class='gold'`（旧: ゴールド乗数）
- slot5 (旧 特定口座 債券) → `asset_class='bond'`（旧: 固定 ×1.0）

**注意**: slot3 の旧 `acMultiplier = 0.666 × usMultiplier + 0.334` が新設計では `usMultiplier` 単体になる。例えば CAPE「割高」（×0.75）時、旧 `acMultiplier = 0.666×0.75 + 0.334 = 0.834`、新 `usMultiplier = 0.75`。**乗数の絶対値が変わる**ので、移行後の月次投資額は旧設計とずれる。きみさんは元々この設定を捨てる予定（PF を JP+EM に絞る）なので影響なしと判断。

### 2-3. 想定影響範囲

| 範囲 | 影響 |
|---|---|
| user_ma_settings | ALTER 5 RENAME + 15 ADD COLUMN（合計 20 操作） |
| 既存レコード | 全行 backfill 完了（DEFAULT 値で自動充填） |
| アプリケーションコード | フロント側コードを同 PR で同時更新必須（DB 単独適用すると UI が壊れる） |
| 他テーブル | 影響なし |
| 他ユーザー | きみさん 1 名のみ。レコード 1 行 |

### 2-4. ロールバック手順

```sql
-- 削除（asset_class + fund_name 計 10 列）
ALTER TABLE user_ma_settings
  DROP COLUMN slot1_asset_class,
  DROP COLUMN slot2_asset_class,
  DROP COLUMN slot3_asset_class,
  DROP COLUMN slot4_asset_class,
  DROP COLUMN slot5_asset_class,
  DROP COLUMN slot1_fund_name,
  DROP COLUMN slot2_fund_name,
  DROP COLUMN slot3_fund_name,
  DROP COLUMN slot4_fund_name,
  DROP COLUMN slot5_fund_name;

-- 列名を旧名に戻す
ALTER TABLE user_ma_settings RENAME COLUMN slot1_amount TO nisa_tsumitate;
ALTER TABLE user_ma_settings RENAME COLUMN slot2_amount TO nisa_growth;
ALTER TABLE user_ma_settings RENAME COLUMN slot3_amount TO tokutei_ac_base;
ALTER TABLE user_ma_settings RENAME COLUMN slot4_amount TO tokutei_gold_base;
ALTER TABLE user_ma_settings RENAME COLUMN slot5_amount TO tokutei_bond;
```

ロールバックには対応するフロント側コードの revert も必須。

---

## 3. fetch_indicators.py 拡張: VWO momentum 追加

**ファイル**: `scripts/market/fetch_indicators.py`

L188-220 付近の `fetch_momentum()` の targets dict に VWO を追加:

```python
def fetch_momentum():
    targets = {
        "us":   {"ticker": "^GSPC", "label": "S&P 500"},
        "jp":   {"ticker": "^N225", "label": "日経225"},
        "em":   {"ticker": "VWO",   "label": "新興国(VWO)"},   # 新規 +1 行
        "gold": {"ticker": "GC=F",  "label": "ゴールド"},
    }
    # 以下既存ループは無変更（forEach で 4 ticker 処理）
```

成果物として `market_data.value.momentum.em = {above_ma: bool, last_price, ma10, label}` が JSON 内に追加される。**スキーマ変更不要**（既存の JSON カラムに 1 キー増えるだけ）。

### 3-1. 初回データ投入

`fetch_indicators.py` を手動実行 1 回:
```bash
cd content-pipeline
python ../セミリタイア・シュミレーター/semi-retire-app/scripts/market/fetch_indicators.py
```

`market_data` テーブルに `momentum.em` 含む新行が INSERT される。

### 3-2. cron

既存 cron（CLAUDE.md に未記載だが run しているはず）が次回回ったときに自動的に VWO も取得開始。手動初回は念のため。

---

## 4. Code 変更

### 4-1. `src/lib/ma/types.ts`

旧 `UserMaSettings` を新構造で全面置換、`AssetClassKey` 型を新設:

```ts
export type MaAssetClass = 'us' | 'jp' | 'em' | 'gold' | 'bond' | 'none';

export const MA_ASSET_CLASS_OPTIONS: { value: MaAssetClass; label: string }[] = [
  { value: 'none', label: '補正なし（固定）' },
  { value: 'us',   label: '米国株（CAPE）' },
  { value: 'jp',   label: '日本株（PBR）' },
  { value: 'em',   label: '新興国株（モメンタム）' },
  { value: 'gold', label: 'ゴールド（GSR）' },
  { value: 'bond', label: '債券' },
];

export interface MaSlot {
  amount: number;
  fund_name: string;
  asset_class: MaAssetClass;
}

export interface UserMaSettings {
  user_id: string;
  monthly_budget: number;
  reserve_balance: number;
  slot1: MaSlot;
  slot2: MaSlot;
  slot3: MaSlot;
  slot4: MaSlot;
  slot5: MaSlot;
}

// 旧 ValuationResult / AllocationResult は構造保持、新 emResult を AllocationResult.details に追加
export interface AllocationResult {
  perSlotAmount: number[];        // 各 slot の最終投資額（5 要素）
  monthlyReserve: number;
  reserveDeployment: number;
  totalInvest: number;
  newReserveBalance: number;
  details: {
    capeResult: ValuationResult;
    pbrResult: ValuationResult;
    gsrResult: ValuationResult;
    usMultiplier: number;
    jpMultiplier: number;
    emMultiplier: number;          // 新規
    goldMultiplier: number;
  };
}

// Indicators に momentum.em フィールドを追加
export interface MomentumData {
  us?: MomentumItem;
  jp?: MomentumItem;
  em?: MomentumItem;               // 新規
  gold?: MomentumItem;
}

// DEFAULT_SETTINGS を新構造に
export const DEFAULT_SETTINGS: Omit<UserMaSettings, 'user_id'> = {
  monthly_budget: 1000000,
  reserve_balance: 0,
  slot1: { amount: 100000, fund_name: '', asset_class: 'none' },
  slot2: { amount: 200000, fund_name: '', asset_class: 'none' },
  slot3: { amount: 500000, fund_name: '', asset_class: 'us' },
  slot4: { amount: 180000, fund_name: '', asset_class: 'gold' },
  slot5: { amount: 20000,  fund_name: '', asset_class: 'bond' },
};
```

### 4-2. `src/lib/ma/logic.ts`

`AC_US_RATIO` / `AC_OTHER_RATIO` 定数を削除。`calculateAllocation` を per-slot 計算に書き換え:

```ts
function getSlotMultiplier(
  ac: MaAssetClass,
  multipliers: { us: number; jp: number; em: number; gold: number },
  mode: MarketMode,
): number {
  switch (ac) {
    case 'us':   return applyModeCorrection(multipliers.us,   mode);
    case 'jp':   return applyModeCorrection(multipliers.jp,   mode);
    case 'em':   return applyModeCorrection(multipliers.em,   mode);
    case 'gold': return applyModeCorrection(multipliers.gold, mode);
    case 'bond': return 1.0;   // Q3 案B: mode 補正非適用
    case 'none': return 1.0;
  }
}

export function calculateAllocation(
  cape: number,
  pbr: number,
  gsr: number,
  momentumUS: boolean,
  momentumJP: boolean,
  momentumEM: boolean,    // 新規
  momentumGold: boolean,
  cape5yMA: number | null,
  settings: UserMaSettings,
  mode: MarketMode,
): AllocationResult {
  const capeResult = getCapeMultiplier(cape, cape5yMA);
  const pbrResult = getPbrMultiplier(pbr);
  const gsrResult = getGsrMultiplier(gsr);

  const usBase   = capeResult.multiplier * (momentumUS   ? 1.0 : 0.5);
  const jpBase   = pbrResult.multiplier  * (momentumJP   ? 1.0 : 0.5);
  const emBase   = momentumEM ? 1.0 : 0.5;              // バリュエーション無し
  const goldBase = gsrResult.multiplier  * (momentumGold ? 1.0 : 0.5);

  const slots: MaSlot[] = [settings.slot1, settings.slot2, settings.slot3, settings.slot4, settings.slot5];
  const perSlotAmount = slots.map(slot => {
    const m = getSlotMultiplier(slot.asset_class, { us: usBase, jp: jpBase, em: emBase, gold: goldBase }, mode);
    return Math.round(slot.amount * m / 10000) * 10000;
  });

  const baseInvest = perSlotAmount.reduce((s, x) => s + x, 0);
  const monthlyReserve = Math.max(0, settings.monthly_budget - baseInvest);

  // 待機資金投入: CAPE 割安時、第一の 'us' クラススロットに加算
  const reserveDeployment = getReserveDeployment(capeResult.level, settings.reserve_balance);
  const firstUsIdx = slots.findIndex(s => s.asset_class === 'us');
  if (firstUsIdx >= 0) perSlotAmount[firstUsIdx] += reserveDeployment;

  const totalInvest = perSlotAmount.reduce((s, x) => s + x, 0);
  const newReserveBalance = settings.reserve_balance + monthlyReserve - reserveDeployment;

  return {
    perSlotAmount,
    monthlyReserve,
    reserveDeployment,
    totalInvest,
    newReserveBalance,
    details: { capeResult, pbrResult, gsrResult, usMultiplier: usBase, jpMultiplier: jpBase, emMultiplier: emBase, goldMultiplier: goldBase },
  };
}
```

**変更要点**:
- `AC_US_RATIO` / `acMultiplier` 廃止
- `momentumEM` 引数を追加
- 戻り値が `acAmount` / `goldAmount` から `perSlotAmount[]` に変わる（呼び出し側も修正）
- `reserveDeployment` は **最初に asset_class='us' のスロット**に加算（旧: ac 枠固定）。'us' スロット無ければ deploy=0 で待機資金パーク

### 4-3. `src/lib/ma/db.ts`

`fetchUserSettings` / `saveUserSettings` を新カラム名に対応:

```ts
export async function fetchUserSettings(userId: string): Promise<UserMaSettings | null> {
  const { data, error } = await supabase
    .from('user_ma_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;

  return {
    user_id: data.user_id,
    monthly_budget: data.monthly_budget,
    reserve_balance: data.reserve_balance,
    slot1: { amount: data.slot1_amount, fund_name: data.slot1_fund_name, asset_class: data.slot1_asset_class },
    slot2: { amount: data.slot2_amount, fund_name: data.slot2_fund_name, asset_class: data.slot2_asset_class },
    slot3: { amount: data.slot3_amount, fund_name: data.slot3_fund_name, asset_class: data.slot3_asset_class },
    slot4: { amount: data.slot4_amount, fund_name: data.slot4_fund_name, asset_class: data.slot4_asset_class },
    slot5: { amount: data.slot5_amount, fund_name: data.slot5_fund_name, asset_class: data.slot5_asset_class },
  };
}

export async function saveUserSettings(userId: string, settings: Omit<UserMaSettings, 'user_id'>): Promise<void> {
  const row = {
    user_id: userId,
    monthly_budget: settings.monthly_budget,
    reserve_balance: settings.reserve_balance,
    slot1_amount: settings.slot1.amount, slot1_fund_name: settings.slot1.fund_name, slot1_asset_class: settings.slot1.asset_class,
    slot2_amount: settings.slot2.amount, slot2_fund_name: settings.slot2.fund_name, slot2_asset_class: settings.slot2.asset_class,
    slot3_amount: settings.slot3.amount, slot3_fund_name: settings.slot3.fund_name, slot3_asset_class: settings.slot3.asset_class,
    slot4_amount: settings.slot4.amount, slot4_fund_name: settings.slot4.fund_name, slot4_asset_class: settings.slot4.asset_class,
    slot5_amount: settings.slot5.amount, slot5_fund_name: settings.slot5.fund_name, slot5_asset_class: settings.slot5.asset_class,
  };
  const { error } = await supabase.from('user_ma_settings').upsert(row);
  if (error) console.error('ma settings save error:', error);
}
```

### 4-4. `src/pages/MonthlyAdvisorPage.tsx`

主な変更点:
- `fundNames` local state を削除（`settings.slot{N}.fund_name` 経由で扱う）
- 5 枠ループの定義を `[{ slotKey: 'slot1', label: 'NISA 積立枠' }, ...]` に書き換え
- 各枠に **asset_class dropdown** を追加
- `handleSettingsChange` を slot 単位に対応（`slot1.amount` / `slot1.fund_name` / `slot1.asset_class` の 3 種編集）

UI イメージ:
```
NISA 積立枠           [ ¥100,000 ]
  銘柄名: [ eMAXIS Slim 新興国株式インデックス ]
  資産クラス: [ 新興国株（モメンタム） ▼ ]

特定口座 1            [ ¥400,000 ]
  銘柄名: [ eMAXIS Slim 新興国株式インデックス ]
  資産クラス: [ 新興国株（モメンタム） ▼ ]
```

`AllocationResult.perSlotAmount[N]` を画面下部の「今月の投資配分」セクションに表示（旧: ac/gold 表示 → 新: slot 1-5 表示）。

### 4-5. `src/lib/ma/logic.test.ts`

既存テストを新構造で書き換え + 新規ケース追加:

| テストケース | 内容 |
|---|---|
| 既存テスト全件 | `UserMaSettings` 新構造に書き換え |
| 新: per-slot multiplier | slot1=us, slot2=jp, slot3=em の各 asset_class が正しい乗数で計算される |
| 新: bond + none は mode 補正されない | mode='bullish' でも bond/none スロットは ×1.0 のまま |
| 新: reserve deployment | CAPE 'low' 時、最初の 'us' スロットに反映 / 'us' スロット無し時 deploy=0 |

---

## 5. 適用順序とリスク確認チェックリスト

### 5-1. 適用順序

**重要**: DB マイグレーション単独適用と UI コード単独デプロイは両方とも壊れる。**同じ PR / 同じセッションで両方適用必須**。

順序:
1. `fetch_indicators.py` 修正 (VWO momentum 追加) commit
2. `fetch_indicators.py` を手動実行 → `market_data.value.momentum.em` が入った 1 行を投入
3. `src/lib/ma/types.ts` / `logic.ts` / `logic.test.ts` / `db.ts` / `MonthlyAdvisorPage.tsx` 修正 commit
4. テスト実行（`npm test`）→ 全 pass 確認
5. Build (`npm run build`) → エラーなし確認
6. Push して Vercel deploy 待ち
7. **Deploy Ready 確認後、即座に SQL Editor で migration 031 適用**（フロントが新スキーマ前提で動くため、DB が古いと壊れる）
8. UI で `/ma` を開き、5 枠 + dropdown + 銘柄名永続化を実機確認

### 5-2. 着手前チェックリスト
- [ ] 本設計書のレビュー完了（きみさん）
- [ ] Vercel 環境（Hobby plan + commit author email）の状態確認（前回 28-30 と同様、`kiminori.chida@largogk.com` で grandfathered OK）
- [ ] `user_ma_settings` 現状バックアップ（CSV エクスポート 1 行）
- [ ] `fetch_indicators.py` 手動実行 1 回、`market_data.value.momentum.em` 入りレコード INSERT 確認
- [ ] コード修正 + テスト pass + ビルド OK + push
- [ ] Vercel deploy Ready 確認
- [ ] SQL Editor で migration 031 実行
- [ ] 検証 SELECT で `user_ma_settings` の新構造確認（slot1-5 amount/fund_name/asset_class 計 15 列 + monthly_budget + reserve_balance = 17 列）
- [ ] `/ma` ブラウザ実機確認
- [ ] CHANGELOG.md 記録

### 5-3. リスク評価

| リスク | 対処 |
|---|---|
| DB 適用と UI デプロイのタイミングずれで `/ma` がエラーになる | 短時間（数秒）の窓は許容、ユーザー 1 名のみで業務影響ゼロ。Vercel Ready → SQL 即実行で最小化 |
| migration 031 ロールバック時にフロント側 revert も必要 | ロールバック手順に **両方** 記載済み |
| VWO momentum 取得失敗（API レート制限等） | 既存 yfinance パターンに乗るだけなので追加リスク低。fetch_indicators.py は失敗時 `momentum = {}` で他 momentum も影響受ける挙動だが、これは既存仕様 |
| 既存テストの修正範囲が広い | `logic.test.ts` 全件書き換え必須。テスト pass を必ず確認してから push |
| `acMultiplier` 廃止で旧 `tokutei_ac_base` ユーザーの月次計算結果が変わる | きみさん 1 名のみ、本人が新構造に移行する前提で問題なし。CHANGELOG に明記 |

---

## 6. 検証 SELECT

migration 031 適用後:
```sql
-- 構造確認: 17 列
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_ma_settings'
ORDER BY ordinal_position;
-- 期待: user_id / monthly_budget / reserve_balance + slot1-5 × (amount, fund_name, asset_class)
-- = 17 列

-- データ確認
SELECT user_id,
  slot1_amount, slot1_fund_name, slot1_asset_class,
  slot2_amount, slot2_fund_name, slot2_asset_class,
  slot3_amount, slot3_fund_name, slot3_asset_class,
  slot4_amount, slot4_fund_name, slot4_asset_class,
  slot5_amount, slot5_fund_name, slot5_asset_class
FROM user_ma_settings;
-- 期待: 既存 1 行のすべてのカラムに値が入っている
-- slot3_asset_class='us', slot4_asset_class='gold', slot5_asset_class='bond' が DEFAULT で入る
```

---

## 7. 既知の制約・後続タスク

### 7-1. Phase 2 拡張余地（本設計では実装しない）
- **新興国バリュエーション指標追加**: VWO の P/E 取得 + 5 年 MA 乖離判定で `emMultiplier` を `momentum × valuation` の合成にする
- **スロット数を 6 以上に増やす**: 別 migration で slot6 列群追加
- **スロット可変化**: `user_ma_slots` 別テーブル化（Q2 案B、今回見送り）

### 7-2. `schema_migrations` 運用判断
案 A 継続（migration 027〜030 と同じ）。`schema_migrations` テーブルは触らず、SQL Editor 直接適用 + CHANGELOG 記録のみ。

### 7-3. 副次バグの扱い
- `saveSnapshot` 重複 INSERT（rb 側、2026-05-16 発覚）→ 別タスク
- 本 migration には含めない

---

## 8. 変更履歴

| 日付 | 変更 |
|---|---|
| 2026-05-16 | 初版作成（Phase A Q1〜Q4 判断結果を反映）|
