import type { Screen, ComponentNode } from '../types/mokkoi'
import { ScreenRenderer } from './ScreenRenderer'
import { MOCK_SCREEN_TREES } from '../data/mockScreens'

interface PhoneFrameProps {
  screen: Screen | undefined
  /** Component tree from AI-generated screen */
  generatedTree?: ComponentNode
  /** Whether a screen is currently being generated */
  isGenerating?: boolean
}

export function PhoneFrame({ screen, generatedTree, isGenerating }: PhoneFrameProps) {
  // Use AI-generated tree, or fall back to sidebar-selected screen
  const componentTree = generatedTree ?? screen?.componentTree ?? MOCK_SCREEN_TREES[screen?.component ?? '']

  const showContent = generatedTree || (screen && componentTree)

  return (
    <div className="relative">
      {/* Ambient glow - layered for depth */}
      <div className="absolute -inset-12 rounded-[80px] bg-mokkoi-accent/[0.06] blur-3xl" />
      <div className="absolute -inset-6 rounded-[60px] bg-mokkoi-accent/[0.04] blur-xl" />

      {/* Phone chassis */}
      <div
        className="relative rounded-[48px] p-[3px] bg-gradient-to-b from-white/[0.12] to-white/[0.04]"
        style={{ width: 393 * 0.55 + 6, height: 852 * 0.55 + 6 }}
      >
        {/* Inner bezel */}
        <div className="w-full h-full rounded-[46px] bg-black p-3 flex flex-col overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-1 pb-2 shrink-0">
            <span className="text-[10px] font-semibold text-white/80 font-mono">9:41</span>
            <div className="w-[72px] h-[22px] rounded-full bg-black" />
            <div className="flex items-center gap-1">
              <svg width="12" height="10" viewBox="0 0 12 10" fill="white" opacity="0.7">
                <rect x="0" y="6" width="2" height="4" rx="0.5"/>
                <rect x="3" y="4" width="2" height="6" rx="0.5"/>
                <rect x="6" y="2" width="2" height="8" rx="0.5"/>
                <rect x="9" y="0" width="2" height="10" rx="0.5"/>
              </svg>
            </div>
          </div>

          {/* Screen content area */}
          <style>{`.phone-screen::-webkit-scrollbar { display: none; }`}</style>
          <div className="flex-1 rounded-b-[36px] overflow-hidden phone-screen" style={{ backgroundColor: '#0a0a0a', overflowY: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            {isGenerating ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-6">
                <div className="w-12 h-12 rounded-2xl bg-mokkoi-accent/10 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.5" className="animate-spin" style={{ animationDuration: '3s' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-[14px] font-medium text-mokkoi-text mb-1">Generating...</div>
                  <div className="text-[12px] text-mokkoi-text-dim leading-relaxed">
                    Creating your screen design
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-mokkoi-accent/40 animate-[bounce_1.4s_ease-in-out_infinite]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-mokkoi-accent/40 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-mokkoi-accent/40 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
                </div>
              </div>
            ) : showContent ? (
              <div className="phone-screen" style={{ width: '100%', height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                <ScreenRenderer tree={(generatedTree ?? componentTree)!} />
              </div>
            ) : screen ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-6">
                <div className="w-12 h-12 rounded-2xl bg-mokkoi-accent/10 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.5">
                    <rect x="3" y="4" width="8" height="14" rx="2"/>
                    <rect x="13" y="4" width="8" height="14" rx="2" opacity="0.4"/>
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-[14px] font-medium text-mokkoi-text mb-1">{screen.name}</div>
                  <div className="text-[12px] text-mokkoi-text-dim leading-relaxed">
                    Waiting for component render<br />from Mokkoi MCP server
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-mokkoi-accent/40 animate-[bounce_1.4s_ease-in-out_infinite]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-mokkoi-accent/40 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-mokkoi-accent/40 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-6">
                <div className="w-10 h-10 rounded-xl bg-mokkoi-accent/10 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M4 10h12M10 4v12" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-[12px] text-mokkoi-text-dim leading-relaxed">
                    Describe a screen below<br />to get started
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <div className="w-[100px] h-[4px] rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  )
}
