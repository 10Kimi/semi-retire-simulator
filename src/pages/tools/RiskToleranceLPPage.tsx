import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { SEOHead } from '../../components/seo/SEOHead'

function InlineCTA() {
  return (
    <div className="text-center py-12">
      <Link
        to="/risk"
        className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold px-10 py-5 rounded-lg transition-colors"
      >
        リスク許容度を診断する →
      </Link>
    </div>
  )
}

export default function RiskToleranceLPPage() {
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
        title="リスク許容度診断 | 本業で稼ぎ、設計で増やす"
        description="資産形成の設計はリスク許容度を知ることから始まります。1から7の7段階で客観的・心理的の2軸で計測。感情ではなく設計で長期運用を。"
        canonical="/tools/risk"
      />
      <Layout>
        {/* Hero */}
        <section className="bg-white min-h-screen flex items-center justify-center py-32 md:py-40">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-800 leading-tight">
              本業で稼ぎ、設計で増やす。
              <br />
              1馬力から2馬力へ。
            </h1>
          </div>
        </section>

        {/* セクション1: 資産形成の構造 (white) */}
        <section className="bg-white py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-5">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">
              資産形成の構造
            </h2>

            <p>資産形成の構造は、シンプルです。</p>

            <div className="bg-gray-900 text-white text-center py-8 px-6 rounded-lg text-xl md:text-2xl font-mono my-10">
              資産 ＝ 収入 － 支出 ＋（資産 × 利回り）
            </div>

            <p>
              収入はすでにある。支出も極端には変えられない。でも「資産 ×
              利回り」の部分がちゃんと設計されていない人が、思いのほか多い。
            </p>

            <p>
              「節約しろ」とよく言われます。でも高収入の人の優先順位は、少し違うと思っています。自分が仕事をしていた頃、東京のど真ん中のタワマンに住んでいました。家賃は高かった。でもそれは、本業のパフォーマンスを最大化するための選択でした。通勤に時間と労力を使いたくなかったから。支出を削るより、入金力を上げることに集中していた。
            </p>

            <p>資産形成には、手をつける順番があります。</p>

            <p>
              多くの人は、収入を増やすことに毎日すでに全力でやっている。本業のことは、誰より考えていると思います。
            </p>

            <p>でも、資産運用についてはどうでしょう？</p>

            <p>
              長期の資産運用は、複利の効果を最大限享受するゲームです。そのためには時間を味方につけないと意味がない。だからこそ、後回しにせず、適当にやらず、1日でも早くちゃんとした設計のもとに仕組みを作った方がいい。
            </p>

            <p>だから順番はこうなります。</p>

            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>資産運用の設計を固める</li>
              <li>収入を増やす（入金力を上げる）</li>
              <li>支出を最適化する</li>
            </ol>

            <p>
              本業に費やしているエネルギーの1%でいい。まず資産運用の設計を整える。それだけで、毎月の積立が複利として積み上がり始めます。収入が上がれば上がるほど、その設計が活きてきます。
            </p>

            <p>
              お金のために働くだけでなく、お金にもあなたのために働いてもらう。その仕組みが動き始めると、富の形成のスピードが変わります。
            </p>

            <p>でも、その仕組みを安心して動かし続けるには、前提があります。</p>
          </div>
        </section>

        {/* セクション2: 正直に言います (gray-50) */}
        <section className="bg-gray-50 py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-5">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">
              正直に言います
            </h2>

            <p>正直に言います。</p>

            <p>
              資産運用を始めた頃、自分はずっとドキドキしていました。下がり止まって上がったときは「あーよかった」と胸をなでおろす。でも心のどこかで、あのまま下がり続けていたら耐えられなかったかもな、とも思っていました。
            </p>

            <p>そして実際に、やってしまいました。</p>

            <p>
              運用資産を数百万から数千万に増やしたとき、毎日100万円単位で減っていく画面を見ながら、「とりあえず売却」したんです。頭では長期投資と決めていたのに。
            </p>

            <p>
              後悔というより、適当にやってはダメだと思いました。でもどうしたらいいのかわからず、たくさんの現金を残したまま、少しずつ積立しながら、ひたすら勉強する期間が続きました。
            </p>
          </div>
        </section>

        {/* セクション3: リスク許容度次第と言いながら (white) */}
        <section className="bg-white py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-5">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">
              リスク許容度次第と言いながら
            </h2>

            <p>ネットで資産運用の質問をしたことはありますか。</p>

            <p>
              「自分は何歳で資産はいくら、このポートフォリオはどうでしょうか」という質問に、いろんな回答がつきます。自分だったらこうします、という単なる個人の意見。この商品は意味がないからこうしたら、という説明。そして、あなたのリスク許容度次第ですね、というまともな回答。
            </p>

            <p>
              でも、リスク許容度をどうやって調べるのか、誰も書いていないんです。
            </p>

            <p>
              以前、IFAの方にリスク許容度を客観的に計測してからポートフォリオを提案しているか聞いたことがあります。していない、と言われました。ファイナンシャルプランナーの方も、少なくとも自分が出会った範囲では、ライフプランを書かせて必要な利回りから逆算してポートフォリオを提案していました。リスク許容度の計測は、その前提に入っていませんでした。
            </p>

            <p>
              やっているプロがいるかもしれません。自分が知らないだけかもしれない。でも少なくとも、「リスク許容度次第」と言いながら、その計測方法を示してくれた人には出会えませんでした。
            </p>
          </div>
        </section>

        {/* セクション4: 転換点 (gray-50) — 末尾に InlineCTA */}
        <section className="bg-gray-50 py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-5">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">
              転換点
            </h2>

            <p>
              転換点は、「リスク許容度」という概念を知って、実際に計測したことでした。
            </p>

            <p>
              当時、アメリカの保険会社のサイトで計測してみました。自分がどのくらいの下落まで冷静でいられるか、どのくらいの期間市場に居続けられるか、数字として把握できた瞬間、何かが変わりました。
            </p>

            <p>
              その範囲に収まるポートフォリオをどう組むか、試行錯誤が始まりました。感情ではなく、設計として運用できるようになったのは、そこからです。
            </p>

            <InlineCTA />
          </div>
        </section>

        {/* セクション5: 株価下落は避けられない (white) */}
        <section className="bg-white py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-5">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">
              株価下落は避けられない
            </h2>

            <p>株価下落は、避けられません。</p>

            <p>
              来るか来ないかではなく、いつ来るかの問題です。リーマンショック、コロナショック、そして次の何か。名前はまだついていないけれど、来ます。
            </p>

            <p>
              だからといって、逃げればいいわけでもありません。S&P500の過去30年のデータがあります。最良の10日間を逃し続けると、リターンは半減します。そしてその最良の日は、最悪の日の直後に来ることがほとんどです。下落が怖くて市場から出た瞬間に、急回復の日も一緒に逃してしまう。
            </p>

            <p>
              市場に居続けることが、長期投資の唯一の正解です。でも、それができなかった。自分のリスク許容度を把握していなかったから。
            </p>
          </div>
        </section>

        {/* セクション6: 2択ではない (gray-50) — 末尾に InlineCTA */}
        <section className="bg-gray-50 py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-5">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">
              2択ではない
            </h2>

            <p>「高リターンか、安全か」という2択で悩んでいませんか。</p>

            <p>
              どちらを選んでも何かを諦めた感覚が残る。その宙ぶらりんな状態のまま、現金を大量に持ちながら機会損失している気もする。
            </p>

            <p>自分もその場所にいました。</p>

            <p>
              でも、これは2択ではありません。リスク許容度の範囲内で最大限のリターンを取りに行く、という設計があります。ダウンサイドを許容範囲に留めながら、長期運用で損失リスクを軽減し、リターンをしっかり享受する。トレードオフではなく、トレードオンの考え方です。
            </p>

            <p>
              そのためにまず必要なのは、自分のリスク許容度を正確に把握することです。どのくらいの下落まで冷静でいられるか。どのくらいの期間、市場に居続けられるか。その輪郭がはっきりすれば、その範囲内で最大限のリターンを取りに行けます。
            </p>

            <InlineCTA />
          </div>
        </section>

        {/* セクション7: 孫子 (white) — 中央に bg-emerald-900 ブロック */}
        <section className="bg-white py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-5">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">
              孫子 — 己を知り敵を知る
            </h2>

            <p>
              孫子は言いました。「彼を知り己を知れば百戦殆うからず」と。
            </p>

            <p>資産運用に置き換えると、こうなります。</p>

            <div className="bg-emerald-900 text-white rounded-lg py-12 px-8 my-8">
              <p className="text-2xl font-bold text-center mb-8">
                彼を知り己を知れば百戦殆うからず
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-bold text-emerald-200 mb-3">
                    己を知るとは
                  </h3>
                  <ul className="space-y-1.5 text-sm">
                    <li>・自分のリスク許容度</li>
                    <li>・損失耐性</li>
                    <li>・投資可能期間</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-200 mb-3">
                    敵を知るとは
                  </h3>
                  <ul className="space-y-1.5 text-sm">
                    <li>・市場の動き</li>
                    <li>・金融商品の特性</li>
                    <li>・ポートフォリオの分散効果</li>
                  </ul>
                </div>
              </div>
            </div>

            <p>
              この両方が揃ったとき、感情ではなく設計で運用できるようになります。タイミングを読もうとする投機的なギャンブルではなく、構造として長期で勝ちに行く運用です。
            </p>
          </div>
        </section>

        {/* セクション8: 複利を味方につける (gray-50) */}
        <section className="bg-gray-50 py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-5">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">
              複利を味方につける
            </h2>

            <p>そして、複利を味方につける。</p>

            <p>
              最初の数年は正直、地味です。積み立てているのに思ったほど増えない。でも5年を超えたあたりから、曲線が変わり始めます。10年、20年と経つにつれて、加速度が全然違う。
            </p>

            <p>複利を最大限に活かす条件は3つだけです。</p>

            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>長期で持ち続けること</li>
              <li>急上昇の日を市場の中で迎えること</li>
              <li>タイミングを読もうとしないこと</li>
            </ol>

            <p>
              この3つはすべてつながっています。タイミングを読もうとした瞬間に、複利が壊れます。予測しようとした瞬間に、設計が崩れます。
            </p>

            <p>
              市場に居続けられる自分を設計する。そのために必要なのは予測力ではなく、自分のリスク許容度の範囲内で組まれた、揺さぶられないポートフォリオです。
            </p>

            <div className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8 my-2">
              <p className="text-xl font-medium text-blue-900">
                あなたが安心して眠れる夜は、設計の先にあります。
              </p>
            </div>
          </div>
        </section>

        {/* セクション9: このツールについて (white) */}
        <section className="bg-white py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-5">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">
              このツールについて
            </h2>

            <p>このツールについて。</p>

            <p>
              このツールでは、リスク許容度を1から7の7段階で数値化します。スコアが高いほどリスクを取れる設計、低いほど安定重視の設計が向いています。
            </p>

            <p>計測は2つの軸で行います。</p>

            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>客観的な損失許容度：資産規模や収入から見て、どこまでのリスクを取れるか</li>
              <li>心理的なリスク許容度：実際の下落局面で、自分がどこまで冷静でいられるか</li>
            </ol>

            <p>
              この2つは必ずしも一致しません。客観的には余裕があっても、心理的に耐えられなければ、下落時に手が動いてしまう。このツールでは両方を計測して、低い方を自分の許容度として採用します。それが、設計が崩れない理由です。
            </p>

            <p>
              もうひとつ、大事なことがあります。リスク許容度は、一度計測すれば終わりではありません。転職・結婚・子供の誕生・退職など、大きなライフイベントのたびに変わります。収入が変われば、取れるリスクも変わる。家族構成が変われば、心理的な余裕も変わる。でもポートフォリオは前の自分のまま動き続けている。そのズレが、次の下落局面でエンストの原因になります。
            </p>

            <p>
              数年に一度、あるいは大きなライフイベントのたびに、自分のポートフォリオが今の自分のリスク許容度の範囲に収まっているか確認する。その習慣が、長期運用を守ります。
            </p>

            <p className="text-sm text-gray-500">
              計測結果は投資の推奨ではありません。設計の起点です。
            </p>
          </div>
        </section>

        {/* クロージング (gray-50) — InlineCTA で締める */}
        <section className="bg-gray-50 py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-5">
            <p>己を知るところから、すべては始まります。</p>

            <p>
              資産運用の設計がしっかりハマれば、あとは本業に集中するだけです。入金力が上がるほど、富の形成が加速します。
            </p>

            <p>
              お金のために走り続けなくていい。設計した仕組みが、あなたの代わりに静かに動いている。そういう状態を作るための、最初の一歩をここから始めてみてください。
            </p>

            <InlineCTA />
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
            5分で診断する →
          </Link>
        </div>
      )}
    </>
  )
}
