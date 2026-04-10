import { Link, useLocation } from 'react-router-dom';
import UserStatusBar from './UserStatusBar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-3 py-2 md:px-4 md:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <div className="shrink-0">
            <h1 className="text-sm md:text-lg font-bold text-gray-800">
              セミリタイア シミュレーター
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">Semi-Retire Life & Money Simulator</p>
          </div>
          <nav className="flex gap-1 md:gap-2 shrink-0">
            <Link
              to="/"
              className={`text-xs md:text-sm px-2 py-1 md:px-3 md:py-1.5 rounded-md font-medium transition-colors ${
                location.pathname === '/'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              シミュレーション
            </Link>
            <Link
              to="/risk"
              className={`text-xs md:text-sm px-2 py-1 md:px-3 md:py-1.5 rounded-md font-medium transition-colors ${
                location.pathname === '/risk'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              リスク診断
            </Link>
            <Link
              to="/pf"
              className={`text-xs md:text-sm px-2 py-1 md:px-3 md:py-1.5 rounded-md font-medium transition-colors ${
                location.pathname === '/pf'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              PF診断
            </Link>
          </nav>
        </div>
        <UserStatusBar variant="light" />
      </header>
      {children}
    </div>
  );
}
