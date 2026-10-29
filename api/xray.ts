// Mokkoi X-ray API: one function (keeps the Vercel function count low), routed by ?action=.
//
// Public:
//   POST /api/xray?action=order          create an order (starts awaiting_payment)
//   GET  /api/xray?action=order&id=      order status for the confirmation page (no email)
//   GET  /api/xray?action=report&token=  an approved report by its share token
// Founder only (Authorization: Bearer $XRAY_ADMIN_TOKEN):
//   GET  /api/xray?action=admin-orders
//   GET  /api/xray?action=admin-report&id=<report id>
//   POST /api/xray?action=admin          { op, orderId?, reportId? }
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { timingSafeEqual } from 'node:crypto'
import { sendOrderReceived, sendReportReady } from '../lib/xray/email.js'
import { getStore, type XrayStore } from '../lib/xray/store.js'
import { AUTOMATED_PLANS, type XrayOrderStatus } from '../lib/xray/types.js'
import { validateOrder } from '../lib/xray/validate.js'

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

function isAdmin(req: VercelRequest): boolean {
  const expected = process.env.XRAY_ADMIN_TOKEN ?? ''
  if (expected.length < 24) return false // not configured: admin is closed
  const got = one(req.headers.authorization).replace(/^bearer\s+/i, '')
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Light per-instance throttle on order creation (spam guard, not security).
const recent = new Map<string, number[]>()
function throttled(ip: string) {
  const now = Date.now()
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60_000)
  hits.push(now)
  recent.set(ip, hits)
  return hits.length > 8
}

async function dispatchRunner(): Promise<string> {
  const token = process.env.GITHUB_DISPATCH_TOKEN
  const repo = process.env.GITHUB_REPOSITORY_SLUG || 'RHINOREX123/mokkoi-web'
  if (!token) return 'queued; the runner picks it up on its next 10-minute cron'
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/xray-runner.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify({ ref: process.env.XRAY_RUNNER_REF || 'main' }),
  })
  return res.ok ? 'queued and runner started' : `queued; runner dispatch failed (HTTP ${res.status}), cron will pick it up`
}

async function admin(req: VercelRequest, res: VercelResponse, store: XrayStore, action: string) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Not authorised.' })

  if (action === 'admin-orders' && req.method === 'GET') {
    return res.status(200).json({ store: store.kind, orders: await store.listOrders(200) })
  }
  if (action === 'admin-report' && req.method === 'GET') {
    const r = await store.getReport(one(req.query.id as string))
    return r ? res.status(200).json(r) : res.status(404).json({ error: 'Report not found.' })
  }
  if (action !== 'admin' || req.method !== 'POST') return res.status(404).json({ error: 'Unknown action.' })

  const body = (req.body ?? {}) as { op?: string; orderId?: string; reportId?: string; paymentRef?: string }
  const order = body.orderId ? await store.getOrder(body.orderId) : null
  switch (body.op) {
    case 'mark-paid': {
      if (!order) return res.status(404).json({ error: 'Order not found.' })
      const to: XrayOrderStatus = AUTOMATED_PLANS.includes(order.plan) ? 'queued' : 'manual'
      const updated = await store.transition(order.id, ['awaiting_payment'], to, { paid_at: new Date().toISOString(), payment_ref: body.paymentRef ?? 'marked paid by founder' })
      if (!updated) return res.status(409).json({ error: `Order is ${order.status}, not awaiting payment.` })
      const note = to === 'queued' ? await dispatchRunner() : 'recorded for manual delivery'
      return res.status(200).json({ order: updated, note })
    }
    case 'run': {
      if (!order) return res.status(404).json({ error: 'Order not found.' })
      if (!AUTOMATED_PLANS.includes(order.plan)) return res.status(400).json({ error: 'Only Quick X-rays run automatically.' })
      const updated = await store.transition(order.id, ['review', 'approved', 'failed', 'queued'], 'queued', { last_error: null, attempts: 0 })
      if (!updated) return res.status(409).json({ error: `Order is ${order.status}; pay it first or wait for the current run.` })
      return res.status(200).json({ order: updated, note: await dispatchRunner() })
    }
    case 'cancel': {
      if (!order) return res.status(404).json({ error: 'Order not found.' })
      const updated = await store.transition(order.id, ['awaiting_payment', 'queued', 'review', 'manual', 'failed'], 'cancelled')
      return updated ? res.status(200).json({ order: updated }) : res.status(409).json({ error: `Order is ${order.status}.` })
    }
    case 'delivered': {
      // Full / Deep / Verified delivered by hand.
      if (!order) return res.status(404).json({ error: 'Order not found.' })
      const updated = await store.transition(order.id, ['manual'], 'approved')
      return updated ? res.status(200).json({ order: updated }) : res.status(409).json({ error: `Order is ${order.status}.` })
    }
    case 'approve': {
      const report = body.reportId ? await store.getReport(body.reportId) : null
      if (!report) return res.status(404).json({ error: 'Report not found.' })
      const approved = await store.approveReport(report.id)
      const o = await store.transition(report.order_id, ['review', 'approved'], 'approved')
      const target = o ?? (await store.getOrder(report.order_id))
      const mail = target ? await sendReportReady(target, approved.share_token).catch((e: Error) => ({ sent: false, reason: e.message })) : { sent: false, reason: 'order missing' }
      return res.status(200).json({ report: { id: approved.id, share_token: approved.share_token, status: approved.status }, email: mail })
    }
    default:
      return res.status(400).json({ error: 'Unknown op.' })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const action = one(req.query.action as string)
  let store: XrayStore
  try {
    store = getStore()
  } catch (err) {
    return res.status(503).json({ error: 'Ordering is not switched on yet. Please email mokkoidev@gmail.com.', detail: (err as Error).message })
  }

  try {
    if (action.startsWith('admin')) return await admin(req, res, store, action)

    if (action === 'order' && req.method === 'POST') {
      const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}) as Record<string, unknown>
      if (typeof body.company === 'string' && body.company) return res.status(200).json({ id: null, status: 'awaiting_payment' }) // honeypot
      const ip = one(req.headers['x-forwarded-for'] as string).split(',')[0].trim() || 'unknown'
      if (throttled(ip)) return res.status(429).json({ error: 'Too many orders from this connection. Please email us instead.' })
      const v = validateOrder(body)
      if (!v.ok) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: v.errors })
      const order = await store.createOrder({ ...v.value, terms_accepted: true, source: one(req.headers.referer as string).slice(0, 200) || null })
      await sendOrderReceived(order).catch(() => undefined)
      return res.status(201).json({ id: order.id, plan: order.plan, status: order.status })
    }

    if (action === 'order' && req.method === 'GET') {
      const id = one(req.query.id as string)
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Bad order id.' })
      const o = await store.getOrder(id)
      if (!o) return res.status(404).json({ error: 'Order not found.' })
      return res.status(200).json({ id: o.id, plan: o.plan, status: o.status, listing_url: o.listing_url, created_at: o.created_at })
    }

    if (action === 'report' && req.method === 'GET') {
      const token = one(req.query.token as string)
      if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return res.status(404).json({ error: 'Report not found.' })
      const r = await store.getReportByToken(token)
      if (!r || r.status !== 'approved') return res.status(404).json({ error: 'Report not found.' })
      res.setHeader('X-Robots-Tag', 'noindex, nofollow')
      return res.status(200).json({ report: r.report, approved_at: r.approved_at })
    }

    return res.status(404).json({ error: 'Unknown action.' })
  } catch (err) {
    console.error('xray api error', err)
    return res.status(500).json({ error: 'Something went wrong. Please try again or email mokkoidev@gmail.com.' })
  }
}
