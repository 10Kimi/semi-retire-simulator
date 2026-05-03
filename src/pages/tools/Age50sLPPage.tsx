import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { SEOHead } from '../../components/seo/SEOHead'

export default function Age50sLPPage() {
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
        title="50代の資産運用｜運用期間はまだ20〜30年、今こそ設計し直す時期 - お金の仕組み化プログラム"
        description="50代の資産運用は、若い時のような無鉄砲は効かない。でも運用期間はまだ20〜30年ある。「もう遅い」でも「年齢別の定型」でもない、自分のリスク許容度から逆算する設計の出発点。"
        canonical="/tools/age50s"
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
              50代の資産運用、これからの20年をどう設計するか
            </h1>
            <p className="text-xl md:text-2xl text-white/80">
              今からでも遅くない、いや今こそ設計し直す時期。
            </p>
          </div>
        </section>

        {/* §2 50代になると、見えてくるもの (white) */}
        <section className="bg-white pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              50代になると、見えてくるもの
            </h2>

            <p className="leading-loose">
              50代に入ると、これまで見えていなかったいろいろなことが、ある程度見えてきます。
            </p>

            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li>会社で自分がどの程度のステータスにいるのか</li>
              <li>給料はあとどれくらいまで上がりうるのか</li>
              <li>退職金はだいたいいくらくらいか</li>
              <li>役職定年は何歳で、その先どういう処遇になるのか</li>
            </ul>

            <p className="leading-loose">
              20代や30代の頃のように「未来は無限に広がっている」という感覚ではなくなって、ある種の輪郭がはっきりしてくる年代だと思います。
            </p>

            <p className="leading-loose">
              これまでは子供の教育費や住宅ローンといった「家族の生活のため」に走ってきた。それがひと段落しつつある中で、これからは夫婦・個人の老後を見据えた準備をしないといけない、と感じ始める。
            </p>

            <p className="leading-loose">
              年金だけでは生活できないことは、もう理解している。だから何かしないといけない、とは思っている。
            </p>

            <p className="leading-loose">
              でも、今やっている運用方法が本当に合っているのか、実は自信がない。インデックス投信だけでいいのか、もっと別の何かをすべきなのか――。
            </p>

            <p className="leading-loose">
              専業主婦の方にとっては、不安はもう一段深いかもしれません。
            </p>

            <p className="leading-loose">
              夫が一生懸命働いているのは分かっている。でも――
            </p>

            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li>定年まで本当に働けるのか</li>
              <li>役職定年で子会社に飛ばされたら収入はどうなるのか</li>
              <li>リストラの話も、最近は身近で聞くようになった</li>
            </ul>

            <p className="leading-loose">
              「今からでも間に合うのか」と「もう遅いのでは」が同居している。これは50代の多くの人が抱える感覚だと思います。
            </p>
          </div>
        </section>

        {/* §3 「もう遅い」と「年齢別の定型」、二つの誤解 (gray-50) */}
        <section className="bg-gray-50 pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              「もう遅い」と「年齢別の定型」、二つの誤解
            </h2>

            <p className="leading-loose">
              50代の資産運用について巷で語られていることには、二つの誤解が混ざっていると自分は思っています。
            </p>

            {/* 誤解1 */}
            <div className="space-y-4 py-4">
              <h3 className="text-xl font-bold">誤解1：「50代はもう遅い」</h3>

              <p className="leading-loose">
                厚生労働省の簡易生命表によると、50歳男性の平均余命は約32年、50歳女性は約38年。
              </p>

              <p className="leading-loose">
                ただ、これは「平均」の数字です。医療が発達している今、自分たちの世代は100歳まで生きる人が相当増えると言われています。
              </p>

              <p className="leading-loose">
                仮に控えめに見積もって、<span className="bg-yellow-200 px-1 rounded">50代から始まる運用期間は20〜30年。100歳前提なら40〜50年</span>。
              </p>

              <p className="leading-loose">
                どちらにしても、複利の効果を享受するには十分な期間です。
              </p>

              <div className="pt-8">
                <div className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8">
                  <p className="text-xl font-medium text-blue-900">
                    「もう遅い」というのは、長く生きる前提で考えると、案外当てはまらないかもしれません。
                  </p>
                </div>
              </div>
            </div>

            {/* 誤解2 */}
            <div className="space-y-4 py-4">
              <h3 className="text-xl font-bold">誤解2：「年齢別ポートフォリオ論」</h3>

              <p className="leading-loose">
                「50代は株式50%、債券50%」「60代は株式40%、債券60%」――こうした年齢別の定型は、雑誌や FP 記事、ロボアドバイザーの提案などで頻繁に目にします。
              </p>

              <p className="leading-loose">
                でも、同じ50代でも事情は人によって全く違いますよね。たとえば――
              </p>

              <ul className="list-disc list-inside space-y-2 leading-loose">
                <li>共働きで世帯年収2,000万、子供は独立済み、住宅ローンなし、という50代</li>
                <li>片働きで子供が大学進学中、住宅ローンが残っている50代</li>
                <li>退職金が手厚い大企業勤務の50代と、専業主婦・主夫がいる50代</li>
              </ul>

              <p className="leading-loose">
                リスクの取り方も、当然変わってくるはずです。
              </p>

              <p className="leading-loose">
                年齢で機械的に決まるものではない。
              </p>

              <p className="leading-loose font-bold pt-4">
                じゃあ、何で決まるのか。
              </p>
            </div>
          </div>
        </section>

        {/* §4 残るのは、自分の許容度を知るというやり方 (white) */}
        <section className="bg-white pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              考えうる選択肢は、4つ
            </h2>

            <p className="leading-loose">
              50代の資産運用で考えうる選択肢を、自分なりに並べてみるとこうなります。
            </p>

            {/* 選択肢A */}
            <div className="space-y-4 py-4">
              <h3 className="text-xl font-bold">選択肢A：年齢別の定型に従う</h3>
              <p className="leading-loose">
                個別事情を無視するので、合わない人には合わない。§3 で見た通りです。
              </p>
            </div>

            {/* 選択肢B */}
            <div className="space-y-4 py-4">
              <h3 className="text-xl font-bold">選択肢B：金融機関のリスク許容度診断を使う</h3>

              <p className="leading-loose">
                銀行・証券会社・ロボアドバイザーが提供する診断です。便利そうに見えますが、こうした診断は最終的に自社商品を販売するための入り口として設計されています。
              </p>

              <p className="leading-loose">
                これは批判ではなく、事実としてそういう構造になっているということ。診断結果が「この投資信託をおすすめ」につながる流れになっている以上、診断の精度よりも商品との接続が優先されている可能性は否定できません。
              </p>
            </div>

            {/* 選択肢C */}
            <div className="space-y-4 py-4">
              <h3 className="text-xl font-bold">選択肢C：とにかく安全資産を増やす</h3>

              <p className="leading-loose">
                「50代だから債券・現金中心」という発想です。
              </p>

              <p className="leading-loose">
                ただ、運用期間がまだ20〜30年あるのに、安全資産だけだとインフレ負けする可能性があります。年2%のインフレが20年続けば、現金の購買力は3割以上目減りする計算。50代だからこそ、この点は気をつけたいかもしれません。
              </p>
            </div>

            {/* 選択肢D */}
            <div className="space-y-4 py-4">
              <h3 className="text-xl font-bold">選択肢D：中立的かつ詳細な計測でリスク許容度を測る</h3>

              <p className="leading-loose">
                商品販売につながらない第三者が、自分のリスク許容度を客観的かつ詳細に測る。
              </p>

              <p className="leading-loose">
                詳細にというのが大事で、リスク許容度は2つの観点から測る必要があります。<span className="font-bold">リスクを取れる客観的条件</span>（年齢・収入・家族構成・既存資産など、数値的に把握できる要素）と、<span className="font-bold">心理的に耐えられる範囲</span>（個人の性格や経験で決まる感覚的な要素）です。
              </p>

              <p className="leading-loose pt-8">
                このサイトの診断ツールは、選択肢D の立場で、米国大学の学術調査をベースに日本向けに設計しています。商品を売っていないので、診断結果が特定の商品の販売に紐づくことはありません。
              </p>
            </div>
          </div>
        </section>

        {/* §4.5 自分で設計するもう一つの意味――手数料 (gray-50) */}
        <section className="bg-gray-50 pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              自分で設計するもう一つの意味――手数料
            </h2>

            <p className="leading-loose">
              選択肢B（金融機関の診断）について、もう一つ触れておきたい論点があります。手数料の差です。
            </p>

            <p className="leading-loose">
              金融機関は手数料で利益を上げているので、構造上、手数料の高い商品が勧められやすい。具体的には、信託報酬が年2%前後の投資信託をすすめられることも、珍しくありません。
            </p>

            <div className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8">
              <p className="text-xl font-medium text-blue-900">
                ちゃんと勉強していない人ほど、こうした手数料の高い商品の「お客さん」になりやすいんですよね。
              </p>
            </div>

            <p className="leading-loose">
              仕事や事業に全力投球してきて、運用について本格的に勉強する時間が取れなかった。気づけば、付き合いのある銀行や保険会社から勧められるまま、よく分からない高額の商品を買っている――50代の方の中には、こういう感覚を持っている方も少なくないと思います。
            </p>

            <p className="leading-loose">
              これはサラリーマンでも、自営業者でも、経営者でも、共通して起こりうる構造です。むしろ、本業で稼いでいる人ほど、金融機関から熱心に営業される頻度も高くなる。<span className="underline decoration-blue-400 decoration-2 underline-offset-4">断りにくい関係性の中で、結果的に手数料の高い商品を抱えてしまう</span>。
            </p>

            <p className="leading-loose">
              一方、自分でインデックスファンドを選べば、信託報酬は年0.1%前後で済みます。
            </p>

            <p className="leading-loose">
              差は年あたり1.9%。一見すると「2%程度の差か」と感じるかもしれません。
            </p>

            <p className="leading-loose">
              でも、これを20〜30年運用すると、複利の力で途方もない差になります。
            </p>

            <p className="leading-loose">
              たとえば1,000万円を年5%で運用した場合――
            </p>

            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li>信託報酬0.1%なら、20年後に約2,600万円、30年後に約4,200万円</li>
              <li>信託報酬2.0%なら、20年後に約1,800万円、30年後に約2,400万円</li>
            </ul>

            <p className="leading-loose">
              <span className="bg-yellow-200 px-1 rounded">差額は20年で約800万円、30年で約1,800万円</span>。元本が2,000万円なら、30年で差額は約3,500万円に広がります。
            </p>

            <p className="leading-loose">
              複利の力は、味方にすると強力ですが、手数料という形で逆向きに働くと、それも同じくらい強力なんですよね。
            </p>

            <p className="leading-loose">
              最大50年という長期の運用期間が残っている50代こそ、この手数料の差は無視できない論点だと思っています。
            </p>

            <p className="leading-loose">
              ただし、<span className="bg-yellow-200 px-1 rounded">大前提として「自分のリスク許容度の範囲内で運用している」ことが必要</span>です。
            </p>

            <p className="leading-loose">
              インデックスで信託報酬を低く抑えていても、自分の許容度を超えた額をリスク資産に振り向けていたら、結局は同じこと。下落局面で耐えられなくなって、底値で売却してしまえば、低コストで運用していた意味も消えます。
            </p>

            <p className="leading-loose">
              手数料を低く抑えるのは、リスク許容度の範囲内で設計したうえでの話。順序が逆になると、せっかくの低コストが活かせなくなります。
            </p>
          </div>
        </section>

        {/* §5 自分の場合のこと (white) */}
        <section className="bg-white pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              自分の場合のこと
            </h2>

            <p className="leading-loose">
              ここまでは一般論ですが、自分自身の話を少しさせてください。
            </p>

            <p className="leading-loose">
              30代後半の頃、自分は数百万円規模で投資信託を始めました。インデックス投信中心。
            </p>

            <p className="leading-loose">
              順調に増えていたある時期、調子に乗って運用額を数千万円規模まで一気に引き上げました。「これだけ増やせるなら、もっと突っ込んだ方がいい」という、典型的な過剰自信ですね。
            </p>

            <p className="leading-loose">そして、ある下落局面で耐えられなくなったんです。</p>

            <p className="leading-loose">
              1日で10%下がるような派手な動きではありませんでした。数%ずつ、毎日のように下落が続いていく。
            </p>

            <p className="leading-loose">
              数千万円が数%下がるたびに、口座の数字が数十万、百万単位で減っていく。それが連続する。気がつけば、合計で数百万円が消えていました。
            </p>

            <p className="leading-loose">頭では「いつかは上昇する」と分かっていたはずなんです。</p>

            <p className="leading-loose">
              でも、底なし沼に連れていかれるような恐怖心が、理性的な判断を少しずつ狂わせていく。「もっと下がるかもしれない」「ここで損切りすれば、これ以上失わずに済む」――そんな思考が止まらなくなって、結局、底値に近いところで損切りしました。
            </p>

            <p className="leading-loose">
              その後、自分の中で一つはっきりしたことがありました。
            </p>

            <p className="leading-loose">
              自分のリスク許容度を超えた運用をしていた。だから狼狽売りに至った。逆に言えば、<span className="bg-yellow-200 px-1 rounded">リスク許容度に合った運用をしないと、また同じことを繰り返す</span>。
            </p>

            <p className="leading-loose">これが腹落ちした瞬間です。</p>

            <p className="leading-loose">
              「リスク許容度」という言葉自体は、SNS や投資ブログで何度も見かけていました。でも概念として知っているだけで、実際に自分の許容度をどう計測すればいいのかは分からなかった。
            </p>

            <p className="leading-loose">
              色々と探して、最終的にアメリカの保険会社が提供している詳細な許容度診断サイトにたどり着きました。海外の投資ブロガーが言及していたのが入り口です。そこで初めて、自分の許容度を数値として把握しました。
            </p>

            <p className="leading-loose">そこから先の話は、シンプルです。</p>

            <p className="leading-loose">
              自分の許容度に見合うポートフォリオを設計し直して、あとは入金力を上げることに全力投球した。要するに、リスクの取り方を間違えないことと、入ってくるお金を増やすこと。この両輪で、48歳でセミリタイアに至っています。
            </p>

            <p className="leading-loose">
              特別な才能ではありません。早い時期に許容度の範囲内で設計し直したから、その後の20年弱で安定して資産が積み上がった。それだけのことです。
            </p>

            <p className="leading-loose">
              今は伊豆で、株価下落のニュースを見ても「ああ、また下げているな」程度で済んでいます。朝、裸足で芝生を歩きながらコーヒーを飲んで、野鳥に餌をやる。海と伊豆大島が見える庭で、淡々とした日常が続いている。
            </p>

            <div className="py-12 md:py-16">
              <div className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8">
                <p className="text-xl font-medium text-blue-900">
                  このサイトを運営している理由の一つは、自分と同じ過ちを犯してほしくないからです。特に、リカバリーが効きにくい50代以降の方には。
                </p>
              </div>
            </div>

            <p className="leading-loose">
              許容度を超えた運用で大きく失敗すると、若い時のようにリカバリーする時間がない。だから50代の今こそ、自分のリスク許容度を一度ちゃんと測って、その範囲内で設計し直してほしい。それが、このサイトを始めた動機の一つです。
            </p>
          </div>
        </section>

        {/* §6 50代は、節目の見直しの時期 (gray-50) */}
        <section className="bg-gray-50 pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              50代は、節目の見直しの時期
            </h2>

            <p className="leading-loose">
              50代は、人生の節目がいくつも重なる時期です。
            </p>

            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li>子供が独立する</li>
              <li>親の介護が始まる</li>
              <li>定年が見え始める</li>
              <li>自分の体力や気力が、以前とは違うことを実感する</li>
            </ul>

            <p className="leading-loose">10年前と同じ自分ではない。これは事実として、そうですよね。</p>

            <p className="leading-loose">リスク許容度も同じです。</p>

            <p className="leading-loose">
              20代や30代の頃に決めた（あるいは何となく続けてきた）リスクの取り方が、50代の今も最適とは限りません。
            </p>

            <p className="leading-loose">
              家族構成が変わり、必要な生活費が変わり、運用に回せる入金力が変わり、心理的に耐えられる下落幅も変わっている。
            </p>

            <p className="leading-loose">
              節目には、お金の仕組みも一度見直しておきたい。自分自身も、節目ごとにリスク許容度を測り直すようにしています。
            </p>

            <p className="leading-loose">
              そして、50代の見直しで一つ大事なのは、「リタイアしたら運用は終わり」ではないということ。
            </p>

            <p className="leading-loose">
              リタイア後も、すべての資産を取り崩して使うのではなく、必要な分だけ取り崩しながら、残りは運用を継続する。
            </p>

            <p className="leading-loose">そうすることで、資産寿命は大きく伸びます。</p>

            <p className="leading-loose">
              <span className="bg-yellow-200 px-1 rounded">50代で組む設計は、リタイア後20〜30年の取り崩しフェーズまで視野に入れた設計になります</span>。
            </p>
          </div>
        </section>

        {/* §7 このツールについて (white) — LP 最後 */}
        <section className="bg-white pt-12 md:pt-20 pb-12 md:pb-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              このツールについて
            </h2>

            <p className="leading-loose">
              50代の資産運用を、自分のリスク許容度の範囲内で設計するための2つのツールを提供しています。
            </p>

            {/* STEP 1 */}
            <div className="space-y-4 py-4">
              <h3 className="text-xl font-bold">STEP 1：リスク許容度診断</h3>

              <ul className="list-disc list-inside space-y-2 leading-loose">
                <li>19問の質問に答えることで、自分のリスク許容度を測ります</li>
                <li>所要時間は5分程度</li>
                <li>中立的な立場で設計（商品販売には一切つながりません）</li>
              </ul>

              <p className="leading-loose">
                自分が30代後半の頃に出会いたかった、詳細な許容度診断を、日本語で受けられる形にしたものです。
              </p>
            </div>

            {/* STEP 2 */}
            <div className="space-y-4 py-4">
              <h3 className="text-xl font-bold">STEP 2：ポートフォリオ診断</h3>

              <ul className="list-disc list-inside space-y-2 leading-loose">
                <li>13資産クラスで現在のポートフォリオを入力</li>
                <li>ボラティリティとリスクレベルを可視化</li>
                <li>自分の許容度の範囲内に収まっているかを確認</li>
              </ul>
            </div>

            {/* CTA */}
            <div className="text-center pt-8 space-y-4">
              <p className="text-lg text-gray-700">まずは STEP 1 のリスク許容度診断から。</p>
              <Link
                to="/risk"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold px-10 py-5 rounded-lg transition-colors"
              >
                5分で診断する（無料） →
              </Link>
            </div>

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
