import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PhoneFrame } from './components/PhoneFrame'
import { ChatPanel, type ChatMessage } from './components/ChatPanel'
import { useMokkoiSocket } from './hooks/useMokkoiSocket'
import type { ComponentNode } from './types/mokkoi'

interface GeneratedScreen {
  id: string
  name: string
  tree: ComponentNode
  messages: ChatMessage[]
}

function App() {
  const [searchParams] = useSearchParams()
  const initialPrompt = searchParams.get('prompt') || undefined

  const {
    screens,
    selectedScreen,
    selectedScreenId,
    setSelectedScreenId,
  } = useMokkoiSocket()

  const [generatedScreens, setGeneratedScreens] = useState<GeneratedScreen[]>([])
  const [activeGeneratedId, setActiveGeneratedId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

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

  const handleSend = useCallback(async (prompt: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    }

    // If we have an active generated screen, we're editing it
    const editingScreenId = activeGeneratedId
    const editingScreen = editingScreenId
      ? generatedScreens.find(s => s.id === editingScreenId)
      : null

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

  // Combine demo screens + generated screens for tabs
  const allTabs = [
    ...screens.map(s => ({ id: s.id, name: s.name, type: 'demo' as const })),
    ...generatedScreens.map(s => ({ id: s.id, name: s.name, type: 'generated' as const })),
  ]

  const activeTabId = showingGenerated ? activeGeneratedId : selectedScreenId

  const handleTabClick = (id: string, type: 'demo' | 'generated') => {
    if (type === 'generated') {
      setActiveGeneratedId(id)
    } else {
      setActiveGeneratedId(null)
      setSelectedScreenId(id)
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
          height: 56, flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center',
          padding: '0 24px', justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Left: logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                color: '#fff', fontSize: 12, fontWeight: 800,
              }}
            >
              M
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>Mokkoi</span>
          </a>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 14, fontWeight: 300, userSelect: 'none' }}>&middot;</span>
          <span
            style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em',
              color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: 6,
            }}
          >
            Playground
          </span>
        </div>

        {/* Right: screen tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {allTabs.map(tab => {
            const isActive = tab.id === activeTabId
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id, tab.type)}
                className={`
                  px-3 py-1 rounded-full text-[11px] font-medium transition-all duration-200 cursor-pointer border
                  ${isActive
                    ? 'bg-mokkoi-accent/15 text-mokkoi-accent border-mokkoi-accent/30 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                    : 'bg-white/[0.03] text-white/40 border-white/[0.06] hover:bg-white/[0.06] hover:text-white/60'
                  }
                `}
              >
                {tab.name}
              </button>
            )
          })}
          {isGenerating && (
            <div className="px-3 py-1 rounded-full text-[11px] font-medium bg-mokkoi-accent/10 text-mokkoi-accent/60 border border-mokkoi-accent/20 flex items-center gap-1.5">
              <span className="inline-flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_infinite]" />
                <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
              </span>
              Generating...
            </div>
          )}
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
            transform: 'scale(0.58)',
            transformOrigin: 'center center',
            maxHeight: 'calc(100vh - 80px)',
          }}>
            <PhoneFrame
              screen={showingGenerated ? undefined : selectedScreen}
              generatedTree={generatedTree}
              isGenerating={isGenerating}
            />
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
            isGenerating={isGenerating}
            initialPrompt={initialPrompt}
          />
        </div>
      </div>
    </div>
  )
}

export default App
