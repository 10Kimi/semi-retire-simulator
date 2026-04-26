import Layout from '../components/Layout'
import { SEOHead } from '../components/seo/SEOHead'
import MarkdownContent from '../components/MarkdownContent'
import aboutMd from '../content/legal/about.md?raw'

export default function AboutPage() {
  return (
    <>
      <SEOHead
        title="運営者について | お金の仕組み化"
        description="外資IT 20年・48歳でセミリタイアした運営者が、自分のリスク許容度に合わせた資産設計のための計算ツール群を提供しています。"
        canonical="/about"
      />
      <Layout>
        <main className="max-w-5xl mx-auto px-4 py-8 md:px-6 md:py-12">
          <MarkdownContent>{aboutMd}</MarkdownContent>
        </main>
      </Layout>
    </>
  )
}
