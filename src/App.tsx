import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PhoneFrame } from './components/PhoneFrame'
import { ChatPanel, type ChatMessage } from './components/ChatPanel'
import { CodeExportModal } from './components/CodeExportModal'
import { useMokkoiSocket } from './hooks/useMokkoiSocket'
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

  const {
    selectedScreen,
  } = useMokkoiSocket()

  const [generatedScreens, setGeneratedScreens] = useState<GeneratedScreen[]>([])
  const [activeGeneratedId, setActiveGeneratedId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showCodeExport, setShowCodeExport] = useState(false)

  // Resizable panel
  const [splitRatio, setSplitRatio] = useState(0.55)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      let ratio = (e.clientX - rect.left) / rect.width
      ratio = Math.max(0.3, Math.min(0.7, ratio))
      setSplitRatio(ratio)
    }
    const handleMouseUp = () => {
      isDragging.current = false
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
  const showingGenerated = !!activeGenerated

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

  const handleFlowPrev = () => {
    if (isInFlow && flowIndex > 0) {
      setActiveGeneratedId(flowScreens[flowIndex - 1].id)
    }
  }
  const handleFlowNext = () => {
    if (isInFlow && flowIndex < flowScreens.length - 1) {
      setActiveGeneratedId(flowScreens[flowIndex + 1].id)
    }
  }

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
        const flowScreens: GeneratedScreen[] = (screens as Array<{ id: string; name: string; tree: ComponentNode }>).map((s: { id: string; name: string; tree: ComponentNode }, i: number) => ({
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
                  content: `Generated a flow with ${screens.length} screens: ${screenNames.join(' → ')}`,
                  timestamp: Date.now(),
                  flowScreenNames: screenNames,
                },
              ]
            : [],
        }))

        // Replace placeholder with flow screens
        setGeneratedScreens(prev => {
          const withoutPlaceholder = prev.filter(s => s.id !== placeholderId)
          return [...withoutPlaceholder, ...flowScreens]
        })
        setActiveGeneratedId(flowScreens[0].id)
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

  return (
    <div className="app-shell" style={{ height: '100vh', background: '#000000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
        }}
      >
        {/* Left: logo */}
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

        {/* Center: Design Studio label */}
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, userSelect: 'none', flexShrink: 0 }}>|</span>
        <span style={{ fontSize: 15, fontWeight: 500, color: '#e2e8f0', flexShrink: 0 }}>Design Studio</span>

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

      {/* Main content: side-by-side layout with draggable divider */}
      <div
        ref={containerRef}
        style={{
          flex: 1, minHeight: 0, display: 'flex', position: 'relative',
        }}
      >
        {/* Left: Phone frame centered */}
        <div style={{
          width: `${splitRatio * 100}%`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
          background: '#000000',
        }}>
          {/* Background glow */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              width: 500, height: 500, borderRadius: '50%',
              background: 'rgba(129,140,248,0.03)', filter: 'blur(100px)',
            }} />
          </div>
          <div style={{
            position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            transform: 'scale(0.85)',
            transformOrigin: 'center center',
            maxHeight: 'calc(100vh - 80px)',
          }}>
            <PhoneFrame
              screen={showingGenerated ? undefined : selectedScreen}
              generatedTree={generatedTree}
              isGenerating={isGenerating}
            />

            {/* Flow navigation arrows — only shown when active screen is part of a flow */}
            {isInFlow && !isGenerating && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '8px 16px',
                borderRadius: 20,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <button
                  onClick={handleFlowPrev}
                  disabled={flowIndex <= 0}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: flowIndex > 0 ? 'pointer' : 'not-allowed',
                    background: flowIndex > 0 ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: flowIndex > 0 ? '#a5b4fc' : '#334155',
                    border: '1px solid',
                    borderColor: flowIndex > 0 ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)',
                    transition: 'all 0.2s',
                  }}
                >
                  ← Previous
                </button>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  Screen {flowIndex + 1} of {flowScreens.length}
                </span>
                <button
                  onClick={handleFlowNext}
                  disabled={flowIndex >= flowScreens.length - 1}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: flowIndex < flowScreens.length - 1 ? 'pointer' : 'not-allowed',
                    background: flowIndex < flowScreens.length - 1 ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: flowIndex < flowScreens.length - 1 ? '#a5b4fc' : '#334155',
                    border: '1px solid',
                    borderColor: flowIndex < flowScreens.length - 1 ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)',
                    transition: 'all 0.2s',
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={startDragging}
          style={{
            width: 4,
            cursor: 'col-resize',
            background: 'rgba(255,255,255,0.06)',
            position: 'relative',
            flexShrink: 0,
            transition: 'background 0.2s',
            zIndex: 10,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
          onMouseLeave={e => { if (!isDragging.current) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        >
          {/* Drag handle dots */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', flexDirection: 'column', gap: 3,
            pointerEvents: 'none',
          }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 3, height: 3, borderRadius: '50%',
                background: 'rgba(255,255,255,0.3)',
              }} />
            ))}
          </div>
        </div>

        {/* Right: Chat panel */}
        <div style={{
          width: `${(1 - splitRatio) * 100}%`,
          borderLeft: 'none',
          display: 'flex', flexDirection: 'column', minHeight: 0,
          background: '#0a0a0a',
        }}>
          <ChatPanel
            messages={activeMessages}
            onSend={handleSend}
            onExportCode={() => generatedTree && setShowCodeExport(true)}
            isGenerating={isGenerating}
            initialPrompt={initialPrompt}
            onFlowScreenClick={handleFlowScreenClick}
          />
        </div>
      </div>

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
