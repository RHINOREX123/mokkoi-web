import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { initAnalytics } from './lib/analytics'
import './index.css'
import App from './App'
import LandingPage from './pages/LandingPage'
import XrayLanding from './pages/XrayLanding'
import XrayDocPage from './pages/XrayDocPage'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import AuthGuard from './components/AuthGuard'
import PublicViewPage from './pages/PublicViewPage'
import PreviewPage from './pages/PreviewPage'
import PricingPage from './components/PricingPage'
import AdminDashboard from './pages/AdminDashboard'
import SettingsPage from './pages/SettingsPage'
import AdminGuard from './components/AdminGuard'
import ComingSoonPage from './pages/ComingSoonPage'
import RuntimePoc from './pages/RuntimePoc'
import PlanModePreview from './pages/PlanModePreview'
import { supabase } from './lib/supabase'

initAnalytics()

/** Root route: logged-in → Dashboard, logged-out → LandingPage */
function RootPage() {
  const [state, setState] = useState<'loading' | 'authed' | 'guest'>('loading')

  useEffect(() => {
    if (!supabase) { setState('guest'); return }
    supabase.auth.getUser().then(({ data: { user } }) => {
      setState(user ? 'authed' : 'guest')
    })
  }, [])

  if (state === 'loading') {
    return (
      <div style={{
        height: '100vh', background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', fontSize: 14, fontFamily: "'DM Sans', sans-serif",
      }}>Loading...</div>
    )
  }

  return state === 'authed' ? <Dashboard /> : <LandingPage />
}

/** /projects redirect: logged-in → /, logged-out → /auth */
function ProjectsRedirect() {
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!supabase) { navigate('/auth', { replace: true }); return }
    supabase.auth.getUser().then(({ data: { user } }) => {
      navigate(user ? '/' : '/auth', { replace: true })
      setChecked(true)
    })
  }, [navigate])

  if (!checked) {
    return (
      <div style={{
        height: '100vh', background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', fontSize: 14, fontFamily: "'DM Sans', sans-serif",
      }}>Loading...</div>
    )
  }

  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<XrayLanding />} />
        {/* Previous mobile-builder home (dashboard / old landing), kept reachable during the pivot. */}
        <Route path="/legacy" element={<RootPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/projects" element={<ProjectsRedirect />} />
        <Route path="/app/:projectId" element={<AuthGuard><App /></AuthGuard>} />
        <Route path="/app" element={<Navigate to="/" replace />} />
        <Route path="/view/:projectId" element={<PublicViewPage />} />
        <Route path="/preview/:projectId/:screenId" element={<PreviewPage />} />
        <Route path="/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
        <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
        <Route path="/runtime-poc" element={<RuntimePoc />} />
        {/* Dev-only Plan Mode component preview. Tree-shaken from prod
            builds via the import.meta.env.DEV gate. */}
        {import.meta.env.DEV && (
          <Route path="/__plan-mode-preview" element={<PlanModePreview />} />
        )}
        <Route path="/docs" element={<ComingSoonPage title="Docs" blurb="Full developer docs are on the way. In the meantime, hop into the app and start building — it's pretty self-explanatory." />} />
        <Route path="/blog" element={<ComingSoonPage title="Blog" blurb="We're writing. Follow along for build logs, launches, and what we're learning." />} />
        <Route path="/changelog" element={<ComingSoonPage title="Changelog" blurb="Every update, every fix. Public changelog coming soon." />} />
        <Route path="/about" element={<ComingSoonPage title="About Mokkoi" blurb="We're building the fastest way to go from idea to mobile app. More about the team and mission soon." />} />
        <Route path="/support" element={<XrayDocPage page="support" />} />
        <Route path="/terms" element={<XrayDocPage page="terms" />} />
        <Route path="/privacy" element={<XrayDocPage page="privacy" />} />
        <Route path="/refunds" element={<XrayDocPage page="refunds" />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
