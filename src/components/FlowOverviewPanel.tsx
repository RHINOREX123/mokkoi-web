import { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, Maximize2 } from 'lucide-react'
import type { FlowGroup } from './FlowConnectors'

interface FlowOverviewPanelProps {
  flows: FlowGroup[]
  activeScreenId: string | null
  onScreenClick: (screenId: string) => void
  onViewFlow: (flow: FlowGroup) => void
}

export function FlowOverviewPanel({ flows, activeScreenId, onScreenClick, onViewFlow }: FlowOverviewPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [activeFlowIdx, setActiveFlowIdx] = useState(0)

  const toggle = useCallback(() => setCollapsed(c => !c), [])

  if (flows.length === 0) return null

  const flow = flows[Math.min(activeFlowIdx, flows.length - 1)]

  return (
    <div style={{
      position: 'absolute',
      bottom: 64,
      right: 16,
      zIndex: 40,
      minWidth: collapsed ? 180 : 240,
      maxWidth: 360,
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
            {flow.name} — {flow.screens.length} screens
          </span>
        </div>
        {collapsed ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
      </div>

      {/* Flow tabs if multiple flows */}
      {!collapsed && flows.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '0 14px 8px',
          overflowX: 'auto',
        }}>
          {flows.map((f, i) => (
            <button
              key={f.flowId}
              onClick={() => setActiveFlowIdx(i)}
              style={{
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                background: i === activeFlowIdx ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
                color: i === activeFlowIdx ? '#818CF8' : '#94a3b8',
              }}
            >
              {f.screens[0].name}
            </button>
          ))}
        </div>
      )}

      {/* Thumbnail strip */}
      {!collapsed && (
        <div style={{ padding: '0 14px 10px' }}>
          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
          }}>
            {flow.screens.map((screen, i) => {
              const isActive = screen.id === activeScreenId
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
                    <span style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: isActive ? '#818CF8' : 'rgba(255,255,255,0.3)',
                    }}>
                      {i + 1}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 500,
                    color: isActive ? '#818CF8' : '#64748b',
                    maxWidth: 44,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                  }}>
                    {screen.name}
                  </span>
                </div>
              )
            })}
          </div>

          {/* View Flow button */}
          <button
            onClick={() => onViewFlow(flow)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              padding: '7px 0',
              marginTop: 8,
              borderRadius: 8,
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: '#818CF8',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)' }}
          >
            <Maximize2 size={12} />
            View Flow
          </button>
        </div>
      )}
    </div>
  )
}
