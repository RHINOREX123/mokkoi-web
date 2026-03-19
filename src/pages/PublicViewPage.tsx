import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PhoneFrame } from '../components/PhoneFrame'
import { ZoomOut, ZoomIn } from 'lucide-react'
import type { ComponentNode } from '../types/mokkoi'
import { supabase } from '../lib/supabase'

interface PublicScreen {
  id: string
  name: string
  tree: ComponentNode
}

export default function PublicViewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [projectName, setProjectName] = useState('')
  const [screens, setScreens] = useState<PublicScreen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Pan/zoom state
  const [zoomLevel, setZoomLevel] = useState(100)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const panOffsetStart = useRef({ x: 0, y: 0 })
  const isSpaceHeld = useRef(false)
  const [isSpacePanning, setIsSpacePanning] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Load project data (public only)
  useEffect(() => {
    if (!projectId) return
    const load = async () => {
      if (!supabase) { setError(true); setLoading(false); return }
      const { data: project } = await supabase
        .from('projects')
        .select('name, is_public')
        .eq('id', projectId)
        .single()

      if (!project || !project.is_public) {
        setError(true)
        setLoading(false)
        return
      }

      setProjectName(project.name || 'Untitled Project')

      const { data: screenData } = await supabase
        .from('screens')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true })

      if (screenData && screenData.length > 0) {
        setScreens(screenData.map(s => ({
          id: s.id,
          name: s.name,
          tree: s.component_tree as ComponentNode,
        })))
      }
      setLoading(false)
    }
    load()
  }, [projectId])

  // Zoom
  const zoomIn = () => setZoomLevel(z => Math.min(300, z + 5))
  const zoomOut = () => setZoomLevel(z => Math.max(25, z - 5))
  const resetZoom = () => { setZoomLevel(100); setPanOffset({ x: 0, y: 0 }) }

  // Canvas wheel handler
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement
      if (!e.ctrlKey && !e.metaKey && target.closest('.phone-screen')) {
        const phoneEl = target.closest('.phone-screen') as HTMLElement
        if (phoneEl) {
          const { scrollTop, scrollHeight, clientHeight } = phoneEl
          const atTop = scrollTop <= 0 && e.deltaY < 0
          const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0
          if (scrollHeight > clientHeight && !atTop && !atBottom) return
        }
      }
      e.preventDefault()
      e.stopPropagation()

      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect()
        const mx = e.clientX - rect.left - rect.width / 2
        const my = e.clientY - rect.top - rect.height / 2
        setZoomLevel(prev => {
          const delta = e.deltaY > 0 ? -5 : 5
          const next = Math.min(300, Math.max(25, prev + delta))
          const s = next / prev
          setPanOffset(p => ({ x: mx - s * (mx - p.x), y: my - s * (my - p.y) }))
          return next
        })
      } else if (e.shiftKey) {
        setPanOffset(p => ({ ...p, x: p.x - e.deltaY }))
      } else {
        setPanOffset(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
      }
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // Pan via mouse
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning.current) return
      setPanOffset({
        x: panOffsetStart.current.x + (e.clientX - panStart.current.x),
        y: panOffsetStart.current.y + (e.clientY - panStart.current.y),
      })
    }
    const handleMouseUp = () => {
      if (isPanning.current) {
        isPanning.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Spacebar for pan
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        isSpaceHeld.current = true
        setIsSpacePanning(true)
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceHeld.current = false
        setIsSpacePanning(false)
      }
    }
    // Prevent browser zoom
    const preventZoom = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault() }
    document.addEventListener('keydown', onDown)
    document.addEventListener('keyup', onUp)
    document.addEventListener('wheel', preventZoom, { passive: false })
    return () => {
      document.removeEventListener('keydown', onDown)
      document.removeEventListener('keyup', onUp)
      document.removeEventListener('wheel', preventZoom)
    }
  }, [])

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || isSpaceHeld.current) {
      if (e.button === 1) e.preventDefault()
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY }
      panOffsetStart.current = { ...panOffset }
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }
  }, [panOffset])

  const cursor = isPanning.current ? 'grabbing' : isSpacePanning ? 'grab' : 'default'

  // Error state
  if (!loading && error) {
    return (
      <div style={{
        height: '100vh', background: '#000', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 20, fontWeight: 800,
        }}>M</div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#f1f5f9' }}>
          This project is private or doesn't exist
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

  // Loading state
  if (loading) {
    return (
      <div style={{
        height: '100vh', background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', fontSize: 14, fontFamily: "'DM Sans', sans-serif",
      }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Navbar */}
      <nav style={{
        height: 48, flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 10,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(20px)',
        zIndex: 50,
      }}>
        {/* Logo */}
        <div
          onClick={() => navigate('/')}
          style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            color: '#fff', fontSize: 11, fontWeight: 800,
            cursor: 'pointer', transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >M</div>

        {/* Project name */}
        <span style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>
          {projectName}
        </span>

        <div style={{ flex: 1 }} />

        {/* Made with Mokkoi */}
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
          Made with Mokkoi
        </span>

        {/* Try Mokkoi button */}
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '5px 14px', borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            color: '#fff', fontSize: 12, fontWeight: 600,
            border: 'none', cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          Try Mokkoi
        </button>
      </nav>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#E8E8E8',
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
          cursor,
        }}
      >
        {screens.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            pointerEvents: 'none', userSelect: 'none',
          }}>
            <span style={{ fontSize: 15, color: 'rgba(0,0,0,0.3)', fontWeight: 500 }}>
              No screens in this project yet
            </span>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 40,
            padding: '40px 60px',
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel / 100})`,
            transformOrigin: 'center center',
            transition: isPanning.current ? 'none' : 'transform 0.15s ease-out',
          }}>
            {screens.map((screen, idx) => (
              <div key={screen.id} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#888',
                  textAlign: 'center', maxWidth: 200,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  padding: '2px 8px', borderRadius: 6,
                }}>
                  {idx + 1}. {screen.name}
                </span>
                <div style={{
                  borderRadius: 52,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}>
                  <PhoneFrame generatedTree={screen.tree} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom zoom toolbar */}
        <div style={{
          position: 'absolute', bottom: 16, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '8px 16px',
          background: '#1A1A1A', borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 20,
        }}>
          <button
            title="Zoom out"
            onClick={zoomOut}
            style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', color: '#999',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <ZoomOut size={18} />
          </button>
          <button
            title="Reset zoom"
            onClick={resetZoom}
            style={{
              fontSize: 12, fontWeight: 600, color: '#999', minWidth: 36, textAlign: 'center',
              userSelect: 'none', background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '4px 2px', borderRadius: 6, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#999'; e.currentTarget.style.background = 'transparent' }}
          >
            {zoomLevel}%
          </button>
          <button
            title="Zoom in"
            onClick={zoomIn}
            style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', color: '#999',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
