import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean)

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (!supabase) {
      navigate('/auth', { replace: true })
      return
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/auth', { replace: true })
        return
      }

      const email = (user.email || '').toLowerCase()
      if (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(email)) {
        setChecked(true)
      } else if (ADMIN_EMAILS.length === 0) {
        // No admin emails configured — deny all access for safety
        setDenied(true)
      } else {
        setDenied(true)
      }
    })
  }, [navigate])

  if (denied) {
    return (
      <div style={{
        height: '100vh', background: '#000',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#ef4444', fontSize: 16, gap: 12,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <span style={{ fontSize: 24, fontWeight: 700 }}>Access Denied</span>
        <span style={{ color: '#64748b', fontSize: 14 }}>You do not have admin privileges.</span>
        <button onClick={() => navigate('/projects')} style={{
          marginTop: 16, padding: '8px 20px', borderRadius: 8,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#e2e8f0', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}>Go to Projects</button>
      </div>
    )
  }

  if (!checked) {
    return (
      <div style={{
        height: '100vh', background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        Loading...
      </div>
    )
  }

  return <>{children}</>
}
