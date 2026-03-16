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
    <div className="app-shell h-screen w-screen flex flex-col bg-[#09090b]">
      {/* Top nav bar */}
      <header
        className="shrink-0 flex items-center px-6 h-14 border-b border-white/[0.05] z-10"
        style={{ background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      >
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[12px] font-extrabold"
            style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
          >
            M
          </div>
          <span className="text-[16px] font-bold text-[#f1f5f9] tracking-tight">Mokkoi</span>
        </a>
        <div className="mx-3 h-4 w-px bg-white/10" />
        <span className="text-[11px] font-mono uppercase tracking-wider text-white/30">
          Playground
        </span>
      </header>

      {/* Scrollable main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Screen tabs */}
        <div className="shrink-0 w-full flex flex-wrap items-center justify-center gap-2 px-6 py-3">
          {allTabs.map(tab => {
            const isActive = tab.id === activeTabId
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id, tab.type)}
                className={`
                  px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer border
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
            <div className="px-3.5 py-1.5 rounded-full text-[12px] font-medium bg-mokkoi-accent/10 text-mokkoi-accent/60 border border-mokkoi-accent/20 flex items-center gap-2">
              <span className="inline-flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_infinite]" />
                <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
              </span>
              Generating...
            </div>
          )}
        </div>

        {/* Phone frame - large and prominent */}
        <div className="flex items-center justify-center px-4 py-8 relative">
          {/* Subtle radial background glow for depth */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[500px] h-[500px] rounded-full bg-mokkoi-accent/[0.03] blur-[100px]" />
          </div>
          <div className="relative">
            <PhoneFrame
              screen={showingGenerated ? undefined : selectedScreen}
              generatedTree={generatedTree}
              isGenerating={isGenerating}
            />
          </div>
        </div>

        {/* Chat input - below phone with proper spacing */}
        <div className="w-full max-w-[600px] mx-auto px-6 pb-8 pt-4">
          <ChatInput onScreenGenerated={handleScreenGenerated} initialPrompt={initialPrompt} />
        </div>
      </div>
    </div>
  )
}

export default App
