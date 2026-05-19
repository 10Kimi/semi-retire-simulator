#!/usr/bin/env tsx
/**
 * Prerender script — ビルド後に Puppeteer で各公開ルートの HTML を生成
 *
 * 背景:
 *   React Router v7 は Declarative Mode で使用しているため、
 *   Framework Mode 専用の prerender 機能は使えない。
 *   代わりに Puppeteer で実ブラウザ描画して静的HTMLを生成する。
 *   Framework Mode 移行時（Phase 3 後半〜4）にこのスクリプトは削除予定。
 *
 * 実行順:
 *   1. dist/ を Node HTTP サーバで静的配信（SPA リライト付き）
 *   2. Puppeteer 起動、各ルートを並列描画
 *   3. 描画結果のHTMLを dist/<route>/index.html として書き出し
 *   4. Vercel 配信時、静的ファイル優先ルールにより prerender 済みHTMLが返る
 *
 * 拡張:
 *   PRERENDER_ROUTES に追加するだけで対象ルートが増える。
 *   認証ゲートのかかったルート（/, /pf 等）は prerender 対象外（AuthGate が焼き付くため）。
 */

import puppeteerCore from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import http from 'node:http'
import handler from 'serve-handler'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import pLimit from 'p-limit'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DIST_DIR = path.resolve(__dirname, '..', 'dist')
const PORT = 4173
const CONCURRENCY = 3
const TIMEOUT_MS = 30_000

/**
 * Prerender 対象ルート一覧
 *
 * Commit 1: /risk のみ（既存の公開ルート）
 * Commit 3: /about, /privacy, /tokushoho を追加
 * Commit 4: /tools, /tools/simulation, /tools/age/50s, /tools/retirement を追加
 *
 * 認証ゲートがかかるルート（/, /pf, /ma, /rb, /portfolio）は除外。
 * prerender 時は未ログイン状態になり AuthGate が HTML に焼き付いてしまうため。
 */
const PRERENDER_ROUTES: string[] = [
  '/risk',
  '/about',
  '/tools',
  '/tools/risk',
  '/tools/retirement-simulation',
  '/tools/age50s',
  '/tools/retirement',
]

type PrerenderResult =
  | { route: string; status: 'ok'; outPath: string }
  | { route: string; status: 'error'; error: string }

async function prerenderRoute(
  browser: puppeteerCore.Browser,
  route: string,
): Promise<PrerenderResult> {
  const page = await browser.newPage()
  try {
    const url = `http://localhost:${PORT}${route}`
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: TIMEOUT_MS,
    })

    // React 19 のメタタグ hoisting が完了するまで少し待つ
    await page.waitForFunction(() => document.title !== '', { timeout: 5_000 }).catch(() => {
      // タイトル設定されなくても続行（static title が残る）
    })

    const html = await page.content()

    // ルート文字列からディレクトリ構造を作る: /tools/simulation → dist/tools/simulation/index.html
    const normalizedRoute = route.replace(/^\//, '').replace(/\/$/, '')
    const outDir = normalizedRoute
      ? path.join(DIST_DIR, normalizedRoute)
      : DIST_DIR
    const outPath = path.join(outDir, 'index.html')
    await fs.mkdir(outDir, { recursive: true })
    await fs.writeFile(outPath, html, 'utf-8')

    return { route, status: 'ok', outPath: path.relative(DIST_DIR, outPath) }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { route, status: 'error', error: message }
  } finally {
    await page.close().catch(() => {})
  }
}

async function main(): Promise<void> {
  if (PRERENDER_ROUTES.length === 0) {
    console.log('[prerender] no routes configured, skipping')
    return
  }

  console.log(
    `[prerender] start: ${PRERENDER_ROUTES.length} routes, concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms`,
  )

  // dist/ が存在するか確認
  try {
    await fs.access(DIST_DIR)
  } catch {
    console.error(`[prerender] ERROR: ${DIST_DIR} not found. Run 'vite build' first.`)
    process.exit(1)
  }

  // 1. 静的配信サーバ起動（SPA リライト: 未prerenderルートは index.html にフォールバック）
  const server = http.createServer((req, res) => {
    // @ts-expect-error serve-handler の型が古いため IncomingMessage / ServerResponse の型が合わない
    handler(req, res, {
      public: DIST_DIR,
      rewrites: [{ source: '**', destination: '/index.html' }],
    })
  })
  await new Promise<void>((resolve) => server.listen(PORT, resolve))
  console.log(`[prerender] static server listening on http://localhost:${PORT}`)

  // 2. Puppeteer 起動
  // Vercel/Lambda 環境: @sparticuz/chromium の Linux バイナリ + Lambda 向け args
  // ローカル(macOS/Linux): インストール済みの Google Chrome + 最小限の args
  // (sparticuz の args には --single-process 等が含まれており、デスクトップ Chrome に
  //  渡すと即クラッシュするため、ローカルでは args/headless も切り替える)
  const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME
  const localChromePath =
    process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : '/usr/bin/google-chrome'
  const browser = await puppeteerCore.launch({
    args: isVercel ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: isVercel
      ? await chromium.executablePath()
      : localChromePath,
    headless: isVercel ? chromium.headless : true,
  })

  // 3. 並列 prerender
  const limit = pLimit(CONCURRENCY)
  const results = await Promise.all(
    PRERENDER_ROUTES.map((route) => limit(() => prerenderRoute(browser, route))),
  )

  // 4. 後片付け
  await browser.close()
  server.close()

  // 5. 結果集計
  const ok = results.filter((r): r is Extract<PrerenderResult, { status: 'ok' }> => r.status === 'ok')
  const failed = results.filter(
    (r): r is Extract<PrerenderResult, { status: 'error' }> => r.status === 'error',
  )

  for (const r of ok) console.log(`  ✓ ${r.route} → ${r.outPath}`)
  for (const r of failed) console.error(`  ✗ ${r.route}: ${r.error}`)

  if (failed.length > 0) {
    console.error(`\n[prerender] ${failed.length}/${PRERENDER_ROUTES.length} routes failed`)
    process.exit(1)
  }

  console.log(`\n[prerender] ✅ all ${PRERENDER_ROUTES.length} routes prerendered\n`)
}

main().catch((err) => {
  console.error('[prerender] fatal:', err)
  process.exit(1)
})
