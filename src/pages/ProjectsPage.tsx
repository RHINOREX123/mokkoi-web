import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { Plus, Search, MoreVertical, Trash2, Pencil, LogOut } from 'lucide-react'

interface Project {
  id: string
  name: string
  created_at: string
  updated_at: string
  screen_count?: number
}

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
  const renameRef = useRef<HTMLInputElement>(null)

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

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const loadProjects = async () => {
    setLoading(true)
    const { data: projectRows } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })

    if (projectRows) {
      // Get screen counts
      const projectsWithCounts: Project[] = await Promise.all(
        projectRows.map(async (p) => {
          const { count } = await supabase
            .from('screens')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', p.id)
          return { ...p, screen_count: count ?? 0 }
        })
      )
      setProjects(projectsWithCounts)
    }
    setLoading(false)
  }

  const createProject = async () => {
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
    await supabase.from('projects').delete().eq('id', id)
    setProjects(prev => prev.filter(p => p.id !== id))
    setMenuOpen(null)
  }

  const renameProject = async (id: string, name: string) => {
    const trimmed = name.trim() || 'Untitled Project'
    await supabase.from('projects').update({ name: trimmed }).eq('id', id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: trimmed } : p))
    setRenamingId(null)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const userInitial = user?.user_metadata?.full_name?.[0]?.toUpperCase()
    || user?.email?.[0]?.toUpperCase()
    || '?'
  const userName = user?.user_metadata?.full_name || user?.email || 'User'

  return (
    <div style={{
      minHeight: '100vh', background: '#000000',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Navbar */}
      <nav style={{
        height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', padding: '0 24px',
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 50,
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>{userName}</span>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff',
          }}>{userInitial}</div>
          <button
            onClick={handleSignOut}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#94a3b8', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: '#f1f5f9', margin: 0,
            fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em',
          }}>My Projects</h1>
          <button
            onClick={createProject}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.3)' }}
          >
            <Plus size={18} />
            New Project
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 24 }}>
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
            <div style={{ fontSize: 48, opacity: 0.3 }}>&#x1F4F1;</div>
            <p style={{ fontSize: 16, fontWeight: 500, color: '#94a3b8', margin: 0 }}>
              {search ? 'No projects match your search' : 'No projects yet. Create your first one!'}
            </p>
            {!search && (
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}>
            {filtered.map(project => (
              <div
                key={project.id}
                onClick={() => {
                  if (renamingId !== project.id) navigate(`/app/${project.id}`)
                }}
                style={{
                  padding: 20, borderRadius: 14,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                  if (menuOpen === project.id) setMenuOpen(null)
                }}
              >
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
                      fontSize: 16, fontWeight: 600, color: '#f1f5f9',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(99,102,241,0.4)',
                      borderRadius: 6, padding: '2px 8px',
                      outline: 'none', width: '80%',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                ) : (
                  <h3 style={{
                    fontSize: 16, fontWeight: 600, color: '#f1f5f9',
                    margin: '0 0 8px 0',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: 32,
                  }}>
                    {project.name}
                  </h3>
                )}
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px 0' }}>
                  {project.screen_count ?? 0} screen{(project.screen_count ?? 0) !== 1 ? 's' : ''}
                </p>
                <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
                  Modified {timeAgo(project.updated_at)}
                </p>

                {/* Three-dot menu */}
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === project.id ? null : project.id) }}
                  style={{
                    position: 'absolute', top: 14, right: 14,
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
                      position: 'absolute', top: 42, right: 14,
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
                      onClick={() => deleteProject(project.id)}
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

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 1024px) and (min-width: 769px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: repeat(2, 1fr) !important;
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
