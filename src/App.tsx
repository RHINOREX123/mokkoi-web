import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PhoneFrame } from './components/PhoneFrame'
import { ChatPanel, type ChatMessage } from './components/ChatPanel'
import { CodeExportModal } from './components/CodeExportModal'
import { MousePointer2, Hand, ZoomOut, ZoomIn, PenTool, Upload } from 'lucide-react'
import type { ComponentNode } from './types/mokkoi'

interface GeneratedScreen {
  id: string
  name: string
  tree: ComponentNode
  messages: ChatMessage[]
  /** If this screen is part of a flow, all screens in the flow share the same flowId */
  flowId?: string
}

const FLOW_KEYWORDS = [
  'flow', 'onboarding', 'walkthrough', 'multi-screen', 'complete app',
  'full app', 'series of screens', 'connected screens', 'user journey',
  'navigation flow', 'multi screen', 'multiple screens', 'screen flow',
  'app flow', 'checkout flow', 'signup flow', 'sign up flow',
]

function isFlowPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return FLOW_KEYWORDS.some(kw => lower.includes(kw))
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

  // Resizable panel — left is chat (28%), right is canvas (72%)
  const [splitRatio, setSplitRatio] = useState(0.28)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Pan state
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const scrollStart = useRef({ x: 0, y: 0 })

  // Prevent browser-level Ctrl+scroll zoom on the entire page
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault()
    }
    document.addEventListener('wheel', preventBrowserZoom, { passive: false })
    return () => document.removeEventListener('wheel', preventBrowserZoom)
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

  // Flow navigation: get sibling screens if active screen is part of a flow
  const activeFlowId = activeGenerated?.flowId
  const flowScreens = activeFlowId
    ? generatedScreens.filter(s => s.flowId === activeFlowId)
    : []
  const flowIndex = activeFlowId
    ? flowScreens.findIndex(s => s.id === activeGeneratedId)
    : -1
  const isInFlow = flowScreens.length > 1

  const handleSend = useCallback(async (prompt: string, imageData?: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      imageData,
    }

    // Detect flow requests
    const flowRequest = isFlowPrompt(prompt) && !imageData

    // If we have an active generated screen, we're editing it
    const editingScreenId = activeGeneratedId
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
          ...(imageData ? { imageData } : {}),
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

  // Handle file upload from canvas toolbar
  const handleCanvasUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      handleSend('Recreate this screen design', base64)
    }
    reader.readAsDataURL(file)
  }

  // Determine canvas state
  const hasScreens = generatedScreens.length > 0

  // Zoom handlers
  const zoomIn = () => setZoomLevel(z => Math.min(200, z + 10))
  const zoomOut = () => setZoomLevel(z => Math.max(25, z - 10))
  const resetZoom = () => setZoomLevel(100)

  const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -10 : 10
      setZoomLevel(z => Math.min(200, Math.max(25, z + delta)))
    }
  }, [])

  // Pan handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeTool !== 'pan') return
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY }
    const canvas = canvasRef.current
    if (canvas) {
      scrollStart.current = { x: canvas.scrollLeft, y: canvas.scrollTop }
    }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current || activeTool !== 'pan') return
    const canvas = canvasRef.current
    if (!canvas) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    canvas.scrollLeft = scrollStart.current.x - dx
    canvas.scrollTop = scrollStart.current.y - dy
  }

  const handleCanvasMouseUp = () => {
    isPanning.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
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

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right: screen tabs + generating indicator */}
        <div
          className="hide-scrollbar"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            overflowX: 'auto', overflowY: 'hidden',
            scrollbarWidth: 'none', flexShrink: 1, minWidth: 0,
          }}
        >
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

          {generatedScreens.map(screen => (
            <button
              key={screen.id}
              onClick={() => setActiveGeneratedId(screen.id)}
              style={{
                flexShrink: 0,
                padding: '4px 12px',
                borderRadius: 14,
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                ...(screen.id === activeGeneratedId
                  ? {
                      background: '#6366f1',
                      color: '#fff',
                      border: '1px solid rgba(99,102,241,0.5)',
                    }
                  : {
                      background: 'transparent',
                      color: '#64748b',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }),
              }}
              onMouseEnter={e => {
                if (screen.id !== activeGeneratedId) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                  e.currentTarget.style.color = '#94a3b8'
                }
              }}
              onMouseLeave={e => {
                if (screen.id !== activeGeneratedId) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                  e.currentTarget.style.color = '#64748b'
                }
              }}
            >
              {screen.name.length > 15 ? screen.name.slice(0, 15) + '...' : screen.name}
            </button>
          ))}

          {/* New screen button */}
          <button
            onClick={() => {
              setActiveGeneratedId(null)
              setShowCodeExport(false)
            }}
            style={{
              flexShrink: 0,
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: '1px dashed rgba(255,255,255,0.15)',
              background: 'transparent',
              color: '#64748b',
              fontSize: 14,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'
              e.currentTarget.style.color = '#818cf8'
              e.currentTarget.style.background = 'rgba(99,102,241,0.1)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
              e.currentTarget.style.color = '#64748b'
              e.currentTarget.style.background = 'transparent'
            }}
            title="New screen"
          >
            +
          </button>
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
          style={{
            width: `${(1 - splitRatio) * 100}%`,
            position: 'relative',
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#E8E8E8',
            backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            cursor: activeTool === 'pan' ? (isPanning.current ? 'grabbing' : 'grab') : 'default',
          }}
        >
          {/* Canvas content based on state */}
          {!hasScreens && !isGenerating ? (
            /* EMPTY STATE — no phone, just centered text on light canvas */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              pointerEvents: 'none', userSelect: 'none',
            }}>
              <span style={{ fontSize: 15, color: 'rgba(0,0,0,0.3)', fontWeight: 500 }}>
                Your designs will appear here
              </span>
            </div>
          ) : isInFlow && !isGenerating ? (
            /* FLOW MODE — multiple smaller phone frames in a horizontal row */
            <div style={{
              display: 'flex', alignItems: 'center', gap: 32,
              padding: '0 40px',
              overflowX: 'auto',
              overflowY: 'hidden',
              maxWidth: '100%',
              scrollbarWidth: 'none',
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease-out',
            }}>
              {flowScreens.map((screen, idx) => (
                <div
                  key={screen.id}
                  onClick={() => setActiveGeneratedId(screen.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    cursor: 'pointer',
                    flexShrink: 0,
                    transform: 'scale(0.65)',
                    transformOrigin: 'center center',
                    transition: 'transform 0.2s',
                  }}
                >
                  <div style={{
                    borderRadius: 52,
                    boxShadow: screen.id === activeGeneratedId
                      ? '0 8px 32px rgba(0,0,0,0.3), 0 0 0 2px rgba(99,102,241,0.5)'
                      : '0 8px 32px rgba(0,0,0,0.3)',
                    transition: 'all 0.25s',
                  }}>
                    <PhoneFrame
                      generatedTree={screen.tree}
                      isGenerating={false}
                    />
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: screen.id === activeGeneratedId ? '#6366f1' : '#666',
                    textAlign: 'center',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.2s',
                  }}>
                    {idx + 1}. {screen.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            /* SINGLE SCREEN or generating — one phone frame centered with shadow */
            <div style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              transform: `scale(${(zoomLevel / 100) * 0.85})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease-out',
              maxHeight: 'calc(100vh - 80px)',
            }}>
              <div style={{
                borderRadius: 52,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                transition: 'all 0.3s',
              }}>
                <PhoneFrame
                  generatedTree={generatedTree}
                  isGenerating={isGenerating}
                />
              </div>

              {/* Flow navigation arrows — only shown when active screen is part of a flow */}
              {isInFlow && !isGenerating && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '8px 16px',
                  borderRadius: 20,
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <button
                    onClick={() => { if (flowIndex > 0) setActiveGeneratedId(flowScreens[flowIndex - 1].id) }}
                    disabled={flowIndex <= 0}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: flowIndex > 0 ? 'pointer' : 'not-allowed',
                      background: flowIndex > 0 ? 'rgba(99,102,241,0.3)' : 'transparent',
                      color: flowIndex > 0 ? '#fff' : '#666',
                      border: '1px solid',
                      borderColor: flowIndex > 0 ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)',
                      transition: 'all 0.2s',
                    }}
                  >
                    ← Previous
                  </button>
                  <span style={{ fontSize: 11, color: '#ccc', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    Screen {flowIndex + 1} of {flowScreens.length}
                  </span>
                  <button
                    onClick={() => { if (flowIndex < flowScreens.length - 1) setActiveGeneratedId(flowScreens[flowIndex + 1].id) }}
                    disabled={flowIndex >= flowScreens.length - 1}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: flowIndex < flowScreens.length - 1 ? 'pointer' : 'not-allowed',
                      background: flowIndex < flowScreens.length - 1 ? 'rgba(99,102,241,0.3)' : 'transparent',
                      color: flowIndex < flowScreens.length - 1 ? '#fff' : '#666',
                      border: '1px solid',
                      borderColor: flowIndex < flowScreens.length - 1 ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)',
                      transition: 'all 0.2s',
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}
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
            {tbBtn('upload', <Upload size={18} />, 'Upload screenshot', () => fileInputRef.current?.click())}
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
