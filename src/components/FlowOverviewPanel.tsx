import { useState, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronUp, Maximize2, X } from 'lucide-react'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import type { FlowConnection } from './FlowConnectors'

interface FlowOverviewPanelProps {
  screens: GeneratedScreen[]
  connections: FlowConnection[]
  activeScreenId: string | null
  onScreenClick: (screenId: string) => void
  onViewFlow: () => void
  flowViewMode?: boolean
  onExitFlowView?: () => void
}

/** Derive display order from connections via topological sort. Unconnected screens go last. */
function getOrderedScreens(screens: GeneratedScreen[], connections: FlowConnection[]): { screen: GeneratedScreen; connected: boolean }[] {
  if (connections.length === 0) {
    return screens.map(s => ({ screen: s, connected: false }))
  }

  const connectedIds = new Set<string>()
  const inbound = new Map<string, string[]>()
  const outbound = new Map<string, string[]>()

  for (const conn of connections) {
    connectedIds.add(conn.fromScreenId)
    connectedIds.add(conn.toScreenId)
    if (!outbound.has(conn.fromScreenId)) outbound.set(conn.fromScreenId, [])
    outbound.get(conn.fromScreenId)!.push(conn.toScreenId)
    if (!inbound.has(conn.toScreenId)) inbound.set(conn.toScreenId, [])
    inbound.get(conn.toScreenId)!.push(conn.fromScreenId)
  }

  // Find roots: connected screens with no inbound connections
  const roots = [...connectedIds].filter(id => !inbound.has(id) || inbound.get(id)!.length === 0)

  // BFS from roots to build ordered list
  const ordered: string[] = []
  const visited = new Set<string>()
  const queue = [...roots]

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    ordered.push(id)
    const children = outbound.get(id) || []
    for (const child of children) {
      if (!visited.has(child)) queue.push(child)
    }
  }

  // Add any connected but unvisited (cycles)
  for (const id of connectedIds) {
    if (!visited.has(id)) ordered.push(id)
  }

  const result: { screen: GeneratedScreen; connected: boolean }[] = []
  const screenMap = new Map(screens.map(s => [s.id, s]))

  // Connected screens in flow order
  for (const id of ordered) {
    const s = screenMap.get(id)
    if (s) result.push({ screen: s, connected: true })
  }

  // Unconnected screens in original order
  for (const s of screens) {
    if (!connectedIds.has(s.id)) {
      result.push({ screen: s, connected: false })
    }
  }

  return result
}

export function FlowOverviewPanel({ screens, connections, activeScreenId, onScreenClick, onViewFlow, flowViewMode, onExitFlowView }: FlowOverviewPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  const toggle = useCallback(() => setCollapsed(c => !c), [])

  const orderedScreens = useMemo(
    () => getOrderedScreens(screens, connections),
    [screens, connections]
  )

  if (screens.length === 0) return null

  const connectedCount = connections.length > 0
    ? new Set([...connections.map(c => c.fromScreenId), ...connections.map(c => c.toScreenId)]).size
    : 0

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
            background: flowViewMode ? '#34d399' : '#818CF8',
            boxShadow: flowViewMode ? '0 0 12px rgba(52,211,153,0.6)' : '0 0 8px rgba(129,140,248,0.5)',
            transition: 'all 0.2s',
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
            {flowViewMode
              ? 'Flow View'
              : `${screens.length} screens${connectedCount > 0 ? ` · ${connections.length} connections` : ''}`
            }
          </span>
        </div>
        {collapsed ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
      </div>

      {/* Thumbnail strip */}
      {!collapsed && (
        <div style={{ padding: '0 14px 10px' }}>
          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
          }}>
            {orderedScreens.map(({ screen, connected }, i) => {
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
                    opacity: connected || connections.length === 0 ? 1 : 0.4,
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

          {/* View Flow / Exit Flow View button */}
          {flowViewMode ? (
            <button
              onClick={() => onExitFlowView?.()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                padding: '7px 0',
                marginTop: 8,
                borderRadius: 8,
                background: 'rgba(99,102,241,0.25)',
                border: '1px solid rgba(99,102,241,0.5)',
                color: '#A5B4FC',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.35)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)' }}
            >
              <X size={12} />
              Exit Flow View
            </button>
          ) : (
            <button
              onClick={() => onViewFlow()}
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
          )}
        </div>
      )}
    </div>
  )
}
