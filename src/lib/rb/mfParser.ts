import * as XLSX from 'xlsx';

/** MFエクセルから解析した1銘柄の情報 */
export interface MfHolding {
  section: string;       // MFセクション名（株式（現物）, 投資信託, 預金・現金・暗号資産, 債券, 年金）
  name: string;          // 銘柄名
  ticker: string;        // 銘柄コード/ティッカー（ない場合は空）
  amount: number;        // 評価額（円）
}

/** MFエクセルのセクションヘッダーパターン */
const SECTION_HEADERS = [
  '株式（現物）',
  '投資信託',
  '預金・現金・暗号資産',
  '債券',
  '年金',
];

/** セクションの合計行パターン */
const SUMMARY_SECTIONS = new Set(['預金・現金・暗号資産', '債券', '年金']);

/**
 * MFエクスポートExcelを解析して銘柄一覧を返す
 */
export function parseMfExcel(data: ArrayBuffer): MfHolding[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const holdings: MfHolding[] = [];
  let currentSection = '';
  let headerRow: (string | number | null)[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[0] ?? '').trim();

    // セクションヘッダーの検出
    const matchedSection = SECTION_HEADERS.find(s => firstCell.includes(s));
    if (matchedSection) {
      currentSection = matchedSection;
      headerRow = [];
      continue;
    }

    if (!currentSection) continue;

    // ヘッダー行の検出（「銘柄名」「保有金額」等を含む行）
    if (hasHeaderKeyword(row)) {
      headerRow = row;
      continue;
    }

    // 合計セクション（預金・債券・年金）: 合計行を探す
    if (SUMMARY_SECTIONS.has(currentSection)) {
      if (firstCell === '合計' || firstCell.includes('合計')) {
        const amount = findAmount(row);
        if (amount > 0) {
          holdings.push({
            section: currentSection,
            name: currentSection,
            ticker: '',
            amount,
          });
        }
        currentSection = ''; // セクション終了
      }
      continue;
    }

    // 株式（現物）・投資信託: 個別銘柄行を解析
    if (headerRow.length === 0) continue;
    if (firstCell === '合計' || firstCell.includes('合計')) {
      currentSection = ''; // セクション終了
      continue;
    }

    const parsed = parseHoldingRow(row, headerRow, currentSection);
    if (parsed && parsed.amount > 0) {
      holdings.push(parsed);
    }
  }

  return holdings;
}

function hasHeaderKeyword(row: (string | number | null)[]): boolean {
  const text = row.map(c => String(c ?? '')).join('');
  return text.includes('銘柄名') || text.includes('銘柄コード') || text.includes('保有金額') || text.includes('評価額');
}

function parseHoldingRow(
  row: (string | number | null)[],
  headerRow: (string | number | null)[],
  section: string,
): MfHolding | null {
  const colIndex = (keyword: string) =>
    headerRow.findIndex(h => String(h ?? '').includes(keyword));

  const nameIdx = colIndex('銘柄名');
  const tickerIdx = colIndex('銘柄コード') !== -1 ? colIndex('銘柄コード') : colIndex('ティッカー');
  const amountIdx = colIndex('評価額') !== -1 ? colIndex('評価額') : colIndex('保有金額');

  if (nameIdx === -1 || amountIdx === -1) return null;

  const name = String(row[nameIdx] ?? '').trim();
  if (!name) return null;

  const ticker = tickerIdx !== -1 ? String(row[tickerIdx] ?? '').trim() : '';
  const amount = parseNumber(row[amountIdx]);

  return { section, name, ticker, amount };
}

function findAmount(row: (string | number | null)[]): number {
  // 合計行の数値セルを探す（最も大きい数値を採用）
  let maxAmount = 0;
  for (const cell of row) {
    const num = parseNumber(cell);
    if (num > maxAmount) maxAmount = num;
  }
  return maxAmount;
}

function parseNumber(cell: string | number | null | undefined): number {
  if (cell == null) return 0;
  if (typeof cell === 'number') return Math.round(cell);
  const cleaned = String(cell).replace(/[,，円¥\s]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}
