import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!supabase) {
      navigate('/auth', { replace: true })
      return
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/auth', { replace: true })
      } else {
        setChecked(true)
      }
    })
  }, [navigate])

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
