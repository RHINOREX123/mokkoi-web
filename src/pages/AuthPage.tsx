import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { trackEvent, identifyUser } from '../lib/analytics'

const C = {
  bg: '#06080D',
  bgCard: '#0D1117',
  border: '#1C2333',
  text: '#E6EDF3',
  textMuted: '#7D8590',
  textDim: '#484F58',
  accent: '#2563EB',
  accentHover: '#1D4ED8',
  accentGlow: '#2563EB30',
  teal: '#14B8A6',
  gradient: 'linear-gradient(135deg, #2563EB, #14B8A6)',
}

export default function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pendingPrompt = searchParams.get('prompt') || ''
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const navigateAfterAuth = async () => {
    if (pendingPrompt && supabase) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('projects')
          .insert({ user_id: user.id, name: pendingPrompt.slice(0, 30) })
          .select()
          .single()
        if (data) {
          navigate(`/app/${data.id}?prompt=${encodeURIComponent(pendingPrompt)}`)
          return
        }
      }
    }
    navigate('/projects')
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      if (!supabase) throw new Error('Supabase is not configured.')
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: pendingPrompt
            ? `${window.location.origin}/auth?prompt=${encodeURIComponent(pendingPrompt)}`
            : `${window.location.origin}/projects`,
        },
      })
      if (error) throw error
      trackEvent('google_signin_initiated')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!supabase) throw new Error('Supabase is not configured. Please set environment variables.')
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          trackEvent('signup_completed')
          identifyUser(user.id, { email: user.email })
        }
        await navigateAfterAuth()
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        const { data: { user } } = await supabase.auth.getUser()
        if (user) identifyUser(user.id, { email: user.email })
        await navigateAfterAuth()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif", position: 'relative', overflow: 'hidden',
    }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Grid background */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `linear-gradient(${C.border} 1px, transparent 1px), linear-gradient(90deg, ${C.border} 1px, transparent 1px)`, backgroundSize: '60px 60px', opacity: 0.1, pointerEvents: 'none' }} />

      {/* Glow orb */}
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: C.accent, filter: 'blur(150px)', opacity: 0.08, top: '30%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />

      <div style={{
        width: '100%', maxWidth: 400, padding: 40, position: 'relative', zIndex: 1,
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{
            fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700,
            letterSpacing: -0.5, background: C.gradient,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            mokkoi
          </div>
          <h1 style={{
            fontSize: 20, fontWeight: 600, color: C.text,
            margin: 0, letterSpacing: '-0.02em',
          }}>
            {isSignUp ? 'Create your account' : 'Sign in to Mokkoi'}
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
            {isSignUp ? 'Start building mobile apps with AI' : 'Welcome back, builder'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 10, marginBottom: 16,
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.15)',
            color: '#f87171', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Google OAuth */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 10,
            background: C.bgCard, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 14, fontWeight: 500,
            cursor: googleLoading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 0.2s', fontFamily: "'DM Sans', sans-serif",
            opacity: googleLoading ? 0.6 : 1,
            marginBottom: 20,
          }}
          onMouseEnter={e => { if (!googleLoading) { e.currentTarget.style.borderColor = C.textDim; e.currentTarget.style.background = '#151B25' } }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bgCard }}
        >
          {/* Google icon */}
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {googleLoading ? 'Connecting...' : 'Continue with Google'}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ fontSize: 12, color: C.textDim, fontWeight: 500 }}>or</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isSignUp && (
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = C.accent }}
              onBlur={e => { e.currentTarget.style.borderColor = C.border }}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = C.accent }}
            onBlur={e => { e.currentTarget.style.borderColor = C.border }}
          />
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ ...inputStyle, paddingRight: 44, width: '100%', boxSizing: 'border-box' }}
              onFocus={e => { e.currentTarget.style.borderColor = C.accent }}
              onBlur={e => { e.currentTarget.style.borderColor = C.border }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: C.textMuted, display: 'flex', alignItems: 'center',
              }}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 24px', borderRadius: 10,
              background: loading ? 'rgba(37,99,235,0.3)' : C.accent,
              color: '#fff', fontSize: 15, fontWeight: 600,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', marginTop: 4,
              boxShadow: loading ? 'none' : `0 0 20px ${C.accentGlow}`,
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = C.accentHover }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = C.accent }}
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Toggle */}
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: C.textMuted }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError('') }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.teal, fontWeight: 600, fontSize: 13,
              textDecoration: 'underline', textUnderlineOffset: 3,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  background: '#0D1117',
  border: '1px solid #1C2333',
  color: '#E6EDF3',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s',
  fontFamily: "'DM Sans', sans-serif",
}
