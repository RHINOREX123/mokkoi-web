import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { trackEvent } from '../lib/analytics'
import type { User } from '@supabase/supabase-js'
import {
  ArrowLeft, Copy, Check, Download, Trash2, AlertTriangle,
  Zap, ExternalLink, ChevronDown,
} from 'lucide-react'

const GRADIENT_PAIRS = [
  ['#6366f1', '#818cf8'],
  ['#8b5cf6', '#a78bfa'],
  ['#ec4899', '#f472b6'],
  ['#f97316', '#fb923c'],
  ['#14b8a6', '#2dd4bf'],
  ['#3b82f6', '#60a5fa'],
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const sectionStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16,
  padding: 24,
  marginBottom: 24,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: 1,
  color: '#64748b',
  marginBottom: 16,
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#94a3b8',
  minWidth: 120,
  flexShrink: 0,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#f1f5f9',
  fontSize: 14,
  outline: 'none',
  fontFamily: "'DM Sans', sans-serif",
  flex: 1,
  maxWidth: 280,
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  background: 'linear-gradient(135deg, #6366f1, #818cf8)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  transition: 'opacity 0.2s',
}

const btnOutline: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  background: 'transparent',
  color: '#94a3b8',
  border: '1px solid rgba(255,255,255,0.1)',
  cursor: 'pointer',
  transition: 'all 0.2s',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
  paddingRight: 32,
  cursor: 'pointer',
  maxWidth: 200,
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [credits, setCredits] = useState<{ plan: string; remaining: number; limit: number } | null>(null)
  const [toastMessage, setToastMessage] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('mokkoi_theme_preference') || 'dark')
  const [model, setModel] = useState(() => localStorage.getItem('mokkoi_model_preference') || 'auto')
  const [mcpCopied, setMcpCopied] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u)
      if (!u) return
      setDisplayName(u.user_metadata?.display_name || u.user_metadata?.full_name || '')
      supabase!.from('subscriptions').select('plan, credits_remaining, credits_monthly_limit')
        .eq('user_id', u.id).maybeSingle()
        .then(({ data }) => {
          if (data) setCredits({ plan: data.plan || 'free', remaining: data.credits_remaining, limit: data.credits_monthly_limit })
          else setCredits({ plan: 'free', remaining: 50, limit: 50 })
        })
    })
  }, [])

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(''), 2500)
      return () => clearTimeout(t)
    }
  }, [toastMessage])

  const saveDisplayName = async () => {
    if (!supabase || !displayName.trim()) return
    setSavingName(true)
    await supabase.auth.updateUser({ data: { display_name: displayName.trim() } })
    setSavingName(false)
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  const handleExportData = async () => {
    if (!supabase || !user) return
    setExporting(true)
    try {
      const { data: projects } = await supabase.from('projects').select('*').eq('user_id', user.id)
      const allData: Record<string, unknown> = { projects: [] }
      if (projects) {
        const withScreens = await Promise.all(projects.map(async (p) => {
          const { data: screens } = await supabase!.from('screens').select('*').eq('project_id', p.id)
          return { ...p, screens: screens || [] }
        }))
        allData.projects = withScreens
      }
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mokkoi-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      trackEvent('data_exported')
      setToastMessage('Data exported successfully')
    } catch {
      setToastMessage('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!supabase || !user || deleteText !== 'DELETE') return
    setDeleting(true)
    try {
      // Delete user data
      await supabase.from('messages').delete().eq('user_id', user.id)
      const { data: projects } = await supabase.from('projects').select('id').eq('user_id', user.id)
      if (projects) {
        for (const p of projects) {
          await supabase.from('screens').delete().eq('project_id', p.id)
        }
      }
      await supabase.from('projects').delete().eq('user_id', user.id)
      await supabase.from('subscriptions').delete().eq('user_id', user.id)
      await supabase.auth.signOut()
      trackEvent('account_deleted')
      navigate('/auth')
    } catch {
      setToastMessage('Failed to delete account. Contact support at contact@mokkoi.com')
      setDeleting(false)
    }
  }

  const handleThemeChange = (val: string) => {
    setTheme(val)
    localStorage.setItem('mokkoi_theme_preference', val)
  }

  const handleModelChange = (val: string) => {
    setModel(val)
    localStorage.setItem('mokkoi_model_preference', val)
  }

  const copyMcpCommand = () => {
    navigator.clipboard.writeText('npx mokkoi-mcp --api-key YOUR_API_KEY')
    setMcpCopied(true)
    setTimeout(() => setMcpCopied(false), 2000)
  }

  const userInitial = (displayName?.[0] || user?.email?.[0] || '?').toUpperCase()
  const gradientIdx = hashString(displayName || user?.email || 'U') % GRADIENT_PAIRS.length
  const [g1, g2] = GRADIENT_PAIRS[gradientIdx]
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  return (
    <div style={{
      minHeight: '100vh', background: '#000000',
      fontFamily: "'DM Sans', sans-serif", color: '#f1f5f9',
    }}>
      {/* Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 20px', borderRadius: 10, zIndex: 200,
          background: '#1a1a2e', color: '#34d399', fontSize: 13, fontWeight: 500,
          border: '1px solid rgba(52,211,153,0.2)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>{toastMessage}</div>
      )}

      {/* Header */}
      <div style={{
        maxWidth: 720, margin: '0 auto', padding: '24px 24px 0',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none',
            color: '#94a3b8', fontSize: 14, fontWeight: 500,
            cursor: 'pointer', padding: 0, marginBottom: 24,
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 32px', letterSpacing: '-0.02em' }}>
          Settings
        </h1>

        {/* ─── Profile ─── */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Profile</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${g1}, ${g2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: '#fff',
            }}>{userInitial}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>
                {displayName || user?.email || 'User'}
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{user?.email}</div>
            </div>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Email</span>
            <span style={{ fontSize: 14, color: '#e2e8f0' }}>{user?.email || '—'}</span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Display Name</span>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveDisplayName() }}
              style={inputStyle}
              placeholder="Enter display name"
            />
            <button
              onClick={saveDisplayName}
              disabled={savingName}
              style={{ ...btnPrimary, opacity: savingName ? 0.7 : 1, minWidth: 60 }}
            >
              {nameSaved ? <Check size={14} /> : savingName ? '...' : 'Save'}
            </button>
          </div>

          {memberSince && (
            <div style={rowStyle}>
              <span style={labelStyle}>Member since</span>
              <span style={{ fontSize: 14, color: '#e2e8f0' }}>{memberSince}</span>
            </div>
          )}
        </div>

        {/* ─── Subscription ─── */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Subscription</div>

          <div style={rowStyle}>
            <span style={labelStyle}>Current Plan</span>
            <span style={{
              fontSize: 14, fontWeight: 600, color: '#f1f5f9',
              textTransform: 'capitalize' as const,
            }}>{credits?.plan || 'Free'}</span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Credits</span>
            <span style={{ fontSize: 14, color: '#e2e8f0' }}>
              {credits?.remaining ?? 50} / {credits?.limit ?? 50} remaining
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)',
            marginBottom: 16, overflow: 'hidden', maxWidth: 400,
          }}>
            <div style={{
              height: '100%', borderRadius: 3, transition: 'width 0.3s',
              width: `${Math.max(0, Math.min(100, ((credits?.remaining ?? 50) / (credits?.limit ?? 50)) * 100))}%`,
              background: (credits?.remaining ?? 50) === 0 ? '#ef4444'
                : (credits?.remaining ?? 50) < 20 ? '#f97316'
                : 'linear-gradient(90deg, #6366f1, #818cf8)',
            }} />
          </div>

          <button
            onClick={() => navigate('/pricing')}
            style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Zap size={14} />
            {credits?.plan === 'free' ? 'Upgrade to Pro — $19/mo' : 'Manage Subscription'}
          </button>

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Credit Usage</div>
            {[
              ['New screen', '5 credits'],
              ['Edit screen', '1 credit'],
              ['Generate flow', '15 credits'],
              ['Screenshot to screen', '8 credits'],
            ].map(([label, cost]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 300, padding: '4px 0' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>{label}</span>
                <span style={{ fontSize: 13, color: '#e2e8f0' }}>{cost}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── MCP Server ─── */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>MCP Server</div>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.5 }}>
            Connect Mokkoi to your AI coding agent
          </p>

          <div style={{ marginBottom: 12, fontSize: 13, color: '#94a3b8' }}>Install & run:</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: '12px 16px',
            marginBottom: 16,
          }}>
            <code style={{
              flex: 1, fontSize: 13, color: '#818cf8',
              fontFamily: "'JetBrains Mono', monospace",
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              npx mokkoi-mcp --api-key YOUR_API_KEY
            </code>
            <button
              onClick={copyMcpCommand}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: mcpCopied ? '#34d399' : '#94a3b8',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.2s', flexShrink: 0,
              }}
            >
              {mcpCopied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>

          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
            Works with: Claude Code, Cursor, Windsurf, and any MCP-compatible editor.
          </p>

          <a
            href="https://www.npmjs.com/package/mokkoi-mcp"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: '#818cf8', textDecoration: 'none',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            <ExternalLink size={13} /> View documentation
          </a>
        </div>

        {/* ─── Preferences ─── */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Preferences</div>

          <div style={rowStyle}>
            <span style={labelStyle}>Default Theme</span>
            <div style={{ position: 'relative' }}>
              <select
                value={theme}
                onChange={e => handleThemeChange(e.target.value)}
                style={selectStyle}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
              <ChevronDown size={14} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                color: '#64748b', pointerEvents: 'none',
              }} />
            </div>
          </div>
          {theme !== 'dark' && (
            <div style={{ fontSize: 12, color: '#f97316', marginBottom: 12, marginLeft: 132 }}>
              Light theme coming soon
            </div>
          )}

          <div style={rowStyle}>
            <span style={labelStyle}>Default AI Model</span>
            <div style={{ position: 'relative' }}>
              <select
                value={model}
                onChange={e => handleModelChange(e.target.value)}
                style={selectStyle}
              >
                <option value="auto">Auto</option>
                <option value="sonnet">Sonnet (quality)</option>
                <option value="haiku">Haiku (fast)</option>
              </select>
              <ChevronDown size={14} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                color: '#64748b', pointerEvents: 'none',
              }} />
            </div>
          </div>
        </div>

        {/* ─── Danger Zone ─── */}
        <div style={{
          ...sectionStyle,
          borderColor: 'rgba(239,68,68,0.2)',
          background: 'rgba(239,68,68,0.02)',
          marginBottom: 60,
        }}>
          <div style={{ ...sectionTitleStyle, color: '#ef4444' }}>Danger Zone</div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>
              Export My Data
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>
              Download all your projects and screens as JSON
            </div>
            <button
              onClick={handleExportData}
              disabled={exporting}
              style={{ ...btnOutline, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={14} /> {exporting ? 'Exporting...' : 'Export Data'}
            </button>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />

          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>
              Delete Account
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>
              Permanently delete your account and all data
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                ...btnOutline,
                display: 'flex', alignItems: 'center', gap: 6,
                color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)',
              }}
            >
              <Trash2 size={14} /> Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowDeleteModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#1A1A1A', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 16, padding: 24,
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)', maxWidth: 440, width: '90%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={20} color="#ef4444" />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>Delete Account</h3>
            </div>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 16px' }}>
              Are you sure? This will permanently delete all your projects, screens, and account data.
              This cannot be undone.
            </p>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
              Type <strong style={{ color: '#ef4444' }}>DELETE</strong> to confirm:
            </div>
            <input
              value={deleteText}
              onChange={e => setDeleteText(e.target.value)}
              placeholder="Type DELETE"
              style={{
                ...inputStyle,
                maxWidth: '100%', width: '100%', marginBottom: 16,
                borderColor: deleteText === 'DELETE' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowDeleteModal(false); setDeleteText('') }} style={btnOutline}>
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteText !== 'DELETE' || deleting}
                style={{
                  ...btnPrimary,
                  background: deleteText === 'DELETE' ? '#ef4444' : 'rgba(255,255,255,0.06)',
                  opacity: deleteText !== 'DELETE' || deleting ? 0.5 : 1,
                  cursor: deleteText !== 'DELETE' ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        select option {
          background: #1A1A1A;
          color: #f1f5f9;
        }
      `}</style>
    </div>
  )
}
