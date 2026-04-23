/**
 * SEOHead — ページ別メタタグを宣言する共通コンポーネント
 *
 * React 19 のネイティブ metadata hoisting を使用（<title>・<meta>・<link> が
 * JSX 内に書かれていれば React が自動で <head> に hoisting する）。
 * react-helmet-async 等の外部ライブラリは不要。
 *
 * 使用例:
 *   <SEOHead
 *     title="資産運用シミュレーション｜入力3秒で到達年数がわかる"
 *     description="金額・期間・期待リターンを入力するだけ..."
 *     canonical="/tools/simulation"
 *     ogImage="/ogp/simulation.png"
 *   />
 */

type Props = {
  title: string
  description: string
  canonical?: string
  ogImage?: string
  noindex?: boolean
}

const ORIGIN = 'https://fire.largogk.jp'
const DEFAULT_OG_IMAGE = '/ogp/default.png'

export function SEOHead({
  title,
  description,
  canonical,
  ogImage,
  noindex,
}: Props) {
  const canonicalUrl = canonical ? `${ORIGIN}${canonical}` : undefined
  const ogImageUrl = `${ORIGIN}${ogImage ?? DEFAULT_OG_IMAGE}`

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      <meta property="og:site_name" content="fire.largogk.jp" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={ogImageUrl} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImageUrl} />
    </>
  )
}
