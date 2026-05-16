-- ============================================================
-- fund_master 年金セクション 2 銘柄 seed
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
--
-- 背景:
--   2026-05-16 のリバランス計算で年金セクション(R94-R95)の 2 銘柄が
--   「未分類」で残った。029 で日本個別株 16 銘柄を seed したのに続き、
--   年金 2 銘柄も自動振り分け対応する。
--
--   parsePensionRow (mfParser.ts:154-167) は { name, ticker: '' } を返す
--   (ticker は空文字列固定)。allocator.ts:45-49 の照合ロジックは
--   `fm.ticker === h.name` を第 1 段で使うため、fund_master の ticker
--   カラムに「MF Excel の col0 完全一致文字列」を入れる必要がある。
--   既存投信パターン (013 seed の eMAXIS / ニッセイ等) と同じ規約。
--
--   ticker = MF col0 そのまま(照合キー)、fund_name = 表示用短縮版。
--
-- 設計書: Docs/migration_028_029_plan.md(同シリーズ、共通方針)
-- ============================================================

INSERT INTO fund_master (ticker, fund_name, asset_class, ratio) VALUES
  (
    'iFree NYダウ・インデックス(iFree NYダウ・インデックス)',
    'iFree NYダウ・インデックス',
    'us_equity',
    1.0
  ),
  (
    '農林中金<パートナーズ>長期厳選投資 おおぶね(農林中金(パートナーズ)長期厳選投資 おおぶね)',
    '農林中金<パートナーズ>長期厳選投資 おおぶね',
    'us_equity',
    1.0
  );
