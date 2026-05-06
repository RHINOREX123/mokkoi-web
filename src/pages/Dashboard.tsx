import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { trackEvent, resetAnalytics } from '../lib/analytics'
import {
  Search, MoreVertical, Trash2, Pencil, LogOut, Settings,
  FolderOpen, Users, Download, Star,
  Zap, Copy, Menu, X,
} from 'lucide-react'
import { useUserPlan } from '../hooks/useUserPlan'
import { PlanChip } from '../components/PlanChip'
import { PaywallModal } from '../components/PaywallModal'
import { DashboardHero } from '../components/dashboard/DashboardHero'
import { PhoneThumbnail } from '../components/dashboard/PhoneThumbnail'
import { PromptCard, type AttachedImage, type SubmitMode } from '../components/dashboard/PromptCard'
import { SignalsHUD, type SignalsState } from '../components/dashboard/SignalsHUD'
import { ModeCards, type DashboardMode } from '../components/dashboard/ModeCards'
import { HudFooter } from '../components/dashboard/HudFooter'
import { RecentProjectsStrip } from '../components/dashboard/RecentProjectsStrip'
import { useFavorites } from '../components/dashboard/useFavorites'
import { usePromptScore } from '../components/dashboard/usePromptScore'

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

// (V1's GRADIENT_PAIRS + hashString are gone — sidebar items now use
//  PhoneThumbnail's calm-pulse fallback, no per-name gradient needed.)

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
  const [showPaywallModal, setShowPaywallModal] = useState(false)
  const userPlanState = useUserPlan()
  const [toastMessage, setToastMessage] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  type SidebarTab = 'projects' | 'favourites' | 'imports' | 'shared'
  const [activeTab, setActiveTab] = useState<SidebarTab>('projects')
  const [importProjects, setImportProjects] = useState<Project[]>([])
  const { has: isFavorite, toggle: toggleFavorite } = useFavorites()
  // V2: prompt mode (Build / Plan), auto-suggest toast, locked-state HUD.
  const [submitMode, setSubmitMode] = useState<SubmitMode>('build')
  const [hudState, setHudState] = useState<SignalsState | undefined>(undefined)
  const [planSuggest, setPlanSuggest] = useState(false)
  // Reference images attached via the Camera button on the prompt card.
  // Up to 4. Lives at the dashboard level so submitWithMode can hand them
  // off to App.tsx via sessionStorage on navigate.
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const promptScore = usePromptScore(prompt)


  const userMenuRef = useRef<HTMLDivElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load user + projects. Plan + free-app count handled by useUserPlan() hook above.
  useEffect(() => {
    const sb = supabase
    if (!sb) {
      // Without supabase the dashboard has nothing to load — flip the loading
      // gate off so the hero still renders (otherwise opacity stays at 0
      // forever and the page looks blank).
      setLoading(false)
      return
    }
    sb.auth.getUser().then(({ data: { user: u } }) => { setUser(u) })
    loadProjects()
  }, [])

  useEffect(() => {
    if (renamingId && renameRef.current) { renameRef.current.focus(); renameRef.current.select() }
  }, [renamingId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false)
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

  const PLAN_SUGGEST_DISMISS_KEY = 'mokkoi.dismissed-plan-suggest'

  /**
   * Submit the prompt. Drives the SUBMITTED state of SignalsHUD for ~700ms
   * before navigating, so the user gets the "analysis complete" beat — the
   * brief check-mark moment that ties the dashboard's coaching into the
   * generation page.
   *
   * Plan auto-suggest: if the user clicks Send in Build mode but their
   * prompt's clarity score is < 50, we offer to switch to Plan mode (a
   * discuss-first chat). Dismissed once → don't ask again this session.
   */
  const submitWithMode = async (mode: SubmitMode) => {
    if (!prompt.trim() || isSubmitting) return
    setIsSubmitting(true)
    setHudState('submitted')

    if (!supabase) { navigate('/auth'); return }
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { navigate('/auth'); return }

    const { data } = await supabase
      .from('projects')
      .insert({ user_id: u.id, name: prompt.trim().slice(0, 30) })
      .select().single()

    if (data) {
      trackEvent('dashboard_prompt_submitted')
      trackEvent('project_created', {
        source: 'dashboard',
        mode,
        imageCount: attachedImages.length,
      })

      // If the user attached reference images, hand them off via
      // sessionStorage keyed by project id. App.tsx reads + clears the key
      // on mount and pipes the array into ai.handleSend so generation gets
      // both the prompt and the visual references. URL params are too small
      // for base64 image data, hence sessionStorage.
      if (attachedImages.length > 0) {
        try {
          sessionStorage.setItem(
            `mokkoi.pendingImages.${data.id}`,
            JSON.stringify(attachedImages),
          )
        } catch {
          // sessionStorage can fail in private mode / quota. Submission
          // still proceeds with the prompt; images get dropped silently.
        }
      }

      // Brief hold so the SUBMITTED HUD state is visible before nav.
      setTimeout(() => {
        const params = new URLSearchParams({ prompt: prompt.trim() })
        if (mode === 'plan') params.set('mode', 'plan')
        navigate(`/app/${data.id}?${params.toString()}`)
      }, 700)
    } else {
      setIsSubmitting(false)
      setHudState(undefined)
    }
  }

  const handleSubmitPrompt = (mode: SubmitMode = submitMode) => {
    if (!prompt.trim() || isSubmitting) return
    // Auto-suggest Plan mode for low-clarity prompts in Build mode.
    if (
      mode === 'build' &&
      promptScore != null &&
      promptScore.clarity < 50 &&
      sessionStorage.getItem(PLAN_SUGGEST_DISMISS_KEY) !== '1'
    ) {
      setPlanSuggest(true)
      return
    }
    submitWithMode(mode)
  }

  /**
   * Mode-card handler. Build focuses the prompt input; Import creates an
   * empty "Untitled" project then navigates to /app/:id?openModal=import,
   * where App.tsx auto-opens ImportHtmlModal.
   *
   * The empty-project shortcut reuses the existing ImportHtmlModal flow
   * (which assumes a project context: ai.handleSend, screen list, etc.)
   * without duplicating its logic on the dashboard. Untitled projects get
   * cleaned up by maybeCleanupOrphanProject in App.tsx if the user cancels
   * the modal without committing — see Phase B.
   *
   * Screenshot was previously a third mode card; it's been consolidated
   * into the Camera button on the prompt card (multi-image up to 4),
   * so 'screenshot' is no longer a valid DashboardMode.
   */
  const handleModeCard = async (mode: DashboardMode) => {
    if (mode === 'build') {
      textareaRef.current?.focus()
      return
    }
    if (!supabase) { navigate('/auth'); return }
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { navigate('/auth'); return }
    const { data } = await supabase
      .from('projects')
      .insert({ user_id: u.id, name: 'Untitled' })
      .select().single()
    if (data) {
      trackEvent('dashboard_mode_card', { mode })
      navigate(`/app/${data.id}?openModal=${mode}`)
    } else {
      setToastMessage('Could not start a new project — try again')
    }
  }

  const acceptPlanSuggest = () => {
    setPlanSuggest(false)
    setSubmitMode('plan')
    submitWithMode('plan')
  }

  const dismissPlanSuggest = (rememberThisSession = true) => {
    setPlanSuggest(false)
    if (rememberThisSession) {
      try { sessionStorage.setItem(PLAN_SUGGEST_DISMISS_KEY, '1') } catch { /* ignore */ }
    }
    submitWithMode('build')
  }

  const deleteProject = async (id: string) => {
    if (!supabase) return
    setMenuOpen(null)
    // Optimistic remove so the UI feels snappy. We restore on failure
    // instead of leaving the user staring at a row that "came back".
    const prevProjects = projects
    const prevImports = importProjects
    setProjects(prev => prev.filter(p => p.id !== id))
    setImportProjects(prev => prev.filter(p => p.id !== id))
    // Use count: 'exact' so we can detect silent RLS blocks. supabase-js
    // returns no error when RLS prevents the delete — only count=0 reveals it.
    // Without this check the row "deletes" optimistically then comes back on
    // the next loadProjects() refresh. Same defensive pattern applies to any
    // delete-via-RLS path.
    const { error, count } = await supabase
      .from('projects')
      .delete({ count: 'exact' })
      .eq('id', id)
    if (error || count === 0) {
      console.error('[mokkoi] delete returned no rows affected', { id, error, count })
      setProjects(prevProjects)
      setImportProjects(prevImports)
      setToastMessage(
        error
          ? `Failed to delete: ${error.message}`
          : `Couldn't delete this project — you may not have permission. Please refresh and try again.`,
      )
    }
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

  const activeList: Project[] = useMemo(() => {
    if (activeTab === 'imports') return importProjects
    if (activeTab === 'favourites') return projects.filter((p) => isFavorite(p.id))
    if (activeTab === 'shared') return [] // Real sharing feature not yet built
    return projects
  }, [activeTab, projects, importProjects, isFavorite])

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
          {/* Phone-frame thumbnail (sm). Calm-pulse fallback is intentional —
              fetching the first-screen tree for every sidebar item is not
              free at 50+ projects, so v1 keeps the sidebar list fast and
              reserves real ScreenRenderer previews for the dashboard cards.
              Lazy real-preview-on-hover is a follow-up. */}
          <div
            style={{
              width: 22, height: 40, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-hidden
          >
            <PhoneThumbnail
              projectName={project.name}
              size="sm"
              style={{ height: 40 }}
            />
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
            {/* Toggle favourites — same useFavorites hook the dashboard
                recents strip uses, so the state stays in sync. Label flips
                between "Add to favourites" / "Remove from favourites". */}
            <button onClick={() => { toggleFavorite(project.id); setMenuOpen(null) }}
              style={{
                ...sidebarItemStyle,
                fontSize: 12,
                color: isFavorite(project.id) ? '#fbbf24' : '#e2e8f0',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.10)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <Star
                size={13}
                fill={isFavorite(project.id) ? 'currentColor' : 'transparent'}
              />
              {isFavorite(project.id) ? 'Remove from favourites' : 'Add to favourites'}
            </button>
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
      // Per-tab empty-state copy. Shared tab gets a richer "no shared
      // projects yet" message since the feature is intentionally a
      // forward-looking placeholder until the real sharing flow ships.
      let body: React.ReactNode
      if (search) {
        body = 'No projects match your search'
      } else if (activeTab === 'imports') {
        body = 'No imports yet. Use the Mokkoi MCP server in Claude Code to import designs.'
      } else if (activeTab === 'favourites') {
        body = (
          <>
            No favourites yet.
            <div style={{ marginTop: 6, color: '#475569', fontSize: 12 }}>
              Star a project from the dashboard or sidebar to pin it here.
            </div>
          </>
        )
      } else if (activeTab === 'shared') {
        body = (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              margin: '8px auto 12px',
            }}>
              <Users size={20} color="#64748b" />
            </div>
            <div style={{ textAlign: 'center', color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>
              No shared projects
            </div>
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: 12, lineHeight: 1.5 }}>
              Projects shared with you will appear here.
            </div>
          </>
        )
      } else {
        body = 'No projects yet'
      }
      return <div style={{ padding: '20px 10px', color: '#64748b', fontSize: 13 }}>{body}</div>
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
      {/* Favourites tab — locally-favorited projects (localStorage). The
          set is shared with the dashboard recents strip via useFavorites,
          so starring a card from the dashboard immediately appears here. */}
      <button onClick={() => setActiveTab('favourites')} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10,
        background: activeTab === 'favourites' ? 'rgba(251,191,36,0.10)' : 'transparent',
        border: activeTab === 'favourites' ? '1px solid rgba(251,191,36,0.25)' : '1px solid transparent',
        color: activeTab === 'favourites' ? '#fbbf24' : '#64748b',
        fontSize: 14, fontWeight: activeTab === 'favourites' ? 600 : 500,
        cursor: 'pointer', width: '100%', textAlign: 'left',
        marginTop: 4, transition: 'all 0.15s',
      }}
        onMouseEnter={e => { if (activeTab !== 'favourites') e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
        onMouseLeave={e => { if (activeTab !== 'favourites') e.currentTarget.style.background = 'transparent' }}
      >
        <Star
          size={18}
          fill={activeTab === 'favourites' ? 'currentColor' : 'transparent'}
        /> Favourites
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
      </button>
      {/* Shared with me — functional placeholder. The empty-state copy in
          renderGroupedProjects explains what users will see here once the
          real sharing flow ships. Tapping the tab still works (selects it,
          shows the empty state) instead of toasting "coming soon". */}
      <button onClick={() => setActiveTab('shared')} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10,
        background: activeTab === 'shared' ? 'rgba(99,102,241,0.10)' : 'transparent',
        border: activeTab === 'shared' ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
        color: activeTab === 'shared' ? '#818cf8' : '#64748b',
        fontSize: 14, fontWeight: activeTab === 'shared' ? 600 : 500,
        cursor: 'pointer', width: '100%', textAlign: 'left',
        marginTop: 4, transition: 'all 0.15s',
      }}
        onMouseEnter={e => { if (activeTab !== 'shared') e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
        onMouseLeave={e => { if (activeTab !== 'shared') e.currentTarget.style.background = 'transparent' }}
      >
        <Users size={18} /> Shared with me
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
            background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
            color: '#fff', fontSize: 12, fontWeight: 800,
          }}>M</div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>Mokkoi</span>
        </a>

        <div style={{ flex: 1 }} />

        {/* Plan / free-trial chip */}
        {!userPlanState.loading && (
          <div style={{ marginRight: 8 }}>
            <PlanChip
              plan={userPlanState.plan}
              freeAppCount={userPlanState.freeAppCount}
              onOpenPaywall={() => setShowPaywallModal(true)}
            />
          </div>
        )}

        {/* Avatar */}
        <div ref={userMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <div onClick={() => setShowUserMenu(!showUserMenu)} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
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
                  background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
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

      {/* Main content area — V2: hero + signals HUD + mode cards + recents.
          DashboardHero owns the atmospheric background; we wrap it in a
          scrollable container so recents below scroll naturally with it. */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          position: 'relative',
          background: 'var(--dash-bg)',
          opacity: loading ? 0 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        <DashboardHero
          firstName={firstName}
          hasProjects={hasProjects}
          userHandle={user?.email ?? undefined}
        >
          <PromptCard
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleSubmitPrompt}
            mode={submitMode}
            onModeChange={setSubmitMode}
            disabled={isSubmitting}
            attachedImages={attachedImages}
            onAttachImagesChange={setAttachedImages}
          />

          <SignalsHUD
            score={promptScore}
            state={hudState}
            projectName={prompt.trim().slice(0, 30) || 'project'}
            screenCount={4}
            mode={submitMode}
          />

          <ModeCards onMode={handleModeCard} />

          {/* Suggestion chips — first-time users only, kept from V1 since
              they're a known good empty-state nudge. */}
          {!hasProjects && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 20,
                justifyContent: 'center',
              }}
            >
              {SUGGESTION_CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => { setPrompt(chip); textareaRef.current?.focus() }}
                  style={{
                    padding: '6px 14px', borderRadius: 20,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--dash-text-2)',
                    fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.2s',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(45,212,191,0.10)'
                    e.currentTarget.style.borderColor = 'rgba(45,212,191,0.3)'
                    e.currentTarget.style.color = 'var(--dash-teal)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.color = 'var(--dash-text-2)'
                  }}
                >{chip}</button>
              ))}
            </div>
          )}

          <HudFooter
            version="2.4"
            model="SONNET 4.6"
            appCount={userPlanState.freeAppCount ?? 0}
            appLimit={userPlanState.plan === 'pro' ? Infinity : 50}
            projectCount={projects.length}
          />
        </DashboardHero>

        {/* Recent projects strip — only renders when user has projects. */}
        {!loading && (
          <RecentProjectsStrip
            projects={projects.map(p => ({
              id: p.id,
              name: p.name,
              updated_at: p.updated_at,
              screen_count: p.screen_count,
            }))}
            loading={loading}
            onOpenAll={() => setMobileSidebarOpen(true)}
            onOpenProject={(id) => navigate(`/app/${id}`)}
          />
        )}
      </div>

      {/* Plan auto-suggest inline modal — fires when user clicks Send in
          Build mode but the prompt clarity is low (< 50). */}
      {planSuggest && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Plan mode suggestion"
          style={{
            position: 'fixed', inset: 0, zIndex: 250,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => dismissPlanSuggest(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--dash-surface)',
              border: '1px solid var(--dash-border)',
              borderRadius: 16,
              padding: 20,
              maxWidth: 420, width: '90%',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10.5, letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--dash-accent-amber)',
                marginBottom: 8,
              }}
            >
              ↳ PROMPT CLARITY {promptScore?.clarity ?? 0}
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--dash-text)' }}>
              Your prompt is broad — want to plan it together first?
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--dash-text-2)', lineHeight: 1.5 }}>
              In Plan mode, Mokkoi asks a few clarifying questions before
              generating — usually leads to a better first build. You can also
              just build now and refine after.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => dismissPlanSuggest(true)}
                style={{
                  padding: '8px 14px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--dash-border)',
                  color: 'var(--dash-text-2)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >Build anyway</button>
              <button
                onClick={acceptPlanSuggest}
                style={{
                  padding: '8px 14px', borderRadius: 8,
                  background: 'linear-gradient(135deg, var(--dash-teal), var(--dash-teal-2))',
                  border: 'none',
                  color: '#001a1f',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >Plan together →</button>
            </div>
          </div>
        </div>
      )}

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

      <PaywallModal open={showPaywallModal} onClose={() => setShowPaywallModal(false)} />
    </div>
  )
}
