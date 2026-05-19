import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { SEOHead } from '../../components/seo/SEOHead'
import { useAuth } from '../../contexts/AuthContext'
import { BarChart3, SlidersHorizontal, Calculator, Lock, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type PhaseKey = 'design-free' | 'design-premium' | 'operation-premium'

interface Tool {
  id: string
  number: string
  title: string
  icon: LucideIcon
  phase: PhaseKey
  tagline: string
  description: string
  cta?: { label: string; to: string }
  requiresLogin: boolean
  premium: boolean
}

const TOOLS: Tool[] = [
  {
    id: 'risk',
    number: '①',
    title: 'リスク許容度診断',
    icon: BarChart3,
    phase: 'design-free',
    tagline: '客観 × 心理の2軸で測る、設計の出発点',
    description:
      'リスク許容度を2つの観点から測ります。客観的な損失許容度（資産規模や収入から見て、どこまでのリスクを取れるか）と、心理的なリスク許容度（実際の下落局面で、自分がどこまで冷静でいられるか）。この2つは必ずしも一致しません。\n\nこの範囲を超えた設計は、リスクを取りすぎている状態です。暴落がきたとき、耐えられない。米国のファイナンシャルアドバイザーは、この診断を起点として資産設計を行うことを標準としています。\n\n米国大学の学術調査をベースにした20問で、Lv1〜Lv7の7段階で数値化されます。',
    cta: { label: '5分で診断する(無料)→', to: '/risk' },
    requiresLogin: false,
    premium: false,
  },
  {
    id: 'pf',
    number: '②',
    title: 'PF診断',
    icon: SlidersHorizontal,
    phase: 'design-free',
    tagline: '今のPFが許容度の範囲内か即チェック',
    description:
      '今のPFを入力すると、自分のリスク許容度の範囲内かどうかがすぐにわかります。範囲を超えている場合は、各アセットクラスの数値を調整しながら、許容度内に収まる目標配分を確認できます。',
    cta: { label: 'PFを診断する(無料)→', to: '/pf' },
    requiresLogin: true,
    premium: false,
  },
  {
    id: 'sim',
    number: '③',
    title: '資産寿命シミュレーター',
    icon: Calculator,
    phase: 'design-free',
    tagline: '自分のLv基準の利回りで試算する',
    description:
      '多くの人はシミュレーションするとき、利回りに適当な数字を入れています。\n\nリスク許容度診断で自分のLvがわかれば、期待リターンの目安が出ます。その数字を使って初めて、シミュレーションに意味が出てきます。',
    cta: { label: 'シミュレーターを使う →', to: '/' },
    requiresLogin: true,
    premium: false,
  },
  {
    id: 'portfolio',
    number: '④',
    title: 'PFカスタマイズ',
    icon: Lock,
    phase: 'design-premium',
    tagline: '13資産スライダー × 1000試行モンテカルロ',
    description:
      '無料版のPF診断をベースに、13資産クラスのスライダーで配分を精緻に設計します。\n\nシャープレシオ(同じリスクでより多くのリターンを取れているかを示す指標)を最大化する配分を参考にしながら、自分の好みに合わせて微調整し、モンテカルロシミュレーション(将来起こりうる1000通りのシナリオを試算)で資産目標に届くかを確認できます。\n\n目標に届かないとき、リスクを上げるのではなく入金力を上げる方向で考える。その判断の土台になるツールです。',
    requiresLogin: false,
    premium: true,
  },
  {
    id: 'ma',
    number: '⑤',
    title: '月次投資アドバイザー',
    icon: Lock,
    phase: 'operation-premium',
    tagline: '市場指標で月次投資額を自動調整',
    description:
      '長期資産形成の基本は、積立を継続することです。ただし、ただ毎月同じ額を買い続けるだけでなく、市場の状態に応じて購入額を微調整できれば、長期的により大きなリターンを目指せます。\n\n買われすぎの局面では一部を待機資金としてリザーブし、売られすぎの局面でそれも活用して大きく投資する。これが理想ですが、危機状態のとき、感情に任せると人間はやるべきことと逆のことをしてしまいます。\n\n平時から仕組みを導入しておくことで、感情に振り回されることなく、淡々と設計通りに実行できるようになります。米国CAPE・日本PBR・新興国モメンタム・ゴールドGSRの4指標をもとに、今月の投資配分を自動計算することで、毎月の積立投資をレベルアップします。',
    requiresLogin: false,
    premium: true,
  },
  {
    id: 'rb',
    number: '⑥',
    title: 'リバランス',
    icon: Lock,
    phase: 'operation-premium',
    tagline: 'ズレを可視化、リバランス計画を自動算出',
    description:
      '長期投資を続けていると、資産の値動きによって目標配分と現在配分にズレが生じてきます。そのまま放置すると、いつの間にかリスク許容度を超えた設計になっていることがあります。\n\n現在の保有額を入力すると(MoneyForwardのExcelからの取り込みにも対応)、アセットクラスごとのズレを可視化し、リバランス計画を自動計算します。売却を含めて調整する、積立のみで対応する、期間を指定して段階的に戻す、の3つのモードから選べます。\n\n3ヶ月〜半年に一度実施することで、当初の設計が長期にわたって機能し続け、感情に左右されない資産形成を実現できます。',
    requiresLogin: false,
    premium: true,
  },
]

const PHASE_LABELS: Record<PhaseKey, string> = {
  'design-free': '設計フェーズ（無料）',
  'design-premium': '設計フェーズ（有料・招待制）',
  'operation-premium': '運用フェーズ（有料・招待制）',
}

const SEO_LP_LINKS = [
  { label: 'リスク許容度とは', to: '/tools/risk' },
  { label: '老後資産シミュレーションの限界', to: '/tools/retirement-simulation' },
  { label: '50代からの資産運用', to: '/tools/age50s' },
  { label: '老後の資産運用の王道', to: '/tools/retirement' },
]

export default function ToolsHubPage() {
  const { user } = useAuth()
  const isLoggedIn = !!(user && user.email_confirmed_at)
  const [modalId, setModalId] = useState<string | null>(null)

  const modalTool = modalId ? TOOLS.find((t) => t.id === modalId) ?? null : null

  const renderCard = (tool: Tool) => {
    const isPremiumGated = tool.premium
    const isLoginGated = tool.requiresLogin && !isLoggedIn
    const Icon = tool.icon

    // フェーズ別アクセントカラー（左ボーダー）
    const phaseBorderClass =
      tool.phase === 'design-free'
        ? 'border-l-blue-500'
        : tool.phase === 'design-premium'
          ? 'border-l-indigo-500'
          : 'border-l-amber-500'

    const wrapperClass = `border border-gray-200 border-l-4 ${phaseBorderClass} rounded-lg overflow-hidden transition-opacity flex flex-col h-full ${
      isPremiumGated ? 'opacity-60' : isLoginGated ? 'opacity-50' : 'opacity-100'
    }`

    return (
      <button
        key={tool.id}
        onClick={() => setModalId(tool.id)}
        className={`${wrapperClass} text-left hover:shadow-md hover:bg-gray-50 transition-shadow p-4 md:p-5`}
      >
        <div className="flex items-start gap-3">
          <Icon
            className={`w-6 h-6 shrink-0 mt-0.5 ${
              isPremiumGated ? 'text-gray-400' : 'text-blue-600'
            }`}
          />
          <div className="font-bold text-gray-800">
            <span className="mr-1">{tool.number}</span>
            {tool.title}
          </div>
        </div>
        <p className="text-sm text-gray-500 leading-snug mt-auto pt-3">{tool.tagline}</p>
      </button>
    )
  }

  const renderModal = () => {
    if (!modalTool) return null
    const tool = modalTool
    const isPremiumGated = tool.premium
    const isLoginGated = tool.requiresLogin && !isLoggedIn
    const isDisabled = isPremiumGated || isLoginGated
    const Icon = tool.icon

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 overflow-y-auto"
        onClick={() => setModalId(null)}
      >
        <div
          className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-gray-200 p-6 relative my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setModalId(null)}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4 pr-8">
            <Icon
              className={`w-7 h-7 shrink-0 ${
                isPremiumGated ? 'text-gray-400' : 'text-blue-600'
              }`}
            />
            <h2 className="text-xl font-bold text-gray-800">
              <span className="mr-1">{tool.number}</span>
              {tool.title}
            </h2>
          </div>

          <div className="text-gray-700 leading-loose space-y-4">
            {tool.description.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {isLoginGated && (
            <p className="mt-5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              リスク許容度診断を完了するとご利用いただけます
            </p>
          )}

          {!isDisabled && tool.cta && (
            <div className="mt-6">
              <Link
                to={tool.cta.to}
                className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                {tool.cta.label}
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  const designFreeTools = TOOLS.filter((t) => t.phase === 'design-free')
  const designPremiumTools = TOOLS.filter((t) => t.phase === 'design-premium')
  const operationPremiumTools = TOOLS.filter((t) => t.phase === 'operation-premium')

  return (
    <>
      <SEOHead
        title="ツール一覧｜後半生を設計するための6つのツール - お金の仕組み化プログラム"
        description="複利を最大限享受するために、暴落を投資スタンスを変えずに乗り越える。意志ではなく仕組みで実現する6つのツール。リスク許容度診断・PF診断・資産寿命シミュレーター・PFカスタマイズ・月次投資アドバイザー・リバランス。"
        canonical="/tools"
      />
      <Layout>
        {/* §1a ヒーロー (写真 + h1 only、既存 LP に揃える) */}
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
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              後半生を設計し、回し続けるための6つのツール
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mt-4">
              資産形成は意志ではなく、仕組みの力で実現しよう。
            </p>
          </div>
        </section>

        {/* §1b リード文 (白背景、ヒーローの直下) */}
        <section className="bg-white pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <p className="leading-loose">
              一般人でも富を形成できる理由は、複利にあります。長期で市場に居続けることで、複利の効果を最大限に享受できる。ただし、そのためには弱気相場や暴落を、投資スタンスを変えずに乗り越えなければならない。
            </p>
            <p className="leading-loose">
              暴落がきたとき、「握力」で耐えろ、という話をよく聞きます。確かに、それで乗り越えた人たちはいます。
            </p>
            <p className="leading-loose">
              でも現実は、<span className="bg-yellow-200 px-1 rounded">100万円単位でお金が毎日溶けていく</span>。マスコミもSNSも「やばい」「終わった」と煽り続ける。底なし沼に投げ込まれたような恐怖の中で、ほとんどの人は<span className="underline decoration-blue-400 decoration-2 underline-offset-4">パニック売り</span>になります。平時には「暴落はバーゲンセールだ」と頭ではわかっている。でも、いざそのときに買い向かえる人は、ほとんどいない。
            </p>
            <div className="bg-blue-50 border-l-4 border-blue-500 py-6 px-8">
              <p className="text-xl font-medium text-blue-900">
                長期投資に耐え得る仕組みを事前に作っておかないと、暴落時の恐怖心に意志の力だけで抗うのは、ほぼ無理です。
              </p>
            </div>
            <p className="leading-loose">
              意志の力ではなく、仕組みの力で暴落を乗り越える。自分も狼狽売りをやってしまった経験があります。その後いろいろ遠回りしましたが、仕組みを整えてからは入金力を上げることだけに集中できるようになり、48歳でリタイアしました。（
              <Link to="/about" className="text-blue-600 hover:underline">
                詳しくはこちら
              </Link>
              ）
            </p>
          </div>
        </section>

        {/* §2 サイクル説明 */}
        <section className="bg-white pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              設計して、淡々と回し続ける
            </h2>
            <p className="leading-loose">
              自分の状況に合った設計をしたら、あとは仕組みの力で計画を遂行するだけです。結婚や子供の誕生など大きなライフイベントのたびに微調整しながら、淡々と続けていく。そのための道具を、ここにまとめました。
            </p>
          </div>
        </section>

        {/* §3 ツールカード一覧 */}
        <section className="bg-white pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 space-y-6 md:space-y-8">
            <div>
              <h3 className="text-sm font-bold text-blue-700 tracking-wide mb-3">
                {PHASE_LABELS['design-free']}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {designFreeTools.map(renderCard)}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-indigo-700 tracking-wide mb-3 mt-8">
                {PHASE_LABELS['design-premium']}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {designPremiumTools.map(renderCard)}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-amber-700 tracking-wide mb-3 mt-8">
                {PHASE_LABELS['operation-premium']}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {operationPremiumTools.map(renderCard)}
              </div>
            </div>

            <p className="text-sm text-gray-500 pt-2">
              ※ 有料ツールは現在、招待制で提供しています。ご希望の方は運営者までご連絡ください。
            </p>
          </div>
        </section>

        {/* §4 SEO LP 別枠 */}
        <section className="bg-white pt-12 md:pt-20 pb-12 md:pb-20">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-gray-700 leading-relaxed space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold border-b border-gray-200 pb-2 mb-6 md:mb-8">
              資産運用の考え方を深めたい方へ
            </h2>
            <p className="leading-loose">
              リスク許容度や後半生の資産設計について、読み物として整理したページもあります。
            </p>
            <div className="flex flex-wrap gap-3">
              {SEO_LP_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-full text-sm font-medium transition-colors"
                >
                  {link.label} →
                </Link>
              ))}
            </div>
          </div>
        </section>
      </Layout>

      {/* モーダル (Layout 外、最前面) */}
      {renderModal()}
    </>
  )
}
