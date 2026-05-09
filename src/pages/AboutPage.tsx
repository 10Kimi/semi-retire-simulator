import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { SEOHead } from '../components/seo/SEOHead'

export default function AboutPage() {
  return (
    <>
      <SEOHead
        title="運営者について | お金の仕組み化"
        description="外資IT 20年・48歳でセミリタイアした運営者が、自分のリスク許容度に合わせた資産設計のための計算ツール群を提供しています。"
        canonical="/about"
      />
      <Layout>
        <main className="py-12 md:py-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 space-y-6 md:space-y-8 text-gray-800">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              運営者について
            </h1>

            <p className="leading-loose">
              このサイトを運営しているのは、外資IT企業に20年勤めたあと、48歳でセミリタイアしたおじさんです。
            </p>

            <p className="leading-loose">
              現在52歳。伊豆の海が見える家から、自分自身の数億円規模のポートフォリオを運用しながら、このサイトを1人で動かしています。
            </p>

            <p className="leading-loose">
              「お金の仕組み化」というテーマで、人生後半の資産設計を自分で組み立てるための計算ツール群を提供しています。
            </p>

            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mt-12 md:mt-16 mb-6 md:mb-8">
              経歴
            </h2>

            <p className="leading-loose">
              20代後半から40代後半まで、20年間にわたって外資IT企業に勤めていました。最後の5年間は、日本法人の社長を務めていました。
            </p>

            <p className="leading-loose">
              仕事をたくさんして、給料も役職とともに増えていく。ただ、ある時期から気づくようになりました。
            </p>

            <p className="leading-loose">
              給料が増えても、税金や社会保険料でかなりの部分が持っていかれる。手元に残った分で生活を回し、また翌月の給料を待つ。
            </p>

            <p className="leading-loose">
              自転車操業ではないんです。給料が増えたぶん余裕もあるし、生活に困ることはない。でも、思ったほどお金が貯まらない。このままだと、労働収入ゼロの状態でずっと暮らせるレベルに行くまでには、何年かかるのか見えてこなかった。
            </p>

            <p className="leading-loose">
              労働収入だけで人生後半まで設計するには、限界がある——そう気づいてから、富の形成をどう設計すればいいかを真剣に考え始めました。
            </p>

            <p className="leading-loose">
              そこからは2つを並行して進めました。1つは、お金が自分のために働いてくれる仕組み——つまり資産運用——をきっちりと設計・整備すること。もう1つは、労働収入そのものの入金力を最大化すること。この両輪を回すことで、想定よりも早く資産を形成できました。
            </p>

            <p className="leading-loose">
              48歳でセミリタイア。息子が大学を卒業して、親としての役目が一段落した年でもありました。今は伊豆で、庭付きの家に暮らしています。金融資産の運用と、運営している数棟のアパートからの家賃収入で生活を支えています。
            </p>

            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mt-12 md:mt-16 mb-6 md:mb-8">
              このサイトを始めた理由
            </h2>

            <p className="leading-loose">
              富の形成を真剣に考え始めたものの、最初からうまくいったわけではありませんでした。
            </p>

            <p className="leading-loose">
              最初は数百万円から始めていました。日々の増減もそれほど大きくないので、相場が動いても落ち着いて見ていられた。ところが運用がうまくいくと、「これはいけるな」と気が大きくなる。あまり調べないまま、数千万円を一気に突っ込んだ時期がありました。
            </p>

            <p className="leading-loose">
              しばらくして、一時的な下落局面が来ました。日々100万円単位で資産が減っていく。これは数百万円で運用していた頃には体験したことのない値動きでした。「これ以上下がる前に逃げよう」と狼狽売り。底値で売り抜けた後、相場はすぐに戻していった。
            </p>

            <p className="leading-loose">
              このとき思ったのは、自分が耐えられるリスクの量は、絶対額ではなくて、自分のキャパに対する相対量で決まるんだ、ということでした。数百万円なら平気だった人が、数千万円になった途端に耐えられなくなる。これは意志の強さの問題ではなくて、設計の問題なんですよね。
            </p>

            <p className="leading-loose">
              そこで「リスク許容度」という概念に出会いました。これをベースにしないと長期運用は成功しない——そう確信してから、自分の許容度に合った仕組みを着実に整備し直しました。
            </p>

            <p className="leading-loose">
              仕組みが整ってしまえば、あとは入金力を上げるだけ。労働収入で得た資金を、整備した仕組みに淡々と流し込んでいく。それを続けた結果、もう1つのエンジンが安定して動くようになって、48歳でセミリタイアという選択ができるところまで来ました。
            </p>

            <p className="leading-loose">
              自分でやってみて分かったのは、特別な人だけが知っている話ではなくて、誰でもやれることなんだということ。でも実際には、利回りばかり追いかけて疲弊する人、「投資は怖い」で一歩も踏み出せない人、なんとなく流行に乗って自分のリスク量を把握しないまま運用している人——いろんなパターンで、長期の資産形成を支える設計・土台がないままに運用している人が多い。
            </p>

            <p className="leading-loose">これが、勿体ないなと思っていて。</p>

            <p className="leading-loose">
              自分が遠回りしてきたぶん、同じ道を辿らずに済む人がいるなら、その手助けがしたい。判断の枠組みを提供できれば、専門家に任せきりにしなくても、自分で設計できるようになる。それがこのサイトを始めた動機です。
            </p>

            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mt-12 md:mt-16 mb-6 md:mb-8">
              いま伊豆で暮らしながら考えていること
            </h2>

            <p className="leading-loose">
              朝起きると、まず野鳥に餌をあげに庭に出ます。それからコーヒー豆を挽いて、ハンドドリップで1杯淹れる。淹れたてのコーヒーを片手に、海を眺める。天気のいい日は伊豆大島まで見えるんですよね。庭の芝生は朝露に光っていて、裸足で歩くと冷たくて気持ちがいい。
            </p>

            <p className="leading-loose">
              会社員時代の20年間は、ひとりで没頭する時間がほぼゼロでした。常に人と話している、常に判断を求められている、常に何かが動いている。それも嫌いではなかったけれど、自分の本質はもっと静かなところにあるんだと、伊豆に来てから気づきました。
            </p>

            <p className="leading-loose">
              今は、庭いじり、将棋、ウクレレ、ゴルフの練習、アプリ作り。1人で没頭できる時間が、生活の中心にあります。子供の頃、姉2人がおままごとをしている横で、積み木がしまってあった押し入れの前に1人で陣取って、黙々と建物を作っていた時間——あの感覚に、今ようやく戻ってきた気がします。
            </p>

            <p className="leading-loose">
              セミリタイアして4年以上経ちますが、資産は減っていません。むしろ運用を続けているおかげで、生活費を引いても増え続けている。やっていることは、自分のリスク許容度に合わせて組んだポートフォリオで、淡々と積立を続けて、年に1〜2回リバランスする。それだけです。
            </p>

            <p className="leading-loose">
              ただ、続けていて一番ありがたいと感じるのは、資産が増えていることそのものよりも、<span className="bg-yellow-200 px-1 rounded">心穏やかに平常運行できていること</span>なんですよね。相場が荒れた日も、口座を開いて動揺することはない。リスク許容度の範囲内に収まっているから、何が起きても「想定の範囲」として受け止められる。
            </p>

            <p className="leading-loose">
              もう1つ、長年運用を続けてきて感じているのが、リスク許容度は固定ではないということ。年齢、家族構成、収入源、住環境——ライフイベントが起こるたびに、自分が取れるリスクの量は変わっていきます。
            </p>

            <p className="leading-loose">
              だから、リスク許容度の診断は一度やって終わりではなくて、節目ごとに測り直すことが大事なんだと、今は実感しています。
            </p>

            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mt-12 md:mt-16 mb-6 md:mb-8">
              運営方針
            </h2>

            <p className="leading-loose">サイトを運営するうえで、以下を守っています。</p>

            <ul className="list-disc list-inside space-y-2 leading-loose">
              <li>特定の金融商品を勧めない。提示するのはすべて計算結果であり、最終的な投資判断はあなた自身に委ねます</li>
              <li>投資助言・代理業に該当しない範囲で運営。個別の銘柄選定や売買タイミングの助言は行いません</li>
            </ul>

            <p className="leading-loose">
              このサイトが目指しているのは、「専門家に任せる」のではなく、「自分で判断して、合理的に設計できる人を増やす」ことです。
            </p>

            <p className="leading-loose">
              銀行や証券会社にすすめられるまま運用して、知らないうちに無駄な手数料を払い続けている——そういう状態から抜け出して、自分の頭で考えて、しっかり資産形成できる人が1人でも増えたらいいなと思っています。
            </p>

            <p className="leading-loose">
              判断の枠組みさえ手に入れば、自分の人生の資産設計は、自分でできる。それが、4年以上のセミリタイア経験を通じて、今いちばん確信していることです。
            </p>

            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mt-12 md:mt-16 mb-6 md:mb-8">
              このサイトの中核は、リスク許容度の診断です
            </h2>

            <p className="leading-loose">
              個人投資家にとって最も勝率が高いのは、王道の長期運用――インデックス中心の分散投資を、20年・30年と続けることです。ただし、それに耐えられる設計をしていることが前提になります。
            </p>

            <p className="leading-loose">
              その設計の最重要の土台が、リスク許容度の診断です。
            </p>

            <p className="leading-loose">
              実際、リーマンショックで狼狽売りした人と、保ち続けることができた人。その後の数年で口座残高は、前者が2%、後者が50%増という差になりました（Fidelity 調査）。
            </p>

            <p className="leading-loose">
              リスク許容度を超えた配分で運用していたから、下落で売ってしまう。下落で売ってしまったから、その後の回復局面に乗れない。これが、土台のない設計が【<Link to="/tools/risk" className="text-blue-600 hover:underline">砂上の楼閣になる構造</Link>】です。
            </p>

            <p className="leading-loose">
              だから、運用を始める前に――あるいは運用中であっても、一度ちゃんとあなたのリスク許容度を客観的に測っておく。それだけで、その後の20年・30年がまったく違うものになります。
            </p>

            <p className="leading-loose">
              診断は米国大学の学術調査をベースに日本向けに設計したもの。20問・5分で完了します。
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
        </main>
      </Layout>
    </>
  )
}
