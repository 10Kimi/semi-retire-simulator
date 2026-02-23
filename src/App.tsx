import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import ResetPassword from './components/auth/ResetPassword';
import SimulatorPage from './pages/SimulatorPage';
import AssessmentPage from './pages/AssessmentPage';

function App() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register' | 'reset'>('login');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    if (authView === 'register') {
      return <RegisterForm onSwitchToLogin={() => setAuthView('login')} />;
    }
    if (authView === 'reset') {
      return <ResetPassword onSwitchToLogin={() => setAuthView('login')} />;
    }
    return (
      <LoginForm
        onSwitchToRegister={() => setAuthView('register')}
        onSwitchToReset={() => setAuthView('reset')}
      />
    );
  }

  return (
    <Routes>
      <Route path="/" element={<SimulatorPage />} />
      <Route path="/assessment" element={<AssessmentPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
