import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PhoneFrame } from './components/PhoneFrame'
import { ChatInput } from './components/ChatInput'
import { useMokkoiSocket } from './hooks/useMokkoiSocket'
import type { ComponentNode } from './types/mokkoi'

interface GeneratedScreen {
  id: string
  name: string
  tree: ComponentNode
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

  // Determine what tree to show
  const activeGenerated = generatedScreens.find(s => s.id === activeGeneratedId)
  const generatedTree = activeGenerated?.tree
  const showingGenerated = !!activeGenerated

  const handleScreenGenerated = useCallback((result: ComponentNode | '__generating__') => {
    if (result === '__generating__') {
      setIsGenerating(true)
      setActiveGeneratedId(null)
    } else {
      setIsGenerating(false)
      const id = crypto.randomUUID()
      const name = `Screen ${generatedScreens.length + 1}`
      const newScreen: GeneratedScreen = { id, name, tree: result }
      setGeneratedScreens(prev => [...prev, newScreen])
      setActiveGeneratedId(id)
    }
  }, [generatedScreens.length])

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

  return (
    <div className="app-shell" style={{ height: '100vh', background: '#09090b', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Navbar with tabs on the right */}
      <nav
        style={{
          height: 56,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: 'rgba(9,9,11,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
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

        {/* Right: screen tabs as small pills */}
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

      {/* Scrollable content area - EVERYTHING CENTERED */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '32px 24px',
          scrollBehavior: 'smooth',
        }}
      >
        {/* Phone frame - centered */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: 500, height: 500, borderRadius: '50%', background: 'rgba(129,140,248,0.03)', filter: 'blur(100px)' }} />
          </div>
          <div style={{ position: 'relative' }}>
            <PhoneFrame
              screen={showingGenerated ? undefined : selectedScreen}
              generatedTree={generatedTree}
              isGenerating={isGenerating}
            />
          </div>
        </div>

        {/* Chat input - centered, 24px below phone */}
        <div style={{ width: '100%', maxWidth: 600, marginTop: 24 }}>
          <ChatInput onScreenGenerated={handleScreenGenerated} initialPrompt={initialPrompt} />
        </div>
      </div>
    </div>
  )
}

export default App
