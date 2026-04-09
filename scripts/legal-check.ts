/**
 * 法的禁止表現チェッカー
 *
 * UIテキスト・コード内の「提案」「推奨」等の表現を検出する。
 * 設計原則: 全ツールは「計算結果の表示」として設計し、
 * 「提案」「推奨」は使わず「モデル配分」「計算結果」に統一する。
 */

import fs from 'fs';
import path from 'path';

const PROHIBITED_PATTERNS = [
  /提案/,
  /推奨/,
  /お勧め/,
  /おすすめ/,
  /アドバイス/,
  /\brecommend\b/i,
  /\bsuggest\b/i,
  /\badvise\b/i,
];

const TARGET_EXTENSIONS = new Set(['.tsx', '.ts', '.md']);

// このスクリプト自身とテストファイル、スキル定義は除外
const EXCLUDE_PATTERNS = [
  'scripts/legal-check.ts',
  '.claude/skills/',
  'node_modules/',
  '.test.ts',
];

interface Violation {
  file: string;
  line: number;
  text: string;
  match: string;
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...collectFiles(fullPath));
    } else if (TARGET_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

function checkFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of PROHIBITED_PATTERNS) {
      const m = line.match(pattern);
      if (m) {
        violations.push({
          file: filePath,
          line: i + 1,
          text: line.trim(),
          match: m[0],
        });
        break; // 1行につき1検出で十分
      }
    }
  }

  return violations;
}

function isExcluded(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some(p => filePath.includes(p));
}

// --- main ---

const projectRoot = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(projectRoot, 'src');

if (!fs.existsSync(srcDir)) {
  console.error(`ERROR: src/ ディレクトリが見つかりません: ${srcDir}`);
  process.exit(2);
}

const files = collectFiles(srcDir).filter(f => !isExcluded(f));
const allViolations: Violation[] = [];

for (const file of files) {
  allViolations.push(...checkFile(file));
}

if (allViolations.length === 0) {
  console.log('OK: 法的禁止表現は検出されませんでした');
  process.exit(0);
} else {
  console.error(`NG: ${allViolations.length} 件の法的禁止表現を検出しました\n`);
  for (const v of allViolations) {
    const relPath = path.relative(projectRoot, v.file);
    console.error(`  ${relPath}:${v.line}  [${v.match}]`);
    console.error(`    ${v.text}\n`);
  }
  console.error('置き換え候補: 「計算結果」「モデル配分」「参考値」');
  process.exit(1);
}
