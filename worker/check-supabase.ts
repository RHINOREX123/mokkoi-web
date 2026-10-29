// Smoke test for the X-ray tables on the real Supabase project (no Claude calls).
//   npx tsx worker/check-supabase.ts
// Creates a test order, walks it through the statuses, stores a report with evidence and
// findings, checks the anon key can't read anything, then deletes what it created.
import { createClient } from '@supabase/supabase-js'
import { SupabaseStore } from '../lib/xray/store.js'
import type { XrayReport } from '../lib/xray/types.js'
import { loadEnv } from './lib/env.js'

loadEnv()
const url = process.env.SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY
if (!url || !service || !anonKey) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY must be set.')
  process.exit(1)
}

const admin = createClient(url, service, { auth: { persistSession: false } })
const store = new SupabaseStore(admin)
const ok = (label: string, cond: boolean, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ` (${detail})` : ''}`)
  if (!cond) process.exitCode = 1
}

const report = {
  schemaVersion: 1,
  harnessVersion: 'smoke-test',
  generatedAt: new Date().toISOString(),
  plan: 'quick',
  accessLevel: 0,
  target: { listingUrl: 'https://example.com/smoke' },
  verdict: { color: 'yellow', score: 55, headline: 'smoke', summary: [] },
  claims: [],
  redFlags: [],
  strengths: [],
  questions: [],
  verifyBeforeClosing: [],
  valuation: null,
  first30Days: [],
  limits: [],
  evidence: [{ key: 'E1', collector: 'smoke', title: 't', summary: 's', data: {}, fetchedAt: new Date().toISOString() }],
  requestLog: [],
} as XrayReport

let orderId: string | undefined
try {
  const o = await store.createOrder({ plan: 'quick', listing_url: 'https://example.com/smoke', email: 'smoke-test@example.com', terms_accepted: true, source: 'check-supabase' })
  orderId = o.id
  ok('create order', o.status === 'awaiting_payment' && o.access_level === 0)
  ok('mark paid -> queued', (await store.transition(o.id, ['awaiting_payment'], 'queued', { paid_at: new Date().toISOString() }))?.status === 'queued')
  ok('second claim is refused', (await store.transition(o.id, ['awaiting_payment'], 'queued')) === null)
  ok('worker claims it', (await store.transition(o.id, ['queued'], 'running'))?.status === 'running')
  const saved = await store.saveReport(o.id, report, {
    costUsd: 0.1234,
    modelUsage: {},
    allFindings: [{ key: 'F1', section: 'tech_security', severity: 'low', title: 't', detail: 'd', evidenceKeys: ['E1'], status: 'kept' }],
    durationMs: 1,
  })
  ok('save report + evidence + findings', saved.share_token.length >= 32 && saved.cost_usd === 0.1234)
  ok('draft is not approved', (await store.getReportByToken(saved.share_token))?.status === 'draft')
  await store.approveReport(saved.id)
  ok('approve', (await store.getReportByToken(saved.share_token))?.status === 'approved')
  const listed = (await store.listOrders(20)).find((x) => x.id === o.id)
  ok('admin list joins latest report', listed?.latest_report?.id === saved.id)

  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  for (const t of ['xray_orders', 'xray_reports', 'xray_evidence', 'xray_findings']) {
    const { data, error } = await anon.from(t).select('*').limit(1)
    ok(`anon cannot read ${t}`, Boolean(error) || (data ?? []).length === 0, error?.message ?? `${(data ?? []).length} rows`)
  }
} catch (err) {
  ok('smoke test ran', false, (err as Error).message)
} finally {
  if (orderId) {
    const { error } = await admin.from('xray_orders').delete().eq('id', orderId) // cascades to report, evidence, findings
    ok('cleanup', !error, error?.message ?? '')
  }
}
