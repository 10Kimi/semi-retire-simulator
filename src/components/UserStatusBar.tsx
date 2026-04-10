import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

type Variant = 'light' | 'dark';

export default function UserStatusBar({ variant = 'light' }: { variant?: Variant }) {
  const { user, signOut } = useAuth();

  const styles = variant === 'dark'
    ? { text: 'text-slate-400', btn: 'text-slate-400 border-slate-600 hover:text-slate-200', link: 'text-blue-400 border-blue-500/50 hover:text-blue-300' }
    : { text: 'text-gray-600', btn: 'text-gray-500 border-gray-300 hover:text-gray-700', link: 'text-blue-600 border-blue-300 hover:text-blue-700' };

  if (!user) {
    return (
      <div className="flex items-center">
        <Link
          to="/"
          className={`text-xs ${styles.link} border rounded px-3 py-2 md:px-2 md:py-1 min-h-[44px] md:min-h-0 inline-flex items-center`}
        >
          ログイン
        </Link>
      </div>
    );
  }

  const displayName = user.user_metadata?.full_name || user.email;
  const shortEmail = displayName && displayName.length > 20
    ? displayName.slice(0, 17) + '...'
    : displayName;

  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm ${styles.text} hidden md:inline`}>{displayName}</span>
      <span className={`text-xs ${styles.text} md:hidden`}>{shortEmail}</span>
      <button
        onClick={signOut}
        className={`text-xs ${styles.btn} border rounded px-3 py-2 md:px-2 md:py-1 min-h-[44px] md:min-h-0`}
      >
        ログアウト
      </button>
    </div>
  );
}
