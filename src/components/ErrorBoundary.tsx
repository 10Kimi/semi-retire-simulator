import { Component, type ErrorInfo, type ReactNode } from 'react';

// 画面のどこかで例外が出ても真っ白にせず、再読み込みを促す（FI_project #136）
export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <h2 className="text-lg font-bold text-gray-800 mb-2">問題が起きました</h2>
          <p className="text-sm text-gray-600 mb-6">お手数ですが、ページを再読み込みしてください。</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white rounded py-3 md:py-2 text-sm font-semibold hover:bg-blue-700 min-h-[44px]"
          >
            ページを再読み込み
          </button>
        </div>
      </div>
    );
  }
}
