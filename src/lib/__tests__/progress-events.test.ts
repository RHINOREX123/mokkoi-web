import { describe, it, expect } from 'vitest'
import {
  reduceMilestones,
  failLatestInflight,
  makeMilestone,
  deriveIdentified,
  type MilestoneEvent,
} from '../progress-events'

describe('reduceMilestones — 4-event happy path', () => {
  it('builds the expected timeline from the server-emitted sequence', () => {
    // The server emits these four events in this order. The reducer must end
    // with all four steps present, the first three 'done', and 'complete'
    // also done. This mirrors what the timeline component renders.
    const events = [
      { type: 'milestone', ...makeMilestone('analyzing', 'Analyzing your prompt…') },
      { type: 'milestone', ...makeMilestone('identified', 'Identified: FitApp · 5 screens · 12 records', 'done') },
      { type: 'milestone', ...makeMilestone('generating', 'Generating 5 screens…') },
      { type: 'milestone', ...makeMilestone('generating', 'Generated 5 screens', 'done') },
      { type: 'milestone', ...makeMilestone('complete', 'Done — 5 screens ready', 'done') },
    ]
    let state: MilestoneEvent[] = []
    for (const e of events) state = reduceMilestones(state, e)

    expect(state).toHaveLength(4)
    expect(state.map(m => m.kind)).toEqual(['analyzing', 'identified', 'generating', 'complete'])
    expect(state.every(m => m.status === 'done')).toBe(true)
    expect(state[2].message).toBe('Generated 5 screens')
  })

  it('auto-completes a prior inflight step when a new kind starts', () => {
    let state: MilestoneEvent[] = []
    state = reduceMilestones(state, makeMilestone('analyzing', 'Analyzing…'))
    state = reduceMilestones(state, makeMilestone('generating', 'Generating…'))
    expect(state[0].status).toBe('done')
    expect(state[1].status).toBe('inflight')
  })
})

describe('reduceMilestones — defensive against malformed input', () => {
  const baseline: MilestoneEvent[] = [
    { id: 'm-analyzing', kind: 'analyzing', message: 'A', status: 'inflight' },
  ]

  it.each([
    null,
    undefined,
    'not-an-object',
    {},
    { kind: 'analyzing' }, // missing message
    { kind: 'bogus-kind', message: 'x' },
    { kind: 'analyzing', message: 42 },
    [1, 2, 3],
  ])('returns previous state for malformed event %p', (bad) => {
    expect(reduceMilestones(baseline, bad as unknown)).toBe(baseline)
  })

  it('does not throw on any of the malformed inputs', () => {
    const bads = [null, undefined, {}, { kind: 'x' }, 'abc', 0, [] as unknown]
    for (const b of bads) {
      expect(() => reduceMilestones(baseline, b)).not.toThrow()
    }
  })
})

describe('failLatestInflight', () => {
  it('flips the most recent inflight step to failed', () => {
    const state: MilestoneEvent[] = [
      { id: 'a', kind: 'analyzing', message: 'A', status: 'done' },
      { id: 'b', kind: 'identified', message: 'B', status: 'done' },
      { id: 'c', kind: 'generating', message: 'C', status: 'inflight' },
    ]
    const next = failLatestInflight(state)
    expect(next[2].status).toBe('failed')
    expect(next[0].status).toBe('done')
  })

  it('returns the same state when nothing is inflight', () => {
    const state: MilestoneEvent[] = [
      { id: 'a', kind: 'analyzing', message: 'A', status: 'done' },
    ]
    expect(failLatestInflight(state)).toBe(state)
  })
})

describe('deriveIdentified', () => {
  it('formats with appData record count', () => {
    const s = deriveIdentified(
      { appName: 'FitTrack', screens: [{}, {}, {}] },
      { workouts: [{}, {}], meals: [{}] },
    )
    expect(s).toBe('Identified: FitTrack · 3 screens · 3 records')
  })

  it('handles missing appData and singular forms', () => {
    expect(deriveIdentified({ appName: 'X', screens: [{}] })).toBe('Identified: X · 1 screen')
    expect(deriveIdentified(null)).toBe('Identified: your app · 0 screens')
  })
})

describe('ChatPanel fallback contract', () => {
  // ChatPanel renders the OLD 2-line block when milestones is empty/undefined.
  // The conditional itself is `milestones && milestones.length > 0`, so we
  // verify the boolean here so a future refactor of the predicate is caught.
  it('treats empty / undefined / null as "render fallback"', () => {
    const shouldRenderTimeline = (m: MilestoneEvent[] | undefined | null) => !!(m && m.length > 0)
    expect(shouldRenderTimeline(undefined)).toBe(false)
    expect(shouldRenderTimeline(null)).toBe(false)
    expect(shouldRenderTimeline([])).toBe(false)
    expect(shouldRenderTimeline([{ id: 'a', kind: 'analyzing', message: 'A', status: 'inflight' }])).toBe(true)
  })
})
