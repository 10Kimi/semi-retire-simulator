import { beforeAll, describe, expect, it } from 'vitest';
import type { CrashRecord } from '../ma/types';
import {
  MAX_ITERATIONS,
  PBKDF2_ITERATIONS,
  VaultError,
  checkKey,
  decryptValue,
  deriveKey,
  encryptValue,
  kdfParamsOf,
  makeVerifier,
  newKdfParams,
  validatePassphrase,
  type VaultKey,
} from './vault';

// 本番と同じ回数で鍵を作る（1回 0.4 秒前後）。作るのは beforeAll の2回と、封筒から作り直す1回だけ
const PASS = 'Abc123';
const OTHER = 'Xyz789';
let key: VaultKey;
let otherKey: VaultKey;

beforeAll(async () => {
  const kdf = newKdfParams();
  key = await deriveKey(PASS, kdf);
  otherKey = await deriveKey(OTHER, kdf); // 同じ salt・違うパスフレーズ
}, 30_000);

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(VaultError);
  await expect(p).rejects.toMatchObject({ code });
}

/** 1文字だけ別の文字に変える */
function flip(s: string, i: number): string {
  const c = s[i] === 'A' ? 'B' : 'A';
  return s.slice(0, i) + c + s.slice(i + 1);
}

// crash_state の形（§13-69）。null と入れ子、日付の文字列を含む
const crashRecord: CrashRecord = {
  current: { athValue: 6144.15, athDate: '2026-10-28', triggered: [20, 30], baseReserve: 1_234_567 },
  month: '2026-11',
  monthBase: { athValue: 6144.15, athDate: '2026-10-28', triggered: [20], baseReserve: null },
};

describe('暗号化して復号すると元に戻る', () => {
  it.each([
    ['数値', 1_234_567],
    ['小数', 37_500.5],
    ['オブジェクト', { monthly_budget: 150_000, reserve_balance: 0, reserve_month: null }],
    ['crash_state の形', crashRecord],
  ])('%s', async (_, value) => {
    const env = await encryptValue(key, value);
    expect(await decryptValue(key, env)).toEqual(value);
  });

  it('athDate は文字列のまま戻る', async () => {
    const back = await decryptValue<CrashRecord>(key, await encryptValue(key, crashRecord));
    expect(typeof back.current?.athDate).toBe('string');
  });

  it('封筒に金額が平文で出ない', async () => {
    const env = await encryptValue(key, { reserve_balance: 98_765_432 });
    expect(env).not.toContain('98765432');
  });
});

it('同じ値を2回暗号化すると暗号文が違う（IV がランダム）', async () => {
  const a = JSON.parse(await encryptValue(key, 100));
  const b = JSON.parse(await encryptValue(key, 100));
  expect(a.iv).not.toBe(b.iv);
  expect(a.ct).not.toBe(b.ct);
});

describe('違うパスフレーズでは復号できない', () => {
  it('復号は decrypt-failed', async () => {
    const env = await encryptValue(key, 100);
    await expectCode(decryptValue(otherKey, env), 'decrypt-failed');
  });

  it('鍵の確かめは wrong-passphrase', async () => {
    const verifier = await makeVerifier(key);
    await expect(checkKey(key, verifier)).resolves.toBeUndefined();
    await expectCode(checkKey(otherKey, verifier), 'wrong-passphrase');
  });

  it('salt が違う鍵（別の利用者・リセット後）は key-mismatch、鍵の確かめでは wrong-passphrase', async () => {
    const env = await encryptValue(key, 100);
    const fresh = await deriveKey(PASS, { ...newKdfParams(), iterations: 1000 });
    await expectCode(decryptValue(fresh, env), 'key-mismatch');
    await expectCode(checkKey(fresh, await makeVerifier(key)), 'wrong-passphrase');
  });
});

describe('改ざんの検出', () => {
  it('暗号文を1文字変えると復号できない', async () => {
    const env = JSON.parse(await encryptValue(key, crashRecord));
    // base64 の末尾の文字は使わないビットを含むことがあり、文字を変えてもバイトが変わらない場合がある。
    // そのためバイトを1つ変えてから base64 に戻す（先頭・中ほど・最後＝認証タグ）
    const bytes = Uint8Array.from(atob(env.ct), (c) => c.charCodeAt(0));
    for (const i of [0, Math.floor(bytes.length / 2), bytes.length - 1]) {
      const b = bytes.slice();
      b[i] ^= 0x01;
      const bad = JSON.stringify({ ...env, ct: btoa(String.fromCharCode(...b)) });
      await expectCode(decryptValue(key, bad), 'decrypt-failed');
    }
    // 先頭の文字（使わないビットを含まない）を変えても同じ
    await expectCode(decryptValue(key, JSON.stringify({ ...env, ct: flip(env.ct, 0) })), 'decrypt-failed');
  });

  it('IV を1文字変えると復号できない', async () => {
    const env = JSON.parse(await encryptValue(key, 100));
    await expectCode(decryptValue(key, JSON.stringify({ ...env, iv: flip(env.iv, 0) })), 'decrypt-failed');
  });
});

describe('パスフレーズの条件', () => {
  it('Abc123 は通る', () => {
    expect(validatePassphrase('Abc123')).toEqual([]);
  });
  it.each([
    ['abc123', ['no-upper']],
    ['ABC123', ['no-lower']],
    ['Abcdef', ['no-digit']],
    ['Ab12', ['too-short']],
    ['', ['too-short', 'no-upper', 'no-lower', 'no-digit']],
  ])('%s は弾かれ、足りない条件が返る', (p, issues) => {
    expect(validatePassphrase(p)).toEqual(issues);
  });
});

describe('暗号文の形式', () => {
  it('版の番号・方式・salt・IV・回数が入っている', async () => {
    const env = JSON.parse(await encryptValue(key, 1));
    expect(env.v).toBe(1);
    expect(env.alg).toBe('AES-GCM-256');
    expect(env.kdf).toEqual({ name: 'PBKDF2-SHA256', iterations: PBKDF2_ITERATIONS, salt: key.kdf.salt });
    expect(typeof env.iv).toBe('string');
  });

  it('版が違うとエラー', async () => {
    const env = JSON.parse(await encryptValue(key, 1));
    await expectCode(decryptValue(key, JSON.stringify({ ...env, v: 2 })), 'unsupported-version');
  });

  it('壊れた文字列は malformed', async () => {
    await expectCode(decryptValue(key, 'not json'), 'malformed');
    await expectCode(decryptValue(key, '{"v":1}'), 'malformed');
  });

  it('封筒のパラメータから鍵を作り直して復号できる（別の端末で開いたとき）', async () => {
    const env = await encryptValue(key, crashRecord);
    const again = await deriveKey(PASS, kdfParamsOf(env));
    expect(await decryptValue(again, env)).toEqual(crashRecord);
  }, 30_000);
});

describe('#117 で足したもの', () => {
  it('封筒の回数が上限を超えると malformed（鍵を作らない）', async () => {
    const env = JSON.parse(await encryptValue(key, 1));
    const big = JSON.stringify({ ...env, kdf: { ...env.kdf, iterations: MAX_ITERATIONS + 1 } });
    expect(() => kdfParamsOf(big)).toThrow(VaultError);
    await expectCode(decryptValue(key, big), 'malformed');
    await expectCode(deriveKey(PASS, { ...key.kdf, iterations: MAX_ITERATIONS + 1 }), 'malformed');
  });

  it('上限ちょうどは形として受け付ける', async () => {
    const env = JSON.parse(await encryptValue(key, 1));
    const max = JSON.stringify({ ...env, kdf: { ...env.kdf, iterations: MAX_ITERATIONS } });
    expect(kdfParamsOf(max).iterations).toBe(MAX_ITERATIONS);
  });

  it('NFC と NFD の同じパスフレーズは同じ鍵になる', async () => {
    const kdf = { ...newKdfParams(), iterations: 1000 };
    const nfc = 'Abc123\u00e9'; // é（1文字）
    const nfd = 'Abc123e\u0301'; // e ＋ 結合アクセント
    expect(nfc).not.toBe(nfd);
    const k1 = await deriveKey(nfc, kdf);
    const k2 = await deriveKey(nfd, kdf);
    expect(await decryptValue(k2, await encryptValue(k1, 42))).toBe(42);
    expect(validatePassphrase(nfd)).toEqual(validatePassphrase(nfc));
  });
});
