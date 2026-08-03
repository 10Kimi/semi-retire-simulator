/**
 * 招待コード生成スクリプト
 *
 * 使い方:
 *   npx tsx scripts/generate-invite-code.ts
 *   npx tsx scripts/generate-invite-code.ts --count 5
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// scripts/market/.env を手動パース
const envPath = resolve(import.meta.dirname, 'market/.env');
const envContent = readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY が scripts/market/.env にありません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
}

async function main() {
  const args = process.argv.slice(2);
  const countIdx = args.indexOf('--count');
  const count = countIdx >= 0 ? parseInt(args[countIdx + 1], 10) || 1 : 1;

  const codes = [];

  for (let i = 0; i < count; i++) {
    const code = generateCode();
    const { data, error } = await supabase
      .from('invite_codes')
      .insert({ code, is_used: false })
      .select('code')
      .single();

    if (error) {
      console.error(`エラー: ${error.message}`);
      process.exit(1);
    }
    codes.push(data.code);
  }

  console.log(`\n✅ 招待コード ${count}件 生成完了\n`);
  for (const c of codes) {
    console.log(`  ${c}`);
  }
  console.log('');
}

main();
