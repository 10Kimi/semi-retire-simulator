// 版の付いたデータの引き継ぎ（FI_project #135）。
// ブラウザに持つ金額（/ma・/rb）は、取り戻す方法が無い（D-065・D-071）。版を上げるときは、前の版のデータを黙って捨てずに引き継ぐ。
// 版 n のデータを版 n+1 にする変換（Upgrade）を版ごとに置き、古い版から今の版まで順に当てる。
// Supabase も画面も知らない純粋な関数にして、テストから直接呼ぶ。

export type Upgrade = (data: Record<string, unknown>) => Record<string, unknown>;

/** upgrades[n] は版 n のデータを版 n+1 にする。版を上げるときに、ここへ1つ足す（テストも付ける） */
export type Upgrades = Readonly<Record<number, Upgrade>>;

export type Upgraded =
  | { ok: true; data: Record<string, unknown>; from: number }
  | { ok: false; reason: 'malformed' | 'unsupported-version' };

/** 値の version を見て、今の版まで変換を順に当てる。今の版ならそのまま（写しを返す） */
export function upgradeData(value: unknown, current: number, upgrades: Upgrades): Upgraded {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ok: false, reason: 'malformed' };
  const from = (value as Record<string, unknown>).version;
  if (typeof from !== 'number' || !Number.isInteger(from)) return { ok: false, reason: 'malformed' };
  if (from > current) return { ok: false, reason: 'unsupported-version' };
  let data: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (let v = from; v < current; v++) {
    const up = upgrades[v];
    if (!up) return { ok: false, reason: 'unsupported-version' };
    data = { ...up(data), version: v + 1 };
  }
  return { ok: true, data, from };
}

/** 今の版まで引き継げる古い版の一覧（新しい順）。変換が途中で欠けている版は含めない */
export function upgradableVersions(current: number, upgrades: Upgrades): number[] {
  const out: number[] = [];
  for (let v = current - 1; v >= 0 && upgrades[v]; v--) out.push(v);
  return out;
}

export type VersionedStorage = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;

export type ReadResult =
  /** 今の名前の文字列（古い名前から引き継いだものを含む）。何も無ければ null */
  | { status: 'ok'; raw: string | null }
  /** 古い版のデータがあるのに引き継げなかった（保存できない・変換したら形が合わない）。古いデータは残っている */
  | { status: 'blocked' }
  /** ストレージが読めない */
  | { status: 'error' };

/**
 * 今の版の名前（keyOf(current)）の文字列を読む。無ければ古い版の名前を新しい順に探して引き継ぐ：
 * 変換して今の名前に保存し、読み直して同じだったら古い名前を消す。保存できなければ古いデータは消さない。
 * valid は変換したあとの文字列が今の版の形として読めるか（読めなければ保存しない）
 */
export function readVersioned(
  storage: VersionedStorage,
  keyOf: (version: number) => string,
  current: number,
  upgrades: Upgrades,
  valid: (json: string) => boolean,
): ReadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(keyOf(current));
  } catch {
    return { status: 'error' };
  }
  if (raw) return { status: 'ok', raw };

  for (const v of upgradableVersions(current, upgrades)) {
    let oldRaw: string | null;
    try {
      oldRaw = storage.getItem(keyOf(v));
    } catch {
      return { status: 'error' };
    }
    if (!oldRaw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(oldRaw);
    } catch {
      // 古い名前の壊れたデータは触らない（消さない）。ほかの古い名前を探す
      continue;
    }
    const up = upgradeData(parsed, current, upgrades);
    if (!up.ok) continue;
    const json = JSON.stringify(up.data);
    if (!valid(json)) return { status: 'blocked' };
    try {
      storage.setItem(keyOf(current), json);
      if (storage.getItem(keyOf(current)) !== json) return { status: 'blocked' };
    } catch {
      return { status: 'blocked' };
    }
    // 保存し直せたのを確かめてから古いものを消す。消せなくても、次からは今の名前を読むので害は無い
    try {
      storage.removeItem?.(keyOf(v));
    } catch {
      /* 残っても読まない */
    }
    return { status: 'ok', raw: json };
  }
  return { status: 'ok', raw: null };
}

/**
 * 今の名前に入っている文字列を今の版の形にする（サーバーの暗号文から戻した古い版の文字列など）。
 * 今の版ならそのまま返す（変えない）。壊れている・引き継げない版なら null
 */
export function upgradeJson(raw: string, current: number, upgrades: Upgrades): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const up = upgradeData(parsed, current, upgrades);
  if (!up.ok) return null;
  return up.from === current ? raw : JSON.stringify(up.data);
}
