import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import MarkdownContent from '../components/MarkdownContent'
import { SEOHead } from '../components/seo/SEOHead'
import termsText from '../content/terms.md?raw'

export default function TermsPage() {
  return (
    <>
      <SEOHead
        title="利用規約 | ウェルスプログラム"
        description="ウェルスプログラムの利用規約です。"
        canonical="/terms"
        noindex
      />
      <Layout>
        <main className="py-12 md:py-16">
          <div className="max-w-3xl mx-auto px-4 md:px-6">
            <MarkdownContent>{termsText}</MarkdownContent>
            <p className="mt-10 text-sm">
              <Link to="/apply" className="text-blue-700 underline">
                お申し込みのページへ戻る
              </Link>
            </p>
          </div>
        </main>
      </Layout>
    </>
  )
}
