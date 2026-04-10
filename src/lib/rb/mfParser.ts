import * as XLSX from 'xlsx';

/** MFエクセルから解析した1銘柄の情報 */
export interface MfHolding {
  section: string;       // MFセクション名
  name: string;          // 銘柄名
  ticker: string;        // 銘柄コード/ティッカー（ない場合は空）
  amount: number;        // 評価額（円）
}

/** セクションヘッダーとして認識する文字列 */
const SECTION_MARKERS = ['預金・現金・暗号資産', '株式（現物）', '投資信託', '債券', '年金'];

/**
 * MFエクスポートExcelを解析して銘柄一覧を返す
 */
export function parseMfExcel(data: ArrayBuffer): MfHolding[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const holdings: MfHolding[] = [];
  let currentSection = '';
  let sectionTotal = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[0] ?? '').trim();

    // セクションヘッダーの検出
    const matchedSection = SECTION_MARKERS.find(s => firstCell === s);
    if (matchedSection) {
      currentSection = matchedSection;
      sectionTotal = 0;
      continue;
    }

    if (!currentSection) continue;

    // 合計行の検出（「合計：28,435,943円」形式）
    if (firstCell.startsWith('合計')) {
      sectionTotal = parseYenString(firstCell);
      // 預金は合計行のみで処理
      if (currentSection === '預金・現金・暗号資産' && sectionTotal > 0) {
        holdings.push({ section: currentSection, name: '預金・現金・暗号資産', ticker: '', amount: sectionTotal });
        currentSection = '';
      }
      continue;
    }

    // --- セクション別の個別行解析 ---

    if (currentSection === '株式（現物）') {
      const parsed = parseStockRow(row);
      if (parsed) holdings.push({ section: currentSection, ...parsed });
      continue;
    }

    if (currentSection === '投資信託') {
      const parsed = parseFundRow(row);
      if (parsed) holdings.push({ section: currentSection, ...parsed });
      continue;
    }

    if (currentSection === '債券') {
      const parsed = parseBondRow(row);
      if (parsed) holdings.push({ section: currentSection, ...parsed });
      continue;
    }

    if (currentSection === '年金') {
      const parsed = parsePensionRow(row);
      if (parsed) holdings.push({ section: currentSection, ...parsed });
      continue;
    }
  }

  return holdings;
}

/**
 * 株式（現物）の行を解析
 * 日本株: [銘柄コード(数値), 銘柄名, 数量, 取得単価, 現在値, 評価額, ...]
 * 米国株: [ティッカー(文字列), 銘柄名, 数量, 取得単価, 現在値, 評価額, ...]
 */
function parseStockRow(row: (string | number | null)[]): { name: string; ticker: string; amount: number } | null {
  if (row.length < 6) return null;

  const col0 = row[0];
  const col1 = row[1];

  // ヘッダー行やnull行をスキップ
  if (col0 == null || col1 == null) return null;
  const col0Str = String(col0).trim();
  if (!col0Str || col0Str === '変更' || col0Str === '削除') return null;

  // 銘柄コード（数値=日本株、文字列=米国株）
  const ticker = col0Str;
  const name = String(col1).trim();
  if (!name) return null;

  // 評価額は「円」付き文字列を探す（5番目のカラム付近）
  const amount = findYenAmount(row, 5);
  if (amount <= 0) return null;

  return { name, ticker, amount };
}

/**
 * 投資信託の行を解析
 * [ファンド名, 口数, 取得基準, 現在基準, 評価額, ...]
 */
function parseFundRow(row: (string | number | null)[]): { name: string; ticker: string; amount: number } | null {
  if (row.length < 5) return null;

  const col0 = row[0];
  if (col0 == null) return null;
  const name = String(col0).trim();
  if (!name || name === '変更' || name === '削除') return null;

  // 口数（2番目）が数値でなければヘッダー行
  if (typeof row[1] !== 'number') return null;

  const amount = findYenAmount(row, 4);
  if (amount <= 0) return null;

  return { name, ticker: '', amount };
}

/**
 * 債券の行を解析
 * [銘柄名, 評価額, 保有金融機関, ...]
 */
function parseBondRow(row: (string | number | null)[]): { name: string; ticker: string; amount: number } | null {
  if (row.length < 2) return null;

  const col0 = row[0];
  if (col0 == null) return null;
  const name = String(col0).trim();
  if (!name || name === '銘柄名') return null;

  const amount = findYenAmount(row, 1);
  if (amount <= 0) return null;

  return { name, ticker: '', amount };
}

/**
 * 年金の行を解析
 * [名称, 取得価額, 現在価値, 評価損益, ...]
 */
function parsePensionRow(row: (string | number | null)[]): { name: string; ticker: string; amount: number } | null {
  if (row.length < 3) return null;

  const col0 = row[0];
  if (col0 == null) return null;
  const name = String(col0).trim();
  if (!name || name === '名称') return null;

  // 現在価値（3番目のカラム）
  const amount = findYenAmount(row, 2);
  if (amount <= 0) return null;

  return { name, ticker: '', amount };
}

/** 「1,234,567円」形式の文字列から数値を抽出 */
function parseYenString(s: string): number {
  const match = s.match(/[\d,]+/);
  if (!match) return 0;
  return parseInt(match[0].replace(/,/g, ''), 10) || 0;
}

/** row[startIdx]以降から「○○円」形式の値を探す */
function findYenAmount(row: (string | number | null)[], startIdx: number): number {
  for (let i = startIdx; i < row.length; i++) {
    const cell = row[i];
    if (cell == null) continue;
    const s = String(cell);
    if (s.includes('円')) {
      // マイナス付き「-78,546円」にも対応
      const cleaned = s.replace(/[^0-9,-]/g, '');
      const num = parseInt(cleaned.replace(/,/g, ''), 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return 0;
}
