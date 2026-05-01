import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { SEOHead } from '../../components/seo/SEOHead'

export default function RetirementSimulationLPPage() {
  const [showPopup, setShowPopup] = useState(false)
  const [popupDismissed, setPopupDismissed] = useState(false)

  useEffect(() => {
    if (popupDismissed) return

    const handleScroll = () => {
      const scrolled = window.scrollY
      const total = document.documentElement.scrollHeight - window.innerHeight
      if (total > 0 && scrolled / total > 0.7) {
        setShowPopup(true)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [popupDismissed])

  const handleDismiss = () => {
    setShowPopup(false)
    setPopupDismissed(true)
  }

  return (
    <>
      <SEOHead
        title="老後資産シミュレーション｜リスク許容度から考える設計の出発点 - お金の仕組み化プログラム"
        description="老後資産のシミュレーションをして「いくら必要か」が見えたら、次は「どう届かせるか」。その逆算で見落とされやすい観点があります。実は、リスク許容度から考えるのが、老後資産設計の正しい順序。"
        canonical="/tools/retirement-simulation"
      />
      <Layout>
        {/* §1 ヒーロー (背景画像 + 黒オーバーレイ) */}
        <section
          className="relative min-h-screen flex flex-col justify-center"
          style={{
            backgroundImage: 'url(/images/hero-izu.jpeg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 max-w-3xl mx-auto px-6 py-32 text-white">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-6">
              老後資産の設計、何から始めていますか?
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mb-2">
              「いくら必要か」が見えたら、次は「どう届かせるか」。
            </p>
            <p className="text-xl md:text-2xl text-white/80 mt-4">
              そこで、よく見落とされる観点がある。
            </p>
          </div>
        </section>

        {/* §2 巷の議論 (white) */}
        <section className="bg-white pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              「いくら必要か」から逆算される世界
            </h2>

            <p className="leading-loose">
              老後資産の話は、たいてい「リタイア後に死ぬまでいくら必要か」から始まる。
            </p>

            <p className="leading-loose">
              雑誌でもネットでも、よく目にするのはこういう議論。
            </p>

            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li>2,000万円問題</li>
              <li>3,000万円必要説</li>
              <li>4,000万円ないと足りない論</li>
            </ul>

            <p className="leading-loose">
              まず必要額を提示して、そこから「だから利回り○%で運用しましょう」「毎月○万円積み立てましょう」と逆算する流れが主流になっている。
            </p>

            <p className="leading-loose">
              それは間違いではない。目標金額があると、設計の出発点が決まる。逆算の対象が明確になる。
            </p>

            <p className="leading-loose">
              ただ、その逆算の中で、<span className="bg-yellow-200 px-1 rounded">ひとつ抜けている観点がある</span>。
            </p>
          </div>
        </section>

        {/* §3 許容度の範囲 (gray-50) */}
        <section className="bg-gray-50 pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              でも、その利回り、自分の許容度の範囲内か
            </h2>

            <p className="leading-loose">
              「3,000万円を20年で作るには、年利5%で運用しましょう」と提示されたとき、その「年利5%」は、自分のリスク許容度の範囲内なのだろうか。
            </p>

            <p className="leading-loose">
              年利5%を期待するということは、それなりに株式比率の高いポートフォリオを組むことになる。当然、年によっては大きく下落する局面も来る。リーマンショック級の暴落なら、運用資産が一時的に半分近くまで落ち込む可能性もある。
            </p>

            <p className="leading-loose">そのとき、自分は耐えられるのか。</p>

            <p className="leading-loose">
              「耐えられる」というのは、精神論ではない。下落を見て狼狽売りせずに、そのまま運用を続けられるか、という具体的な行動の話。
            </p>

            <p className="leading-loose">
              もし運用資産が半分になっても、若い人なら時間があるから取り返せる。でも、<span className="bg-yellow-200 px-1 rounded">中高年にはその時間がない</span>。後になって後悔しても、どうしようもない。ある意味、人生を賭けて構築してきた資産を失うことになる。だからこそ、慎重に吟味すべきだと考えている。
            </p>

            <p className="leading-loose">
              ここを問わずに「年利5%で運用」と決めてしまうと、ある日、それまで積み上げてきた数千万円が大きく目減りする画面を前に、自分が冷静でいられる保証はどこにもない。シミュレーターの上で美しく描かれた右肩上がりのグラフは、その瞬間、<span className="underline decoration-blue-400 decoration-2 underline-offset-4">何の意味も持たなくなる</span>。
            </p>
          </div>
        </section>

        {/* §4 設計は自由 (white) */}
        <section className="bg-white pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              許容度の中なら、設計は自由
            </h2>

            <p className="leading-loose">
              リスク許容度というのは、「ここまでなら耐えられる」という範囲のこと。
            </p>

            <p className="leading-loose">
              たとえば目的地まで行く手段に、飛行機・新幹線・特急があるとする。本当は飛行機で行ける人が、新幹線や特急を選ぶのは、それはそれでいい。時間はかかるけど、確実に着く。本人がそれで納得しているなら、何の問題もない。
            </p>

            <p className="leading-loose">ただ、ここで違いが出るのは次の点。</p>

            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li>自分が飛行機にも乗れることを「知った上で」新幹線を選んでいるのか</li>
              <li>飛行機という選択肢を知らずに、何となく新幹線にしているのか</li>
            </ul>

            <p className="leading-loose">
              リスク許容度を低く見積もっていると、本来取れるはずのリスクを取らずに、想定よりも控えめな運用をすることになる。それで本人が納得しているなら、それでいい。でも、選択肢の存在そのものを知らないまま、保守的に寄せているとしたら、それは「選んでいる」のではなく「狭めている」。
            </p>

            <div className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8">
              <p className="text-xl font-medium text-blue-900">
                何が正しいかではなく、自分が納得して選べているかどうか。許容度の範囲内であれば、攻めるのも守るのも、自由でいい。
              </p>
            </div>
          </div>
        </section>

        {/* §5 設計は崩れる (gray-50) */}
        <section className="bg-gray-50 pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              許容度を超えると、設計は崩れる
            </h2>

            <p className="leading-loose">
              逆に、リスク許容度を超えて取っている場合は、話の構造が違ってくる。
            </p>

            <p className="leading-loose">
              街中をフェラーリで時速200キロで走る人がいるとする。確かに、事故に遭わなければ、想定外のことに巻き込まれなければ、目的地には予定通り着く。それも一応、計算の上では成立する。
            </p>

            <p className="leading-loose">でもそれは、楽観でしかない。</p>

            <p className="leading-loose">
              リスク許容度を超えた運用には、いくつかのパターンがある。
            </p>

            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li>リスク許容度を超えて株式比率を高く取っている</li>
              <li>信用取引でレバレッジを効かせている</li>
              <li>FXやビットコインなど、投機性の高い対象に集中している</li>
            </ul>

            <p className="leading-loose">
              こういう状態で暴落が来ると、耐えられない。慌てて売却する。その瞬間、長期運用の前提は崩れる。シミュレーターの上で「年利7%で30年運用」と計画していても、途中で売ってしまえば、その数字は絵に描いた餅で終わる。
            </p>

            <p className="leading-loose">
              ここで重要なのは、「自分は意志が強いから大丈夫」という発想は、ほぼ通用しないということ。
            </p>

            <p className="leading-loose">
              ほとんどの人は、暴落の現場でパニックになる。感情で負ける。<span className="bg-yellow-200 px-1 rounded">本能の欲求は、理性ではコントロールできないほど強い</span>。これは個人の精神論の問題ではなく、人間の構造的な性質の話。だから、自分の意志を過信しない方がいい。
            </p>

            <p className="leading-loose">
              範囲を超えた設計は、構造的に成立しない。「自分が納得しているなら自由」の話ではない。
            </p>

            <div className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8">
              <p className="text-xl font-medium text-blue-900">
                大人の判断としては、許容度を超えた設計はNG。これは選択肢として成立しないラインだと考えている。
              </p>
            </div>
          </div>
        </section>

        {/* §6 目標に届かない場合 (white) */}
        <section className="bg-white pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              許容度の範囲内で目標に届かない場合
            </h2>

            <p className="leading-loose">
              ここまでの話で、自分のリスク許容度の範囲内で運用すべきだ、ということは見えてきた。
            </p>

            <p className="leading-loose">
              では、その範囲内で運用したときに、目標金額に届かないとしたら、どうするのか。
            </p>

            <p className="leading-loose">ここが、見落とされやすいポイント。</p>

            <p className="leading-loose">
              金融資産の運用だけで目標に届かないなら、金融資産以外の選択肢を模索する必要がある。考えられる選択肢は次のようなもの。
            </p>

            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li>収入を増やす</li>
              <li>支出を見直す</li>
              <li>目標金額そのものを再検討する</li>
              <li>リタイア時期を後ろにずらす</li>
              <li>不動産や事業など、別の手段を検討する</li>
            </ul>

            <p className="leading-loose">
              選択肢はいくつもある。でも、これを金融資産の運用だけで何とかしようとすると、リスク許容度を超えた運用に踏み込まざるを得なくなる。それは先ほどのフェラーリの話と同じで、構造的に成立しない。
            </p>

            <p className="leading-loose">
              資産形成は、収入・支出・運用の3つの要素で決まる。運用だけで目標を埋めようとするのは、最初から無理筋になっているケースがある。
            </p>

            <p className="leading-loose">
              このサイトでは、資産形成を以下の式で捉えている。
            </p>

            <div className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8">
              <p className="text-xl font-medium text-blue-900 text-center">
                富 = 収入 − 支出 + (資産 × 利回り)
              </p>
            </div>

            <p className="leading-loose">
              利回りには、自分のリスク許容度という上限がある。だから、<span className="underline decoration-blue-400 decoration-2 underline-offset-4">利回りで埋めきれないギャップは、収入か支出の側で考える</span>。これが現実的な設計の順序になる。
            </p>
          </div>
        </section>

        {/* §7 順序の提示 (gray-50) */}
        <section className="bg-gray-50 pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              だからまず、自分の許容度を知る
            </h2>

            <p className="leading-loose">
              ここまでの話で、設計の順序が見えてくる。
            </p>

            <p className="leading-loose">
              巷の主流は「いくら必要か → 逆算して利回り○% → シミュレーションして結果を見る」という流れ。でも、その利回りが自分のリスク許容度の範囲内かどうかを確認しない限り、シミュレーションして出てきた数字は、<span className="bg-yellow-200 px-1 rounded">実現可能性の検証が抜けたままになる</span>。
            </p>

            <p className="leading-loose">だから、順序としてはこうなる。</p>

            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li>まず、自分のリスク許容度を測る</li>
              <li>範囲が分かれば、その範囲内で実現可能な利回りも見えてくる</li>
              <li>その利回りで目標に届くなら、運用設計は完了</li>
              <li>届かないなら、収入・支出・目標金額・時間軸の方を調整する</li>
            </ul>

            <div className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8">
              <p className="text-xl font-medium text-blue-900">
                シミュレーターは、この順序の最後に使うもの。最初に使うものではない。
              </p>
            </div>

            <p className="leading-loose">
              何を選ぶかの前に、選択肢を判定する基準が必要。それが、自分のリスク許容度。
            </p>
          </div>
        </section>

        {/* §8 ツール紹介 (white) — 最後 section: フッター余白として pb 維持 */}
        <section className="bg-white pt-12 md:pt-20 pb-12 md:pb-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              このツールについて
            </h2>

            <p className="leading-loose">
              このサイトの診断は、2つのステップで進む。
            </p>

            {/* STEP 1 ブロック */}
            <div className="space-y-4 py-4">
              <h3 className="text-xl font-bold">STEP 1：リスク許容度診断</h3>
              <p className="leading-loose">
                客観的なリスク許容力と主観的なリスク選好の2軸から、1〜7の段階で総合判定する。
              </p>
              <p className="leading-loose">
                「この範囲までは取れる」という枠が見えてくる。
              </p>
              <p className="leading-loose">
                診断結果は「このリスク水準を取るべき」という提案ではない。あくまで枠を提示するだけ。
              </p>
            </div>

            {/* STEP 2 ブロック */}
            <div className="space-y-4 py-4">
              <h3 className="text-xl font-bold">STEP 2：ポートフォリオ診断</h3>
              <p className="leading-loose">
                現在の運用内容を入力すると、いま運用しているポートフォリオがリスク許容度の範囲内に収まっているかどうかが判定できる。
              </p>
              <p className="leading-loose">
                許容度内に収めるためのポートフォリオも理解できる。
              </p>
            </div>

            <p className="leading-loose pt-4">
              シミュレーターを使う前に、まずこの2つの診断で、自分の現在地を確認する。
            </p>
            <p className="leading-loose">
              それが、<span className="underline decoration-blue-400 decoration-2 underline-offset-4">設計の出発点になる</span>。
            </p>

            {/* CTA */}
            <div className="text-center pt-8 space-y-4">
              <p className="text-lg text-gray-700">
                あなたのリスク許容度、まず測ってみますか?
              </p>
              <Link
                to="/risk"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold px-10 py-5 rounded-lg transition-colors"
              >
                5分で診断する（無料） →
              </Link>
            </div>
          </div>
        </section>
      </Layout>

      {/* スクロールポップアップ (70%到達で1回のみ) */}
      {showPopup && (
        <div className="fixed bottom-6 right-6 z-50 bg-white shadow-2xl rounded-xl p-6 max-w-sm border border-gray-100">
          <button
            onClick={handleDismiss}
            aria-label="閉じる"
            className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-lg"
          >
            ✕
          </button>
          <p className="text-sm text-gray-500 mb-1">己を知るところから</p>
          <p className="font-bold text-gray-900 mb-4">
            あなたのリスク許容度、
            <br />
            把握していますか？
          </p>
          <Link
            to="/risk"
            onClick={handleDismiss}
            className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            5分で診断する（無料） →
          </Link>
        </div>
      )}
    </>
  )
}
