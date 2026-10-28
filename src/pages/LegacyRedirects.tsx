import { lazy, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { legacyLoading } from './legacyLoading'

const LandingPage = lazy(() => import('./LandingPage'))
const Dashboard = lazy(() => import('./Dashboard'))

/** Root route: logged-in → Dashboard, logged-out → LandingPage */
export function RootPage() {
  const [state, setState] = useState<'loading' | 'authed' | 'guest'>(supabase ? 'loading' : 'guest')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      setState(user ? 'authed' : 'guest')
    })
  }, [])

  if (state === 'loading') return legacyLoading

  return state === 'authed' ? <Dashboard /> : <LandingPage />
}

/** /projects redirect: logged-in → /, logged-out → /auth */
export function ProjectsRedirect() {
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!supabase) { navigate('/auth', { replace: true }); return }
    supabase.auth.getUser().then(({ data: { user } }) => {
      navigate(user ? '/' : '/auth', { replace: true })
      setChecked(true)
    })
  }, [navigate])

  if (!checked) return legacyLoading

  return null
}
