import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { SEOHead } from '../components/seo/SEOHead'

// 申し込みの前の同意のページ（#146）。
// 「次へ」の先は Stripe Checkout ができるまで仮（別の cc-task）。
// 同意の記録は Stripe の consent_collection.terms_of_service に任せる（DB には持たない）。
export default function ApplyPage() {
  const [agreed, setAgreed] = useState(false)
  const [proceeded, setProceeded] = useState(false)

  return (
    <>
      <SEOHead
        title="お申し込みの前に | ウェルスプログラム"
        description="ウェルスプログラムのお申し込みの前に、利用規約の要点をご確認ください。"
        canonical="/apply"
        noindex
      />
      <Layout>
        <main className="py-12 md:py-16">
          <div className="max-w-3xl mx-auto px-4 md:px-6 space-y-6 text-gray-800">
            <h1 className="text-2xl md:text-3xl font-bold">お申し込みの前に</h1>
            <p className="leading-relaxed">
              お支払いの前に、利用規約の要点をご確認ください。同意いただいた方だけ、お支払いの画面に進めます。
            </p>

            <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
              <h2 className="text-lg font-bold">要点</h2>
              <ul className="list-disc pl-6 space-y-3 text-sm md:text-base leading-relaxed">
                <li>
                  <strong>返金：</strong>
                  デジタルの商品で、お支払いと同時にご利用いただけるため、お支払いのあとの返金・申込みの撤回（クーリング・オフを含む）はお受けしません。
                  ただし、当社の事情でご提供できなかったとき、二重にお支払いいただいたときは返金します。
                </li>
                <li>
                  <strong>提供期間・提供時期：</strong>
                  提供の開始は 2027年2月1日です。ご利用いただける期間は、利用規約 第5条のとおりです。
                </li>
                <li>
                  <strong>投資助言ではありません：</strong>
                  本サービスは、お金の仕組みを考えるための教育と、計算結果の表示です。特定の金融商品を勧めたり、個別の投資の助言を行うものではありません。投資の判断と結果は、ご自身が責任を負います。
                </li>
                <li>
                  <strong>アカウントの共有・転載の禁止：</strong>
                  アカウントの共有・譲渡と、動画・ツール・資料の無断転載はできません。
                </li>
              </ul>
              <p className="text-sm">
                全文は
                <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline mx-1">
                  利用規約（別のタブで開きます）
                </Link>
                でご覧いただけます。
              </p>
            </section>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked)
                  if (!e.target.checked) setProceeded(false)
                }}
              />
              <span className="text-sm md:text-base">利用規約に同意する</span>
            </label>

            <button
              type="button"
              disabled={!agreed}
              onClick={() => setProceeded(true)}
              className="w-full md:w-auto px-8 py-3 rounded-md font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              次へ（お支払いへ）
            </button>

            {proceeded && (
              <p role="status" className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm">
                （仮の行き先）お支払いの画面は準備中です。ここから Stripe Checkout に進む予定です。
              </p>
            )}
          </div>
        </main>
      </Layout>
    </>
  )
}
