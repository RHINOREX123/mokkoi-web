import type { Screen } from '../types/mokkoi'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

interface SidebarProps {
  screens: Screen[]
  selectedScreenId: string
  onSelectScreen: (id: string) => void
  status: ConnectionStatus
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

export function Sidebar({ screens, selectedScreenId, onSelectScreen }: SidebarProps) {

  return (
    <aside className="w-[240px] min-w-[240px] h-full flex flex-col border-r border-white/[0.06] bg-[#09090b]">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-mokkoi-accent/20 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="5" height="8" rx="1.5" stroke="#818CF8" strokeWidth="1.5"/>
              <rect x="7" y="2" width="5" height="8" rx="1.5" stroke="#818CF8" strokeWidth="1.5" opacity="0.5"/>
              <circle cx="3.5" cy="9" r="0.75" fill="#818CF8"/>
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.3px] text-mokkoi-text">
            Mokkoi
          </span>
        </div>
      </div>

      {/* Playground label */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-mokkoi-surface/50">
          <span className="text-[11px] font-medium tracking-wide uppercase text-mokkoi-text-dim font-mono">
            Playground
          </span>
        </div>
      </div>

      {/* Section header */}
      <div className="px-5 pb-2">
        <span className="text-[11px] font-medium tracking-wider uppercase text-mokkoi-text-dim">
          Screens
        </span>
      </div>

      {/* Screen list */}
      <nav className="flex-1 overflow-y-auto px-3">
        {screens.map((screen) => {
          const isActive = screen.id === selectedScreenId
          return (
            <button
              key={screen.id}
              onClick={() => onSelectScreen(screen.id)}
              className={`
                w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-all duration-150
                group cursor-pointer
                ${isActive
                  ? 'bg-mokkoi-accent/10 text-mokkoi-text'
                  : 'text-mokkoi-text-muted hover:bg-mokkoi-surface-hover/50 hover:text-mokkoi-text'
                }
              `}
            >
              <div className="flex items-center gap-2.5">
                <div className={`
                  w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-medium
                  ${isActive ? 'bg-mokkoi-accent/20 text-mokkoi-accent' : 'bg-mokkoi-surface text-mokkoi-text-dim'}
                `}>
                  {screen.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate leading-tight">
                    {screen.name}
                  </div>
                  <div className="text-[11px] text-mokkoi-text-dim mt-0.5">
                    {formatTime(screen.updatedAt)}
                  </div>
                </div>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-mokkoi-accent" />
                )}
              </div>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-mokkoi-border-subtle">
        <div className="text-[11px] text-mokkoi-text-dim font-mono">
          {screens.length} screen{screens.length !== 1 ? 's' : ''}
        </div>
      </div>
    </aside>
  )
}
