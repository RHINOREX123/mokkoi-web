import { describe, expect, it } from 'vitest'
import type { Evidence } from '../../lib/xray/types.js'
import { Budget, BudgetExceededError, type ModelCall, type ModelClient, type ModelResult } from './model.js'
import { runHarness } from './pipeline.js'

const evidence: Evidence[] = [
  { key: 'E1', collector: 'listing', title: 'Flippa listing: summary metrics', summary: 'mrr=968', data: { fields: { mrr: '968' } }, fetchedAt: '2026-10-29T00:00:00Z' },
  { key: 'E2', collector: 'http', title: 'Security headers', summary: 'Missing: content-security-policy', data: {}, fetchedAt: '2026-10-29T00:00:00Z' },
]

const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }

/** Scripted stand-in for Claude: returns canned outputs per step and counts calls. */
class FakeClient implements ModelClient {
  calls: string[] = []
  emptyOnce = new Set<string>()

  async call<T>(req: ModelCall<T>, _budget: Budget): Promise<ModelResult<T>> {
    this.calls.push(req.label)
    let data: unknown
    if (req.role === 'parse') data = { business: { name: 'X', whatItDoes: 'y', revenueModel: 'z' }, claims: [{ text: 'MRR $1.7K', category: 'revenue', evidenceKeys: ['E1'] }], focus: [] }
    else if (req.role === 'specialist') {
      if (this.emptyOnce.delete(req.label)) data = { findings: [], claimChecks: [], strengths: [], questions: [] }
      else if (req.label === 'specialist:tech_security')
        data = {
          findings: [
            { severity: 'medium', title: 'Headers missing', detail: 'd', evidenceKeys: ['E2'] },
            { severity: 'high', title: 'Invented problem', detail: 'd', evidenceKeys: ['E99'] },
          ],
          claimChecks: [],
          strengths: [],
          questions: ['q'],
        }
      else if (req.label === 'specialist:listing_financials')
        data = { findings: [], claimChecks: [{ claimIndex: 0, status: 'contradicted', finding: 'Panel says $968', evidenceKeys: ['E1'] }], strengths: [], questions: [] }
      else data = { findings: [], claimChecks: [], strengths: [{ text: 'fine', evidenceKeys: ['E2'] }], questions: [] }
    } else if (req.role === 'skeptic') {
      const j = JSON.parse(req.input) as { findings: { key: string; severity: string; title: string; detail: string }[] }
      data = { decisions: j.findings.map((f) => ({ ...f, action: 'keep', reason: 'ok' })), claimDecisions: [] }
    } else {
      data = { headline: 'h', summary: ['s'], questions: ['q'], verifyBeforeClosing: [], valuation: '', first30Days: [], scoreAdjustment: 0, adjustmentReason: '' }
    }
    return { data: req.schema.parse(data), model: 'fake', usage, costUsd: 0 }
  }
}

const input = { target: { listingUrl: 'https://flippa.com/1' }, evidence, requestLog: [], plan: 'quick' as const, accessLevel: 0 as const }

describe('report harness', () => {
  it('rejects findings that cite unknown evidence and keeps the rest', async () => {
    const client = new FakeClient()
    const { report, meta } = await runHarness(input, { client, capUsd: 5 })
    expect(report.redFlags.map((f) => f.title)).toEqual(['Headers missing'])
    expect(meta.allFindings.find((f) => f.title === 'Invented problem')?.status).toBe('rejected')
    expect(report.claims[0]).toMatchObject({ status: 'contradicted', evidenceKeys: ['E1'] })
  })

  it('retries a specialist once when its answer is completely empty', async () => {
    const client = new FakeClient()
    client.emptyOnce.add('specialist:tech_security')
    const { report } = await runHarness(input, { client, capUsd: 5 })
    expect(client.calls.filter((c) => c === 'specialist:tech_security')).toHaveLength(2)
    expect(report.redFlags).toHaveLength(1)
  })

  it('stops when a call could exceed the cost cap', () => {
    const b = new Budget(0.01)
    expect(() => b.assertCanSpend('claude-opus-5-5', 50_000, 16_000, 'skeptic')).toThrow(BudgetExceededError)
    expect(() => new Budget(5).assertCanSpend('claude-opus-5-5', 50_000, 16_000, 'skeptic')).not.toThrow()
  })
})
