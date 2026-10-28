// Deterministic parts of the report: the evidence gate and the rubric score.
import { SEVERITY_ORDER, type ClaimCheck, type Finding, type Severity, type VerdictColor } from './types.js'

/**
 * The evidence gate. Keeps only evidence keys that exist; anything left with no valid key
 * is rejected. This runs in code on every model output, so a model cannot get an
 * unsupported finding into a report by asserting it.
 */
export function gateEvidence<T extends { evidenceKeys: string[] }>(items: T[], known: Set<string>): { accepted: T[]; rejected: T[] } {
  const accepted: T[] = []
  const rejected: T[] = []
  for (const item of items) {
    const keys = [...new Set(item.evidenceKeys.map((k) => k.trim().toUpperCase()))].filter((k) => known.has(k))
    if (keys.length) accepted.push({ ...item, evidenceKeys: keys })
    else rejected.push(item)
  }
  return { accepted, rejected }
}

const SEVERITY_POINTS: Record<Severity, number> = { critical: 25, high: 10, medium: 5, low: 2, info: 0 }
const SEVERITY_CAP: Record<Severity, number> = { critical: 100, high: 40, medium: 15, low: 6, info: 0 }

export interface RubricResult {
  score: number
  color: VerdictColor
  breakdown: string[]
}

/** Rubric: start at 100, subtract for each kept red flag and each claim problem. */
export function rubricScore(findings: Pick<Finding, 'severity' | 'status'>[], claims: Pick<ClaimCheck, 'status'>[], adjustment = 0): RubricResult {
  const live = findings.filter((f) => f.status === 'kept' || f.status === 'downgraded')
  const breakdown: string[] = []
  let score = 100
  for (const sev of SEVERITY_ORDER) {
    const n = live.filter((f) => f.severity === sev).length
    if (n && SEVERITY_POINTS[sev]) {
      // Many small issues should not outweigh one serious one.
      const pts = Math.min(n * SEVERITY_POINTS[sev], SEVERITY_CAP[sev])
      score -= pts
      breakdown.push(`${n} ${sev}: −${pts}`)
    }
  }
  const contradicted = claims.filter((c) => c.status === 'contradicted').length
  const unverified = claims.filter((c) => c.status === 'unverified').length
  if (contradicted) {
    score -= contradicted * 6
    breakdown.push(`${contradicted} contradicted claim(s) × −6`)
  }
  if (unverified) {
    // Most listing claims can't be checked from public data; that alone shouldn't sink a score.
    const pts = Math.min(3, unverified)
    score -= pts
    breakdown.push(`${unverified} unverified claim(s): −${pts}`)
  }
  const adj = Math.max(-10, Math.min(10, Math.round(adjustment)))
  if (adj) {
    score += adj
    breakdown.push(`reviewer adjustment ${adj > 0 ? '+' : ''}${adj}`)
  }
  score = Math.max(5, Math.min(98, score))
  if (live.some((f) => f.severity === 'critical') && score > 40) {
    score = 40
    breakdown.push('capped at 40: critical red flag')
  }
  const color: VerdictColor = score >= 70 ? 'green' : score >= 45 ? 'yellow' : 'red'
  return { score, color, breakdown }
}

export function bySeverity<T extends { severity: Severity }>(a: T, b: T) {
  return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
}
