// Run only the plain-code collectors and print the evidence (no model calls).
//   npx tsx worker/collect.ts --listing <url> [--website <url>] [--record <dir> | --replay <dir>] [--out file.json]
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { collectEvidence, resolveTarget } from './collectors/index.js'
import { loadEnv } from './lib/env.js'

loadEnv()
const { values } = parseArgs({
  options: {
    listing: { type: 'string' },
    website: { type: 'string' },
    record: { type: 'string' },
    replay: { type: 'string' },
    out: { type: 'string' },
    'skip-pagespeed': { type: 'boolean' },
  },
})
if (!values.listing) {
  console.error('Usage: tsx worker/collect.ts --listing <url> [--website <url>] [--record dir | --replay dir] [--out file]')
  process.exit(1)
}

const target = resolveTarget(values.listing, values.website)
const mode = values.record ? 'record' : values.replay ? 'replay' : 'live'
const t0 = Date.now()
const result = await collectEvidence(target, {
  mode,
  fixtureDir: values.record ?? values.replay,
  pagespeedKey: process.env.PAGESPEED_API_KEY,
  skipPagespeed: values['skip-pagespeed'],
})
for (const e of result.evidence) console.log(`${e.key.padEnd(4)} [${e.collector}] ${e.title}\n     ${e.summary}`)
console.log(`\n${result.evidence.length} evidence rows, ${result.requestLog.length} requests (${result.requestLog.filter((r) => r.error).length} failed), ${((Date.now() - t0) / 1000).toFixed(1)} s`)
console.log('timings ms:', JSON.stringify(result.timings))
if (values.out) writeFileSync(values.out, JSON.stringify({ target, ...result, shared: undefined }, null, 2))
