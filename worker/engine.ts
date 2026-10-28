// Runs one order end to end: collectors -> harness -> stored draft report for founder review.
import type { XrayStore } from '../lib/xray/store.js'
import { AUTOMATED_PLANS, type XrayOrder } from '../lib/xray/types.js'
import { collectEvidence, resolveTarget, type CollectOptions } from './collectors/index.js'
import { runHarness } from './harness/pipeline.js'
import type { ModelClient } from './harness/model.js'

export const QUICK_CAP_USD = 5

export interface EngineOptions {
  client: ModelClient
  capUsd?: number
  collect?: CollectOptions
  log?: (msg: string) => void
}

/** Claims a queued order, runs it and leaves it in `review`. Returns the stored report id. */
export async function processOrder(store: XrayStore, order: XrayOrder, opts: EngineOptions): Promise<string | null> {
  const log = opts.log ?? console.log
  if (!AUTOMATED_PLANS.includes(order.plan)) {
    log(`order ${order.id}: plan ${order.plan} is delivered by hand; skipping`)
    return null
  }
  const claimed = await store.transition(order.id, ['queued'], 'running', { run_started_at: new Date().toISOString(), attempts: order.attempts + 1, last_error: null })
  if (!claimed) {
    log(`order ${order.id}: no longer queued; skipping`)
    return null
  }
  try {
    const target = resolveTarget(order.listing_url, order.website_url, order.listing_text)
    log(`order ${order.id}: collecting evidence for ${target.websiteUrl ?? target.listingUrl}`)
    const collected = await collectEvidence(target, opts.collect)
    log(`order ${order.id}: ${collected.evidence.length} evidence rows, ${collected.requestLog.length} requests`)
    const { report, meta } = await runHarness(
      { target, evidence: collected.evidence, requestLog: collected.requestLog, plan: order.plan, accessLevel: order.access_level },
      { client: opts.client, capUsd: opts.capUsd ?? QUICK_CAP_USD, log: (m) => log(`order ${order.id}: ${m}`) },
    )
    const saved = await store.saveReport(order.id, report, meta)
    await store.transition(order.id, ['running'], 'review')
    log(`order ${order.id}: report ${saved.id} ready for review (score ${report.verdict.score}, $${meta.costUsd.toFixed(3)})`)
    return saved.id
  } catch (err) {
    const msg = (err as Error).message.slice(0, 1000)
    // Back to the queue for one retry, then failed (the founder can re-run from admin).
    const next = claimed.attempts >= 2 ? 'failed' : 'queued'
    await store.transition(order.id, ['running'], next, { last_error: msg })
    log(`order ${order.id}: ${next === 'failed' ? 'failed' : 'will retry'}: ${msg}`)
    return null
  }
}

/** Orders stuck in `running` (worker died) go back to the queue after this long. */
export const STALE_RUN_MS = 45 * 60_000

export async function requeueStale(store: XrayStore, log: (m: string) => void = console.log) {
  for (const o of await store.listByStatus('running', 50)) {
    if (o.run_started_at && Date.now() - Date.parse(o.run_started_at) > STALE_RUN_MS) {
      await store.transition(o.id, ['running'], o.attempts >= 2 ? 'failed' : 'queued', { last_error: 'Worker stopped before finishing' })
      log(`order ${o.id}: stale run requeued`)
    }
  }
}
