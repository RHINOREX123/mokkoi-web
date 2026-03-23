import { useMemo } from 'react'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import { getCanvasDimensions, DEFAULT_DEVICE } from '../constants/devices'

const LABEL_HEIGHT = 26
export const GAP = 40
export const PAD_X = 60
export const PAD_Y = 40

export interface FlowConnection {
  fromScreenId: string
  toScreenId: string
}

function inferTransitionType(screenName: string): string {
  const lower = screenName.toLowerCase()
  if (lower.includes('modal') || lower.includes('popup') || lower.includes('dialog') || lower.includes('alert')) return 'Modal'
  if (lower.includes('tab') || lower.includes('tabs')) return 'Tab'
  return 'Push'
}

interface FlowConnectorsProps {
  connections: FlowConnection[]
  screens: GeneratedScreen[]
  screenPositions: Map<string, { x: number; y: number }>
  selectedConnectionIdx: number | null
  onConnectionClick: (idx: number, e: React.MouseEvent) => void
  /** Temporary line while user is dragging to create a connection */
  draggingLine?: { fromX: number; fromY: number; toX: number; toY: number } | null
}

export function FlowConnectors({
  connections,
  screens,
  screenPositions,
  selectedConnectionIdx,
  onConnectionClick,
  draggingLine,
}: FlowConnectorsProps) {
  const connectors = useMemo(() => {
    const lines: Array<{
      key: string
      idx: number
      x1: number; y1: number
      x2: number; y2: number
      transitionType: string
    }> = []

    for (let i = 0; i < connections.length; i++) {
      const conn = connections[i]
      const fromScreen = screens.find(s => s.id === conn.fromScreenId)
      const toScreen = screens.find(s => s.id === conn.toScreenId)
      if (!fromScreen || !toScreen) continue

      const fromDims = getCanvasDimensions(fromScreen.deviceId || DEFAULT_DEVICE)
      const toDims = getCanvasDimensions(toScreen.deviceId || DEFAULT_DEVICE)
      const fromPos = screenPositions.get(fromScreen.id)
      const toPos = screenPositions.get(toScreen.id)
      if (!fromPos || !toPos) continue

      const x1 = fromPos.x + fromDims.CANVAS_W
      const y1 = fromPos.y + LABEL_HEIGHT + fromDims.CANVAS_H / 2
      const x2 = toPos.x
      const y2 = toPos.y + LABEL_HEIGHT + toDims.CANVAS_H / 2

      lines.push({
        key: `${conn.fromScreenId}-${conn.toScreenId}`,
        idx: i,
        x1, y1, x2, y2,
        transitionType: inferTransitionType(toScreen.name),
      })
    }
    return lines
  }, [connections, screens, screenPositions])

  if (connectors.length === 0 && !draggingLine) return null

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <defs>
        <marker
          id="flow-arrow"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L8,3 L0,6" fill="rgba(99,102,241,0.6)" />
        </marker>
        <marker
          id="flow-arrow-selected"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L8,3 L0,6" fill="rgba(129,140,248,0.9)" />
        </marker>
        <marker
          id="flow-arrow-dragging"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L8,3 L0,6" fill="rgba(129,140,248,0.5)" />
        </marker>
        <style>{`
          @keyframes flowDash {
            to { stroke-dashoffset: -20; }
          }
        `}</style>
      </defs>

      {connectors.map(c => {
        const isSelected = c.idx === selectedConnectionIdx
        const dx = c.x2 - c.x1
        const cpOffset = Math.min(Math.abs(dx) * 0.4, 60)
        const cpX1 = c.x1 + cpOffset
        const cpX2 = c.x2 - cpOffset
        const pathD = `M${c.x1},${c.y1} C${cpX1},${c.y1} ${cpX2},${c.y2} ${c.x2},${c.y2}`

        const midX = (c.x1 + c.x2) / 2
        const midY = (c.y1 + c.y2) / 2

        return (
          <g key={c.key}>
            {/* Invisible wide hit area for clicking */}
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onConnectionClick(c.idx, e) }}
            />
            {/* Shadow line */}
            <path
              d={pathD}
              fill="none"
              stroke={isSelected ? 'rgba(129,140,248,0.25)' : 'rgba(99,102,241,0.15)'}
              strokeWidth={isSelected ? 8 : 6}
              strokeLinecap="round"
            />
            {/* Main bezier line */}
            <path
              d={pathD}
              fill="none"
              stroke={isSelected ? 'rgba(129,140,248,0.8)' : 'rgba(99,102,241,0.5)'}
              strokeWidth={isSelected ? 3 : 2}
              strokeLinecap="round"
              markerEnd={isSelected ? 'url(#flow-arrow-selected)' : 'url(#flow-arrow)'}
            />
            {/* Animated dashed overlay */}
            <path
              d={pathD}
              fill="none"
              stroke={isSelected ? 'rgba(129,140,248,0.9)' : 'rgba(99,102,241,0.7)'}
              strokeWidth={2}
              strokeDasharray="4 6"
              strokeLinecap="round"
              style={{ animation: 'flowDash 1s linear infinite' }}
            />
            {/* Transition type badge */}
            <foreignObject
              x={midX - 22}
              y={midY - 11}
              width={44}
              height={22}
              style={{ pointerEvents: 'none' }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                background: isSelected ? 'rgba(99,102,241,0.3)' : 'rgba(30, 30, 46, 0.85)',
                borderRadius: 11,
                border: `1px solid ${isSelected ? 'rgba(129,140,248,0.6)' : 'rgba(99,102,241,0.3)'}`,
                fontSize: 10,
                fontWeight: 600,
                color: isSelected ? 'rgba(165,180,252,1)' : 'rgba(129,140,248,0.9)',
                letterSpacing: '0.3px',
                backdropFilter: 'blur(4px)',
              }}>
                {c.transitionType}
              </div>
            </foreignObject>

            {/* Delete button when selected */}
            {isSelected && (
              <foreignObject
                x={midX + 26}
                y={midY - 11}
                width={22}
                height={22}
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              >
                <div
                  onClick={(e) => { e.stopPropagation(); onConnectionClick(c.idx, e) }}
                  title="Delete connection"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(248,113,113,0.2)',
                    border: '1px solid rgba(248,113,113,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#f87171',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </div>
              </foreignObject>
            )}
          </g>
        )
      })}

      {/* Dragging line preview */}
      {draggingLine && (() => {
        const dx = draggingLine.toX - draggingLine.fromX
        const cpOffset = Math.min(Math.abs(dx) * 0.4, 60)
        const cpX1 = draggingLine.fromX + cpOffset
        const cpX2 = draggingLine.toX - cpOffset
        const pathD = `M${draggingLine.fromX},${draggingLine.fromY} C${cpX1},${draggingLine.fromY} ${cpX2},${draggingLine.toY} ${draggingLine.toX},${draggingLine.toY}`
        return (
          <path
            d={pathD}
            fill="none"
            stroke="rgba(129,140,248,0.5)"
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeLinecap="round"
            markerEnd="url(#flow-arrow-dragging)"
          />
        )
      })()}
    </svg>
  )
}
