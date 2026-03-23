import { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { GeneratedScreen } from '../hooks/useScreenManagement'

interface FlowOverviewPanelProps {
  screens: GeneratedScreen[]
  activeScreenId: string | null
  onScreenClick: (screenId: string) => void
}

export function FlowOverviewPanel({ screens, activeScreenId, onScreenClick }: FlowOverviewPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  const toggle = useCallback(() => setCollapsed(c => !c), [])

  if (screens.length === 0) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 64,
      right: 16,
      zIndex: 40,
      minWidth: collapsed ? 180 : 240,
      maxWidth: 420,
      background: 'rgba(15, 15, 25, 0.9)',
      borderRadius: 14,
      border: '1px solid rgba(99,102,241,0.2)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
    }}>
      {/* Header */}
      <div
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#818CF8',
            boxShadow: '0 0 8px rgba(129,140,248,0.5)',
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
            {screens.length} screen{screens.length !== 1 ? 's' : ''}
          </span>
        </div>
        {collapsed ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
      </div>

      {/* Screen list */}
      {!collapsed && (
        <div style={{ padding: '0 14px 10px' }}>
          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
          }}>
            {screens.map((screen) => {
              const isActive = screen.id === activeScreenId
              // Truncate name/prompt for display
              const displayName = screen.name.length > 18 ? screen.name.slice(0, 18) + '...' : screen.name
              return (
                <div
                  key={screen.id}
                  onClick={() => onScreenClick(screen.id)}
                  style={{
                    flexShrink: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <div style={{
                    width: 40,
                    height: 60,
                    borderRadius: 6,
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(129,140,248,0.2))'
                      : 'rgba(255,255,255,0.06)',
                    border: isActive
                      ? '2px solid rgba(99,102,241,0.6)'
                      : '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {/* Small phone icon placeholder */}
                    <div style={{
                      width: 20,
                      height: 34,
                      borderRadius: 4,
                      border: `1.5px solid ${isActive ? 'rgba(129,140,248,0.6)' : 'rgba(255,255,255,0.15)'}`,
                      transition: 'border-color 0.2s',
                    }} />
                  </div>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 500,
                    color: isActive ? '#818CF8' : '#64748b',
                    maxWidth: 56,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                  }}>
                    {displayName}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
