// The report harness: orchestrator -> 5 specialists -> evidence gate -> skeptic -> writer + scorer.
import { bySeverity, gateEvidence, rubricScore } from '../../lib/xray/score.js'
import {
  type ClaimCheck,
  type Evidence,
  type EvidencedPoint,
  type Finding,
  type RequestLogEntry,
  type SectionKey,
  type XrayPlan,
  type XrayReport,
  type XrayRunMeta,
} from '../../lib/xray/types.js'
import { marketplaceOf } from '../collectors/listing.js'
import type { Target } from '../collectors/context.js'
import { Budget, BudgetExceededError, type ModelClient } from './model.js'
import { HARNESS_VERSION, ORCHESTRATOR_INSTRUCTIONS, SKEPTIC_INSTRUCTIONS, SPECIALIST_INSTRUCTIONS, WRITER_INSTRUCTIONS, cachedPrefix } from './prompts.js'
import { OrchestratorZ, SkepticZ, SpecialistZ, WriterZ, type SpecialistOut } from './schemas.js'

export const SECTIONS: SectionKey[] = ['listing_financials', 'tech_security', 'traffic_seo', 'market_platform', 'transferability']

export interface HarnessInput {
  target: Target
  evidence: Evidence[]
  requestLog: RequestLogEntry[]
  plan: XrayPlan
  accessLevel: 0 | 1 | 2
}

export interface HarnessOptions {
  client: ModelClient
  capUsd: number
  log?: (msg: string) => void
}

export interface HarnessOutput {
  report: XrayReport
  meta: XrayRunMeta
}

export async function runHarness(input: HarnessInput, opts: HarnessOptions): Promise<HarnessOutput> {
  const t0 = Date.now()
  const log = opts.log ?? (() => {})
  const budget = new Budget(opts.capUsd)
  const known = new Set(input.evidence.map((e) => e.key))
  const listingRow = input.evidence.find((e) => e.collector === 'listing' && e.title.includes('summary metrics'))
  const listingTitle = (listingRow?.data.title as string | undefined)?.replace(/…?\s*\|\s*SaaS for Sale on Flippa$/, '')
  const targetLine = [
    `Listing: ${input.target.listingUrl}${listingTitle ? ` ("${listingTitle}")` : ''}`,
    `Website: ${input.target.websiteUrl ?? 'not known (listing-only check)'}`,
    `Report level: ${input.accessLevel} (${input.plan})`,
  ].join('\n')
  const prefix = cachedPrefix(input.evidence, targetLine)

  // 1. Orchestrator (Haiku): extract claims and focus notes.
  log('orchestrator: extracting claims')
  const orch = await opts.client.call(
    { role: 'parse', label: 'orchestrator', cachedSystem: prefix, instructions: ORCHESTRATOR_INSTRUCTIONS, input: 'Extract the claims and focus notes now.', schema: OrchestratorZ, maxTokens: 6000 },
    budget,
  )
  const claims = orch.data.claims.map((c) => ({ ...c, evidenceKeys: c.evidenceKeys.filter((k) => known.has(k)) }))
  const specialistInput = JSON.stringify({ business: orch.data.business, claims: claims.map((c, i) => ({ index: i, ...c })), focus: orch.data.focus }, null, 1)

  // 2. Specialists (Sonnet). The first one warms the prompt cache; the rest run in parallel.
  const results = new Map<SectionKey, SpecialistOut>()
  const errors: string[] = []
  const runSpecialist = async (section: SectionKey) => {
    try {
      const call = () =>
        opts.client.call(
          { role: 'specialist', label: `specialist:${section}`, cachedSystem: prefix, instructions: SPECIALIST_INSTRUCTIONS[section], input: specialistInput, schema: SpecialistZ, maxTokens: 20000 },
          budget,
        )
      let r = await call()
      // An answer with nothing at all in it (seen in about 1 in 5 live calls) is almost
      // always a dud, not a clean bill of health: retry once.
      const empty = (d: SpecialistOut) => d.findings.length + d.strengths.length + d.claimChecks.length + d.questions.length === 0
      if (empty(r.data)) {
        log(`specialist ${section}: empty answer, retrying once`)
        r = await call()
      }
      results.set(section, r.data)
      log(`specialist ${section}: ${r.data.findings.length} findings ($${r.costUsd.toFixed(3)}, cache read ${r.usage.cacheReadTokens})`)
    } catch (err) {
      if (err instanceof BudgetExceededError) throw err
      errors.push(`${section}: ${(err as Error).message}`)
      log(`specialist ${section} failed: ${(err as Error).message}`)
    }
  }
  await runSpecialist(SECTIONS[0])
  await Promise.all(SECTIONS.slice(1).map(runSpecialist))
  if (results.size === 0) throw new Error(`All specialists failed: ${errors.join('; ')}`)

  // 3. Evidence gate (code).
  let n = 0
  const proposed: Finding[] = []
  for (const section of SECTIONS) {
    for (const f of results.get(section)?.findings ?? []) {
      proposed.push({ key: `F${++n}`, section, severity: f.severity, title: f.title, detail: f.detail, evidenceKeys: f.evidenceKeys, status: 'kept' })
    }
  }
  const gated = gateEvidence(proposed, known)
  const rejected = gated.rejected.map((f) => ({ ...f, status: 'rejected' as const, skepticReason: 'No valid evidence keys (rejected by code)' }))
  log(`gate: ${gated.accepted.length} findings with evidence, ${rejected.length} rejected`)

  // Claim checks: one per claim, preferring the listing specialist's view.
  const checksByClaim = new Map<number, { status: ClaimCheck['status']; finding: string; evidenceKeys: string[] }>()
  for (const section of SECTIONS) {
    for (const c of results.get(section)?.claimChecks ?? []) {
      if (c.claimIndex < 0 || c.claimIndex >= claims.length || checksByClaim.has(c.claimIndex)) continue
      checksByClaim.set(c.claimIndex, c)
    }
  }
  let claimChecks: (ClaimCheck & { key: string })[] = claims.map((c, i) => {
    const check = checksByClaim.get(i)
    const keys = (check?.evidenceKeys ?? []).filter((k) => known.has(k))
    // Verified or contradicted needs evidence; otherwise it can only be "unverified".
    const status = check && keys.length ? check.status : 'unverified'
    return { key: `C${i + 1}`, claim: c.text, status, finding: check?.finding ?? 'Not checked at Level 0.', evidenceKeys: keys.length ? keys : c.evidenceKeys }
  })

  const strengths: EvidencedPoint[] = gateEvidence(
    SECTIONS.flatMap((s) => results.get(s)?.strengths ?? []),
    known,
  ).accepted
  const rawQuestions = SECTIONS.flatMap((s) => results.get(s)?.questions ?? [])

  // 4. Skeptic (Opus): keep, downgrade or drop each finding; confirm claim statuses.
  log('skeptic: reviewing findings')
  const sk = await opts.client.call(
    {
      role: 'skeptic',
      label: 'skeptic',
      cachedSystem: prefix,
      instructions: SKEPTIC_INSTRUCTIONS,
      input: JSON.stringify({ findings: gated.accepted.map(({ status: _s, ...f }) => f), claimChecks }, null, 1),
      schema: SkepticZ,
      maxTokens: 16000,
    },
    budget,
  )
  const decisions = new Map(sk.data.decisions.map((d) => [d.key, d]))
  const reviewed: Finding[] = gated.accepted.map((f) => {
    const d = decisions.get(f.key)
    if (!d) return { ...f, skepticReason: 'No skeptic decision; kept as proposed' }
    if (d.action === 'drop') return { ...f, status: 'dropped', skepticReason: d.reason }
    return { ...f, status: d.action === 'downgrade' ? 'downgraded' : 'kept', severity: d.severity, title: d.title || f.title, detail: d.detail || f.detail, skepticReason: d.reason }
  })
  const claimDecisions = new Map(sk.data.claimDecisions.map((d) => [d.key, d]))
  claimChecks = claimChecks.map((c) => {
    const d = claimDecisions.get(c.key)
    if (!d) return c
    // The skeptic may only move a claim to a status the evidence gate allows.
    const status = d.status !== 'unverified' && c.evidenceKeys.length === 0 ? 'unverified' : d.status
    return { ...c, status, finding: d.finding || c.finding }
  })
  // Info-level items are context, not red flags; they stay in the audit trail only.
  const kept = reviewed.filter((f) => (f.status === 'kept' || f.status === 'downgraded') && f.severity !== 'info').sort(bySeverity)
  log(`skeptic: kept ${kept.length}, dropped ${reviewed.length - kept.length}`)

  // 5. Writer + scorer (Opus writes; code scores with the rubric).
  const base = rubricScore(kept, claimChecks)
  const wr = await opts.client.call(
    {
      role: 'writer',
      label: 'writer',
      cachedSystem: prefix,
      instructions: WRITER_INSTRUCTIONS,
      input: JSON.stringify(
        {
          rubric: { score: base.score, band: base.color, breakdown: base.breakdown },
          listingMetrics: listingRow?.data.fields ?? null,
          redFlags: kept.map(({ key: _k, status: _s, skepticReason: _r, ...f }) => f),
          claimChecks: claimChecks.map(({ key: _k, ...c }) => c),
          strengths,
          candidateQuestions: rawQuestions,
        },
        null,
        1,
      ),
      schema: WriterZ,
      maxTokens: 12000,
    },
    budget,
  )
  const final = rubricScore(kept, claimChecks, wr.data.scoreAdjustment)

  const limits = [
    ...input.evidence.filter((e) => e.title === 'Not visible at Level 0' || e.title.startsWith('Acquire.com listing')).map((e) => e.summary),
    'Revenue, churn and traffic are the seller\'s figures until checked with seller-shared Stripe and analytics access (Full X-ray).',
    'No code, database or admin access was used. Mokkoi only looked at public information.',
  ]

  const report: XrayReport = {
    schemaVersion: 1,
    harnessVersion: HARNESS_VERSION,
    generatedAt: new Date().toISOString(),
    plan: input.plan,
    accessLevel: input.accessLevel,
    target: {
      listingUrl: input.target.listingUrl,
      websiteUrl: input.target.websiteUrl,
      title: listingTitle ?? orch.data.business.name,
      marketplace: marketplaceOf(input.target.listingUrl) ?? 'website',
    },
    verdict: { color: final.color, score: final.score, headline: wr.data.headline, summary: wr.data.summary.slice(0, 5) },
    claims: claimChecks.map(({ key: _k, ...c }) => c),
    redFlags: kept,
    strengths,
    questions: wr.data.questions,
    verifyBeforeClosing: wr.data.verifyBeforeClosing,
    valuation: wr.data.valuation.trim() || null,
    first30Days: wr.data.first30Days,
    limits,
    evidence: input.evidence,
    requestLog: input.requestLog,
  }

  const meta: XrayRunMeta = {
    costUsd: budget.spentUsd,
    modelUsage: budget.byModel,
    allFindings: [...reviewed, ...rejected],
    durationMs: Date.now() - t0,
    aborted: errors.length ? `Some specialists failed: ${errors.join('; ')}` : undefined,
  }
  log(`done: score ${final.score} (${final.color}), $${budget.spentUsd.toFixed(3)}, ${((Date.now() - t0) / 1000).toFixed(0)} s`)
  return { report, meta }
}
