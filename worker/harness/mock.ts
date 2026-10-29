// Offline stand-in for Claude, for tests and dry runs (--mock / XRAY_MOCK_MODEL=1).
// It builds simple, clearly labelled findings from evidence summaries with fixed rules.
// Reports made with it are test data, never something to send to a customer.
import type { Budget, ModelCall, ModelClient, ModelResult } from './model.js'
import type { OrchestratorOut, SkepticOut, SpecialistOut, WriterOut } from './schemas.js'

interface Row {
  key: string
  title: string
  summary: string
}

function rows(prefix: string): Row[] {
  const out: Row[] = []
  for (const m of prefix.matchAll(/^\[(E\d+)\] (.+?) \(collector[^\n]*\nSummary: ([^\n]*)/gm)) out.push({ key: m[1], title: m[2], summary: m[3] })
  return out
}

const MOCK = '[mock] '

function orchestrator(prefix: string): OrchestratorOut {
  const r = rows(prefix)
  const metrics = r.find((x) => x.title.includes('summary metrics'))
  const claims: OrchestratorOut['claims'] = []
  for (const m of metrics?.summary.matchAll(/(\w+)=([^,.]+(?:\.\d+)?)/g) ?? []) {
    claims.push({ text: `${m[1].replace(/_/g, ' ')}: ${m[2]}`, category: /mrr|revenue/.test(m[1]) ? 'revenue' : /profit/.test(m[1]) ? 'profit' : /churn/.test(m[1]) ? 'churn' : 'other', evidenceKeys: [metrics!.key] })
  }
  return { business: { name: 'Mock business', whatItDoes: 'unknown (mock run)', revenueModel: 'unknown' }, claims, focus: [] }
}

function specialist(instructions: string, prefix: string, input: string): SpecialistOut {
  const r = rows(prefix)
  const findings: SpecialistOut['findings'] = []
  const strengths: SpecialistOut['strengths'] = []
  const add = (severity: SpecialistOut['findings'][number]['severity'], row: Row, title: string) => findings.push({ severity, title: MOCK + title, detail: row.summary, evidenceKeys: [row.key] })
  const section = instructions.match(/specialist "([^"]+)"/)?.[1] ?? ''
  for (const row of r) {
    if (section.startsWith('Tech')) {
      if (/does not resolve/.test(row.title)) add('critical', row, 'The backend the app depends on is gone')
      if (row.title === 'Security headers' && /Missing: (?!none)/.test(row.summary)) add('medium', row, 'Security headers are missing')
      if (/likely secret/.test(row.summary)) add('critical', row, 'Secret keys are exposed in public JavaScript')
      if (/TLS certificate for/.test(row.title)) strengths.push({ text: MOCK + 'Valid TLS certificate', evidenceKeys: [row.key] })
    }
    if (section.startsWith('Traffic')) {
      if (/returns an HTML page/.test(row.summary)) add('low', row, 'robots.txt is not a real robots file')
      if (/No valid sitemap/.test(row.summary)) add('low', row, 'No sitemap')
      if (/Universal Analytics/.test(row.summary)) add('low', row, 'Still loads Universal Analytics')
    }
    if (section.startsWith('Transfer') && /transferred \d{4}/.test(row.summary)) add('low', row, 'Domain was transferred before; confirm who controls it')
  }
  const claims = (JSON.parse(input) as { claims: { index: number }[] }).claims
  return {
    findings,
    claimChecks: section.startsWith('Listing') ? claims.map((c) => ({ claimIndex: c.index, status: 'unverified' as const, finding: MOCK + 'Not checked in a mock run.', evidenceKeys: [] })) : [],
    strengths,
    questions: findings.map((f) => `${MOCK}Can you explain: ${f.title.replace(MOCK, '')}?`),
  }
}

function skeptic(input: string): SkepticOut {
  const j = JSON.parse(input) as { findings: { key: string; severity: SkepticOut['decisions'][number]['severity']; title: string; detail: string }[]; claimChecks: { key: string; status: SkepticOut['claimDecisions'][number]['status']; finding: string }[] }
  return {
    decisions: j.findings.map((f) => ({ key: f.key, action: 'keep', severity: f.severity, title: f.title, detail: f.detail, reason: MOCK + 'kept' })),
    claimDecisions: j.claimChecks.map((c) => ({ key: c.key, status: c.status, finding: c.finding, reason: MOCK + 'unchanged' })),
  }
}

function writer(input: string): WriterOut {
  const j = JSON.parse(input) as { rubric: { band: string }; candidateQuestions: string[]; redFlags: { title: string }[] }
  return {
    headline: `${MOCK}Test report (${j.rubric.band}); not written by Claude.`,
    summary: [`${MOCK}This report was produced by the offline mock model for testing.`, ...j.redFlags.slice(0, 3).map((f) => f.title)],
    questions: j.candidateQuestions.slice(0, 8),
    verifyBeforeClosing: [MOCK + 'Real revenue in Stripe', MOCK + 'Real traffic in analytics'],
    valuation: '',
    first30Days: [MOCK + 'Fix the red flags above'],
    scoreAdjustment: 0,
    adjustmentReason: MOCK,
  }
}

export class MockModelClient implements ModelClient {
  async call<T>(req: ModelCall<T>, _budget: Budget): Promise<ModelResult<T>> {
    let data: unknown
    if (req.role === 'parse') data = orchestrator(req.cachedSystem)
    else if (req.role === 'specialist') data = specialist(req.instructions, req.cachedSystem, req.input)
    else if (req.role === 'skeptic') data = skeptic(req.input)
    else data = writer(req.input)
    return { data: req.schema.parse(data), model: 'mock', usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, costUsd: 0 }
  }
}
