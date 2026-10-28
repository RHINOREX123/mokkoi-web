import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FileStore, setStore } from '../lib/xray/store.js'
import type { XrayReport } from '../lib/xray/types.js'
import handler from './xray.js'

const ADMIN = 'test-admin-token-0123456789abcdef'

function call(method: string, query: Record<string, string>, body?: unknown, auth?: string) {
  let status = 200
  let json: unknown
  const req = { method, query, body, headers: auth ? { authorization: `Bearer ${auth}` } : {} } as unknown as VercelRequest
  const res = {
    setHeader() {},
    status(c: number) {
      status = c
      return res
    },
    json(d: unknown) {
      json = d
      return res
    },
  } as unknown as VercelResponse
  return Promise.resolve(handler(req, res)).then(() => ({ status, json: json as Record<string, unknown> }))
}

const report = { schemaVersion: 1, harnessVersion: 't', verdict: { score: 50, color: 'yellow' }, evidence: [] } as unknown as XrayReport

describe('api/xray', () => {
  let store: FileStore
  beforeAll(() => {
    process.env.XRAY_ADMIN_TOKEN = ADMIN
    store = new FileStore(mkdtempSync(join(tmpdir(), 'xray-api-')))
    setStore(store)
  })
  afterAll(() => setStore(undefined))

  it('rejects an invalid order with field errors', async () => {
    const r = await call('POST', { action: 'order' }, { plan: 'quick', listing_url: 'nope', email: 'x', terms: false })
    expect(r.status).toBe(400)
    expect(Object.keys(r.json.fields as object).sort()).toEqual(['email', 'listing_url', 'terms'])
  })

  it('creates an order awaiting payment', async () => {
    const r = await call('POST', { action: 'order' }, { plan: 'quick', listing_url: 'flippa.com/14580347', website_url: 'pointp.in', email: 'Buyer@Example.com', terms: true })
    expect(r.status).toBe(201)
    const o = await store.getOrder(r.json.id as string)
    expect(o).toMatchObject({ status: 'awaiting_payment', listing_url: 'https://flippa.com/14580347', website_url: 'https://pointp.in/', email: 'buyer@example.com' })
  })

  it('keeps admin closed without the token', async () => {
    expect((await call('GET', { action: 'admin-orders' })).status).toBe(401)
    expect((await call('GET', { action: 'admin-orders' }, undefined, 'wrong')).status).toBe(401)
    expect((await call('GET', { action: 'admin-orders' }, undefined, ADMIN)).status).toBe(200)
  })

  it('queues a paid Quick order and records Full orders for manual delivery', async () => {
    const quick = await store.createOrder({ plan: 'quick', listing_url: 'https://a.example', email: 'a@b.co', terms_accepted: true })
    const full = await store.createOrder({ plan: 'full', listing_url: 'https://b.example', email: 'a@b.co', terms_accepted: true })
    await call('POST', { action: 'admin' }, { op: 'mark-paid', orderId: quick.id }, ADMIN)
    await call('POST', { action: 'admin' }, { op: 'mark-paid', orderId: full.id }, ADMIN)
    expect((await store.getOrder(quick.id))?.status).toBe('queued')
    expect((await store.getOrder(full.id))?.status).toBe('manual')
  })

  it('serves a report by token only after approval', async () => {
    const o = await store.createOrder({ plan: 'quick', listing_url: 'https://c.example', email: 'a@b.co', terms_accepted: true })
    await store.transition(o.id, ['awaiting_payment'], 'review')
    const saved = await store.saveReport(o.id, report, { costUsd: 0.4, modelUsage: {}, allFindings: [], durationMs: 1 })
    expect((await call('GET', { action: 'report', token: saved.share_token })).status).toBe(404)
    const a = await call('POST', { action: 'admin' }, { op: 'approve', orderId: o.id, reportId: saved.id }, ADMIN)
    expect(a.status).toBe(200)
    const r = await call('GET', { action: 'report', token: saved.share_token })
    expect(r.status).toBe(200)
    expect((await store.getOrder(o.id))?.status).toBe('approved')
  })
})
