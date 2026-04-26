import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-12 py-6 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-600">
          <Link to="/about" className="hover:text-gray-900 hover:underline">
            運営者について
          </Link>
          <span className="text-gray-300" aria-hidden="true">
            ·
          </span>
          <Link to="/privacy" className="hover:text-gray-900 hover:underline">
            プライバシーポリシー
          </Link>
          <span className="text-gray-300" aria-hidden="true">
            ·
          </span>
          <Link to="/tokushoho" className="hover:text-gray-900 hover:underline">
            特定商取引法に基づく表記
          </Link>
        </nav>
        <p className="text-xs text-gray-400">© 2026 合同会社ラルゴ</p>
      </div>
    </footer>
  )
}
