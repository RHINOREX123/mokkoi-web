import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PhoneFrame } from './components/PhoneFrame'
import { ChatPanel, type ChatMessage } from './components/ChatPanel'
import { CodeExportModal } from './components/CodeExportModal'
import { MousePointer2, Hand, ZoomOut, ZoomIn, PenTool, Upload, Sparkles, Download, Share2, Plus, X } from 'lucide-react'
import type { ComponentNode } from './types/mokkoi'

interface GeneratedScreen {
  id: string
  name: string
  tree: ComponentNode
  messages: ChatMessage[]
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

  // Resizable panel — left is chat (28%), right is canvas (72%)
  const [splitRatio, setSplitRatio] = useState(0.28)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Pan state — Figma-style translate-based panning
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const panOffsetStart = useRef({ x: 0, y: 0 })
  const isSpaceHeld = useRef(false)

  // Prevent browser-level Ctrl+scroll zoom + spacebar pan shortcut
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        isSpaceHeld.current = true
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceHeld.current = false
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
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      let ratio = (e.clientX - rect.left) / rect.width
      ratio = Math.max(0.2, Math.min(0.45, ratio))
      setSplitRatio(ratio)
    }
    const handleMouseUp = () => {
      isDragging.current = false
      isPanning.current = false
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
  // Messages for the active screen (or empty for new screen)
  const activeMessages = activeGenerated?.messages ?? []


  const handleSend = useCallback(async (prompt: string, imageData?: string, imageMimeType?: string, forceNew?: boolean) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      imageData,
    }

    // Detect flow requests
    const flowRequest = isFlowPrompt(prompt) && !imageData

    // Intent detection: decide whether to edit or create
    let editingScreenId: string | null = null
    if (!forceNew && activeGeneratedId) {
      const hasEditIntent = isEditIntent(prompt)
      const hasCreateIntent = isCreateIntent(prompt)
      // Edit if: screen selected AND (edit words OR no create words)
      if (hasEditIntent && !hasCreateIntent) {
        editingScreenId = activeGeneratedId
      } else if (!hasEditIntent && hasCreateIntent) {
        editingScreenId = null // create new
      } else if (hasEditIntent && hasCreateIntent) {
        // Ambiguous — default to edit since a screen is selected
        editingScreenId = activeGeneratedId
      } else {
        // No keywords — default to edit selected screen
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
        messages: [userMsg],
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
        const newFlowScreens: GeneratedScreen[] = (screens as Array<{ id: string; name: string; tree: ComponentNode }>).map((s: { id: string; name: string; tree: ComponentNode }, i: number) => ({
          id: crypto.randomUUID(),
          name: s.name,
          tree: s.tree,
          flowId,
          messages: i === 0
            ? [
                userMsg,
                {
                  id: crypto.randomUUID(),
                  role: 'assistant' as const,
                  content: `Generated a flow with ${screens.length} screens: ${screenNames.join(' \u2192 ')}`,
                  timestamp: Date.now(),
                  flowScreenNames: screenNames,
                },
              ]
            : [],
        }))

        // Replace placeholder with flow screens
        setGeneratedScreens(prev => {
          const withoutPlaceholder = prev.filter(s => s.id !== placeholderId)
          return [...withoutPlaceholder, ...newFlowScreens]
        })
        setActiveGeneratedId(newFlowScreens[0].id)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${errorMessage}`,
          timestamp: Date.now(),
        }
        setGeneratedScreens(prev => prev.map(s =>
          s.id === placeholderId
            ? { ...s, messages: [...s.messages, errorMsg] }
            : s
        ))
      } finally {
        setIsGenerating(false)
      }
      return
    }

    // === SINGLE SCREEN GENERATION (original logic) ===
    let targetId: string

    if (editingScreen) {
      // Editing existing screen — append message
      targetId = editingScreenId!
      setGeneratedScreens(prev => prev.map(s =>
        s.id === targetId
          ? { ...s, messages: [...s.messages, userMsg] }
          : s
      ))
    } else {
      // Creating a new screen
      targetId = crypto.randomUUID()
      const name = prompt.length > 20 ? prompt.slice(0, 20) + '...' : prompt
      const newScreen: GeneratedScreen = {
        id: targetId,
        name,
        tree: { type: 'View', style: {}, children: [] },
        messages: [userMsg],
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

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: editingScreen ? 'Updated your screen design' : 'Generated your screen design',
        timestamp: Date.now(),
      }
      setGeneratedScreens(prev => prev.map(s =>
        s.id === targetId
          ? { ...s, tree, messages: [...s.messages, assistantMsg] }
          : s
      ))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        timestamp: Date.now(),
      }
      setGeneratedScreens(prev => prev.map(s =>
        s.id === targetId
          ? { ...s, messages: [...s.messages, errorMsg] }
          : s
      ))
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
  const canPan = (e: React.MouseEvent) =>
    activeTool === 'pan' || e.button === 1 || isSpaceHeld.current

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!canPan(e)) return
    // Prevent middle-click auto-scroll
    if (e.button === 1) e.preventDefault()
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY }
    panOffsetStart.current = { ...panOffset }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    setPanOffset({
      x: panOffsetStart.current.x + dx,
      y: panOffsetStart.current.y + dy,
    })
  }

  const handleCanvasMouseUp = () => {
    isPanning.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  const resetPan = () => setPanOffset({ x: 0, y: 0 })

  // Click empty canvas to deselect
  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only deselect if clicking directly on the canvas background (not a child phone)
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset?.canvasBg === 'true') {
      setActiveGeneratedId(null)
    }
  }

  // Share: copy current URL
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch {
      // fallback — silently ignore
    }
  }

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

  // Navbar button helper
  const navBtn = (icon: React.ReactNode, label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 8,
        fontSize: 12, fontWeight: 500,
        color: '#94a3b8',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
        e.currentTarget.style.color = '#e2e8f0'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.color = '#94a3b8'
      }}
    >
      {icon}
      {label}
    </button>
  )

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
        {/* Left: logo + Design Studio */}
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
        <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b', flexShrink: 0 }}>Design Studio</span>

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
          {navBtn(<Download size={14} />, 'Export', () => {
            if (generatedTree) setShowCodeExport(true)
          })}

          {/* Share button */}
          {navBtn(<Share2 size={14} />, 'Share', handleShare)}

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
            U
          </div>
        </div>
      </nav>

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
            messages={activeMessages}
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

        {/* RIGHT: Canvas — light cream background with dot grid */}
        <div
          ref={canvasRef}
          className="canvas-side"
          onWheel={handleCanvasWheel}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
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
            cursor: (activeTool === 'pan' || isSpaceHeld.current) ? 'grab' : 'default',
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
            /* ALL SCREENS + REFERENCE IMAGES — horizontal row */
            <div
              data-canvas-bg="true"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 40,
                padding: '40px 60px',
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel / 100})`,
                transformOrigin: 'center center',
                transition: isPanning.current ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              {generatedScreens.map((screen, idx) => {
                const isActive = screen.id === activeGeneratedId
                const isScreenGenerating = isGenerating && isActive
                const isImage = screen.type === 'image'
                return (
                  <div
                    key={screen.id}
                    onClick={(e) => { e.stopPropagation(); setActiveGeneratedId(screen.id) }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                      cursor: 'pointer', flexShrink: 0,
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

      {/* Responsive styles */}
      <style>{`
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
