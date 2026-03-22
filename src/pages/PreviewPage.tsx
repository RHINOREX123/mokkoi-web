import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PhoneFrame, DEVICE_W, DEVICE_H } from '../components/PhoneFrame'
import { ScreenRenderer } from '../components/ScreenRenderer'
import { Smartphone, Tablet, Monitor, LayoutGrid, Share2, ExternalLink } from 'lucide-react'
import type { ComponentNode } from '../types/mokkoi'
import { supabase } from '../lib/supabase'

// ----- Device Presets -----
interface DevicePreset {
  id: string
  width: number
  height: number
  name: string
  borderRadius: number
  icon: 'phone' | 'phone-lg' | 'tablet' | 'desktop'
}

const DEVICE_PRESETS: DevicePreset[] = [
  { id: 'iphone14', width: 390, height: 884, name: 'iPhone 14 / 15', borderRadius: 47, icon: 'phone' },
  { id: 'iphone16pm', width: 430, height: 932, name: 'iPhone 16 Pro Max', borderRadius: 55, icon: 'phone-lg' },
  { id: 'android', width: 412, height: 917, name: 'Android Compact', borderRadius: 30, icon: 'phone' },
  { id: 'ipad', width: 768, height: 1024, name: 'iPad', borderRadius: 20, icon: 'tablet' },
  { id: 'desktop', width: 1280, height: 800, name: 'Desktop', borderRadius: 8, icon: 'desktop' },
]

export default function PreviewPage() {
  const { projectId, screenId } = useParams<{ projectId: string; screenId: string }>()
  const navigate = useNavigate()

  const [screenName, setScreenName] = useState('')
  const [tree, setTree] = useState<ComponentNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeDevice, setActiveDevice] = useState('iphone14')
  const [showAll, setShowAll] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Load screen data — try sessionStorage first (in-memory preview from studio),
  // then fall back to Supabase (shared/public link)
  useEffect(() => {
    if (!projectId || !screenId) return

    // 1. Try sessionStorage (set by handlePreviewNewTab in App.tsx)
    try {
      const raw = sessionStorage.getItem('mokkoi-preview-data')
      if (raw) {
        sessionStorage.removeItem('mokkoi-preview-data') // one-shot
        const payload = JSON.parse(raw)
        if (payload.tree) {
          setScreenName(payload.name || 'Untitled Screen')
          setTree(payload.tree as ComponentNode)
          setLoading(false)
          return
        }
      }
    } catch { /* ignore parse errors, fall through to Supabase */ }

    // 2. Fall back to Supabase fetch for shared/public links
    const load = async () => {
      if (!supabase) { setError('Not configured'); setLoading(false); return }
      // Check project access: public OR owned by authenticated user
      const { data: project } = await supabase
        .from('projects')
        .select('name, is_public, user_id')
        .eq('id', projectId)
        .single()

      if (!project) {
        setError('Project not found')
        setLoading(false)
        return
      }

      let hasAccess = project.is_public
      if (!hasAccess) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user && user.id === project.user_id) {
          hasAccess = true
        }
      }

      if (!hasAccess) {
        setError('This screen is private')
        setLoading(false)
        return
      }

      // Fetch the specific screen
      const { data: screen } = await supabase
        .from('screens')
        .select('name, component_tree')
        .eq('id', screenId)
        .eq('project_id', projectId)
        .single()

      if (!screen) {
        setError('Screen not found')
        setLoading(false)
        return
      }

      setScreenName(screen.name || 'Untitled Screen')
      setTree(screen.component_tree as ComponentNode)
      setLoading(false)
    }
    load()
  }, [projectId, screenId])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(''), 2500)
    return () => clearTimeout(t)
  }, [toastMessage])

  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setToastMessage('Preview link copied!')
    } catch {
      setToastMessage('Could not copy link')
    }
  }

  const device = DEVICE_PRESETS.find(d => d.id === activeDevice) || DEVICE_PRESETS[0]

  const deviceIcon = (preset: DevicePreset) => {
    switch (preset.icon) {
      case 'phone': return <Smartphone size={16} />
      case 'phone-lg': return <Smartphone size={18} />
      case 'tablet': return <Tablet size={16} />
      case 'desktop': return <Monitor size={16} />
    }
  }

  // Scale factor to fit device in viewport
  const getScale = (d: DevicePreset) => {
    const maxH = window.innerHeight - 160 // navbar + label + padding
    const maxW = window.innerWidth - 80
    const isPhone = d.icon === 'phone' || d.icon === 'phone-lg'
    // For phones, scale relative to the PhoneFrame's actual DEVICE dimensions
    const refW = isPhone ? DEVICE_W : d.width
    const refH = isPhone ? DEVICE_H : d.height
    const scaleH = maxH / refH
    const scaleW = maxW / refW
    return Math.min(1, scaleH, scaleW)
  }

  // ----- Error state -----
  if (!loading && error) {
    return (
      <div style={{
        height: '100vh', background: '#0A0A0A', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        fontFamily: "'DM Sans', -apple-system, system-ui, sans-serif",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 20, fontWeight: 800,
        }}>M</div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#f1f5f9' }}>
          {error}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
          The owner may have disabled sharing, or the link is incorrect.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: 8, padding: '10px 24px', borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            border: 'none', cursor: 'pointer',
          }}
        >
          Go to Mokkoi
        </button>
      </div>
    )
  }

  // ----- Loading state -----
  if (loading) {
    return (
      <div style={{
        height: '100vh', background: '#0A0A0A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', fontSize: 14, fontFamily: "'DM Sans', -apple-system, system-ui, sans-serif",
      }}>
        Loading preview...
      </div>
    )
  }

  // ----- Render a single device frame -----
  const renderDeviceFrame = (d: DevicePreset, scale?: number) => {
    const s = scale ?? getScale(d)
    const isPhone = d.icon === 'phone' || d.icon === 'phone-lg'

    return (
      <div key={d.id} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        flexShrink: 0,
      }}>
        {isPhone ? (
          /* Phone presets: reuse PhoneFrame with preview mode + viewport-fit scaling */
          <div style={{
            transform: `scale(${s})`,
            transformOrigin: 'top center',
          }}>
            <PhoneFrame mode="preview" generatedTree={tree ?? undefined} />
          </div>
        ) : (
          /* Tablet/Desktop presets: simple container, no phone chrome */
          <div style={{
            width: d.width,
            height: d.height,
            borderRadius: d.borderRadius,
            overflow: 'hidden',
            background: '#000',
            border: '2px solid rgba(255,255,255,0.12)',
            boxShadow: '0 0 60px rgba(99,102,241,0.06), 0 20px 60px rgba(0,0,0,0.5)',
            transform: `scale(${s})`,
            transformOrigin: 'top center',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div
              className="phone-screen"
              style={{
                flex: 1,
                overflowX: 'hidden',
                overflowY: 'auto',
                backgroundColor: '#0F172A',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
              }}
            >
              <style>{`.phone-screen::-webkit-scrollbar { display: none; }`}</style>
              {tree && <ScreenRenderer tree={tree} />}
            </div>
          </div>
        )}

        {/* Device label */}
        <span style={{
          fontSize: 12, fontWeight: 500, color: '#64748b',
          transform: `scale(${s})`, transformOrigin: 'top center',
        }}>
          {d.name} — {d.width} × {d.height}
        </span>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh', background: '#0A0A0A', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontFamily: "'DM Sans', -apple-system, system-ui, sans-serif",
    }}>
      {/* ----- Top Navbar ----- */}
      <nav style={{
        height: 56, flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px',
        background: '#111111',
        zIndex: 50,
        gap: 12,
      }}>
        {/* Left: Logo + screen name */}
        <div
          onClick={() => navigate('/')}
          style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            color: '#fff', fontSize: 12, fontWeight: 800,
            cursor: 'pointer', transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >M</div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap' }}>
          {screenName}
        </span>

        <div style={{ flex: 1 }} />

        {/* Center: Device switcher */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          padding: '4px 6px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {DEVICE_PRESETS.map(preset => (
            <button
              key={preset.id}
              title={`${preset.name} (${preset.width}×${preset.height})`}
              onClick={() => { setActiveDevice(preset.id); setShowAll(false) }}
              style={{
                width: 34, height: 30, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: !showAll && activeDevice === preset.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: !showAll && activeDevice === preset.id ? '#818CF8' : '#888',
                border: !showAll && activeDevice === preset.id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (showAll || activeDevice !== preset.id) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              }}
              onMouseLeave={e => {
                if (showAll || activeDevice !== preset.id) e.currentTarget.style.background = 'transparent'
              }}
            >
              {deviceIcon(preset)}
            </button>
          ))}

          {/* Separator */}
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

          {/* Show all */}
          <button
            title="Show all devices"
            onClick={() => setShowAll(!showAll)}
            style={{
              width: 34, height: 30, borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: showAll ? 'rgba(99,102,241,0.2)' : 'transparent',
              color: showAll ? '#818CF8' : '#888',
              border: showAll ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!showAll) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { if (!showAll) e.currentTarget.style.background = 'transparent' }}
          >
            <LayoutGrid size={16} />
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Right: Share + Open in Studio */}
        <button
          onClick={handleShare}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        >
          <Share2 size={14} />
          Share
        </button>
        <button
          onClick={() => navigate(`/app/${projectId}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            border: 'none',
            color: '#fff', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          <ExternalLink size={14} />
          Open in Studio
        </button>
      </nav>

      {/* ----- Center: Device frame(s) ----- */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflow: 'auto', padding: '40px 20px',
        gap: 40,
      }}>
        {showAll ? (
          // Show all devices side by side
          DEVICE_PRESETS.map(d => {
            // Scale all to fit: use a smaller scale for "all" view
            const maxH = window.innerHeight - 200
            const isPhone = d.icon === 'phone' || d.icon === 'phone-lg'
            const refH = isPhone ? DEVICE_H : d.height
            const s = Math.min(0.45, maxH / refH)
            return renderDeviceFrame(d, s)
          })
        ) : (
          renderDeviceFrame(device)
        )}
      </div>

      {/* ----- Toast ----- */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          padding: '10px 20px', borderRadius: 10,
          background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)',
          color: '#e2e8f0', fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 200, animation: 'fadeInDown 0.2s ease-out',
        }}>
          {toastMessage}
        </div>
      )}

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
