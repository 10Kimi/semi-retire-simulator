// 利用者の金額を、利用者のパスフレーズから作った鍵でブラウザの中で暗号化・復号する土台（案B、FI_project #116）。
// サーバーには暗号文だけを置き、オーナー（service key）にも中身は見えない。復元の仕組みは持たない（忘れたらリセット）。
// Web Crypto API だけを使う（外部のライブラリなし）。Supabase も画面も知らない純粋な関数にして、テストから直接呼ぶ。
//
// 暗号文（封筒）は JSON の文字列。版・方式・鍵を作るパラメータ・salt・IV を含むので、それだけで復号の条件がそろう。
// 版・方式・パラメータ・salt・IV は AES-GCM の追加データ（AAD）にも入れるので、本文だけでなく見出しを書き換えても復号できない。

/**
 * 暗号文の形式の版。形式を変えたら上げる。上げるときは、前の版の封筒を読む処理を ENVELOPE_READERS に残し、
 * 前の版の封筒が読めるテストを付ける（#135）。古い版の封筒は読めれば、次に暗号化したとき今の版で書き直される
 */
export const VAULT_VERSION = 1;

/**
 * 版ごとの封筒の読み方。ここに無い版は 'unsupported-version'（黙って捨てずにエラーにする）。
 * 復号の追加データ（AAD）には封筒に書かれた版を使うので、古い版の封筒もその版のまま検証される
 */
const ENVELOPE_READERS: Readonly<Record<number, (e: Record<string, unknown>) => Envelope>> = {
  1: readEnvelopeV1,
};

/** 読める封筒の版の一覧（古い順） */
export function readableVaultVersions(): number[] {
  return Object.keys(ENVELOPE_READERS).map(Number).sort((a, b) => a - b);
}

/**
 * PBKDF2-SHA256 の回数。6文字のパスフレーズを総当たりに強くするため重くする（#116）。
 * 手元（Apple M1、Node 22）で 1 回の導出が約 0.4 秒。iPhone の Safari で 1 秒前後の見込み（推定、実機で要確認）。
 * 変えても、古い暗号文は封筒に入った回数で読める。
 */
export const PBKDF2_ITERATIONS = 2_000_000;

/** 封筒の回数の上限。封筒はサーバーから来るので、書き換えられて端末が固まらないように（#117） */
export const MAX_ITERATIONS = 10_000_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;
/** 鍵の確かめに使う既知の文字列（秘密ではない） */
const VERIFIER_TEXT = 'fi-vault-verifier-v1';

export const PASSPHRASE_MIN_LENGTH = 6;

/** パスフレーズの足りない条件 */
export type PassphraseIssue = 'too-short' | 'no-upper' | 'no-lower' | 'no-digit';

/** 決まったエラーの種類 */
export type VaultErrorCode =
  | 'wrong-passphrase' // 鍵の確かめで、パスフレーズが違う
  | 'decrypt-failed' // 鍵が違う、または暗号文が書き換えられている
  | 'unsupported-version' // 暗号文の版が違う
  | 'malformed' // 暗号文の形が壊れている
  | 'key-mismatch'; // 暗号文の salt・パラメータが、渡された鍵のものと違う

export class VaultError extends Error {
  readonly code: VaultErrorCode;
  constructor(code: VaultErrorCode) {
    super(`vault: ${code}`);
    this.name = 'VaultError';
    this.code = code;
  }
}

/** 鍵を作るパラメータ（利用者ごとに1つ。サーバーに暗号文と一緒に置いてよい、秘密ではない） */
export interface KdfParams {
  name: 'PBKDF2-SHA256';
  iterations: number;
  /** base64 */
  salt: string;
}

/** パスフレーズから作った鍵。CryptoKey は取り出せない（extractable: false） */
export interface VaultKey {
  readonly cryptoKey: CryptoKey;
  readonly kdf: KdfParams;
}

interface Envelope {
  v: number;
  alg: 'AES-GCM-256';
  kdf: KdfParams;
  /** base64 */
  iv: string;
  /** base64（暗号文＋認証タグ） */
  ct: string;
}

/** パスフレーズの条件を確かめ、足りない条件の一覧を返す（空なら通る） */
export function validatePassphrase(raw: string): PassphraseIssue[] {
  const passphrase = raw.normalize('NFC');
  const issues: PassphraseIssue[] = [];
  if (passphrase.length < PASSPHRASE_MIN_LENGTH) issues.push('too-short');
  if (!/[A-Z]/.test(passphrase)) issues.push('no-upper');
  if (!/[a-z]/.test(passphrase)) issues.push('no-lower');
  if (!/[0-9]/.test(passphrase)) issues.push('no-digit');
  return issues;
}

/** 新しい利用者のパラメータ（ランダムな salt と今の回数） */
export function newKdfParams(): KdfParams {
  return {
    name: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTES))),
  };
}

/**
 * パスフレーズとパラメータから鍵を作る（重い。1 画面で 1 回だけ呼ぶ）。
 * パスフレーズは NFC にそろえてから使う（端末によって同じ文字の形が違っても同じ鍵になるように、#117）
 */
export async function deriveKey(passphrase: string, kdf: KdfParams): Promise<VaultKey> {
  if (kdf.name !== 'PBKDF2-SHA256' || !validIterations(kdf.iterations)) {
    throw new VaultError('malformed');
  }
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const cryptoKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(kdf.salt), iterations: kdf.iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return { cryptoKey, kdf: { ...kdf } };
}

/** 値（JSON にできるもの）を暗号化して、封筒の文字列を返す。IV は毎回ランダム */
export async function encryptValue(key: VaultKey, value: unknown): Promise<string> {
  const head = {
    v: VAULT_VERSION,
    alg: 'AES-GCM-256' as const,
    kdf: key.kdf,
    iv: toBase64(crypto.getRandomValues(new Uint8Array(IV_BYTES))),
  };
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: fromBase64(head.iv), additionalData: aad(head) },
    key.cryptoKey,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  const env: Envelope = { ...head, ct: toBase64(new Uint8Array(ct)) };
  return JSON.stringify(env);
}

/** 封筒の文字列を復号して値を返す。失敗は VaultError */
export async function decryptValue<T = unknown>(key: VaultKey, envelope: string): Promise<T> {
  const env = parseEnvelope(envelope);
  if (env.kdf.salt !== key.kdf.salt || env.kdf.iterations !== key.kdf.iterations || env.kdf.name !== key.kdf.name) {
    throw new VaultError('key-mismatch');
  }
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(env.iv), additionalData: aad(env) },
      key.cryptoKey,
      fromBase64(env.ct),
    );
  } catch {
    throw new VaultError('decrypt-failed');
  }
  try {
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    throw new VaultError('malformed');
  }
}

/** 封筒から鍵を作るパラメータを読む（パスフレーズを聞いたあと deriveKey に渡す） */
export function kdfParamsOf(envelope: string): KdfParams {
  return { ...parseEnvelope(envelope).kdf };
}

/** 鍵の確かめ用の値を作る（パスフレーズの設定のときに1回。暗号文と一緒に置く） */
export function makeVerifier(key: VaultKey): Promise<string> {
  return encryptValue(key, VERIFIER_TEXT);
}

/** 金額を復号しなくても、鍵（＝パスフレーズ）が合っているかを確かめる。違うときは VaultError('wrong-passphrase') */
export async function checkKey(key: VaultKey, verifier: string): Promise<void> {
  let text: unknown;
  try {
    text = await decryptValue(key, verifier);
  } catch (e) {
    if (e instanceof VaultError && (e.code === 'decrypt-failed' || e.code === 'key-mismatch')) {
      throw new VaultError('wrong-passphrase');
    }
    throw e;
  }
  if (text !== VERIFIER_TEXT) throw new VaultError('wrong-passphrase');
}

function parseEnvelope(envelope: string): Envelope {
  let o: unknown;
  try {
    o = JSON.parse(envelope);
  } catch {
    throw new VaultError('malformed');
  }
  if (typeof o !== 'object' || o === null) throw new VaultError('malformed');
  const e = o as Record<string, unknown>;
  if (typeof e.v !== 'number') throw new VaultError('malformed');
  const read = Object.prototype.hasOwnProperty.call(ENVELOPE_READERS, e.v) ? ENVELOPE_READERS[e.v] : undefined;
  if (!read) throw new VaultError('unsupported-version');
  return read(e);
}

/** 版 1 の封筒：AES-GCM-256、PBKDF2-SHA256（回数・salt は封筒に入っている値を使う、D-070） */
function readEnvelopeV1(e: Record<string, unknown>): Envelope {
  const kdf = e.kdf as Record<string, unknown> | undefined;
  if (
    e.alg !== 'AES-GCM-256' ||
    typeof e.iv !== 'string' ||
    typeof e.ct !== 'string' ||
    typeof kdf !== 'object' ||
    kdf === null ||
    kdf.name !== 'PBKDF2-SHA256' ||
    typeof kdf.iterations !== 'number' ||
    !validIterations(kdf.iterations) ||
    typeof kdf.salt !== 'string'
  ) {
    throw new VaultError('malformed');
  }
  return {
    v: 1,
    alg: e.alg,
    kdf: { name: kdf.name, iterations: kdf.iterations, salt: kdf.salt },
    iv: e.iv,
    ct: e.ct,
  };
}

function validIterations(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_ITERATIONS;
}

/** 追加データ：版・方式・パラメータ・IV を決まった順で並べたもの */
function aad(h: Pick<Envelope, 'v' | 'alg' | 'kdf' | 'iv'>): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    JSON.stringify([h.v, h.alg, h.kdf.name, h.kdf.iterations, h.kdf.salt, h.iv]),
  );
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  let s: string;
  try {
    s = atob(b64);
  } catch {
    throw new VaultError('malformed');
  }
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
