import { useState } from 'react';
import Layout from './Layout';
import { useIsPremium } from '../hooks/useIsPremium';
import InviteCodeModal from './InviteCodeModal';

interface Props {
  children: React.ReactNode;
  title: string;
  description: string;
}

export default function PremiumGate({ children, title, description }: Props) {
  const { isPremium, loading, refresh } = useIsPremium();
  const [showInviteModal, setShowInviteModal] = useState(false);

  if (loading) {
    return (
      <Layout>
        <main className="max-w-lg mx-auto px-4 py-20 text-center">
          <p className="text-sm text-gray-500">読み込み中...</p>
        </main>
      </Layout>
    );
  }

  if (!isPremium) {
    return (
      <Layout>
        <main className="max-w-lg mx-auto px-4 py-10">
          <div className="text-center space-y-6">
            <h1 className="text-xl font-bold text-gray-800">{title}</h1>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-8">
              <div className="text-4xl mb-4">🔒</div>
              <p className="text-sm text-gray-700 mb-2">この機能は有料プランでご利用いただけます</p>
              <p className="text-xs text-gray-500 mb-6">{description}</p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
              >
                招待コードをお持ちの方はこちら
              </button>
            </div>
          </div>
          {showInviteModal && (
            <InviteCodeModal
              onSuccess={() => { setShowInviteModal(false); refresh(); }}
              onClose={() => setShowInviteModal(false)}
            />
          )}
        </main>
      </Layout>
    );
  }

  return <>{children}</>;
}
