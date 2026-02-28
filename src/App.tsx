import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AuthGatePage from './pages/AuthGatePage';
import SimulatorPage from './pages/SimulatorPage';
import AssessmentPage from './pages/AssessmentPage';
import PortfolioDiagnosisPage from './pages/PortfolioDiagnosisPage';
import PortfolioDiagnosisResultPage from './pages/PortfolioDiagnosisResultPage';

function App() {
  const { user, loading } = useAuth();

  // 読み込み中はローディング表示
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  // 未ログイン → 認証ゲート画面（マーケティングコピー + タブ切り替えフォーム）
  if (!user) {
    return <AuthGatePage />;
  }

  // メール確認がまだの場合 → 確認を促す画面
  if (!user.email_confirmed_at) {
    return <EmailConfirmationPending email={user.email ?? ''} />;
  }

  // ログイン済み＆メール確認済み → シミュレーターを表示
  return (
    <Routes>
      <Route path="/" element={<SimulatorPage />} />
      <Route path="/assessment" element={<AssessmentPage />} />
      <Route path="/portfolio-diagnosis" element={<PortfolioDiagnosisPage />} />
      <Route path="/portfolio-diagnosis/result" element={<PortfolioDiagnosisResultPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// メール確認待ち画面
function EmailConfirmationPending({ email }: { email: string }) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="text-4xl mb-4">📬</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">メールを確認してください</h2>
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium">{email}</span> に確認メールを送信しています。
        </p>
        <p className="text-sm text-gray-600 mb-6">
          メール内のリンクをクリックして登録を完了してください。<br />
          完了後、このページを再読み込みしてください。
        </p>
        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white rounded py-3 md:py-2 text-sm font-semibold hover:bg-blue-700 min-h-[44px]"
          >
            ページを再読み込み
          </button>
          <button
            onClick={signOut}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            別のアカウントでログインする
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
