import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { PhoneFrame } from './components/PhoneFrame'
import { TokenPanel } from './components/TokenPanel'
import { ChatInput } from './components/ChatInput'
import { useMokkoiSocket } from './hooks/useMokkoiSocket'
import type { ComponentNode } from './types/mokkoi'

function App() {
  const {
    screens,
    tokens,
    status,
    selectedScreen,
    selectedScreenId,
    setSelectedScreenId,
  } = useMokkoiSocket()

  const [generatedTree, setGeneratedTree] = useState<ComponentNode | undefined>()
  const [isGenerating, setIsGenerating] = useState(false)
  const [showTokens, setShowTokens] = useState(true)

  const handleScreenGenerated = (result: ComponentNode | '__generating__') => {
    if (result === '__generating__') {
      setIsGenerating(true)
      setGeneratedTree(undefined)
    } else {
      setIsGenerating(false)
      setGeneratedTree(result)
    }
  }

  return (
    <div className="app-shell h-screen w-screen flex bg-[#06090F] overflow-hidden">
      {/* Sidebar - hidden on small screens */}
      <div className="hidden lg:block">
        <Sidebar
          screens={screens}
          selectedScreenId={selectedScreenId}
          onSelectScreen={setSelectedScreenId}
          status={status}
        />
      </div>

      {/* Center panel */}
      <div className="flex-1 flex flex-col items-center min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between w-full px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>M</div>
            <span className="text-[14px] font-semibold text-white">Mokkoi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-400' : status === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-[11px] text-white/40 font-mono uppercase">{status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Offline'}</span>
          </div>
        </div>

        {/* Phone frame area */}
        <div className="flex-1 flex items-center justify-center min-h-0 w-full px-4 py-4">
          <div className="transform scale-[0.85] sm:scale-90 md:scale-95 lg:scale-100 origin-center">
            <PhoneFrame
              screen={selectedScreen}
              generatedTree={generatedTree}
              isGenerating={isGenerating}
            />
          </div>
        </div>

        {/* Chat input */}
        <div className="w-full px-4 sm:px-6 pt-3 pb-4 border-t border-white/[0.04]">
          <ChatInput onScreenGenerated={handleScreenGenerated} />
        </div>
      </div>

      {/* Token panel - hidden on small screens, toggleable on medium */}
      <div className="hidden xl:block">
        <TokenPanel tokens={tokens} />
      </div>

      {/* Token toggle for medium screens */}
      <button
        onClick={() => setShowTokens(!showTokens)}
        className="hidden lg:flex xl:hidden fixed right-4 top-4 z-10 items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[11px] text-white/50 hover:text-white/70 hover:bg-white/[0.08] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="4" cy="4" r="2.5"/><circle cx="10" cy="10" r="2.5"/><line x1="6" y1="4" x2="13" y2="4" opacity="0.5"/><line x1="1" y1="10" x2="8" y2="10" opacity="0.5"/>
        </svg>
        Tokens
      </button>
    </div>
  )
}

export default App
