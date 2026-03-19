import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Share2, Plus, Pencil, LogOut, Menu, ArrowLeft, Copy, Trash2, Settings, User as UserIcon, Undo2, Redo2, Clipboard, ClipboardCopy, Command, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { convertTreeToJSX } from './CodeExportModal'
import type { User } from '@supabase/supabase-js'
import type { ComponentNode } from '../types/mokkoi'

const hamburgerItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', padding: '9px 12px', borderRadius: 8,
  background: 'transparent', border: 'none',
  color: '#e2e8f0', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', transition: 'background 0.15s',
  textAlign: 'left',
}

const studioAvatarItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', padding: '10px 12px', borderRadius: 8,
  background: 'transparent', border: 'none',
  color: '#e2e8f0', fontSize: 14, fontWeight: 500,
  cursor: 'pointer', transition: 'background 0.15s',
  textAlign: 'left',
}

interface TopNavbarProps {
  projectName: string
  setProjectName: (name: string) => void
  saveProjectName: (name: string) => void
  isGenerating: boolean
  generatedTree: ComponentNode | undefined
  activeGeneratedTree: ComponentNode | undefined
  setActiveGeneratedId: (id: string | null) => void
  setShowCodeExport: (show: boolean) => void
  setShowShareModal: (show: boolean) => void
  setShowCommandPalette: (show: boolean) => void
  setShowDeleteConfirm: (show: boolean) => void
  setToastMessage: (msg: string) => void
}

export function TopNavbar({
  projectName, setProjectName, saveProjectName,
  isGenerating, generatedTree, activeGeneratedTree,
  setActiveGeneratedId, setShowCodeExport, setShowShareModal,
  setShowCommandPalette, setShowDeleteConfirm, setToastMessage,
}: TopNavbarProps) {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false)
  const [showEditSubmenu, setShowEditSubmenu] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const hamburgerMenuRef = useRef<HTMLDivElement>(null)
  const editSubmenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectNameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase?.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => {
    if (isEditingName) {
      projectNameInputRef.current?.focus()
      projectNameInputRef.current?.select()
    }
  }, [isEditingName])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false)
      if (hamburgerMenuRef.current && !hamburgerMenuRef.current.contains(e.target as Node)) setShowHamburgerMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut()
    navigate('/auth')
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') setIsEditingName(false)
  }

  const handleNameBlur = () => {
    setIsEditingName(false)
    const name = projectName.trim() || 'Untitled Project'
    if (!projectName.trim()) setProjectName(name)
    saveProjectName(name)
  }

  return (
    <nav style={{
      height: 48, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', padding: '0 16px',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      gap: 10, position: 'relative', zIndex: 50,
    }}>
      {/* Logo */}
      <div onClick={() => navigate('/projects')} style={{
        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #6366f1, #818cf8)',
        color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'opacity 0.2s',
      }} title="Go to projects"
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
      >M</div>

      {/* Hamburger menu */}
      <div ref={hamburgerMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={() => setShowHamburgerMenu(!showHamburgerMenu)} style={{
          width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: showHamburgerMenu ? 'rgba(255,255,255,0.1)' : 'transparent',
          border: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { if (!showHamburgerMenu) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { if (!showHamburgerMenu) e.currentTarget.style.background = 'transparent' }}
        ><Menu size={18} /></button>
        {showHamburgerMenu && (
          <div style={{
            position: 'absolute', top: 34, left: 0, background: '#1A1A1A',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 4,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 100, minWidth: 220,
          }}>
            <button onClick={() => { navigate('/projects'); setShowHamburgerMenu(false) }} style={hamburgerItemStyle}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            ><ArrowLeft size={16} color="#94a3b8" />Go to all projects</button>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />

            {/* Edit submenu */}
            <div style={{ position: 'relative' }}
              onMouseEnter={() => { if (editSubmenuTimer.current) { clearTimeout(editSubmenuTimer.current); editSubmenuTimer.current = null } setShowEditSubmenu(true) }}
              onMouseLeave={() => { editSubmenuTimer.current = setTimeout(() => setShowEditSubmenu(false), 200) }}
            >
              <button style={{ ...hamburgerItemStyle, justifyContent: 'space-between', background: showEditSubmenu ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Pencil size={16} color="#94a3b8" />Edit</span>
                <ChevronRight size={14} color="#555" />
              </button>
              {showEditSubmenu && (
                <div style={{
                  position: 'absolute', left: '100%', top: 0, background: '#1A1A1A',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 4,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 101, minWidth: 200, marginLeft: 4,
                }}>
                  {[
                    { label: 'Undo', icon: <Undo2 size={14} color="#94a3b8" />, shortcut: 'Ctrl+Z', action: () => { setToastMessage('Undo — coming soon') } },
                    { label: 'Redo', icon: <Redo2 size={14} color="#94a3b8" />, shortcut: 'Ctrl+Y', action: () => { setToastMessage('Redo — coming soon') } },
                    { label: 'Copy', icon: <ClipboardCopy size={14} color="#94a3b8" />, shortcut: 'Ctrl+C', action: () => {
                      if (activeGeneratedTree) {
                        const code = convertTreeToJSX(activeGeneratedTree)
                        navigator.clipboard.writeText(code).then(
                          () => setToastMessage('Code copied!'),
                          () => setToastMessage('Failed to copy code')
                        )
                      } else { setToastMessage('No screen selected to copy') }
                    }},
                    { label: 'Paste', icon: <Clipboard size={14} color="#94a3b8" />, shortcut: 'Ctrl+V', action: () => { setToastMessage('Paste — coming soon') } },
                  ].map(item => (
                    <button key={item.label}
                      onClick={() => { item.action(); setShowHamburgerMenu(false); setShowEditSubmenu(false) }}
                      style={{ ...hamburgerItemStyle, fontSize: 12, padding: '7px 10px', justifyContent: 'space-between' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{item.icon}{item.label}</span>
                      <span style={{ fontSize: 10, color: '#555' }}>{item.shortcut}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => { setShowCommandPalette(true); setShowHamburgerMenu(false) }}
              style={{ ...hamburgerItemStyle, justifyContent: 'space-between' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Command size={16} color="#94a3b8" />Command menu</span>
              <span style={{ fontSize: 10, color: '#555' }}>Ctrl+K</span>
            </button>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />
            <button onClick={() => { setShowShareModal(true); setShowHamburgerMenu(false) }} style={hamburgerItemStyle}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            ><Share2 size={16} color="#94a3b8" />Share</button>
            <button onClick={() => { setToastMessage('Coming soon'); setShowHamburgerMenu(false) }} style={hamburgerItemStyle}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            ><Download size={16} color="#94a3b8" />Download project</button>
            <button onClick={() => { setToastMessage('Coming soon'); setShowHamburgerMenu(false) }} style={hamburgerItemStyle}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            ><Copy size={16} color="#94a3b8" />Duplicate project</button>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />
            <button onClick={() => { setShowDeleteConfirm(true); setShowHamburgerMenu(false) }}
              style={{ ...hamburgerItemStyle, color: '#f87171' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            ><Trash2 size={16} color="#f87171" />Delete project</button>
          </div>
        )}
      </div>

      {/* Editable project name */}
      {isEditingName ? (
        <input ref={projectNameInputRef} value={projectName}
          onChange={e => setProjectName(e.target.value)}
          onKeyDown={handleNameKeyDown} onBlur={handleNameBlur}
          style={{
            fontSize: 14, fontWeight: 500, color: '#f1f5f9',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 6, padding: '2px 8px', outline: 'none', minWidth: 120, maxWidth: 240,
          }}
        />
      ) : (
        <button onClick={() => setIsEditingName(true)} className="project-name-btn" style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: '#f1f5f9',
          background: 'transparent', border: '1px solid transparent', borderRadius: 6,
          padding: '2px 8px', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; const p = e.currentTarget.querySelector('.pencil-icon') as HTMLElement; if (p) p.style.opacity = '1' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; const p = e.currentTarget.querySelector('.pencil-icon') as HTMLElement; if (p) p.style.opacity = '0' }}
          title="Click to rename project"
        >
          {projectName}
          <span className="pencil-icon" style={{ opacity: 0, transition: 'opacity 0.2s', display: 'flex' }}><Pencil size={12} color="#64748b" /></span>
        </button>
      )}

      {/* Generating indicator */}
      {isGenerating && (
        <div className="flex items-center gap-1.5 shrink-0" style={{
          padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 500,
          background: 'rgba(129,140,248,0.1)', color: 'rgba(129,140,248,0.7)',
          border: '1px solid rgba(129,140,248,0.15)',
        }}>
          <span className="inline-flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_infinite]" />
            <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
            <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
          </span>
          Generating
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Right: action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => { setActiveGeneratedId(null); setShowCodeExport(false) }} style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          color: '#818cf8', background: 'rgba(99,102,241,0.08)',
          border: '1px dashed rgba(99,102,241,0.3)', cursor: 'pointer', transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)' }}
          title="New screen"
        ><Plus size={14} />New Screen</button>

        <button onClick={() => { if (generatedTree) setShowCodeExport(true) }} style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          color: '#94a3b8', background: 'transparent', border: 'none',
          cursor: generatedTree ? 'pointer' : 'default',
          opacity: generatedTree ? 1 : 0.4, transition: 'all 0.2s',
        }}
          onMouseEnter={e => { if (generatedTree) e.currentTarget.style.color = '#e2e8f0' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
        ><Download size={14} />Export</button>

        <button onClick={() => setShowShareModal(true)} style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
        ><Share2 size={14} />Share</button>

        {/* User avatar */}
        <div ref={userMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <div onClick={() => setShowUserMenu(!showUserMenu)} style={{
            width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', transition: 'box-shadow 0.2s',
            boxShadow: showUserMenu ? '0 0 0 2px rgba(99,102,241,0.4)' : 'none',
          }} title={user?.user_metadata?.full_name || user?.email || 'User'}>
            {(user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
          </div>
          {showUserMenu && (
            <div style={{
              position: 'absolute', top: 36, right: 0, background: '#1A1A1A',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)', zIndex: 100, minWidth: 260, overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>{(user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.user_metadata?.full_name || user?.email || 'User'}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email || ''}
                  </div>
                </div>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 12px' }} />
              <div style={{ padding: '4px 8px' }}>
                <button onClick={() => { setToastMessage('Coming soon'); setShowUserMenu(false) }} style={studioAvatarItemStyle}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                ><Settings size={18} color="#94a3b8" />Settings</button>
                <button onClick={() => { setToastMessage('Coming soon'); setShowUserMenu(false) }} style={studioAvatarItemStyle}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                ><UserIcon size={18} color="#94a3b8" />Manage account</button>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 12px' }} />
              <div style={{ padding: '4px 8px 8px' }}>
                <button onClick={handleSignOut} style={{ ...studioAvatarItemStyle, color: '#f87171' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                ><LogOut size={18} color="#f87171" />Sign Out</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
