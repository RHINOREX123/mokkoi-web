import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { initAnalytics } from './lib/analytics'
import './index.css'
import App from './App'
import LandingPage from './pages/LandingPage'
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
        <Route path="/" element={<RootPage />} />
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
        <Route path="/docs" element={<ComingSoonPage title="Docs" blurb="Full developer docs are on the way. In the meantime, hop into the app and start building — it's pretty self-explanatory." />} />
        <Route path="/blog" element={<ComingSoonPage title="Blog" blurb="We're writing. Follow along for build logs, launches, and what we're learning." />} />
        <Route path="/changelog" element={<ComingSoonPage title="Changelog" blurb="Every update, every fix. Public changelog coming soon." />} />
        <Route path="/about" element={<ComingSoonPage title="About Mokkoi" blurb="We're building the fastest way to go from idea to mobile app. More about the team and mission soon." />} />
        <Route path="/support" element={<ComingSoonPage title="Support" blurb="Need help? Reach us on Twitter — we reply fast." />} />
        <Route path="/terms" element={<ComingSoonPage title="Terms of Service" blurb="Formal terms are being drafted. By using Mokkoi today you agree to the standard terms: don't abuse the service, don't generate harmful content, you own what you build." />} />
        <Route path="/privacy" element={<ComingSoonPage title="Privacy Policy" blurb="Formal policy coming soon. Short version: we store only what's needed to run the service (your projects, auth, usage), we don't sell data, we use Supabase/Stripe/Anthropic as subprocessors." />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
