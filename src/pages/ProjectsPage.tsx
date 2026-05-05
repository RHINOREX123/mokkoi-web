import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { Plus, Search, MoreVertical, Trash2, Pencil, LogOut, Settings, User as UserIcon, FolderOpen, Users, Smartphone, Download } from 'lucide-react'

interface Project {
  id: string
  name: string
  created_at: string
  updated_at: string
  screen_count?: number
  source?: string
}

type SidebarTab = 'projects' | 'imports'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SidebarTab>('projects')
  const [importProjects, setImportProjects] = useState<Project[]>([])
  const renameRef = useRef<HTMLInputElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadUser()
    loadProjects()
  }, [])

  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [renamingId])

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Toast auto-hide
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(''), 2000)
      return () => clearTimeout(t)
    }
  }, [toastMessage])

  const loadUser = async () => {
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const loadProjects = async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const sb = supabase

    // Load user's own projects (source is null or 'web')
    const { data: projectRows } = await sb
      .from('projects')
      .select('*')
      .or('source.is.null,source.eq.web')
      .order('updated_at', { ascending: false })

    if (projectRows) {
      const projectsWithCounts: Project[] = await Promise.all(
        projectRows.map(async (p) => {
          const { count } = await sb
            .from('screens')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', p.id)
          return { ...p, screen_count: count ?? 0 }
        })
      )
      setProjects(projectsWithCounts)
    }

    // Load MCP import projects
    const { data: importRows } = await sb
      .from('projects')
      .select('*')
      .eq('source', 'mcp')
      .order('updated_at', { ascending: false })

    if (importRows) {
      const importsWithCounts: Project[] = await Promise.all(
        importRows.map(async (p) => {
          const { count } = await sb
            .from('screens')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', p.id)
          return { ...p, screen_count: count ?? 0 }
        })
      )
      setImportProjects(importsWithCounts)
    }

    setLoading(false)
  }

  const createProject = async () => {
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name: 'Untitled Project' })
      .select()
      .single()
    if (data) navigate(`/app/${data.id}`)
  }

  const deleteProject = async (id: string) => {
    if (!supabase) return
    setMenuOpen(null)
    const prevProjects = projects
    const prevImports = importProjects
    setProjects(prev => prev.filter(p => p.id !== id))
    setImportProjects(prev => prev.filter(p => p.id !== id))
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) {
      console.error('[mokkoi] failed to delete project', id, error)
      setProjects(prevProjects)
      setImportProjects(prevImports)
      setToastMessage(`Failed to delete: ${error.message}`)
    }
  }

  const renameProject = async (id: string, name: string) => {
    if (!supabase) return
    const trimmed = name.trim() || 'Untitled Project'
    await supabase.from('projects').update({ name: trimmed }).eq('id', id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: trimmed } : p))
    setRenamingId(null)
  }

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut()
    navigate('/auth')
  }

  const showToast = (msg: string) => setToastMessage(msg)

  const activeList = activeTab === 'imports' ? importProjects : projects
  const filtered = activeList.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const userInitial = user?.user_metadata?.full_name?.[0]?.toUpperCase()
    || user?.email?.[0]?.toUpperCase()
    || '?'
  const userName = user?.user_metadata?.full_name || user?.email || 'User'
  const userEmail = user?.email || ''

  return (
    <div style={{
      minHeight: '100vh', background: '#000000',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 20px', borderRadius: 10,
          background: '#1a1a2e', color: '#34d399',
          fontSize: 13, fontWeight: 500,
          border: '1px solid rgba(52,211,153,0.2)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 200,
          animation: 'fadeInDown 0.25s ease-out',
        }}>
          {toastMessage}
        </div>
      )}

      {/* Navbar */}
      <nav style={{
        height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', padding: '0 24px',
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 50, flexShrink: 0,
      }}>
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

        {/* Avatar + dropdown */}
        <div ref={userMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
              cursor: 'pointer', transition: 'box-shadow 0.2s',
              boxShadow: showUserMenu ? '0 0 0 2px rgba(99,102,241,0.4)' : 'none',
            }}
            title={userName}
          >
            {userInitial}
          </div>
          {showUserMenu && (
            <div style={{
              position: 'absolute', top: 40, right: 0,
              background: '#1A1A1A',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: 0,
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              zIndex: 100, minWidth: 260,
              overflow: 'hidden',
            }}>
              {/* User info */}
              <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {userInitial}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userName}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userEmail}
                  </div>
                </div>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 12px' }} />
              {/* Menu items */}
              <div style={{ padding: '4px 8px' }}>
                <button
                  onClick={() => { showToast('Coming soon'); setShowUserMenu(false) }}
                  style={avatarMenuItemStyle}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <Settings size={18} color="#94a3b8" />
                  Settings
                </button>
                <button
                  onClick={() => { showToast('Coming soon'); setShowUserMenu(false) }}
                  style={avatarMenuItemStyle}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <UserIcon size={18} color="#94a3b8" />
                  Manage account
                </button>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 12px' }} />
              <div style={{ padding: '4px 8px 8px' }}>
                <button
                  onClick={handleSignOut}
                  style={{ ...avatarMenuItemStyle, color: '#f87171' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <LogOut size={18} color="#f87171" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main layout: sidebar + content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left sidebar */}
        <div style={{
          width: 260, flexShrink: 0,
          background: '#0A0A0A',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
          padding: '16px 12px',
        }}>
          <button
            onClick={() => setActiveTab('projects')}
            style={{
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
            <FolderOpen size={18} />
            My Projects
          </button>
          <button
            onClick={() => setActiveTab('imports')}
            style={{
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
            <Download size={18} />
            Imports
            {importProjects.length > 0 && (
              <span style={{
                marginLeft: 'auto', fontSize: 10, fontWeight: 600,
                padding: '2px 8px', borderRadius: 10,
                background: activeTab === 'imports' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
                color: activeTab === 'imports' ? '#34d399' : '#94a3b8',
              }}>{importProjects.length}</span>
            )}
          </button>
          <button
            onClick={() => showToast('Coming soon')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: 'transparent',
              border: '1px solid transparent',
              color: '#64748b', fontSize: 14, fontWeight: 500,
              cursor: 'pointer', width: '100%', textAlign: 'left',
              marginTop: 4, transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <Users size={18} />
            Shared with me
            <span style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 600,
              padding: '2px 8px', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              color: '#64748b',
            }}>Soon</span>
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ padding: '12px', fontSize: 11, color: '#475569' }}>
            Mokkoi v1.0
          </div>
        </div>

        {/* Right content area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, maxWidth: 1100 }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px 10px 40px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#f1f5f9', fontSize: 14, outline: 'none',
                  transition: 'border-color 0.2s',
                  fontFamily: "'DM Sans', sans-serif",
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              />
            </div>
            <button
              onClick={createProject}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                transition: 'all 0.2s', marginLeft: 16, flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.3)' }}
            >
              <Plus size={18} />
              New Project
            </button>
          </div>

          {/* Projects grid */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#64748b', fontSize: 14 }}>
              Loading projects...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 16, padding: '80px 20px', color: '#64748b',
            }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>{activeTab === 'imports' ? '\u{1F4E5}' : '\u{1F4F1}'}</div>
              <p style={{ fontSize: 16, fontWeight: 500, color: '#94a3b8', margin: 0 }}>
                {search
                  ? 'No projects match your search'
                  : activeTab === 'imports'
                    ? 'No imports yet'
                    : 'No projects yet. Create your first one!'}
              </p>
              {!search && activeTab === 'imports' && (
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
                  Connect the Mokkoi MCP server in Claude Code to import designs directly from your IDE.
                </p>
              )}
              {!search && activeTab === 'projects' && (
                <button
                  onClick={createProject}
                  style={{
                    padding: '10px 20px', borderRadius: 10,
                    background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    color: '#818cf8', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', marginTop: 8,
                  }}
                >
                  Create Project
                </button>
              )}
            </div>
          ) : (
            <div className="projects-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              maxWidth: 1100,
            }}>
              {filtered.map(project => (
                <div
                  key={project.id}
                  onClick={() => {
                    if (renamingId !== project.id) navigate(`/app/${project.id}`)
                  }}
                  className="project-card"
                  style={{
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.02)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                    if (menuOpen === project.id) setMenuOpen(null)
                  }}
                >
                  {/* Thumbnail area */}
                  <div style={{
                    height: 160,
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 8,
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    {(project.screen_count ?? 0) > 0 ? (
                      <>
                        <Smartphone size={28} color="rgba(255,255,255,0.25)" />
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                          {project.screen_count} screen{(project.screen_count ?? 0) !== 1 ? 's' : ''}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>
                        Empty project
                      </span>
                    )}
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '16px 20px' }}>
                    {/* Name */}
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
                          fontSize: 15, fontWeight: 600, color: '#f1f5f9',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(99,102,241,0.4)',
                          borderRadius: 6, padding: '2px 8px',
                          outline: 'none', width: '80%',
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      />
                    ) : (
                      <h3 style={{
                        fontSize: 15, fontWeight: 600, color: '#f1f5f9',
                        margin: '0 0 6px 0',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        paddingRight: 32,
                      }}>
                        {project.name}
                      </h3>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {project.screen_count ?? 0} screen{(project.screen_count ?? 0) !== 1 ? 's' : ''}
                      </span>
                      <span style={{ fontSize: 10, color: '#475569' }}>·</span>
                      <span style={{ fontSize: 11, color: '#475569' }}>
                        Modified {timeAgo(project.updated_at)}
                      </span>
                      {project.source === 'mcp' && (
                        <>
                          <span style={{ fontSize: 10, color: '#475569' }}>·</span>
                          <span style={{
                            fontSize: 10, fontWeight: 600,
                            padding: '1px 6px', borderRadius: 6,
                            background: 'rgba(52,211,153,0.1)',
                            color: '#34d399',
                          }}>Via MCP</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Three-dot menu */}
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === project.id ? null : project.id) }}
                    style={{
                      position: 'absolute', top: 170, right: 14,
                      width: 28, height: 28, borderRadius: 6,
                      background: 'transparent', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: '#64748b',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <MoreVertical size={16} />
                  </button>

                  {/* Dropdown menu */}
                  {menuOpen === project.id && (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: 'absolute', top: 200, right: 14,
                        background: '#1a1a2e',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 10, padding: 4,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        zIndex: 20, minWidth: 140,
                      }}
                    >
                      <button
                        onClick={() => {
                          setRenamingId(project.id)
                          setRenameValue(project.name)
                          setMenuOpen(null)
                        }}
                        style={menuItemStyle}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <Pencil size={14} /> Rename
                      </button>
                      <button
                        onClick={() => { setDeleteConfirmId(project.id); setMenuOpen(null) }}
                        style={{ ...menuItemStyle, color: '#f87171' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (() => {
        const project = projects.find(p => p.id === deleteConfirmId) || importProjects.find(p => p.id === deleteConfirmId)
        if (!project) return null
        return (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 300,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setDeleteConfirmId(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#1A1A1A',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: 24,
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                maxWidth: 400, width: '90%',
              }}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#fff' }}>
                Delete project?
              </h3>
              <p style={{ margin: '0 0 20px', fontSize: 14, color: '#94a3b8', lineHeight: 1.5 }}>
                This will permanently delete '{project.name}' and all its screens. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e2e8f0', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { deleteProject(deleteConfirmId); setDeleteConfirmId(null) }}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    background: '#EF4444',
                    border: 'none',
                    color: '#fff', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#DC2626' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#EF4444' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Responsive + animations */}
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @media (max-width: 768px) {
          .projects-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 1024px) and (min-width: 769px) {
          .projects-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 900px) {
          div[style*="width: 260"] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '8px 12px', borderRadius: 6,
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
