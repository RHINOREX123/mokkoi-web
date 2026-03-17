import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PhoneFrame } from './components/PhoneFrame'
import { ChatPanel, type ChatMessage } from './components/ChatPanel'
import { CodeExportModal } from './components/CodeExportModal'
import { MousePointer2, Hand, ZoomOut, ZoomIn, PenTool, Upload, Sparkles, Download, Share2, Plus, X, Pencil } from 'lucide-react'
import type { ComponentNode } from './types/mokkoi'

interface GeneratedScreen {
  id: string
  name: string
  tree: ComponentNode
  /** If this screen is part of a flow, all screens in the flow share the same flowId */
  flowId?: string
  /** Screen type: 'generated' for AI screens, 'image' for uploaded screenshots */
  type?: 'generated' | 'image'
  /** Data URL for uploaded screenshot images */
  imageUrl?: string
}

interface CanvasRefImage {
  id: string
  url: string
  name: string
}

const FLOW_KEYWORDS = [
  'flow', 'onboarding', 'walkthrough', 'multi-screen', 'complete app',
  'full app', 'series of screens', 'connected screens', 'user journey',
  'navigation flow', 'multi screen', 'multiple screens', 'screen flow',
  'app flow', 'checkout flow', 'signup flow', 'sign up flow',
]

const EDIT_KEYWORDS = [
  'change', 'update', 'modify', 'remove', 'add to', 'make it', 'make the',
  'replace', 'fix', 'adjust', 'tweak', 'edit', 'move', 'resize', 'recolor',
  'darker', 'lighter', 'bigger', 'smaller', 'add a', 'delete',
]

const CREATE_KEYWORDS = [
  'create', 'build', 'make a', 'design a', 'new', 'generate a',
  'create a', 'build a', 'design', 'make me',
]

function isFlowPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return FLOW_KEYWORDS.some(kw => lower.includes(kw))
}

function isEditIntent(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return EDIT_KEYWORDS.some(kw => lower.includes(kw))
}

function isCreateIntent(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return CREATE_KEYWORDS.some(kw => lower.includes(kw))
}

function App() {
  const [searchParams] = useSearchParams()
  const initialPrompt = searchParams.get('prompt') || undefined

  const [generatedScreens, setGeneratedScreens] = useState<GeneratedScreen[]>([])
  const [activeGeneratedId, setActiveGeneratedId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showCodeExport, setShowCodeExport] = useState(false)
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select')
  const [zoomLevel, setZoomLevel] = useState(100)
  const [referenceImages, setReferenceImages] = useState<CanvasRefImage[]>([])

  // Project-level chat messages — one continuous thread
  const [projectMessages, setProjectMessages] = useState<ChatMessage[]>([])

  // Editable project name
  const [projectName, setProjectName] = useState('Untitled Project')
  const [isEditingName, setIsEditingName] = useState(false)
  const projectNameInputRef = useRef<HTMLInputElement>(null)

  // Share toast
  const [showShareToast, setShowShareToast] = useState(false)

  // Resizable panel — left is chat (28%), right is canvas (72%)
  const [splitRatio, setSplitRatio] = useState(0.28)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Pan state — Figma-style translate-based panning
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const didPan = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const panOffsetStart = useRef({ x: 0, y: 0 })
  const isSpaceHeld = useRef(false)
  const [isSpacePanning, setIsSpacePanning] = useState(false) // state for cursor re-render

  // Focus project name input when editing
  useEffect(() => {
    if (isEditingName) {
      projectNameInputRef.current?.focus()
      projectNameInputRef.current?.select()
    }
  }, [isEditingName])

  // Auto-hide share toast
  useEffect(() => {
    if (!showShareToast) return
    const t = setTimeout(() => setShowShareToast(false), 2000)
    return () => clearTimeout(t)
  }, [showShareToast])

  // Prevent browser-level Ctrl+scroll zoom + spacebar pan shortcut
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        isSpaceHeld.current = true
        setIsSpacePanning(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceHeld.current = false
        setIsSpacePanning(false)
      }
    }
    document.addEventListener('wheel', preventBrowserZoom, { passive: false })
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    return () => {
      document.removeEventListener('wheel', preventBrowserZoom)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        let ratio = (e.clientX - rect.left) / rect.width
        ratio = Math.max(0.2, Math.min(0.45, ratio))
        setSplitRatio(ratio)
      }
      // Handle canvas panning via global mousemove for smoothness
      if (isPanning.current) {
        const dx = e.clientX - panStart.current.x
        const dy = e.clientY - panStart.current.y
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          didPan.current = true
        }
        setPanOffset({
          x: panOffsetStart.current.x + dx,
          y: panOffsetStart.current.y + dy,
        })
      }
    }
    const handleMouseUp = () => {
      isDragging.current = false
      if (isPanning.current) {
        isPanning.current = false
        // Reset didPan after a tick so click handlers can still read it
        requestAnimationFrame(() => { didPan.current = false })
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Current active generated screen
  const activeGenerated = generatedScreens.find(s => s.id === activeGeneratedId)
  const generatedTree = activeGenerated?.tree

  const handleSend = useCallback(async (prompt: string, imageData?: string, imageMimeType?: string, forceNew?: boolean) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      imageData,
    }

    // Add user message to project-level chat
    setProjectMessages(prev => [...prev, userMsg])

    // Detect flow requests
    const flowRequest = isFlowPrompt(prompt) && !imageData

    // Intent detection: decide whether to edit or create
    let editingScreenId: string | null = null
    if (!forceNew && activeGeneratedId) {
      const hasEditIntent = isEditIntent(prompt)
      const hasCreateIntent = isCreateIntent(prompt)
      if (hasEditIntent && !hasCreateIntent) {
        editingScreenId = activeGeneratedId
      } else if (!hasEditIntent && hasCreateIntent) {
        editingScreenId = null
      } else if (hasEditIntent && hasCreateIntent) {
        editingScreenId = activeGeneratedId
      } else {
        editingScreenId = activeGeneratedId
      }
    }

    const editingScreen = editingScreenId
      ? generatedScreens.find(s => s.id === editingScreenId)
      : null

    // Don't use flow mode when editing an existing screen
    if (flowRequest && !editingScreen) {
      // === FLOW GENERATION ===
      const placeholderId = crypto.randomUUID()
      const placeholderName = prompt.length > 20 ? prompt.slice(0, 20) + '...' : prompt
      const placeholderScreen: GeneratedScreen = {
        id: placeholderId,
        name: placeholderName,
        tree: { type: 'View', style: {}, children: [] },
      }
      setGeneratedScreens(prev => [...prev, placeholderScreen])
      setActiveGeneratedId(placeholderId)
      setIsGenerating(true)

      try {
        const res = await fetch('/api/generate-flow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Failed to generate flow')
        }

        const { screens } = await res.json()
        const flowId = crypto.randomUUID()
        const screenNames = (screens as Array<{ id: string; name: string; tree: ComponentNode }>).map((s: { name: string }) => s.name)

        // Create flow screens
        const newFlowScreens: GeneratedScreen[] = (screens as Array<{ id: string; name: string; tree: ComponentNode }>).map((s: { id: string; name: string; tree: ComponentNode }) => ({
          id: crypto.randomUUID(),
          name: s.name,
          tree: s.tree,
          flowId,
        }))

        // Replace placeholder with flow screens
        setGeneratedScreens(prev => {
          const withoutPlaceholder = prev.filter(s => s.id !== placeholderId)
          return [...withoutPlaceholder, ...newFlowScreens]
        })
        setActiveGeneratedId(newFlowScreens[0].id)

        // Add assistant message to project chat
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Generated a flow with ${screens.length} screens: ${screenNames.join(' \u2192 ')}`,
          timestamp: Date.now(),
          flowScreenNames: screenNames,
        }
        setProjectMessages(prev => [...prev, assistantMsg])
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${errorMessage}`,
          timestamp: Date.now(),
        }
        setProjectMessages(prev => [...prev, errorMsg])
      } finally {
        setIsGenerating(false)
      }
      return
    }

    // === SINGLE SCREEN GENERATION ===
    let targetId: string
    let screenName: string
    const screenNumber = editingScreen
      ? generatedScreens.findIndex(s => s.id === editingScreenId) + 1
      : generatedScreens.length + 1

    if (editingScreen) {
      targetId = editingScreenId!
      screenName = editingScreen.name
    } else {
      targetId = crypto.randomUUID()
      screenName = prompt.length > 20 ? prompt.slice(0, 20) + '...' : prompt
      const newScreen: GeneratedScreen = {
        id: targetId,
        name: screenName,
        tree: { type: 'View', style: {}, children: [] },
      }
      setGeneratedScreens(prev => [...prev, newScreen])
      setActiveGeneratedId(targetId)
    }

    setIsGenerating(true)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          ...(editingScreen ? { currentScreen: editingScreen.tree } : {}),
          ...(imageData ? { imageData, imageMimeType: imageMimeType || 'image/png' } : {}),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate screen')
      }

      const { tree } = await res.json()

      setGeneratedScreens(prev => prev.map(s =>
        s.id === targetId ? { ...s, tree } : s
      ))

      // Project-level assistant message with screen context
      const action = editingScreen ? 'Updated' : 'Generated'
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `${action} Screen ${screenNumber}: ${screenName}`,
        timestamp: Date.now(),
      }
      setProjectMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        timestamp: Date.now(),
      }
      setProjectMessages(prev => [...prev, errorMsg])
    } finally {
      setIsGenerating(false)
    }
  }, [activeGeneratedId, generatedScreens])

  // Handle clicking a screen name in a flow message
  const handleFlowScreenClick = (screenName: string) => {
    const screen = generatedScreens.find(s => s.name === screenName && s.flowId)
    if (screen) {
      setActiveGeneratedId(screen.id)
    }
  }

  const startDragging = () => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // Handle file upload from canvas toolbar — places image as REFERENCE on canvas
  const handleCanvasUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const name = file.name.replace(/\.[^.]+$/, '')
      setReferenceImages(prev => [...prev, {
        id: crypto.randomUUID(),
        url: dataUrl,
        name: name.length > 20 ? name.slice(0, 20) + '...' : name,
      }])
    }
    reader.readAsDataURL(file)
  }

  const removeReferenceImage = (id: string) => {
    setReferenceImages(prev => prev.filter(img => img.id !== id))
  }

  // Generate a screen from an uploaded screenshot on the canvas
  const handleGenerateFromImage = (screen: GeneratedScreen) => {
    if (!screen.imageUrl) return
    const match = screen.imageUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return
    const [, mimeType, base64] = match
    handleSend('Recreate this screen design', base64, mimeType, true)
  }

  // Determine canvas state
  const hasScreens = generatedScreens.length > 0

  // Zoom handlers
  const zoomIn = () => setZoomLevel(z => Math.min(200, z + 10))
  const zoomOut = () => setZoomLevel(z => Math.max(25, z - 10))
  const resetZoom = () => { setZoomLevel(100); resetPan() }

  const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -10 : 10
      setZoomLevel(z => Math.min(200, Math.max(25, z + delta)))
    }
  }, [])

  // Pan handlers — Figma-style: hand tool, middle mouse, or spacebar+drag
  // Works ANYWHERE on canvas (empty space, phones, reference images)
  const shouldPan = (e: React.MouseEvent) =>
    activeTool === 'pan' || e.button === 1 || isSpaceHeld.current

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!shouldPan(e)) return
    if (e.button === 1) e.preventDefault()
    isPanning.current = true
    didPan.current = false
    panStart.current = { x: e.clientX, y: e.clientY }
    panOffsetStart.current = { ...panOffset }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

  const resetPan = () => setPanOffset({ x: 0, y: 0 })

  // Click empty canvas to deselect (only in select mode)
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (didPan.current) return
    if (activeTool === 'pan' || isSpaceHeld.current) return
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset?.canvasBg === 'true') {
      setActiveGeneratedId(null)
    }
  }

  // Phone click handler — select only in select mode and if not panning
  const handlePhoneClick = (e: React.MouseEvent, screenId: string) => {
    e.stopPropagation()
    if (didPan.current) return
    if (activeTool === 'pan' || isSpaceHeld.current) return
    setActiveGeneratedId(screenId)
  }

  // Share: copy current URL + show toast
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShowShareToast(true)
    } catch {
      // fallback
    }
  }

  // Project name editing
  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditingName(false)
    }
    if (e.key === 'Escape') {
      setIsEditingName(false)
    }
  }

  const handleNameBlur = () => {
    setIsEditingName(false)
    if (!projectName.trim()) setProjectName('Untitled Project')
  }

  // Determine canvas cursor
  const panActive = activeTool === 'pan' || isSpacePanning
  const canvasCursor = isPanning.current ? 'grabbing' : panActive ? 'grab' : 'default'

  // Toolbar button helper
  const tbBtn = (id: string, icon: React.ReactNode, tooltip: string, onClick?: () => void) => {
    const isActiveTool = id === 'select' || id === 'pan'
    const isActive = isActiveTool && activeTool === id
    return (
      <button
        title={tooltip}
        onClick={onClick ?? (() => { if (id === 'select' || id === 'pan') setActiveTool(id) })}
        style={{
          width: 32, height: 32, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
          color: isActive ? '#fff' : '#999',
          border: 'none', cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        {icon}
      </button>
    )
  }

  return (
    <div className="app-shell" style={{ height: '100vh', background: '#000000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Hidden file input for canvas upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        style={{ display: 'none' }}
        onChange={handleCanvasUpload}
      />

      {/* Navbar */}
      <nav
        style={{
          height: 48, flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center',
          padding: '0 16px',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          gap: 12,
          transformOrigin: 'unset',
          zoom: 1,
        }}
      >
        {/* Left: logo + editable project name */}
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
          <div
            style={{
              width: 26, height: 26, borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              color: '#fff', fontSize: 11, fontWeight: 800,
            }}
          >
            M
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>Mokkoi</span>
        </a>

        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, userSelect: 'none', flexShrink: 0 }}>|</span>

        {/* Editable project name */}
        {isEditingName ? (
          <input
            ref={projectNameInputRef}
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            onKeyDown={handleNameKeyDown}
            onBlur={handleNameBlur}
            style={{
              fontSize: 14, fontWeight: 500, color: '#f1f5f9',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: 6,
              padding: '2px 8px',
              outline: 'none',
              minWidth: 120, maxWidth: 240,
            }}
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="project-name-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 14, fontWeight: 500, color: '#f1f5f9',
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 6,
              padding: '2px 8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              const pencil = e.currentTarget.querySelector('.pencil-icon') as HTMLElement
              if (pencil) pencil.style.opacity = '1'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
              const pencil = e.currentTarget.querySelector('.pencil-icon') as HTMLElement
              if (pencil) pencil.style.opacity = '0'
            }}
            title="Click to rename project"
          >
            {projectName}
            <span className="pencil-icon" style={{ opacity: 0, transition: 'opacity 0.2s', display: 'flex' }}>
              <Pencil size={12} color="#64748b" />
            </span>
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

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right: action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* New screen button */}
          <button
            onClick={() => {
              setActiveGeneratedId(null)
              setShowCodeExport(false)
            }}
            style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 8,
              fontSize: 12, fontWeight: 500,
              color: '#818cf8',
              background: 'rgba(99,102,241,0.08)',
              border: '1px dashed rgba(99,102,241,0.3)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(99,102,241,0.15)'
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(99,102,241,0.08)'
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
            }}
            title="New screen"
          >
            <Plus size={14} />
            New Screen
          </button>

          {/* Export button */}
          <button
            onClick={() => { if (generatedTree) setShowCodeExport(true) }}
            style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 8,
              fontSize: 12, fontWeight: 500,
              color: '#94a3b8',
              background: 'transparent',
              border: 'none',
              cursor: generatedTree ? 'pointer' : 'default',
              opacity: generatedTree ? 1 : 0.4,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (generatedTree) e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
          >
            <Download size={14} />
            Export
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            style={{
              flexShrink: 0, position: 'relative',
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 8,
              fontSize: 12, fontWeight: 500,
              color: '#94a3b8',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
          >
            <Share2 size={14} />
            Share
          </button>

          {/* User avatar */}
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff',
              flexShrink: 0, cursor: 'default',
            }}
            title="User"
          >
            S
          </div>
        </div>
      </nav>

      {/* Share toast */}
      {showShareToast && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 20px', borderRadius: 10,
          background: '#1a1a2e', color: '#34d399',
          fontSize: 13, fontWeight: 500,
          border: '1px solid rgba(52,211,153,0.2)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 100,
          animation: 'fadeInDown 0.25s ease-out',
        }}>
          Link copied!
        </div>
      )}

      {/* Main content: LEFT = Chat, RIGHT = Canvas */}
      <div
        ref={containerRef}
        className="main-panels"
        style={{
          flex: 1, minHeight: 0, display: 'flex', position: 'relative',
        }}
      >
        {/* LEFT: Chat panel */}
        <div
          className="chat-side"
          style={{
            width: `${splitRatio * 100}%`,
            display: 'flex', flexDirection: 'column', minHeight: 0,
            background: '#0A0A0A',
            transformOrigin: 'unset',
            zoom: 1,
          }}
        >
          <ChatPanel
            messages={projectMessages}
            onSend={handleSend}
            onExportCode={() => generatedTree && setShowCodeExport(true)}
            isGenerating={isGenerating}
            initialPrompt={initialPrompt}
            onFlowScreenClick={handleFlowScreenClick}
            hasScreens={hasScreens}
            selectedScreenName={activeGenerated?.name}
          />
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={startDragging}
          style={{
            width: 1,
            cursor: 'col-resize',
            background: 'rgba(255,255,255,0.06)',
            position: 'relative',
            flexShrink: 0,
            transition: 'background 0.2s',
            zIndex: 10,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.width = '3px' }}
          onMouseLeave={e => { if (!isDragging.current) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.width = '1px' } }}
        />

        {/* RIGHT: Canvas */}
        <div
          ref={canvasRef}
          className="canvas-side"
          onWheel={handleCanvasWheel}
          onMouseDown={handleCanvasMouseDown}
          onClick={handleCanvasClick}
          style={{
            width: `${(1 - splitRatio) * 100}%`,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#E8E8E8',
            backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
            cursor: canvasCursor,
          }}
        >
          {/* Canvas content — multi-screen infinite canvas */}
          {!hasScreens && !isGenerating && referenceImages.length === 0 ? (
            /* EMPTY STATE */
            <div data-canvas-bg="true" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              pointerEvents: 'none', userSelect: 'none',
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            }}>
              <span style={{ fontSize: 15, color: 'rgba(0,0,0,0.3)', fontWeight: 500 }}>
                Your designs will appear here
              </span>
            </div>
          ) : (
            /* ALL SCREENS + REFERENCE IMAGES */
            <div
              data-canvas-bg="true"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 40,
                padding: '40px 60px',
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel / 100})`,
                transformOrigin: 'center center',
                transition: isPanning.current ? 'none' : 'transform 0.15s ease-out',
                cursor: panActive ? 'inherit' : 'default',
              }}
            >
              {generatedScreens.map((screen, idx) => {
                const isActive = screen.id === activeGeneratedId
                const isScreenGenerating = isGenerating && isActive
                const isImage = screen.type === 'image'
                return (
                  <div
                    key={screen.id}
                    onClick={(e) => handlePhoneClick(e, screen.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                      cursor: panActive ? 'inherit' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {/* Screen label */}
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: isActive ? '#6366f1' : '#888',
                      textAlign: 'center', maxWidth: 200,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      transition: 'color 0.2s',
                      padding: '2px 8px', borderRadius: 6,
                      background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                    }}>
                      {idx + 1}. {screen.name}
                    </span>

                    {/* Phone frame with selection highlight */}
                    <div style={{
                      borderRadius: 52,
                      boxShadow: isActive
                        ? '0 8px 32px rgba(0,0,0,0.3), 0 0 0 3px rgba(99,102,241,0.5), 0 0 20px rgba(99,102,241,0.15)'
                        : '0 8px 32px rgba(0,0,0,0.2)',
                      transition: 'box-shadow 0.25s',
                    }}>
                      <PhoneFrame
                        generatedTree={!isImage ? screen.tree : undefined}
                        imageUrl={isImage ? screen.imageUrl : undefined}
                        isGenerating={isScreenGenerating}
                      />
                    </div>

                    {/* "Generate from this" button for uploaded images */}
                    {isImage && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleGenerateFromImage(screen) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 14px', borderRadius: 20,
                          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                          color: '#fff', fontSize: 11, fontWeight: 600,
                          border: 'none', cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                      >
                        <Sparkles size={12} />
                        Generate from this
                      </button>
                    )}
                  </div>
                )
              })}

              {/* Reference images from toolbar upload */}
              {referenceImages.map(img => (
                <div
                  key={img.id}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    flexShrink: 0, position: 'relative',
                  }}
                >
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#888',
                    padding: '2px 8px', borderRadius: 6,
                  }}>
                    Ref: {img.name}
                  </span>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={img.url}
                      alt={img.name}
                      style={{
                        maxWidth: 280, maxHeight: 500,
                        borderRadius: 12,
                        border: '2px solid rgba(0,0,0,0.15)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                        objectFit: 'contain',
                        background: '#fff',
                      }}
                    />
                    {/* Remove button */}
                    <button
                      onClick={() => removeReferenceImage(img.id)}
                      style={{
                        position: 'absolute', top: -8, right: -8,
                        width: 22, height: 22, borderRadius: '50%',
                        background: '#1a1a1a', color: '#fff',
                        border: '2px solid rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: 12,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f87171'; e.currentTarget.style.borderColor = '#f87171' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                      title="Remove reference image"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom canvas toolbar */}
          <div style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 16px',
            background: '#1A1A1A',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 20,
            transformOrigin: 'unset',
            zoom: 1,
          }}>
            {tbBtn('select', <MousePointer2 size={18} />, 'Select')}
            {tbBtn('pan', <Hand size={18} />, 'Pan')}

            {/* Separator */}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

            {tbBtn('zoomOut', <ZoomOut size={18} />, 'Zoom out', zoomOut)}
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
            {tbBtn('zoomIn', <ZoomIn size={18} />, 'Zoom in', zoomIn)}

            {/* Separator */}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

            {tbBtn('pen', <PenTool size={18} />, 'Direct edit (coming soon)', () => {})}
            {tbBtn('upload', <Upload size={18} />, 'Upload reference image', () => fileInputRef.current?.click())}
          </div>
        </div>
      </div>

      {/* Responsive styles + toast animation */}
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @media (max-width: 768px) {
          .main-panels {
            flex-direction: column !important;
          }
          .chat-side {
            width: 100% !important;
            height: 50% !important;
            border-bottom: 1px solid rgba(255,255,255,0.06);
          }
          .canvas-side {
            width: 100% !important;
            height: 50% !important;
          }
        }
      `}</style>

      {/* Code Export Modal */}
      {showCodeExport && generatedTree && (
        <CodeExportModal
          tree={generatedTree}
          onClose={() => setShowCodeExport(false)}
        />
      )}
    </div>
  )
}

export default App
