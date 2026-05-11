// Client mirror of api/_lib/progress-events.ts (kept identical aside from the
// .js import suffix, which Vite/TS-app config rejects). Server emits the events;
// client folds them with reduceMilestones. The two files exist separately
// because the Vercel function bundle uses NodeNext module resolution (.js
// suffixes required) while the Vite client uses Bundler resolution (no suffix).

export type MilestoneKind =
  | 'analyzing'
  | 'identified'
  | 'generating'
  | 'complete'
  | 'error'

export type MilestoneStatus = 'pending' | 'inflight' | 'done' | 'failed'

export interface MilestoneEvent {
  id: string
  kind: MilestoneKind
  message: string
  status: MilestoneStatus
}

const KIND_ORDER: MilestoneKind[] = ['analyzing', 'identified', 'generating', 'complete']

export function makeMilestone(
  kind: MilestoneKind,
  message: string,
  status: MilestoneStatus = 'inflight',
): MilestoneEvent {
  return { id: `m-${kind}`, kind, message, status }
}

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

export function reduceMilestones(
  state: MilestoneEvent[],
  event: unknown,
): MilestoneEvent[] {
  if (!event || typeof event !== 'object') return state
  const e = event as Partial<MilestoneEvent>
  const validKind = typeof e.kind === 'string' && (KIND_ORDER.includes(e.kind as MilestoneKind) || e.kind === 'error')
  if (!validKind) return state
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
  let next = state
  if (incoming.status === 'inflight') {
    next = state.map(m => (m.status === 'inflight' ? { ...m, status: 'done' as MilestoneStatus } : m))
  }
  return [...next, incoming]
}

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
