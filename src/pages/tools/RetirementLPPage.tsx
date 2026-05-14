import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { SEOHead } from '../../components/seo/SEOHead'

export default function RetirementLPPage() {
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
        title="老後の資産運用｜資産寿命を伸ばす王道の設計 - お金の仕組み化プログラム"
        description="老後の資産運用で大事なのは、資産寿命を伸ばすこと。多くの人は攻めすぎるか守りすぎるかの両極に振れるが、王道はリスク許容度に合わせた PF を、節目ごとに見直し続けること。リタイア後の20〜30年を支える出発点。"
        canonical="/tools/retirement"
      />
      <Layout>
        {/* §1 ヒーロー (背景画像 + 黒オーバーレイ / 装飾なし) */}
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
              老後の資産運用、資産寿命を伸ばす王道の設計
            </h1>
            <p className="text-lg md:text-xl text-white/90 leading-loose mb-4">
              老後の資産を支えるための最も大事な考え方は、「いくら増やすか」ではなく、資産寿命をどれだけ伸ばせるか。
            </p>
            <p className="text-lg md:text-xl text-white/90 leading-loose mb-10">
              その出発点は、自分のリスク許容度を客観的に測ること。
            </p>
            <div>
              <Link
                to="/risk"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold px-10 py-5 rounded-lg transition-colors"
              >
                5分で診断する（無料） →
              </Link>
            </div>
          </div>
        </section>

        {/* §2 リタイアを意識する頃に、見えてくるもの (white) */}
        <section className="bg-white pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-6">
              リタイアを意識する頃に、見えてくるもの
            </h2>
            <p className="leading-loose">
              50代後半くらいになるとリタイアを意識し始めて、それまでは漠然としていた「リタイア後」が、急に現実味を帯びてくる。
            </p>
            <p className="leading-loose">
              たとえば、こんな景色が見え始める。
            </p>
            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li>退職金が振り込まれて、これを何にどう振り分けたらいいか分からない</li>
              <li>銀行や証券会社から、「リタイア後の運用プラン」の提案が増えてくる</li>
              <li>月に何万円を取り崩せばいいのか、何年もつのか、自分では計算しきれない</li>
              <li>配偶者の不安、医療費、介護費。先のことが、急に重く感じられる</li>
            </ul>
            <p className="leading-loose">
              これらは、世帯年収が高くても変わらない。
              むしろ、<span className="bg-yellow-200">ある程度の資産があるからこそ「減らしたくない」という気持ちが強くなる</span>。
            </p>
            <p className="leading-loose">
              そしてその気持ちが、運用の判断を二つの方向に引っ張ることがある。
              攻めすぎる方向と、守りすぎる方向。
            </p>
            <p className="leading-loose">
              ここからは、まずその両極について見ていきたい。
            </p>
          </div>
        </section>

        {/* §3 攻めすぎ・守りすぎ――両極のどちらも、資産寿命を縮める (gray-50) */}
        <section className="bg-gray-50 pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-6">
              攻めすぎ・守りすぎ――両極のどちらも、資産寿命を縮める
            </h2>
            <p className="leading-loose">
              リタイアを意識する頃になると、運用について、多くの人が二つの偏りのどちらかに振れる。
              しかも、その偏りは性格の問題ではなく、過去の経験や情報源が引き起こすことが多い。
            </p>
            <p className="leading-loose">
              攻めすぎにも守りすぎにも、それぞれ見た目が違う2つのパターンがある。
              順番に見ていく。
            </p>

            <h3 className="text-xl md:text-2xl font-bold text-gray-900 pt-4 mb-2">
              偏り①：攻めすぎる――2つのパターンがある
            </h3>
            <p className="leading-loose">
              これまで数千万円単位のお金を本格的に運用してきた経験がない。下落相場で資産が半分になる感覚も、味わったことがない。
              そんな状態で運用を始めると、無自覚に「攻めすぎ」る方向に振れることがある。
            </p>

            <h4 className="text-lg md:text-xl font-bold text-gray-900 pt-2">
              パターンA：無謀型
            </h4>
            <p className="leading-loose">
              上昇相場で周囲がどんどん資産を増やしていくのを見ると、「自分にもできるはずだ」という気持ちが膨らんでくる。
              情報源は YouTube、雑誌、SNS。「これだけ持っておけばいい」「今からでも間に合う」という発信が、次々と目に入る。
            </p>
            <p className="leading-loose">
              退職金をまとめて個別株に投入したり、米国株一極集中、レバレッジ商品、新興国への偏った投資、新NISA満額をハイリスク商品で。
              順調な相場では「もっと早く始めればよかった」と思えるかもしれない。
            </p>
            <p className="leading-loose">
              けれど、本格的な下落局面が来ると、景色は一変する。
              資産が一日で数百万、数千万単位で減っていくのを、画面で見続けることになる。
            </p>
            <p className="leading-loose">
              最初は「持ち続ければ戻る」と頭で言い聞かせる。
              2日目、3日目と下落が続くと、夜眠れなくなる。
              1週間続くと、ニュースを見るたびに胃が痛くなる。
              ひと月続くと、「ここでさらに半分になったらどうしよう」という不安が、合理的な判断を覆い始める。
            </p>
            <p className="leading-loose">
              そして、ある日の朝、まだ下がるかもしれないという恐怖に耐えきれなくなって、底に近い水準で売る。
              ここまでくると、<span className="underline decoration-blue-400 decoration-2 underline-offset-2">自分のリスク許容度を超えた配分で持っていたこと</span>が、はっきり分かる。
            </p>
            <p className="leading-loose">
              問題は金額の大きさではなく、自分の輪郭を超えた配分にあった。
            </p>

            <h4 className="text-lg md:text-xl font-bold text-gray-900 pt-4">
              パターンB：インデックス過信型
            </h4>
            <p className="leading-loose">
              ここまでなら、「自分はちゃんと勉強した。インデックス投資にたどり着いた。だからパターンAとは違う」と思う方もいるかもしれない。
            </p>
            <p className="leading-loose">
              確かに、<span className="bg-yellow-200">オルカンや S&amp;P500 を中心にした長期インデックス分散投資は、個人投資家にとって最も勝率の高い王道</span>。
              そこにたどり着いたこと自体は、悪くない。むしろ、ここまで勉強してきた結果としての正解の一つ。
            </p>
            <p className="leading-loose">
              ただし、もう一歩踏み込まないと、別の危なさが残る。
            </p>
            <p className="leading-loose">
              「オルカンだから分散されている、だから大丈夫」<br />
              「インデックスだから長期で持てば必ず戻る、だから大丈夫」<br />
              「全世界に投資しているから、最悪の事態でも耐えられる」
            </p>
            <blockquote className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8 leading-loose text-gray-700">
              インデックス投資は、商品としての安心感を与える。ただし、<span className="underline decoration-blue-400 decoration-2 underline-offset-2">商品の安心感と、自分のリスク許容度に合っているかは、別の話になる</span>。
            </blockquote>
            <p className="leading-loose">
              たとえば、リーマンショックでは S&amp;P500 が 2008年10月〜2009年3月の半年で 31% 下落した。
              オルカンも同様に半分以下まで落ちた局面がある。1億円持っていた人が、4,000万円台まで減った計算になる。
            </p>
            <p className="leading-loose">
              そして、米国 Fidelity の調査によれば、その時期の行動の差は、その後 2年間で歴然となった。
              売却した人の口座は、平均で 2% しか戻らなかった。
              持ち続けた人の口座は、平均で 50% 増えていた。
            </p>
            <blockquote className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8 leading-loose text-gray-700">
              市場に居続けるのは、感情との戦いになる。<br />
              その戦いの場面で、設計の精度が真価を問われる。
            </blockquote>
            <p className="leading-loose">
              ここがポイント。
              売却するか持ち続けられるかを分けるのは、商品（オルカン）の優劣ではない。
              <span className="bg-yellow-200">自分のリスク許容度の範囲で持っているかどうか。それだけで、その後の20年が変わる</span>。
            </p>
            <p className="leading-loose">
              商品が悪いのではない。
              自分のリスク許容度を知らないまま、にわか知識のまま全力で乗っていることが危ない。
            </p>
            <p className="leading-loose">
              ここから、もう一歩勉強する。
              「商品は王道だが、自分にとっての配分は適切か」を測る。
              それが、インデックス投資にたどり着いた人にとっての次の一歩になる。
            </p>

            <h3 className="text-xl md:text-2xl font-bold text-gray-900 pt-8 mb-2">
              偏り②：守りすぎる――2つのパターンがある
            </h3>
            <p className="leading-loose">
              「ここから増やすより、減らさないことが大事」「リタイアしたら、もう運用は卒業」。
              そんな思いで、リスク資産を抑える方向に振れる。
            </p>
            <p className="leading-loose">
              ただし、この「守りすぎ」にも、見た目が違う2つのパターンがある。
            </p>

            <h4 className="text-lg md:text-xl font-bold text-gray-900 pt-4">
              パターンA：完全防御型
            </h4>
            <p className="leading-loose">
              一度、ちゃんと理解しないまま株式投資に手を出して、痛い目を見た記憶がある。
              あるいは、リーマンショックや暴落のニュースが頭に焼き付いている。
            </p>
            <p className="leading-loose">
              その感覚は、頭ではなく体に残る。
              「もう、あんな思いはしたくない」「リタイア後にあれを繰り返したら、取り返しがつかない」。
            </p>
            <p className="leading-loose">
              こうして、リスク資産をゼロに近づける方向に振れる。
              退職金を全額預金、現金比率を9割以上に。
            </p>
            <p className="leading-loose">
              通帳の残高は減らない。短期的には、これ以上ない安心に見える。
            </p>
            <blockquote className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8 leading-loose text-gray-700">
              しかし、これがインフレ時代の恐ろしいサイレント・タックスになる。<br />
              税金は1円も取られていないのに、毎年確実に資産が削られていく。
            </blockquote>
            <p className="leading-loose">
              年2%のインフレが30年続くと、1億円の実質価値は約5,500万円になる。
              10年後には2割減、18年後には3割減。
            </p>
            <p className="leading-loose">
              通帳の数字は変わらないのに、その1億円で買えるものは、年々静かに減っていく。
            </p>

            <h4 className="text-lg md:text-xl font-bold text-gray-900 pt-4">
              パターンB：専門家任せ型
            </h4>
            <p className="leading-loose">
              このパターンの厄介なところは、本人が「自分は守りすぎていない」と思っていること。
            </p>
            <p className="leading-loose">
              「完全に現金で持つほど、臆病じゃない」<br />
              「ちゃんと運用も考えている。だから専門家に相談している」<br />
              「YouTube やネットの情報を鵜呑みにする攻めすぎとも違う。慎重に進めている」
            </p>
            <p className="leading-loose">
              確かに、リタイアを意識して運用を始めようとする姿勢は、悪くない。
              ただし、<span className="underline decoration-blue-400 decoration-2 underline-offset-2">知識がないまま大金を持って銀行や証券会社の窓口に行くのは、鴨が葱を背負って店に入っていくのと同じ構図になる</span>。
            </p>
            <p className="leading-loose">
              自分の知り合いに、こういう人がいる。
              証券会社の営業から、その時々のテーマ株をパッケージにした商品を勧められて、ずっと買い続けている。
              AI、半導体、脱炭素、宇宙、ヘルスケア。話題の銘柄が詰め合わせになった商品。
            </p>
            <p className="leading-loose">
              本人は「儲かっている」と言う。
              パッケージの中に上昇している個別株が混ざっているから、含み益は出る。月次レポートも「順調」と説明される。
            </p>
            <p className="leading-loose">
              ただ、構造を見ると違う景色になる。
            </p>
            <p className="leading-loose">
              販売手数料は2%以上。
              そして、数年に一度、新しいテーマの商品に買い替える。
            </p>
            <p className="leading-loose">
              数年ごとに2%以上の手数料を払い続け、買い替えるたびに、それまで積み上がっていた複利の土台がリセットされる。
              長期で見れば、複利効果はほぼゼロに近づいていく。
            </p>
            <p className="leading-loose">
              長期投資の威力（複利）を取り戻すために運用を始めたのに、その威力を全部、金融機関の手数料に渡している。
              本人の主観では運用を続けているつもりが、構造的には博打に付き合わされ続けているだけ。
            </p>
            <p className="leading-loose">
              専門家任せ型のもう一つの厄介さは、毎月レポートが届き「順調ですよ」と説明され続けることで、表面上は「ちゃんと運用している」感覚が長く続くこと。
              気づくのは、20年経って通帳を見た時か、誰かに構造を指摘された時。
              そのとき、戻ってきたはずの複利は、もう取り戻せない。
            </p>

            <h3 className="text-xl md:text-2xl font-bold text-gray-900 pt-8 mb-2">
              どの偏りも、資産寿命を縮める方向に働く
            </h3>
            <p className="leading-loose">
              整理すると、リタイアを意識する頃に振れやすい偏りには4つのパターンがある。
            </p>
            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li>攻めすぎ・無謀型：YouTube や SNS で勝手に判断 → 下落で狼狽売り</li>
              <li>攻めすぎ・インデックス過信型：商品の安心感に乗って、自分の許容度を超えた配分 → 暴落で持ち続けられない</li>
              <li>守りすぎ・完全防御型：過去の傷で現金に逃げる → サイレント・タックスで実質価値が削られる</li>
              <li>守りすぎ・専門家任せ型：金融機関で手数料の高い商品を持たされる → 複利が手数料に消える</li>
            </ul>
            <p className="leading-loose">
              4つの偏りは、見た目はそれぞれ違う。けれど、向かう先は同じ。
              どれも、資産寿命を縮める方向に向かっている。
            </p>
            <p className="leading-loose">
              収入が年金しかない老後を考えると、どの偏りも危険になる。
              過信も、商品への安心感も、過去の傷も、専門家への信頼も、それ自体は自然な反応。
              ただ、リタイア前後はその偏りを一度リセットして、自分の事情から設計を組み直す節目になる。
            </p>
          </div>
        </section>

        {/* §4 資産寿命を伸ばす王道 (white) */}
        <section className="bg-white pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-6">
              資産寿命を伸ばす王道――リスク許容度に合わせた PF を、節目ごとに見直し続ける
            </h2>
            <p className="leading-loose">
              4つの偏りのどれでもなく、自分の事情から逆算する設計。
              それを支えるのは、ひとつのシンプルな考え方になる。
            </p>

            <h3 className="text-xl md:text-2xl font-bold text-gray-900 pt-4 mb-2">
              リスク許容度に合わせた PF こそが、長期運用を継続させる礎になる
            </h3>
            <p className="leading-loose">
              許容度を超えた配分で持っていれば、下落局面で耐えきれずに手放す。
              許容度より控えめすぎれば、インフレで資産が静かに削られる。
              専門家に任せきりなら、手数料で複利が半減する。
              どれも、長期で続けることができない。
            </p>
            <p className="leading-loose">
              <span className="bg-yellow-200">自分の許容度の中で、自分で組まれた PF だけが、20〜30年という単位の運用を続けさせてくれる</span>。
            </p>
            <p className="leading-loose">
              そしてその PF は、金融機関に作ってもらうのではなく、自分で設計できる力が必要になる。
            </p>

            <h3 className="text-xl md:text-2xl font-bold text-gray-900 pt-4 mb-2">
              そして、長期継続そのものが、資産寿命を最大化する
            </h3>
            <p className="leading-loose">
              複利の力は、続けた人にだけ働く。
              途中で降りた人にも、手数料に取られ続けた人にも、回復局面の上昇は届かない。
            </p>
            <p className="leading-loose">
              リタイア後の20〜30年も、この構造は変わらない。
              取り崩しながらでも、残りの資産は運用を続ける。
              これが、<span className="underline decoration-blue-400 decoration-2 underline-offset-2">資産寿命を伸ばす王道になる</span>。
            </p>

            <h3 className="text-xl md:text-2xl font-bold text-gray-900 pt-4 mb-2">
              ただし、リスク許容度はライフイベントごとに変化する
            </h3>
            <p className="leading-loose">
              ここがもう一つ重要なポイントになる。
            </p>
            <p className="leading-loose">
              リスク許容度は、一度測れば一生変わらないものではない。
              ライフイベントを経るたびに、自分が市場下落にどこまで耐えられるかは、静かに変わっていく。
            </p>
            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li>子供の独立で、教育費負担がなくなる</li>
              <li>親の介護が始まり、月単位で支出が増える</li>
              <li>住宅ローンを完済する</li>
              <li>退職して、入金力という変数がなくなる</li>
              <li>配偶者の働き方が変わる</li>
              <li>自分の健康状態が変化する</li>
            </ul>
            <p className="leading-loose">
              こうした節目を迎えるたびに、許容度は変わる。
              配分も、見直しが必要になる。
            </p>
            <blockquote className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8 leading-loose text-gray-700">
              一度測って終わりではなく、節目ごとに見直し続ける。<br />
              それが、リスク許容度を礎とする設計の本質になる。
            </blockquote>
            <p className="leading-loose">
              リタイア前後の年代は、まさにこうした節目が連続する時期。
              だからこそ、ここで一度ちゃんと測り直す価値がある。
            </p>
          </div>
        </section>

        {/* §5 では、リスク許容度はどう測るか (gray-50) */}
        <section className="bg-gray-50 pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-6">
              では、リスク許容度はどう測るか
            </h2>
            <p className="leading-loose">
              ここまでで、「リスク許容度に合わせた PF を持ち続けることが王道」というのは見えてきた。
              では、その許容度はどう測ればいいのか。
            </p>
            <p className="leading-loose">
              世間でよく見かけるのは、いくつかの定型ルールや、金融機関で受ける簡易な質問。
              けれど、これらでは届かない範囲がある。
            </p>

            <h3 className="text-xl md:text-2xl font-bold text-gray-900 pt-4 mb-2">
              「100−年齢」のような定型ルール
            </h3>
            <p className="leading-loose">
              リスク資産比率の決め方として、「100−年齢」「110−年齢」というルールがある。
              60歳なら100−60で、リスク資産40%。これが世間で使われる目安。
            </p>
            <p className="leading-loose">
              このルール自体は、ざっくりした出発点としては悪くない。
              ただ、<span className="underline decoration-blue-400 decoration-2 underline-offset-2">同じ60代でも、事情は人によって全く違う</span>。
            </p>
            <p className="leading-loose">
              たとえば、こんな3つのケースを並べてみる。
            </p>
            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li><strong>パターンA</strong>：金融資産3,000万円、住宅ローン完済、年金月22万円、子供独立、健康状態良好</li>
              <li><strong>パターンB</strong>：金融資産1.5億円、配偶者あり、子供独立、親の介護なし</li>
              <li><strong>パターンC</strong>：金融資産5,000万円、親の介護中で月10万円の支出、年金繰り下げ検討中</li>
            </ul>
            <p className="leading-loose">
              3つとも同じ60代だが、<span className="bg-yellow-200">適切なリスク許容度も、PF 構成も全く違う設計になる</span>。
              定型ルールでは、ここに届かない。
            </p>

            <h3 className="text-xl md:text-2xl font-bold text-gray-900 pt-4 mb-2">
              金融機関の簡易な質問
            </h3>
            <p className="leading-loose">
              銀行や証券会社の窓口でも、簡単なリスク許容度の質問を受けることがある。
              ただ、5問〜10問程度のチェックリストで、自分の輪郭を測れるかというと、難しい。
            </p>
            <p className="leading-loose">
              加えて、金融機関には商品販売のインセンティブがある。
              許容度の判定が「あなたに合うのはこの商品」という提案につながりやすい構造は、<span className="underline decoration-blue-400 decoration-2 underline-offset-2">客観的な計測とは別物として扱ったほうがいい</span>。
            </p>

            <h3 className="text-xl md:text-2xl font-bold text-gray-900 pt-4 mb-2">
              中立的かつ詳細な計測
            </h3>
            <p className="leading-loose">
              定型ルールでも、簡易な質問でもなく、自分の事情を踏まえて中立に測る。
            </p>
            <p className="leading-loose">
              このサイトの診断は、<span className="bg-yellow-200">米国大学の学術調査をベースに日本向けに設計したもの</span>。
              20問・5分で、市場下落にどこまで耐えられるかが、客観的な数字として出る。
            </p>
            <p className="leading-loose">
              診断結果は、<span className="underline decoration-blue-400 decoration-2 underline-offset-2">Lv1からLv7までの7段階で表示される</span>。
              Lv1が最も保守的なリスク許容度、Lv7が最も積極的なリスク許容度。
              自分がこの7段階のどこに位置するのかが分かると、それに合った PF の方向性も見えてくる。
            </p>
            <p className="leading-loose">
              「自分は何%までの下落なら耐えられるのか」が数字で見えると、攻めすぎでも守りすぎでもない、自分の事情に合わせた配分の出発点が立ち上がる。
            </p>
          </div>
        </section>

        {/* §6 運営者の場合のこと (white) */}
        <section className="bg-white pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-6">
              運営者の場合のこと
            </h2>
            <p className="leading-loose">
              ここまで書いてきたことは、すべて運営者の経験を通して考えてきたこと。
            </p>
            <p className="leading-loose">
              30代の後半、勢いに任せて株式に数千万円を入れた時期がある。
              当時はまだ会社員で、入金力にも自信があった。
              だから、下がっても回復するまで持ち続ければいい、と頭では分かっていた。
            </p>
            <p className="leading-loose">
              けれど、いざ大きな下落が来た時、その「頭での理解」は機能しなかった。
              数千万円の含み損を抱えて夜眠れなくなり、結局、底に近い水準で売却してしまった。
            </p>
            <p className="leading-loose">
              問題は金額の大きさではなく、リスク許容度を超えた配分で運用していたこと。
              今の言葉で言えば「攻めすぎ・無謀型」だった。
            </p>
            <p className="leading-loose">
              その後、ある米国保険会社の許容度診断に出会った。
              <span className="underline decoration-blue-400 decoration-2 underline-offset-2">リスク許容度という概念こそが最も大切で、その指標をもとにポートフォリオを設計するという考え方</span>が、ようやく腹落ちした瞬間だった。
            </p>
            <p className="leading-loose">
              その基盤を整備できたことで、その後は入金力を最大化することに全集中。
              40代半ばまでに数億の資産を作り、48歳でセミリタイアできるまでになった。
            </p>
            <p className="leading-loose">
              今は伊豆で暮らしながら、海と山と温泉に囲まれて穏やかな日々を過ごしている。
            </p>
          </div>
        </section>

        {/* §7 このツールについて (gray-50) */}
        <section className="bg-gray-50 pt-12 md:pt-20 pb-12 md:pb-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-6">
              このツールについて
            </h2>
            <p className="leading-loose">
              ここまで書いてきたことを、あなた自身の数字で確かめるためのツールを2つ用意している。
            </p>

            {/* STEP 1 */}
            <div className="space-y-4 py-4">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900">
                STEP 1：リスク許容度診断（20問・5分）
              </h3>
              <p className="leading-loose">
                米国大学の学術調査をベースに、日本向けに設計した詳細診断。
                20問に答えると、自分が市場下落にどこまで耐えられるかが、Lv1からLv7の7段階で出る。
              </p>
              <p className="leading-loose">
                「自分は何%までの下落なら耐えられるのか」<br />
                「同じ年代・収入の人と比べて、自分はどの位置にいるのか」
              </p>
              <p className="leading-loose">
                これが見えると、攻めすぎでも守りすぎでもない、自分の事情に合わせた配分の出発点が立ち上がる。
              </p>
              <div className="text-center pt-4">
                <Link
                  to="/risk"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold px-10 py-5 rounded-lg transition-colors"
                >
                  5分で診断する（無料） →
                </Link>
              </div>
            </div>

            {/* STEP 2 */}
            <div className="space-y-4 py-4">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900">
                STEP 2：ポートフォリオ診断
              </h3>
              <p className="leading-loose">
                リスク許容度が測れたら、次は自分の今のポートフォリオを、その許容度に照らし合わせて点検する。
              </p>
              <p className="leading-loose">
                許容度を超えた配分で持っているなら「攻めすぎ」、許容度より控えめなら「守りすぎ」。
                どちらも、20〜30年の運用期間では資産寿命を縮める方向に効いてくる。
              </p>
            </div>

            {/* 締めの引用ブロック */}
            <blockquote className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8 leading-loose text-gray-700">
              リタイア後の20〜30年を支えるのは、攻めすぎず守りすぎず、土台のある設計を持ち続けること。<br />
              その出発点が、自分のリスク許容度を一度ちゃんと測り、節目ごとに見直し続けること。
            </blockquote>

            <p className="text-sm text-gray-500 text-center pt-8">
              このサイトの運営者については、
              <Link to="/about" className="text-blue-600 hover:underline">/about</Link>
              {' '}を参照してください。
            </p>
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
