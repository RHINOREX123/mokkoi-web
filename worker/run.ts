// Report worker entry point (GitHub Actions cron, or by hand).
//   npx tsx worker/run.ts --queued              process queued Quick X-ray orders
//   npx tsx worker/run.ts --order <id>          run one order (it must be queued)
//   npx tsx worker/run.ts --listing <url> [--website <url>] [--out report.json] [--replay dir] [--mock]
//                                               ad-hoc run without the database
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { getStore } from '../lib/xray/store.js'
import { collectEvidence, resolveTarget } from './collectors/index.js'
import { QUICK_CAP_USD, processOrder, requeueStale } from './engine.js'
import { MockModelClient } from './harness/mock.js'
import { AnthropicModelClient, type ModelClient } from './harness/model.js'
import { runHarness } from './harness/pipeline.js'
import { loadEnv } from './lib/env.js'

loadEnv()
const { values } = parseArgs({
  options: {
    queued: { type: 'boolean' },
    order: { type: 'string' },
    listing: { type: 'string' },
    website: { type: 'string' },
    out: { type: 'string' },
    replay: { type: 'string' },
    record: { type: 'string' },
    mock: { type: 'boolean' },
    max: { type: 'string', default: '3' },
  },
})

function modelClient(): ModelClient {
  if (values.mock || process.env.XRAY_MOCK_MODEL === '1') return new MockModelClient()
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set (use --mock for a dry run)')
  return new AnthropicModelClient()
}

const collect = {
  mode: values.replay ? ('replay' as const) : values.record ? ('record' as const) : ('live' as const),
  fixtureDir: values.replay ?? values.record,
  pagespeedKey: process.env.PAGESPEED_API_KEY,
}
const capUsd = Number(process.env.XRAY_COST_CAP_USD || QUICK_CAP_USD)

if (values.listing) {
  const target = resolveTarget(values.listing, values.website)
  const collected = await collectEvidence(target, collect)
  const out = await runHarness(
    { target, evidence: collected.evidence, requestLog: collected.requestLog, plan: 'quick', accessLevel: 0 },
    { client: modelClient(), capUsd, log: (m) => console.log(m) },
  )
  if (values.out) writeFileSync(values.out, JSON.stringify(out, null, 2))
  console.log(`score ${out.report.verdict.score} (${out.report.verdict.color}); ${out.report.redFlags.length} red flags; cost $${out.meta.costUsd.toFixed(3)}`)
} else if (values.queued || values.order) {
  const store = getStore()
  const client = modelClient()
  console.log(`store: ${store.kind}`)
  await requeueStale(store)
  const orders = values.order ? [await store.getOrder(values.order)].filter((o) => o !== null) : await store.listByStatus('queued', Number(values.max))
  if (orders.length === 0) console.log('no queued orders')
  for (const order of orders) await processOrder(store, order, { client, capUsd, collect })
} else {
  console.error('Pass --queued, --order <id> or --listing <url>.')
  process.exit(1)
}
