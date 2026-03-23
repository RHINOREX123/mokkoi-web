import { useMemo } from 'react'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import { getCanvasDimensions, DEFAULT_DEVICE } from '../constants/devices'

const LABEL_HEIGHT = 26 // approximate height of screen label above frame
export const GAP = 40
export const PAD_X = 60
export const PAD_Y = 40

export interface FlowGroup {
  flowId: string
  name: string
  screens: GeneratedScreen[]
  /** indices into the full generatedScreens array */
  indices: number[]
}

export function getFlows(screens: GeneratedScreen[]): FlowGroup[] {
  const flowMap = new Map<string, { screens: GeneratedScreen[]; indices: number[] }>()

  // Group by explicit flowId
  screens.forEach((s, i) => {
    if (s.flowId) {
      const existing = flowMap.get(s.flowId)
      if (existing) {
        existing.screens.push(s)
        existing.indices.push(i)
      } else {
        flowMap.set(s.flowId, { screens: [s], indices: [i] })
      }
    }
  })

  // Detect implicit flows: screens generated within 5 seconds of each other
  // with sequential names and no explicit flowId
  // (We check by looking for sequential screens without flowId that share naming patterns)
  const ungrouped = screens
    .map((s, i) => ({ screen: s, index: i }))
    .filter(({ screen }) => !screen.flowId)

  // Group consecutive ungrouped screens that were likely generated together
  // Heuristic: screens adjacent in order with similar naming patterns
  let runStart = -1
  for (let i = 0; i < ungrouped.length; i++) {
    const curr = ungrouped[i]
    const next = ungrouped[i + 1]
    if (runStart === -1) runStart = i

    const isConsecutive = next && next.index === curr.index + 1
    if (!isConsecutive || i === ungrouped.length - 1) {
      const runEnd = i
      const runLength = runEnd - runStart + 1
      if (runLength >= 2) {
        // Check if names look sequential (e.g. "Welcome", "Login", "Dashboard")
        // Simple heuristic: if they were generated as consecutive screens they likely belong together
        // We'll be conservative and only group if there are 3+ consecutive screens
        if (runLength >= 3) {
          const implicitFlowId = `implicit-${ungrouped[runStart].index}`
          const flowScreens = ungrouped.slice(runStart, runEnd + 1)
          flowMap.set(implicitFlowId, {
            screens: flowScreens.map(f => f.screen),
            indices: flowScreens.map(f => f.index),
          })
        }
      }
      runStart = -1
    }
  }

  // Convert to FlowGroup array, only include groups with 2+ screens
  const flows: FlowGroup[] = []
  flowMap.forEach((value, flowId) => {
    if (value.screens.length < 2) return
    const firstName = value.screens[0].name
    const flowName = firstName.includes('Flow')
      ? firstName
      : `${firstName} Flow`
    flows.push({
      flowId,
      name: flowName,
      screens: value.screens,
      indices: value.indices,
    })
  })

  return flows
}

/** Get the bounding rect of a screen on the canvas, using explicit position or fallback to index */
function getScreenRect(screenId: string, screenIndex: number, screenPositions?: Map<string, { x: number; y: number }>, deviceId?: string) {
  const { CANVAS_W, CANVAS_H } = getCanvasDimensions(deviceId || DEFAULT_DEVICE)
  const pos = screenPositions?.get(screenId)
  const x = pos ? pos.x : PAD_X + screenIndex * (CANVAS_W + GAP)
  const y = (pos ? pos.y : PAD_Y) + LABEL_HEIGHT
  return { x, y, w: CANVAS_W, h: CANVAS_H }
}

function inferTransitionType(screenName: string): string {
  const lower = screenName.toLowerCase()
  if (lower.includes('modal') || lower.includes('popup') || lower.includes('dialog') || lower.includes('alert')) return 'Modal'
  if (lower.includes('tab') || lower.includes('tabs')) return 'Tab'
  return 'Push'
}

interface FlowConnectorsProps {
  flows: FlowGroup[]
  totalScreens: number
  /** Map of screenId → { x, y } canvas positions for free-drag layout */
  screenPositions?: Map<string, { x: number; y: number }>
  /** Device ID for dimension calculations */
  deviceId?: string
}

export function FlowConnectors({ flows, screenPositions, deviceId }: FlowConnectorsProps) {
  const connectors = useMemo(() => {
    const lines: Array<{
      key: string
      x1: number; y1: number
      x2: number; y2: number
      transitionType: string
    }> = []

    for (const flow of flows) {
      for (let i = 0; i < flow.indices.length - 1; i++) {
        const fromIdx = flow.indices[i]
        const toIdx = flow.indices[i + 1]
        const fromId = flow.screens[i].id
        const toId = flow.screens[i + 1].id
        const fromRect = getScreenRect(fromId, fromIdx, screenPositions, deviceId)
        const toRect = getScreenRect(toId, toIdx, screenPositions, deviceId)

        const x1 = fromRect.x + fromRect.w
        const y1 = fromRect.y + fromRect.h / 2
        const x2 = toRect.x
        const y2 = toRect.y + toRect.h / 2

        const transitionType = inferTransitionType(flow.screens[i + 1].name)

        lines.push({
          key: `${flow.flowId}-${i}`,
          x1, y1, x2, y2,
          transitionType,
        })
      }
    }
    return lines
  }, [flows])

  if (connectors.length === 0) return null

  // Calculate SVG viewBox to cover all connectors
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const c of connectors) {
    minX = Math.min(minX, c.x1 - 10, c.x2 - 10)
    minY = Math.min(minY, c.y1 - 30, c.y2 - 30)
    maxX = Math.max(maxX, c.x1 + 10, c.x2 + 10)
    maxY = Math.max(maxY, c.y1 + 30, c.y2 + 30)
  }

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
        <style>{`
          @keyframes flowDash {
            to { stroke-dashoffset: -20; }
          }
        `}</style>
      </defs>

      {connectors.map(c => {
        const dx = c.x2 - c.x1
        const cpOffset = Math.min(Math.abs(dx) * 0.4, 60)
        const cpX1 = c.x1 + cpOffset
        const cpX2 = c.x2 - cpOffset

        const midX = (c.x1 + c.x2) / 2
        const midY = (c.y1 + c.y2) / 2

        return (
          <g key={c.key}>
            {/* Shadow line for depth */}
            <path
              d={`M${c.x1},${c.y1} C${cpX1},${c.y1} ${cpX2},${c.y2} ${c.x2},${c.y2}`}
              fill="none"
              stroke="rgba(99,102,241,0.15)"
              strokeWidth={6}
              strokeLinecap="round"
            />
            {/* Main bezier line */}
            <path
              d={`M${c.x1},${c.y1} C${cpX1},${c.y1} ${cpX2},${c.y2} ${c.x2},${c.y2}`}
              fill="none"
              stroke="rgba(99,102,241,0.5)"
              strokeWidth={2}
              strokeLinecap="round"
              markerEnd="url(#flow-arrow)"
            />
            {/* Animated dashed overlay */}
            <path
              d={`M${c.x1},${c.y1} C${cpX1},${c.y1} ${cpX2},${c.y2} ${c.x2},${c.y2}`}
              fill="none"
              stroke="rgba(99,102,241,0.7)"
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
                background: 'rgba(30, 30, 46, 0.85)',
                borderRadius: 11,
                border: '1px solid rgba(99,102,241,0.3)',
                fontSize: 10,
                fontWeight: 600,
                color: 'rgba(129,140,248,0.9)',
                letterSpacing: '0.3px',
                backdropFilter: 'blur(4px)',
              }}>
                {c.transitionType}
              </div>
            </foreignObject>
          </g>
        )
      })}
    </svg>
  )
}
