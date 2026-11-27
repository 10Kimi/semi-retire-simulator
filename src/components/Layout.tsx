import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import UserStatusBar from './UserStatusBar';
import Footer from './Footer';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  const navLinkClass = (path: string) =>
    `whitespace-nowrap text-xs lg:text-sm px-2 py-1 lg:px-3 lg:py-1.5 rounded-md font-medium transition-colors ${
      location.pathname === path
        ? 'bg-blue-50 text-blue-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
    }`;

  const mobileNavLinkClass = (path: string) =>
    `block px-6 py-3 text-sm font-medium transition-colors ${
      location.pathname === path
        ? 'bg-blue-50 text-blue-700'
        : 'text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="relative bg-white border-b border-gray-200 px-3 py-2 md:px-4 md:py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <div className="shrink-0">
            <h1 className="text-sm md:text-lg font-bold text-gray-800">
              お金の仕組み化プログラム
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">Wealth Program</p>
          </div>
        </div>

        {/* デスクトップ ログイン/ステータスバー (md 以上) */}
        <div className="hidden md:flex">
          <UserStatusBar variant="light" />
        </div>

        {/* モバイル ハンバーガーボタン (md 未満) */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
          aria-expanded={isMenuOpen}
          className="md:hidden p-2 text-gray-600 hover:text-gray-900"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* デスクトップ ナビ (md 以上)。項目が7つあり見出しと同じ行に収まらないので、下の行に出す（FI_project #142） */}
        <nav className="hidden md:flex w-full gap-1 lg:gap-2">
          <Link to="/" className={navLinkClass('/')}>
            シミュレーション
          </Link>
          <Link to="/risk" className={navLinkClass('/risk')}>
            リスク診断
          </Link>
          <Link to="/pf" className={navLinkClass('/pf')}>
            PF診断
          </Link>
          <Link to="/portfolio" className={navLinkClass('/portfolio')}>
            ポートフォリオ
          </Link>
          <Link to="/ma" className={navLinkClass('/ma')}>
            月次アドバイザー
          </Link>
          <Link to="/rb" className={navLinkClass('/rb')}>
            リバランス
          </Link>
          <Link to="/about" className={navLinkClass('/about')}>
            運営者について
          </Link>
        </nav>

        {/* モバイル ドロップダウンメニュー */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-md z-50">
            <nav className="flex flex-col py-2">
              <Link to="/" onClick={closeMenu} className={mobileNavLinkClass('/')}>
                シミュレーション
              </Link>
              <Link to="/risk" onClick={closeMenu} className={mobileNavLinkClass('/risk')}>
                リスク診断
              </Link>
              <Link to="/pf" onClick={closeMenu} className={mobileNavLinkClass('/pf')}>
                PF診断
              </Link>
              <Link to="/portfolio" onClick={closeMenu} className={mobileNavLinkClass('/portfolio')}>
                ポートフォリオ
              </Link>
              <Link to="/ma" onClick={closeMenu} className={mobileNavLinkClass('/ma')}>
                月次アドバイザー
              </Link>
              <Link to="/rb" onClick={closeMenu} className={mobileNavLinkClass('/rb')}>
                リバランス
              </Link>
              <Link to="/about" onClick={closeMenu} className={mobileNavLinkClass('/about')}>
                運営者について
              </Link>

              <div className="border-t border-gray-200 mt-2 pt-3 px-6 pb-4">
                {!user ? (
                  <Link
                    to="/"
                    onClick={closeMenu}
                    className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors"
                  >
                    ログイン
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 truncate">
                      {user.user_metadata?.full_name || user.email}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        signOut();
                        closeMenu();
                      }}
                      className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                      ログアウト
                    </button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
