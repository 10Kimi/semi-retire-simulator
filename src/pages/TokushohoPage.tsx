import Layout from '../components/Layout'
import { SEOHead } from '../components/seo/SEOHead'
import MarkdownContent from '../components/MarkdownContent'
import tokushohoMd from '../content/legal/tokushoho.md?raw'

export default function TokushohoPage() {
  return (
    <>
      <SEOHead
        title="特定商取引法に基づく表記 | お金の仕組み化"
        description="合同会社ラルゴが運営する fire.largogk.jp の特定商取引法に基づく表記。事業者情報・連絡先等。"
        canonical="/tokushoho"
      />
      <Layout>
        <main className="max-w-5xl mx-auto px-4 py-8 md:px-6 md:py-12">
          <MarkdownContent>{tokushohoMd}</MarkdownContent>
        </main>
      </Layout>
    </>
  )
}
