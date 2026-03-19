import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
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
import AdminGuard from './components/AdminGuard'
import { supabase } from './lib/supabase'

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
        <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
