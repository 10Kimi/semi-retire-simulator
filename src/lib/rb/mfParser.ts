import type { Holdings } from './types';

/** マネーフォワードの「資産」ページのテキストから読んだ1銘柄の情報 */
export interface MfHolding {
  section: string;       // 区分名（allocateHoldings が読む表記）
  name: string;          // 銘柄名
  ticker: string;        // 銘柄コード/ティッカー（ない場合は空）
  amount: number;        // 評価額（円）
}

interface SectionColumns {
  section: string;         // MfHolding.section に入れる表記
  nameCol: number;
  amountCol: number;
  tickerCol: number | null;
  merge: boolean;          // 同じ銘柄の行を合算するか（預金は合算しない）
}

/** 区分ごとの列の位置（0 始まり）。キーは見出しを norm した表記 */
const SECTIONS: Record<string, SectionColumns> = {
  '預金・現金': { section: '預金・現金・暗号資産', nameCol: 0, amountCol: 1, tickerCol: null, merge: false },
  '預金・現金・暗号資産': { section: '預金・現金・暗号資産', nameCol: 0, amountCol: 1, tickerCol: null, merge: false },
  '株式(現物)': { section: '株式（現物）', nameCol: 1, amountCol: 5, tickerCol: 0, merge: true },
  '投資信託': { section: '投資信託', nameCol: 0, amountCol: 4, tickerCol: null, merge: true },
  '債券': { section: '債券', nameCol: 0, amountCol: 1, tickerCol: null, merge: true },
  '年金': { section: '年金', nameCol: 0, amountCol: 2, tickerCol: null, merge: true },
};

/** 読まない区分 */
const SKIP_SECTIONS = new Set(['ポイント']);

/** 区分の合計と読んだ合計のずれの許容差（外国株の円換算の端数のぶん） */
const TOTAL_TOLERANCE_YEN = 1000;

const AMOUNT = /^-?[\d,]+(\.\d+)?円$/;

/** 照合用：NFKC で揃え、前後の空白を除く。表示には使わない */
function norm(s: string): string {
  return s.normalize('NFKC').trim();
}

/** `1,234円` → 1234。読めない（`-` など）なら null */
function parseAmount(cell: string): number | null {
  const s = cell.trim();
  if (!AMOUNT.test(s)) return null;
  return Number(s.slice(0, -1).replace(/,/g, ''));
}

function yen(n: number): string {
  return `${Math.round(n).toLocaleString('ja-JP')}円`;
}

/**
 * 「資産」ページのテキストを読んで銘柄一覧を返す。
 * 区分の見出しは「次の行が `合計：` で始まる行」。列の位置に金額が読めない行は読み飛ばす。
 * 冒頭の「資産の内訳」は見出しではなく、本文に無い区分の確認だけに使う
 */
export function parseMfText(text: string): { holdings: MfHolding[]; warnings: string[] } {
  const lines = text.split(/\r\n|\r|\n/);
  const rows: MfHolding[] = [];
  const merged = new Map<string, MfHolding>();
  const seen = new Set<string>();
  const seenSections = new Set<string>(); // 表記をそろえた区分（預金は見出しが2通りある）
  const totals: { label: string; stated: number | null; read: number }[] = [];
  const unknown: string[] = [];
  const duplicates: string[] = [];
  const breakdown: string[] = [];

  let current: SectionColumns | null = null;
  let currentTotal: { read: number } | null = null;
  let inBreakdown = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = norm(lines[i + 1] ?? '');

    if (norm(line) === '資産の内訳') {
      inBreakdown = true;
      continue;
    }
    if (inBreakdown) {
      const cells = line.split('\t');
      if (cells.length >= 3 && cells[cells.length - 1].trim().endsWith('%')) {
        breakdown.push(cells[0].trim());
        continue;
      }
      inBreakdown = false;
    }

    if (!line.trim().includes('\t') && next.startsWith('合計:')) {
      const label = line.trim();
      const n = norm(line);
      current = null;
      currentTotal = null;
      if (seen.has(n)) {
        duplicates.push(label); // 2回目の区分は読まない（二重計上を防ぐ）
      } else {
        seen.add(n);
        if (SECTIONS[n]) seenSections.add(SECTIONS[n].section);
        if (n in SECTIONS) {
          current = SECTIONS[n];
          const total = { label, stated: parseAmount(next.slice('合計:'.length)), read: 0 };
          totals.push(total);
          currentTotal = total;
        } else if (!SKIP_SECTIONS.has(n)) {
          unknown.push(label);
        }
      }
      i++;
      continue;
    }

    if (!current || !currentTotal) continue;

    const cells = line.split('\t');
    const amount = current.amountCol < cells.length ? parseAmount(cells[current.amountCol]) : null;
    if (amount === null) continue; // 列名の行・広告の行

    currentTotal.read += amount;

    const name = (cells[current.nameCol] ?? '').trim();
    const ticker = current.tickerCol === null ? '' : (cells[current.tickerCol] ?? '').trim();
    const key = current.merge ? `${current.section}\t${norm(ticker || name)}` : null;
    const existing = key ? merged.get(key) : undefined;
    if (existing) {
      existing.amount += amount;
    } else {
      const holding = { section: current.section, name, ticker, amount };
      rows.push(holding);
      if (key) merged.set(key, holding);
    }
  }

  const warnings: string[] = [];
  for (const { label, stated, read } of totals) {
    if (stated === null) {
      warnings.push(`${label}：合計の金額を読めず、照合できませんでした`);
    } else if (Math.abs(stated - read) > TOTAL_TOLERANCE_YEN) {
      warnings.push(`${label}：ページの合計 ${yen(stated)} と読み取った合計 ${yen(read)} がずれています`);
    }
  }
  for (const label of unknown) {
    warnings.push(`未対応の区分「${label}」は読み飛ばしました（金額は保有額に入りません）`);
  }
  for (const label of duplicates) {
    warnings.push(`区分「${label}」が2回あります。2回目は読み飛ばしました`);
  }
  for (const label of breakdown) {
    const n = norm(label);
    const inBody = seen.has(n) || (SECTIONS[n] && seenSections.has(SECTIONS[n].section));
    if (!inBody && !SKIP_SECTIONS.has(n)) {
      warnings.push(`区分「${label}」が本文にありません（金額は保有額に入りません）。ページの全体をコピーしたか確かめてください`);
    }
  }

  const holdings = rows
    .map(h => ({ ...h, amount: Math.round(h.amount) }))
    .filter(h => h.amount !== 0);

  return { holdings, warnings };
}

/** 資産クラスの合計がマイナスなら 0 にそろえる。0 にしたクラスのキーも返す */
export function clampNegativeHoldings(summary: Holdings): { holdings: Holdings; clamped: string[] } {
  const holdings: Holdings = { ...summary };
  const clamped: string[] = [];
  for (const key of Object.keys(holdings)) {
    if (holdings[key] < 0) {
      holdings[key] = 0;
      clamped.push(key);
    }
  }
  return { holdings, clamped };
}
