import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import NoticeBanner from './components/NoticeBanner'
import { installReloadOnPreloadError } from './lib/reloadOnPreloadError'

installReloadOnPreloadError()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <NoticeBanner />
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
