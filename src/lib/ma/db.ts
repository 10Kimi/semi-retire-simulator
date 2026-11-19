import { supabase } from '../supabase';
import type { Indicators, UserMaSettings, MaSlot, MaAssetClass, MaAccount, SlotKey, JpIndex, CrashRecord } from './types';
import { DEFAULT_SETTINGS } from './types';
import { rowToSettings, settingsToRow, type UserMaSettingsRow } from './settingsRow';
import {
  amountsToRowPatch, baseOf, defaultAmounts, loadLocalAmounts, loadLocalRaw, mergeAmounts, nullAmountsPatch, parseAmountsJson,
  patchLocalAmounts, planAmountMove, rowAmounts, sameTime, saveLocalAmounts, saveLocalRaw, savedAtOf, setLocalBase,
  withoutAmounts, type AmountStorage,
} from './localAmounts';
import {
  checkKey, decryptValue, deriveKey, encryptValue, kdfParamsOf, makeVerifier, newKdfParams, validatePassphrase,
  VaultError, type KdfParams, type VaultKey,
} from '../vault/vault';
import { EMPTY_VAULT, vaultStatus, type VaultColumns, type VaultStatus } from './vaultAmounts';

export async function fetchLatestIndicators(): Promise<Indicators | null> {
  const { data, error } = await supabase
    .from('indicators')
    .select('*')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('indicators fetch error:', error);
    return null;
  }
  return data;
}

/** 行を読む。無ければ既定値で作る（金額の列は送らない）。読めなければ null */
async function fetchUserSettingsRow(userId: string): Promise<UserMaSettingsRow | null> {
  const { data, error } = await supabase
    .from('user_ma_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data) return data as UserMaSettingsRow;

  // 初回：デフォルト値で作成。金額は送らない（D-065。金額はブラウザに持つ）
  if (error?.code === 'PGRST116') {
    const row = withoutAmounts(settingsToRow(userId, DEFAULT_SETTINGS));
    // 同時に2回作ろうとしても失敗しない。既にある行は上書きしない（重複なら行が返らないので読み直す）
    const { data: inserted, error: insertError } = await supabase
      .from('user_ma_settings')
      .upsert(row, { onConflict: 'user_id', ignoreDuplicates: true })
      .select()
      .maybeSingle();

    if (insertError) {
      console.error('settings insert error:', insertError);
      return null;
    }
    if (inserted) return inserted as UserMaSettingsRow;

    const { data: existing, error: refetchError } = await supabase
      .from('user_ma_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) return existing as UserMaSettingsRow;
    console.error('settings refetch error:', refetchError);
    return null;
  }

  console.error('settings fetch error:', error);
  return null;
}

/** サーバーの行だけから作った設定（金額の移し替えはしない） */
export async function fetchUserSettings(userId: string): Promise<UserMaSettings> {
  const row = await fetchUserSettingsRow(userId);
  return row ? rowToSettings(row) : { user_id: userId, ...DEFAULT_SETTINGS };
}

function browserStorage(): AmountStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null; // ストレージが無効なブラウザ
  }
}

/**
 * /ma の画面が使う設定。オーナー本人の行（amounts_on_server）はサーバーの金額をそのまま使う。
 * それ以外は金額をブラウザ（localStorage）から読み、サーバーに金額が残っていれば一度ブラウザへ移してからサーバー側を消す（D-065、#111）。
 */
export async function loadUserSettings(userId: string, storage: AmountStorage | null = browserStorage()): Promise<UserMaSettings> {
  return (await loadUserSettingsWithVault(userId, storage)).settings;
}

/** /ma の画面が開いたときに使う：設定と、サーバーの暗号文の列と、その状態（#117） */
export async function loadUserSettingsWithVault(
  userId: string, storage: AmountStorage | null = browserStorage(),
): Promise<{ settings: UserMaSettings; vault: VaultColumns; status: VaultStatus }> {
  const row = await fetchUserSettingsRow(userId);
  const settings = await settingsFromRow(userId, row, storage);
  const vault: VaultColumns | null = row ? vaultColumnsOf(row) : null;
  let localRaw = storage ? loadLocalRaw(storage, userId) : null;
  // ほかの端末でリセットされたあと、この端末に古い版の印（base）が残っていれば消す（再レビューの指摘・中1）
  if (storage && vault && !vault.vault_verifier && baseOf(localRaw)) {
    setLocalBase(storage, userId, null);
    localRaw = loadLocalRaw(storage, userId);
  }
  return { settings, vault: vault ?? EMPTY_VAULT, status: vaultStatus(settings.amounts_on_server === true, vault, localRaw) };
}

async function settingsFromRow(
  userId: string, row: UserMaSettingsRow | null, storage: AmountStorage | null,
): Promise<UserMaSettings> {
  if (!row) {
    const base: UserMaSettings = { user_id: userId, ...DEFAULT_SETTINGS };
    const local = storage ? loadLocalAmounts(storage, userId) : null;
    return local ? mergeAmounts(base, local) : base;
  }
  const base = rowToSettings(row);
  if (base.amounts_on_server) {
    // 目印を付ける前に新しい画面で開き、金額がブラウザへ移っていた場合の戻し道：サーバーが全部 null でブラウザに値があれば書き戻す
    const local = storage ? loadLocalAmounts(storage, userId) : null;
    if (rowAmounts(row) || !local) return base;
    const restored = mergeAmounts(base, local);
    const { error } = await supabase.from('user_ma_settings').update(amountsToRowPatch(local)).eq('user_id', userId);
    if (error) console.error('settings restore amounts error:', error);
    return restored;
  }

  const plan = planAmountMove(rowAmounts(row), storage ? loadLocalAmounts(storage, userId) : null);
  let clear = plan.clearServer;
  if (plan.saveToLocal) {
    // ブラウザに保存できなかったら、サーバーの金額は消さない（その回はサーバーの値で表示する）
    clear = !!storage && saveLocalAmounts(storage, userId, plan.saveToLocal);
  }
  if (clear) {
    const { error } = await supabase.from('user_ma_settings').update(nullAmountsPatch()).eq('user_id', userId);
    if (error) console.error('settings clear amounts error:', error);
  }
  return mergeAmounts(base, plan.use);
}

/**
 * 待機資金と暴落ルールの段階を確定する（投資実行）。オーナー本人の行はサーバーへ、それ以外はブラウザへ。
 * 暴落ルールの段階は待機資金と同じタイミングで確定する。指標が無く判定しなかった月は触らない
 */
export async function updateReserveBalance(
  userId: string, balance: number, month: string, monthBase: number, crashState: CrashRecord | undefined,
  amountsOnServer: boolean, storage: AmountStorage | null = browserStorage(),
): Promise<boolean> {
  if (!amountsOnServer) {
    const ok = !!storage && patchLocalAmounts(storage, userId, {
      reserve_balance: balance, reserve_month: month, reserve_month_base: monthBase,
      ...(crashState !== undefined ? { crash_state: crashState } : {}),
    });
    if (!ok) console.error('reserve save error: このブラウザに保存できませんでした');
    return ok;
  }
  const { error } = await supabase
    .from('user_ma_settings')
    .update({
      reserve_balance: balance, reserve_month: month, reserve_month_base: monthBase,
      ...(crashState !== undefined ? { crash_state: crashState } : {}),
    })
    .eq('user_id', userId);

  if (error) console.error('reserve update error:', error);
  return !error;
}

/**
 * 月次予算 / 待機資金以外は slot 単位で更新する。
 * top-level scalar フィールド: monthly_budget / reserve_balance
 * slot フィールド: slot{N}.amount / slot{N}.fund_name / slot{N}.asset_class
 */
type UpdatePatch =
  | { monthly_budget: number }
  | { reserve_balance: number }
  | { jp_index: JpIndex }
  | { nikkei_pbr_anchor: number; nikkei_price_anchor: number }
  | { slot: SlotKey; field: keyof MaSlot; value: number | string | MaAssetClass | MaAccount };

export async function updateSettings(
  userId: string, patch: UpdatePatch, amountsOnServer: boolean, storage: AmountStorage | null = browserStorage(),
): Promise<boolean> {
  // 金額（月の予算・待機資金・積立額）は、オーナー本人の行以外はブラウザにだけ保存する（D-065）
  if (!amountsOnServer) {
    let local: Parameters<typeof patchLocalAmounts>[2] | null = null;
    if ('monthly_budget' in patch) local = { monthly_budget: patch.monthly_budget };
    else if ('reserve_balance' in patch) local = { reserve_balance: patch.reserve_balance };
    else if ('slot' in patch && patch.field === 'amount') local = { slot_amounts: { [patch.slot]: patch.value as number } };
    if (local) {
      const ok = !!storage && patchLocalAmounts(storage, userId, local);
      if (!ok) console.error('settings save error: このブラウザに保存できませんでした');
      return ok;
    }
  }

  let dbPatch: Record<string, number | string> = {};
  if ('monthly_budget' in patch) {
    dbPatch = { monthly_budget: patch.monthly_budget };
  } else if ('reserve_balance' in patch) {
    dbPatch = { reserve_balance: patch.reserve_balance };
  } else if ('jp_index' in patch) {
    dbPatch = { jp_index: patch.jp_index };
  } else if ('nikkei_pbr_anchor' in patch) {
    dbPatch = { nikkei_pbr_anchor: patch.nikkei_pbr_anchor, nikkei_price_anchor: patch.nikkei_price_anchor };
  } else {
    const col = `${patch.slot}_${patch.field}`;   // account / amount / fund_name / asset_class
    dbPatch = { [col]: patch.value };
  }

  const { error } = await supabase
    .from('user_ma_settings')
    .update(dbPatch)
    .eq('user_id', userId);

  if (error) console.error('settings update error:', error);
  return !error;
}

// ── 暗号文（案B、#117、D-070） ─────────────────────────────────────────────
// 鍵はページの中（メモリ）だけに持つ。パスフレーズ・鍵はどこにも保存しない。
// サーバーに置くのは暗号文・鍵の確かめ用の値・保存した時刻（版）だけ（金額は平文で置かない）。オーナー本人の行では使わない。
// サーバーへの書き込みは、サーバーの版がこの端末の base のままで、確かめ用の値も同じときだけ通す（条件つきの更新）。
// 0 行なら、ほかの端末がそのあとに保存したか、パスフレーズを設定し直した（#117 のレビュー役の指摘・高1・中2・中3）。

function vaultColumnsOf(row: UserMaSettingsRow): VaultColumns {
  return { amounts_vault: row.amounts_vault ?? null, vault_verifier: row.vault_verifier ?? null, vault_saved_at: row.vault_saved_at ?? null };
}

/** ブラウザに保存できなかった（プライベートブラウズ・容量超過）。暗号文の不具合と分けて表示する */
export class LocalSaveError extends Error {
  constructor() {
    super('local-save-failed');
    this.name = 'LocalSaveError';
  }
}

export type VaultWrite = 'ok' | 'conflict' | 'error';

/**
 * この端末の値（localStorage の文字列そのもの）を暗号化してサーバーに置く。
 * サーバーの版がこの端末の base と違う・確かめ用の値が違う（ほかの端末で設定し直した）ときは書かずに 'conflict'
 */
export async function pushVault(userId: string, key: VaultKey, verifier: string, storage: AmountStorage): Promise<VaultWrite> {
  const raw = loadLocalRaw(storage, userId);
  if (!raw) return 'error';
  const base = baseOf(raw);
  const savedAt = savedAtOf(raw) ?? new Date().toISOString();
  let q = supabase
    .from('user_ma_settings')
    .update({ amounts_vault: await encryptValue(key, raw), vault_saved_at: savedAt })
    .eq('user_id', userId)
    .eq('vault_verifier', verifier);
  q = base ? q.eq('vault_saved_at', base) : q.is('vault_saved_at', null);
  const { data, error } = await q.select('user_id');
  if (error) {
    console.error('vault save error:', error);
    return 'error';
  }
  if (!data || data.length === 0) return 'conflict';
  // サーバーとそろったので、この端末の base を今の版にする
  return setLocalBase(storage, userId, savedAt) ? 'ok' : 'error';
}

/**
 * 投資実行の直前：サーバーの暗号文の版が、この端末の base のままか（鍵が無くても確かめられる）。
 * 'changed' なら、ほかの端末が保存している（古い値のまま投資実行すると二重になりうる）
 */
export async function checkVaultUnchanged(userId: string, storage: AmountStorage): Promise<'same' | 'changed' | 'error'> {
  const { data, error } = await supabase.from('user_ma_settings').select('vault_saved_at, vault_verifier').eq('user_id', userId).single();
  if (error || !data) return 'error';
  const row = data as { vault_saved_at: string | null; vault_verifier: string | null };
  // パスフレーズを設定していない（ほかの端末でリセットされた場合も）なら、比べる暗号文が無いので止めない（再レビューの指摘・中1）
  if (!row.vault_verifier) return 'same';
  return sameTime(row.vault_saved_at ?? null, baseOf(loadLocalRaw(storage, userId))) ? 'same' : 'changed';
}

/**
 * 初めてのパスフレーズの設定：条件を確かめ、鍵を作り、確かめ用の値とこの端末の値の暗号文をサーバーに置く。
 * まだ誰も設定していない（vault_verifier が null）ときだけ書く。ほかの端末で設定済みなら 'already-set'。kdf はテスト用
 */
export async function setupVault(
  userId: string, passphrase: string, storage: AmountStorage, kdf: KdfParams = newKdfParams(),
): Promise<
  | { key: VaultKey; verifier: string }
  | { issues: ReturnType<typeof validatePassphrase> }
  | { error: 'already-set' | 'server' | 'local' }
> {
  const issues = validatePassphrase(passphrase);
  if (issues.length > 0) return { issues };
  // この端末にまだ値が無ければ既定値（0）を保存してから暗号化する（サーバーに空の暗号文を置かない）
  if (!loadLocalRaw(storage, userId) && !saveLocalAmounts(storage, userId, defaultAmounts())) return { error: 'local' };
  const key = await deriveKey(passphrase, kdf);
  const verifier = await makeVerifier(key);
  const raw = loadLocalRaw(storage, userId)!;
  const savedAt = savedAtOf(raw) ?? new Date().toISOString();
  const { data, error } = await supabase
    .from('user_ma_settings')
    .update({ vault_verifier: verifier, amounts_vault: await encryptValue(key, raw), vault_saved_at: savedAt })
    .eq('user_id', userId)
    .is('vault_verifier', null)
    .select('user_id');
  if (error) {
    console.error('vault setup error:', error);
    return { error: 'server' };
  }
  if (!data || data.length === 0) return { error: 'already-set' };
  if (!setLocalBase(storage, userId, savedAt)) return { error: 'local' };
  return { key, verifier };
}

/**
 * パスフレーズを入れたとき：鍵を作って確かめる。
 * - この端末に値が無いか、この端末がそろえたあとでサーバーが変わっていたら、サーバーの値で戻す（両方で変えていたらサーバーを採る）。
 *   この端末で変えた分を捨てたときは discarded: true（画面で知らせる）
 * - サーバーが変わっていなければ、この端末の値をサーバーに置く（push の結果を返す）
 * パスフレーズが違えば VaultError('wrong-passphrase')、ブラウザに保存できなければ LocalSaveError
 */
export async function unlockVault(
  userId: string, passphrase: string, vault: VaultColumns, storage: AmountStorage,
): Promise<{ key: VaultKey; restored: boolean; discarded: boolean; push: VaultWrite | null }> {
  if (!vault.vault_verifier) throw new VaultError('malformed');
  const key = await deriveKey(passphrase, kdfParamsOf(vault.vault_verifier));
  await checkKey(key, vault.vault_verifier);

  const localRaw = loadLocalRaw(storage, userId);
  if (vault.amounts_vault && (!localRaw || !sameTime(baseOf(localRaw), vault.vault_saved_at))) {
    const serverRaw = await decryptValue<string>(key, vault.amounts_vault);
    const serverAmounts = typeof serverRaw === 'string' ? parseAmountsJson(serverRaw) : null;
    if (!serverAmounts) throw new VaultError('malformed');
    const localAmounts = localRaw ? parseAmountsJson(localRaw) : null;
    const withBase = JSON.stringify({ ...(JSON.parse(serverRaw) as Record<string, unknown>), base: vault.vault_saved_at });
    if (!saveLocalRaw(storage, userId, withBase)) throw new LocalSaveError();
    const discarded = !!localAmounts && JSON.stringify(localAmounts) !== JSON.stringify(serverAmounts);
    return { key, restored: true, discarded, push: null };
  }
  const push = localRaw ? await pushVault(userId, key, vault.vault_verifier, storage) : null;
  return { key, restored: false, discarded: false, push };
}

/** 「パスフレーズを忘れた」：暗号文・確かめ用の値・時刻を消す（この端末の値は残す）。行は消さない（DELETE のポリシーは無い） */
export async function resetVault(userId: string, storage: AmountStorage | null = browserStorage()): Promise<boolean> {
  const { error } = await supabase
    .from('user_ma_settings')
    .update({ amounts_vault: null, vault_verifier: null, vault_saved_at: null })
    .eq('user_id', userId);
  if (error) {
    console.error('vault reset error:', error);
    return false;
  }
  if (storage) setLocalBase(storage, userId, null);
  return true;
}
