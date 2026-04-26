import Layout from '../components/Layout'
import { SEOHead } from '../components/seo/SEOHead'
import MarkdownContent from '../components/MarkdownContent'
import privacyMd from '../content/legal/privacy.md?raw'

export default function PrivacyPage() {
  return (
    <>
      <SEOHead
        title="プライバシーポリシー | お金の仕組み化"
        description="本サービスで取得する情報の種類と取り扱い方針。匿名性、業務委託先について明記。"
        canonical="/privacy"
      />
      <Layout>
        <main className="max-w-5xl mx-auto px-4 py-8 md:px-6 md:py-12">
          <MarkdownContent>{privacyMd}</MarkdownContent>
        </main>
      </Layout>
    </>
  )
}
