// Streaming progress milestones for app generation.
//
// Sits ALONGSIDE the existing SSE events ('status', 'plan', 'screen',
// 'complete', 'error'). A pre-milestone client that ignores unknown event
// types must keep working. The server emits these at 4 well-known anchor
// points; the client builds a timeline UI from them.

export type MilestoneKind =
  | 'analyzing'
  | 'planning'
  | 'identified'
  | 'generating'
  | 'wiring'
  | 'finalizing'
  | 'complete'
  | 'error'

export type MilestoneStatus = 'pending' | 'inflight' | 'done' | 'failed'

export interface MilestoneEvent {
  id: string
  kind: MilestoneKind
  message: string
  status: MilestoneStatus
}

const KIND_ORDER: MilestoneKind[] = [
  'analyzing',
  'planning',
  'identified',
  'generating',
  'wiring',
  'finalizing',
  'complete',
]

/** Build a milestone event with a stable id (kind-derived). The reducer
 *  upserts by id so re-emitting the same kind updates rather than appends. */
export function makeMilestone(
  kind: MilestoneKind,
  message: string,
  status: MilestoneStatus = 'inflight',
): MilestoneEvent {
  return { id: `m-${kind}`, kind, message, status }
}

/** "Identified: <appName> · <N> screens · <M> records" — surfaced once the
 *  planner returns so the user sees what the system understood from their
 *  prompt before any screen comes back. appData is optional; when present
 *  we surface a top-level record count summed across collections. */
export function deriveIdentified(
  plan: { appName?: string; screens?: Array<unknown> } | null | undefined,
  appData?: Record<string, unknown> | null | undefined,
): string {
  const appName = plan?.appName?.trim() || 'your app'
  const screenCount = Array.isArray(plan?.screens) ? plan!.screens!.length : 0
  let recordCount = 0
  if (appData && typeof appData === 'object') {
    for (const v of Object.values(appData)) {
      if (Array.isArray(v)) recordCount += v.length
    }
  }
  const parts = [`Identified: ${appName}`, `${screenCount} screen${screenCount === 1 ? '' : 's'}`]
  if (recordCount > 0) parts.push(`${recordCount} record${recordCount === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

/** Reducer: fold a new milestone event into the current timeline.
 *
 *  Rules:
 *  - Upsert by id (kind-derived). Same-kind events update in place.
 *  - Marking a milestone 'done' or 'failed' is terminal — incoming events
 *    with status:'inflight' on an already-terminal milestone are ignored.
 *  - When a new kind starts ('inflight'), any prior 'inflight' milestone is
 *    auto-completed to 'done'. Prevents two spinners on the timeline at
 *    once when the server forgets to close out a step.
 *  - Malformed events (missing id/kind, unknown kind) are rejected — the
 *    caller is expected to fall back to the old block rather than render
 *    a corrupt timeline. The reducer NEVER throws.
 */
export function reduceMilestones(
  state: MilestoneEvent[],
  event: unknown,
): MilestoneEvent[] {
  if (!event || typeof event !== 'object') return state
  const e = event as Partial<MilestoneEvent>
  if (typeof e.kind !== 'string' || !KIND_ORDER.includes(e.kind as MilestoneKind) && e.kind !== 'error') {
    return state
  }
  if (typeof e.message !== 'string') return state
  const id = e.id && typeof e.id === 'string' ? e.id : `m-${e.kind}`
  const status: MilestoneStatus =
    e.status === 'pending' || e.status === 'inflight' || e.status === 'done' || e.status === 'failed'
      ? e.status
      : 'inflight'
  const incoming: MilestoneEvent = { id, kind: e.kind as MilestoneKind, message: e.message, status }

  const existingIdx = state.findIndex(m => m.id === id)
  if (existingIdx >= 0) {
    const existing = state[existingIdx]
    if ((existing.status === 'done' || existing.status === 'failed') && incoming.status === 'inflight') {
      return state
    }
    const next = state.slice()
    next[existingIdx] = incoming
    return next
  }
  // New kind starting — auto-complete any still-inflight prior steps.
  let next = state
  if (incoming.status === 'inflight') {
    next = state.map(m => (m.status === 'inflight' ? { ...m, status: 'done' as MilestoneStatus } : m))
  }
  return [...next, incoming]
}

/** Mark the latest still-inflight milestone as failed. Used when an SSE
 *  'error' event arrives so the timeline visually halts at the right step. */
export function failLatestInflight(state: MilestoneEvent[]): MilestoneEvent[] {
  for (let i = state.length - 1; i >= 0; i--) {
    if (state[i].status === 'inflight') {
      const next = state.slice()
      next[i] = { ...next[i], status: 'failed' }
      return next
    }
  }
  return state
}
