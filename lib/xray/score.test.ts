import { describe, expect, it } from 'vitest'
import { gateEvidence, rubricScore } from './score.js'

const f = (severity: 'critical' | 'high' | 'medium' | 'low' | 'info', status: 'kept' | 'dropped' = 'kept') => ({ severity, status })

describe('evidence gate', () => {
  it('rejects findings with no valid evidence keys and strips unknown keys', () => {
    const known = new Set(['E1', 'E2'])
    const { accepted, rejected } = gateEvidence(
      [
        { title: 'a', evidenceKeys: ['E1', 'E9'] },
        { title: 'b', evidenceKeys: [] },
        { title: 'c', evidenceKeys: ['E7'] },
        { title: 'd', evidenceKeys: [' e2 '] },
      ],
      known,
    )
    expect(accepted.map((x) => [x.title, x.evidenceKeys])).toEqual([['a', ['E1']], ['d', ['E2']]])
    expect(rejected.map((x) => x.title)).toEqual(['b', 'c'])
  })
})

describe('rubric score', () => {
  it('starts high and ignores dropped findings', () => {
    expect(rubricScore([f('high', 'dropped')], []).score).toBe(98)
  })
  it('caps the score at 40 when a critical flag survives', () => {
    const r = rubricScore([f('critical')], [])
    expect(r.score).toBe(40)
    expect(r.color).toBe('red')
  })
  it('caps many small issues so they cannot outweigh serious ones', () => {
    const lows = Array.from({ length: 10 }, () => f('low'))
    expect(rubricScore(lows, []).score).toBe(94)
  })
  it('lands a typical small-SaaS mix in the yellow band', () => {
    const findings = [f('high'), f('high'), ...Array.from({ length: 6 }, () => f('medium')), ...Array.from({ length: 6 }, () => f('low'))]
    const claims = [{ status: 'contradicted' as const }, ...Array.from({ length: 8 }, () => ({ status: 'unverified' as const }))]
    const r = rubricScore(findings, claims)
    expect(r.color).toBe('yellow')
  })
  it('clamps the reviewer adjustment to ±10', () => {
    expect(rubricScore([], [], 50).score).toBe(98)
    expect(rubricScore([f('high')], [], -50).score).toBe(80)
  })
})
