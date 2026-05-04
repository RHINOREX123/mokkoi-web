import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { trackEvent, resetAnalytics } from '../lib/analytics'
import {
  Search, MoreVertical, Trash2, Pencil, LogOut, Settings,
  FolderOpen, Users, Smartphone, ArrowUp, Download,
  Zap, Copy, Menu, X,
} from 'lucide-react'

interface Project {
  id: string
  name: string
  is_public?: boolean
  created_at: string
  updated_at: string
  screen_count?: number
}

const SUGGESTION_CHIPS = [
  'A fitness tracking app',
  'An e-commerce shopping app',
  'A social media app',
  'A banking & finance app',
  'A music streaming app',
  'A food delivery app',
]

// Hash a string to pick a gradient pair
const GRADIENT_PAIRS = [
  ['#6366f1', '#818cf8'],
  ['#8b5cf6', '#a78bfa'],
  ['#ec4899', '#f472b6'],
  ['#f97316', '#fb923c'],
  ['#14b8a6', '#2dd4bf'],
  ['#3b82f6', '#60a5fa'],
  ['#e11d48', '#fb7185'],
  ['#84cc16', '#a3e635'],
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function groupProjectsByRecency(projects: Project[]) {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  return {
    last7Days: projects.filter(p => new Date(p.updated_at) > sevenDaysAgo),
    last30Days: projects.filter(p => {
      const d = new Date(p.updated_at)
      return d <= sevenDaysAgo && d > thirtyDaysAgo
    }),
    older: projects.filter(p => new Date(p.updated_at) <= thirtyDaysAgo),
  }
}

const sidebarItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', padding: '8px 10px', borderRadius: 8,
  background: 'transparent', border: 'none',
  color: '#e2e8f0', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', transition: 'background 0.15s',
  textAlign: 'left',
}

const avatarMenuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', padding: '10px 12px', borderRadius: 8,
  background: 'transparent', border: 'none',
  color: '#e2e8f0', fontSize: 14, fontWeight: 500,
  cursor: 'pointer', transition: 'background 0.15s',
  textAlign: 'left',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [prompt, setPrompt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showCreditsDropdown, setShowCreditsDropdown] = useState(false)
  const [credits, setCredits] = useState<{ plan: string; remaining: number; limit: number } | null>(null)
  const [toastMessage, setToastMessage] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'projects' | 'imports'>('projects')
  const [importProjects, setImportProjects] = useState<Project[]>([])


  const userMenuRef = useRef<HTMLDivElement>(null)
  const creditsRef = useRef<HTMLDivElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load user + projects + credits
  useEffect(() => {
    const sb = supabase
    if (!sb) return
    let realtimeSub: ReturnType<typeof sb.channel> | null = null

    sb.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u)
      if (!u) return
      // Credits
      sb.from('subscriptions').select('plan, credits_remaining, credits_monthly_limit')
        .eq('user_id', u.id).maybeSingle()
        .then(({ data }) => {
          if (data) setCredits({ plan: data.plan || 'free', remaining: data.credits_remaining, limit: data.credits_monthly_limit })
          else setCredits({ plan: 'free', remaining: 50, limit: 50 })
        })
      // Realtime credits
      realtimeSub = sb.channel('dashboard-credits')
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'subscriptions',
          filter: `user_id=eq.${u.id}`,
        }, (payload: { new: { plan?: string; credits_remaining?: number; credits_monthly_limit?: number } }) => {
          const row = payload.new
          setCredits({ plan: row.plan || 'free', remaining: row.credits_remaining ?? 0, limit: row.credits_monthly_limit ?? 50 })
        })
        .subscribe()
    })

    loadProjects()

    return () => { if (realtimeSub) sb.removeChannel(realtimeSub) }
  }, [])

  useEffect(() => {
    if (renamingId && renameRef.current) { renameRef.current.focus(); renameRef.current.select() }
  }, [renamingId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false)
      if (creditsRef.current && !creditsRef.current.contains(e.target as Node)) setShowCreditsDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (toastMessage) { const t = setTimeout(() => setToastMessage(''), 2000); return () => clearTimeout(t) }
  }, [toastMessage])

  const loadProjects = async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const sb = supabase

    // User's own projects (source is null or 'web')
    const { data: projectRows } = await sb
      .from('projects').select('*')
      .or('source.is.null,source.eq.web')
      .order('updated_at', { ascending: false })
    if (projectRows) {
      const withCounts: Project[] = await Promise.all(
        projectRows.map(async (p) => {
          const { count } = await sb.from('screens')
            .select('*', { count: 'exact', head: true }).eq('project_id', p.id)
          return { ...p, screen_count: count ?? 0 }
        })
      )
      setProjects(withCounts)
    }

    // MCP import projects
    const { data: importRows } = await sb
      .from('projects').select('*')
      .eq('source', 'mcp')
      .order('updated_at', { ascending: false })
    if (importRows) {
      const withCounts: Project[] = await Promise.all(
        importRows.map(async (p) => {
          const { count } = await sb.from('screens')
            .select('*', { count: 'exact', head: true }).eq('project_id', p.id)
          return { ...p, screen_count: count ?? 0 }
        })
      )
      setImportProjects(withCounts)
    }

    setLoading(false)
  }

  const handleSubmitPrompt = async () => {
    if (!prompt.trim() || isSubmitting) return
    setIsSubmitting(true)
    if (!supabase) { navigate('/auth'); return }
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { navigate('/auth'); return }
    const { data } = await supabase
      .from('projects')
      .insert({ user_id: u.id, name: prompt.trim().slice(0, 30) })
      .select().single()
    if (data) {
      trackEvent('dashboard_prompt_submitted')
      trackEvent('project_created', { source: 'dashboard' })
      navigate(`/app/${data.id}?prompt=${encodeURIComponent(prompt.trim())}`)
    }
    setIsSubmitting(false)
  }

  const deleteProject = async (id: string) => {
    if (!supabase) return
    await supabase.from('projects').delete().eq('id', id)
    setProjects(prev => prev.filter(p => p.id !== id))
    setImportProjects(prev => prev.filter(p => p.id !== id))
    setMenuOpen(null)
  }

  const renameProject = async (id: string, name: string) => {
    if (!supabase) return
    const trimmed = name.trim() || 'Untitled Project'
    await supabase.from('projects').update({ name: trimmed }).eq('id', id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: trimmed } : p))
    setRenamingId(null)
  }

  const duplicateProject = async (id: string) => {
    if (!supabase || !user) return
    const original = projects.find(p => p.id === id)
    if (!original) return
    const { data } = await supabase.from('projects')
      .insert({ user_id: user.id, name: `${original.name} (copy)` })
      .select().single()
    if (data) {
      // Copy screens
      const { data: screens } = await supabase.from('screens')
        .select('*').eq('project_id', id)
      if (screens && screens.length > 0) {
        await supabase.from('screens').insert(
          screens.map((s: { name: string; component_tree: unknown; order_index: number }) => ({
            project_id: data.id, name: s.name, component_tree: s.component_tree, order_index: s.order_index,
          }))
        )
      }
      loadProjects()
      setToastMessage('Project duplicated')
    }
    setMenuOpen(null)
  }

  const handleSignOut = async () => {
    resetAnalytics()
    if (supabase) await supabase.auth.signOut()
    navigate('/auth')
  }

  const activeList = activeTab === 'imports' ? importProjects : projects
  const filtered = useMemo(() =>
    activeList.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [activeList, search]
  )

  const grouped = useMemo(() => groupProjectsByRecency(filtered), [filtered])

  const userInitial = user?.user_metadata?.full_name?.[0]?.toUpperCase()
    || user?.email?.[0]?.toUpperCase() || '?'
  const userName = user?.user_metadata?.full_name || user?.email || 'User'
  const firstName = (user?.user_metadata?.full_name || user?.email || 'there').split(/[\s@]/)[0]

  const hasProjects = projects.length > 0

  // Render a project item for the sidebar
  const renderProjectItem = (project: Project) => {
    const gradientIdx = hashString(project.name) % GRADIENT_PAIRS.length
    const [g1, g2] = GRADIENT_PAIRS[gradientIdx]
    return (
      <div key={project.id} style={{ position: 'relative' }}>
        <button
          onClick={() => { navigate(`/app/${project.id}`); setMobileSidebarOpen(false) }}
          style={{
            ...sidebarItemStyle,
            gap: 10,
            position: 'relative',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          {/* Thumbnail */}
          <div style={{
            width: 40, height: 40, borderRadius: 8, flexShrink: 0,
            background: `linear-gradient(135deg, ${g1}, ${g2})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0.85,
          }}>
            <Smartphone size={18} color="rgba(255,255,255,0.8)" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            {renamingId === project.id ? (
              <input
                ref={renameRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') renameProject(project.id, renameValue)
                  if (e.key === 'Escape') setRenamingId(null)
                }}
                onBlur={() => renameProject(project.id, renameValue)}
                onClick={e => e.stopPropagation()}
                style={{
                  fontSize: 13, fontWeight: 500, color: '#f1f5f9',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(99,102,241,0.4)',
                  borderRadius: 4, padding: '1px 6px', outline: 'none', width: '100%',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            ) : (
              <div style={{
                fontSize: 13, fontWeight: 500, color: '#e2e8f0',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{project.name}</div>
            )}
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {formatDate(project.updated_at)}
            </div>
          </div>
        </button>
        {/* Three-dot menu */}
        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === project.id ? null : project.id) }}
          style={{
            position: 'absolute', top: 8, right: 4,
            width: 24, height: 24, borderRadius: 4,
            background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#64748b', opacity: 0.5,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.5' }}
        >
          <MoreVertical size={14} />
        </button>
        {/* Context menu */}
        {menuOpen === project.id && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 32, right: 4, zIndex: 60,
              background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              minWidth: 140,
            }}
          >
            <button onClick={() => { setRenamingId(project.id); setRenameValue(project.name); setMenuOpen(null) }}
              style={{ ...sidebarItemStyle, fontSize: 12 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            ><Pencil size={13} /> Rename</button>
            <button onClick={() => duplicateProject(project.id)}
              style={{ ...sidebarItemStyle, fontSize: 12 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            ><Copy size={13} /> Duplicate</button>
            <button onClick={() => { setDeleteConfirmId(project.id); setMenuOpen(null) }}
              style={{ ...sidebarItemStyle, fontSize: 12, color: '#f87171' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            ><Trash2 size={13} /> Delete</button>
          </div>
        )}
      </div>
    )
  }

  const renderGroupedProjects = () => {
    if (loading) return <div style={{ padding: 20, color: '#64748b', fontSize: 13 }}>Loading...</div>
    if (filtered.length === 0) {
      return <div style={{ padding: '20px 10px', color: '#64748b', fontSize: 13 }}>
        {search
          ? 'No projects match your search'
          : activeTab === 'imports'
            ? 'No imports yet. Use the Mokkoi MCP server in Claude Code to import designs.'
            : 'No projects yet'}
      </div>
    }
    return (
      <>
        {grouped.last7Days.length > 0 && (
          <>
            <div style={{ padding: '12px 10px 4px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Last 7 days</div>
            {grouped.last7Days.map(renderProjectItem)}
          </>
        )}
        {grouped.last30Days.length > 0 && (
          <>
            <div style={{ padding: '12px 10px 4px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Last 30 days</div>
            {grouped.last30Days.map(renderProjectItem)}
          </>
        )}
        {grouped.older.length > 0 && (
          <>
            <div style={{ padding: '12px 10px 4px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Older</div>
            {grouped.older.map(renderProjectItem)}
          </>
        )}
      </>
    )
  }

  const sidebarContent = (
    <>
      {/* Tabs */}
      <button onClick={() => setActiveTab('projects')} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10,
        background: activeTab === 'projects' ? 'rgba(99,102,241,0.1)' : 'transparent',
        border: activeTab === 'projects' ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
        color: activeTab === 'projects' ? '#818cf8' : '#64748b',
        fontSize: 14, fontWeight: activeTab === 'projects' ? 600 : 500,
        cursor: 'pointer', width: '100%', textAlign: 'left',
        transition: 'all 0.15s',
      }}
        onMouseEnter={e => { if (activeTab !== 'projects') e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
        onMouseLeave={e => { if (activeTab !== 'projects') e.currentTarget.style.background = 'transparent' }}
      >
        <FolderOpen size={18} /> My Projects
      </button>
      <button onClick={() => setActiveTab('imports')} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10,
        background: activeTab === 'imports' ? 'rgba(52,211,153,0.1)' : 'transparent',
        border: activeTab === 'imports' ? '1px solid rgba(52,211,153,0.2)' : '1px solid transparent',
        color: activeTab === 'imports' ? '#34d399' : '#64748b',
        fontSize: 14, fontWeight: activeTab === 'imports' ? 600 : 500,
        cursor: 'pointer', width: '100%', textAlign: 'left',
        marginTop: 4, transition: 'all 0.15s',
      }}
        onMouseEnter={e => { if (activeTab !== 'imports') e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
        onMouseLeave={e => { if (activeTab !== 'imports') e.currentTarget.style.background = 'transparent' }}
      >
        <Download size={18} /> Imports
        {importProjects.length > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 600,
            padding: '2px 8px', borderRadius: 10,
            background: activeTab === 'imports' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
            color: activeTab === 'imports' ? '#34d399' : '#94a3b8',
          }}>{importProjects.length}</span>
        )}
      </button>
      <button onClick={() => setToastMessage('Coming soon')} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10,
        background: 'transparent', border: '1px solid transparent',
        color: '#64748b', fontSize: 14, fontWeight: 500,
        cursor: 'pointer', width: '100%', textAlign: 'left',
        marginTop: 4, transition: 'background 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        <Users size={18} /> Shared with me
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontWeight: 600,
          padding: '2px 8px', borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', color: '#64748b',
        }}>Soon</span>
      </button>

      {/* Search */}
      <div style={{ position: 'relative', marginTop: 12 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
        <input
          type="text" placeholder="Search projects..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#f1f5f9', fontSize: 13, outline: 'none',
            fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
        />
      </div>

      {/* Project list */}
      <div style={{ flex: 1, overflowY: 'auto', marginTop: 8, marginRight: -4, paddingRight: 4 }}>
        {renderGroupedProjects()}
      </div>
    </>
  )

  return (
    <div style={{
      height: '100vh', background: '#000000',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 20px', borderRadius: 10,
          background: '#1a1a2e', color: '#34d399', fontSize: 13, fontWeight: 500,
          border: '1px solid rgba(52,211,153,0.2)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 200,
          animation: 'fadeInDown 0.25s ease-out',
        }}>{toastMessage}</div>
      )}

      {/* Navbar */}
      <nav style={{
        height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', padding: '0 20px',
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 50, flexShrink: 0,
      }}>
        {/* Hamburger menu — always visible, opens sidebar overlay */}
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          style={{
            display: 'flex', width: 32, height: 32, borderRadius: 6,
            background: 'transparent', border: 'none',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#94a3b8', marginRight: 8,
          }}
        >
          <Menu size={20} />
        </button>

        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            color: '#fff', fontSize: 12, fontWeight: 800,
          }}>M</div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>Mokkoi</span>
        </a>

        <div style={{ flex: 1 }} />

        {/* Credits */}
        {credits && (
          <div ref={creditsRef} style={{ position: 'relative', flexShrink: 0, marginRight: 8 }}>
            <button onClick={() => setShowCreditsDropdown(!showCreditsDropdown)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', transition: 'all 0.2s',
              color: credits.remaining === 0 ? '#ef4444' : credits.remaining < 20 ? '#f97316' : '#94a3b8',
            }}>
              <Zap size={12} /> {credits.remaining} remaining
            </button>
            {showCreditsDropdown && (
              <div style={{
                position: 'absolute', top: 34, right: 0, background: '#1A1A1A',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 100, padding: 16, minWidth: 220,
              }}>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                  {credits.remaining} of {credits.limit} screens remaining
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', marginBottom: 12, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3, transition: 'width 0.3s',
                    width: `${Math.max(0, Math.min(100, (credits.remaining / credits.limit) * 100))}%`,
                    background: credits.remaining === 0 ? '#ef4444' : credits.remaining < 20 ? '#f97316' : 'linear-gradient(90deg, #6366f1, #818cf8)',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {credits.plan} plan
                </div>
                <button onClick={() => { navigate('/pricing'); setShowCreditsDropdown(false) }} style={{
                  width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff',
                  border: 'none', cursor: 'pointer',
                }}>
                  {credits.plan === 'free' ? 'Upgrade to Pro' : 'View Plans'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Avatar */}
        <div ref={userMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <div onClick={() => setShowUserMenu(!showUserMenu)} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
            transition: 'box-shadow 0.2s',
            boxShadow: showUserMenu ? '0 0 0 2px rgba(99,102,241,0.4)' : 'none',
          }} title={userName}>{userInitial}</div>
          {showUserMenu && (
            <div style={{
              position: 'absolute', top: 40, right: 0, background: '#1A1A1A',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)', zIndex: 100, minWidth: 260, overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>{userInitial}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email || ''}</div>
                </div>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 12px' }} />
              <div style={{ padding: '4px 8px' }}>
                <button onClick={() => { navigate('/settings'); setShowUserMenu(false) }} style={avatarMenuItemStyle}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                ><Settings size={18} color="#94a3b8" />Settings</button>
                <button onClick={() => { navigate('/pricing'); setShowUserMenu(false) }} style={avatarMenuItemStyle}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                ><Zap size={18} color="#94a3b8" />Pricing</button>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 12px' }} />
              <div style={{ padding: '4px 8px 8px' }}>
                <button onClick={handleSignOut} style={{ ...avatarMenuItemStyle, color: '#f87171' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                ><LogOut size={18} color="#f87171" />Sign Out</button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Sidebar overlay — always overlay-based, never persistent */}
      {mobileSidebarOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }} onClick={() => setMobileSidebarOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 320, height: '100%', background: '#0A0A0A',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column', padding: '16px 12px',
            animation: 'slideInLeft 0.2s ease-out', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={() => setMobileSidebarOpen(false)} style={{
                background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer',
              }}><X size={20} /></button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main content area — full width, prompt-first */}
      <div style={{
        flex: 1, overflowY: 'auto', position: 'relative',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: hasProjects ? 'flex-start' : 'center',
        padding: hasProjects ? '80px 24px 40px' : '40px 24px',
        background: hasProjects
          ? 'radial-gradient(ellipse 1100px 600px at 50% 180px, rgba(20,184,166,0.18) 0%, rgba(6,182,212,0.10) 35%, transparent 70%)'
          : 'radial-gradient(ellipse 1100px 600px at 50% 50%, rgba(20,184,166,0.18) 0%, rgba(6,182,212,0.10) 35%, transparent 70%)',
        }}>
          <div style={{ width: '100%', maxWidth: 720, opacity: loading ? 0 : 1, transition: 'opacity 0.15s', position: 'relative', zIndex: 1 }}>
            {/* Welcome */}
            <h1 style={{
              fontSize: hasProjects ? 40 : 52, fontWeight: 700, color: '#f1f5f9',
              margin: '0 0 12px', letterSpacing: '-0.02em', textAlign: 'center',
              fontFamily: "'Outfit', 'DM Sans', sans-serif", lineHeight: 1.1,
            }}>
              {hasProjects ? (
                <>Welcome back, <span style={{
                  background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>{firstName}</span></>
              ) : (
                <>What will you <span style={{
                  background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  fontStyle: 'italic',
                }}>build</span> today?</>
              )}
            </h1>
            {!hasProjects && (
              <p style={{ fontSize: 16, color: '#94a3b8', margin: '0 0 32px', lineHeight: 1.5, textAlign: 'center' }}>
                Create stunning mobile apps by chatting with AI.
              </p>
            )}

            {/* Chat input area */}
            <div style={{
              position: 'relative',
              background: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(45,212,191,0.25)',
              borderRadius: 16,
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: '0 8px 32px rgba(20,184,166,0.12), 0 0 0 1px rgba(45,212,191,0.05) inset',
              backdropFilter: 'blur(8px)',
            }}>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitPrompt() }
                }}
                placeholder="Let's build"
                rows={3}
                style={{
                  width: '100%', padding: '16px 16px 40px', borderRadius: 16,
                  background: 'transparent', border: 'none',
                  color: '#f1f5f9', fontSize: 15, outline: 'none',
                  resize: 'none', fontFamily: "'DM Sans', sans-serif",
                  lineHeight: 1.5, boxSizing: 'border-box',
                }}
                onFocus={e => {
                  const p = e.currentTarget.parentElement as HTMLElement
                  p.style.borderColor = 'rgba(45,212,191,0.6)'
                  p.style.boxShadow = '0 8px 32px rgba(20,184,166,0.25), 0 0 0 3px rgba(45,212,191,0.12)'
                }}
                onBlur={e => {
                  const p = e.currentTarget.parentElement as HTMLElement
                  p.style.borderColor = 'rgba(45,212,191,0.25)'
                  p.style.boxShadow = '0 8px 32px rgba(20,184,166,0.12), 0 0 0 1px rgba(45,212,191,0.05) inset'
                }}
              />
              <button
                onClick={handleSubmitPrompt}
                disabled={!prompt.trim() || isSubmitting}
                style={{
                  position: 'absolute', bottom: 10, right: 10,
                  width: 32, height: 32, borderRadius: 8,
                  background: prompt.trim() ? 'linear-gradient(135deg, #2dd4bf, #06b6d4)' : 'rgba(255,255,255,0.06)',
                  border: 'none', cursor: prompt.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: prompt.trim() ? '0 4px 12px rgba(20,184,166,0.4)' : 'none',
                }}
              >
                <ArrowUp size={16} color={prompt.trim() ? '#fff' : '#64748b'} />
              </button>
            </div>

            {/* Suggestion chips — below input, first-time users only */}
            {!hasProjects && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8,
                marginTop: 20, justifyContent: 'center',
              }}>
                {SUGGESTION_CHIPS.map(chip => (
                  <button key={chip} onClick={() => { setPrompt(chip); textareaRef.current?.focus() }} style={{
                    padding: '6px 14px', borderRadius: 20,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#94a3b8', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.2s',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.color = '#818cf8' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8' }}
                  >{chip}</button>
                ))}
              </div>
            )}

            {/* Or start from — compact text link */}
            {!hasProjects && (
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#475569' }}>or start from </span>
                <button
                  onClick={() => setToastMessage('Screenshot import coming soon')}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', padding: '0 4px' }}
                >Screenshot</button>
                <span style={{ fontSize: 12, color: '#475569' }}> · </span>
                <button
                  onClick={() => setToastMessage('HTML import coming soon')}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', padding: '0 4px' }}
                >Import HTML</button>
              </div>
            )}

            {/* Recent projects — returning users */}
            {hasProjects && (
              <div style={{ marginTop: 48 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 16,
                }}>
                  <h2 style={{
                    fontSize: 13, fontWeight: 600, color: '#64748b',
                    margin: 0, textTransform: 'uppercase', letterSpacing: 0.5,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>Your projects</h2>
                  {projects.length > 6 && (
                    <button onClick={() => setMobileSidebarOpen(true)} style={{
                      background: 'none', border: 'none', color: '#818cf8',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    }}>View all ({projects.length})</button>
                  )}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 12,
                }}>
                  {projects.slice(0, 6).map(p => {
                    const [g1, g2] = GRADIENT_PAIRS[hashString(p.id) % GRADIENT_PAIRS.length]
                    return (
                      <button key={p.id} onClick={() => navigate(`/app/${p.id}`)} style={{
                        textAlign: 'left', padding: 14, borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        cursor: 'pointer', transition: 'all 0.15s',
                        display: 'flex', flexDirection: 'column', gap: 10,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: `linear-gradient(135deg, ${g1}, ${g2})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 14, fontWeight: 700,
                        }}>{p.name.charAt(0).toUpperCase()}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: 14, fontWeight: 600, color: '#f1f5f9',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            marginBottom: 3,
                          }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {p.screen_count ?? 0} screen{p.screen_count === 1 ? '' : 's'} · {formatDate(p.updated_at)}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}


          </div>
        </div>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (() => {
        const project = projects.find(p => p.id === deleteConfirmId) || importProjects.find(p => p.id === deleteConfirmId)
        if (!project) return null
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setDeleteConfirmId(null)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: 24,
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)', maxWidth: 400, width: '90%',
            }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#fff' }}>Delete project?</h3>
              <p style={{ margin: '0 0 20px', fontSize: 14, color: '#94a3b8', lineHeight: 1.5 }}>
                This will permanently delete &apos;{project.name}&apos; and all its screens. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setDeleteConfirmId(null)} style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}>Cancel</button>
                <button onClick={() => { deleteProject(deleteConfirmId); setDeleteConfirmId(null) }} style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: '#EF4444', border: 'none',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Delete</button>
              </div>
            </div>
          </div>
        )
      })()}

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
