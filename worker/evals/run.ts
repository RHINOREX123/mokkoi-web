// Eval runner: re-runs the benchmark targets from recorded fixtures and scores whether each
// known finding was found. Run it after every prompt or skill change.
//
//   npx tsx worker/evals/run.ts [--dir <eval dir>] [--case pointpin] [--mock] [--live]
//
// The eval set (cases.json + fixtures) lives outside this public repo, because it is built
// from private sample reports. Point XRAY_EVAL_DIR (or --dir) at it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import type { XrayReport } from '../../lib/xray/types.js'
import { collectEvidence, resolveTarget } from '../collectors/index.js'
import { QUICK_CAP_USD } from '../engine.js'
import { MockModelClient } from '../harness/mock.js'
import { AnthropicModelClient, Budget, type ModelClient } from '../harness/model.js'
import { HARNESS_VERSION } from '../harness/prompts.js'
import { runHarness } from '../harness/pipeline.js'
import { loadEnv } from '../lib/env.js'

loadEnv()
const { values } = parseArgs({
  options: {
    dir: { type: 'string' },
    case: { type: 'string', multiple: true },
    mock: { type: 'boolean' },
    live: { type: 'boolean' },
    out: { type: 'string', default: '.xray-data/evals' },
  },
})

interface EvalCase {
  id: string
  listingUrl: string
  websiteUrl?: string
  fixtures: string
  expectedVerdict: string[]
  expected: { id: string; weight: number; text: string }[]
}

const dir = values.dir ?? process.env.XRAY_EVAL_DIR
if (!dir || !existsSync(join(dir, 'cases.json'))) {
  console.error('Set XRAY_EVAL_DIR (or --dir) to the folder holding cases.json and fixtures/.')
  process.exit(1)
}
const cases = (JSON.parse(readFileSync(join(dir, 'cases.json'), 'utf8')) as { cases: EvalCase[] }).cases.filter((c) => !values.case || values.case.includes(c.id))
const client: ModelClient = values.mock ? new MockModelClient() : new AnthropicModelClient()
mkdirSync(values.out!, { recursive: true })

const JudgeZ = z.object({
  results: z.array(z.object({ id: z.string(), found: z.boolean(), where: z.string().describe('Which part of the report matches, quoted briefly, or empty') })),
})

/** Everything a customer would read, flattened for the judge. */
function reportText(r: XrayReport): string {
  return [
    `VERDICT ${r.verdict.color} ${r.verdict.score}: ${r.verdict.headline}`,
    ...r.verdict.summary,
    'RED FLAGS',
    ...r.redFlags.map((f) => `- [${f.severity}] ${f.title}: ${f.detail}`),
    'CLAIMS',
    ...r.claims.map((c) => `- ${c.claim} => ${c.status}: ${c.finding}`),
    'STRENGTHS',
    ...r.strengths.map((s) => `- ${s.text}`),
    'QUESTIONS',
    ...r.questions.map((q) => `- ${q}`),
    'VERIFY BEFORE CLOSING',
    ...r.verifyBeforeClosing.map((q) => `- ${q}`),
  ].join('\n')
}

async function judge(c: EvalCase, report: XrayReport) {
  if (values.mock) {
    // Offline: crude keyword overlap so the pipeline can be smoke-tested without an API key.
    const text = reportText(report).toLowerCase()
    return c.expected.map((e) => {
      const words = e.text.toLowerCase().match(/[a-z]{6,}/g) ?? []
      const hit = words.filter((w) => text.includes(w)).length / Math.max(1, words.length)
      return { id: e.id, found: hit > 0.5, where: '' }
    })
  }
  const r = await client.call(
    {
      role: 'parse',
      label: `judge:${c.id}`,
      cachedSystem: 'You grade due-diligence reports against a list of known findings. A finding counts as found if the report states the same issue or fact anywhere (red flags, claims, strengths, questions), even in different words or with different severity. It does not count if the report only hints at it vaguely.',
      instructions: 'Return one result per expected finding id.',
      input: `EXPECTED FINDINGS\n${c.expected.map((e) => `${e.id}: ${e.text}`).join('\n')}\n\nREPORT\n${reportText(report)}`,
      schema: JudgeZ,
      maxTokens: 4000,
    },
    new Budget(0.5),
  )
  return r.data.results
}

const rows: string[] = []
let totalCost = 0
for (const c of cases) {
  const target = resolveTarget(c.listingUrl, c.websiteUrl)
  const collected = await collectEvidence(target, { mode: values.live ? 'live' : 'replay', fixtureDir: join(dir, c.fixtures), skipPagespeed: !values.live })
  const t0 = Date.now()
  const { report, meta } = await runHarness(
    { target, evidence: collected.evidence, requestLog: collected.requestLog, plan: 'quick', accessLevel: 0 },
    { client, capUsd: QUICK_CAP_USD, log: (m) => console.log(`[${c.id}] ${m}`) },
  )
  const results = await judge(c, report)
  const weight = c.expected.reduce((n, e) => n + e.weight, 0)
  const got = c.expected.reduce((n, e) => n + (results.find((r) => r.id === e.id)?.found ? e.weight : 0), 0)
  const verdictOk = c.expectedVerdict.includes(report.verdict.color)
  totalCost += meta.costUsd
  writeFileSync(join(values.out!, `${c.id}.json`), JSON.stringify({ report, meta, judge: results }, null, 2))
  rows.push(
    `${c.id.padEnd(10)} recall ${((100 * got) / weight).toFixed(0).padStart(3)}%  verdict ${report.verdict.color}/${report.verdict.score} (${verdictOk ? 'ok' : `expected ${c.expectedVerdict.join('|')}`})  flags ${report.redFlags.length}  cost $${meta.costUsd.toFixed(3)}  ${((Date.now() - t0) / 1000).toFixed(0)}s`,
  )
  for (const e of c.expected) {
    const r = results.find((x) => x.id === e.id)
    rows.push(`   ${r?.found ? 'FOUND ' : 'MISSED'} ${e.id} ${e.text.slice(0, 90)}${r?.where ? `\n          ↳ ${r.where.slice(0, 140)}` : ''}`)
  }
}
console.log(`\nEval ${HARNESS_VERSION} ${values.mock ? '(mock model)' : ''}\n${rows.join('\n')}\nTotal model cost $${totalCost.toFixed(3)} for ${cases.length} report(s), $${(totalCost / Math.max(1, cases.length)).toFixed(3)} per report`)
