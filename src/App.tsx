import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PhoneFrame } from './components/PhoneFrame'
import { ChatPanel, type ChatMessage } from './components/ChatPanel'
import { CodeExportModal } from './components/CodeExportModal'
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

  // Resizable panel — left is chat (38%), right is canvas (62%)
  const [splitRatio, setSplitRatio] = useState(0.38)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      let ratio = (e.clientX - rect.left) / rect.width
      ratio = Math.max(0.25, Math.min(0.55, ratio))
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

  // Determine canvas state
  const hasScreens = generatedScreens.length > 0

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
          }}
        >
          <ChatPanel
            messages={activeMessages}
            onSend={handleSend}
            onExportCode={() => generatedTree && setShowCodeExport(true)}
            isGenerating={isGenerating}
            initialPrompt={initialPrompt}
            onFlowScreenClick={handleFlowScreenClick}
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
          className="canvas-side"
          style={{
            width: `${(1 - splitRatio) * 100}%`,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#050505',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {/* Canvas content based on state */}
          {!hasScreens && !isGenerating ? (
            /* EMPTY STATE — no screens generated yet */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              pointerEvents: 'none', userSelect: 'none',
            }}>
              {/* Phone outline icon */}
              <svg width="48" height="72" viewBox="0 0 48 72" fill="none" style={{ opacity: 0.2 }}>
                <rect x="2" y="2" width="44" height="68" rx="10" stroke="white" strokeWidth="2" strokeDasharray="4 3" />
                <rect x="18" y="60" width="12" height="3" rx="1.5" fill="white" opacity="0.3" />
                <rect x="16" y="6" width="16" height="4" rx="2" fill="white" opacity="0.2" />
              </svg>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>
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
                      ? '0 0 30px rgba(99,102,241,0.3), 0 0 60px rgba(99,102,241,0.1)'
                      : '0 0 30px rgba(0,0,0,0.3)',
                    border: screen.id === activeGeneratedId
                      ? '2px solid rgba(99,102,241,0.5)'
                      : '2px solid transparent',
                    transition: 'all 0.25s',
                  }}>
                    <PhoneFrame
                      generatedTree={screen.tree}
                      isGenerating={false}
                    />
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 500,
                    color: screen.id === activeGeneratedId ? '#a5b4fc' : '#64748b',
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
            /* SINGLE SCREEN or generating — one phone frame centered */
            <div style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              transform: 'scale(0.85)',
              transformOrigin: 'center center',
              maxHeight: 'calc(100vh - 80px)',
            }}>
              {/* Subtle glow behind phone */}
              {showingGenerated && !isGenerating && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 300, height: 400, borderRadius: '50%',
                  background: 'rgba(99,102,241,0.06)',
                  filter: 'blur(80px)',
                  pointerEvents: 'none',
                }} />
              )}
              <div style={{
                borderRadius: 52,
                boxShadow: showingGenerated && !isGenerating
                  ? '0 0 40px rgba(99,102,241,0.15), 0 0 80px rgba(99,102,241,0.05)'
                  : 'none',
                border: showingGenerated && !isGenerating
                  ? '2px solid rgba(99,102,241,0.2)'
                  : '2px solid transparent',
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
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
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
                      background: flowIndex > 0 ? 'rgba(99,102,241,0.15)' : 'transparent',
                      color: flowIndex > 0 ? '#a5b4fc' : '#334155',
                      border: '1px solid',
                      borderColor: flowIndex > 0 ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)',
                      transition: 'all 0.2s',
                    }}
                  >
                    \u2190 Previous
                  </button>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>
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
                      background: flowIndex < flowScreens.length - 1 ? 'rgba(99,102,241,0.15)' : 'transparent',
                      color: flowIndex < flowScreens.length - 1 ? '#a5b4fc' : '#334155',
                      border: '1px solid',
                      borderColor: flowIndex < flowScreens.length - 1 ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)',
                      transition: 'all 0.2s',
                    }}
                  >
                    Next \u2192
                  </button>
                </div>
              )}
            </div>
          )}
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
