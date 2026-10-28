// Storage for X-ray orders and reports (server-side only: API routes and the worker).
//
// Two backends with one interface:
//   * SupabaseStore: used whenever SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
//   * FileStore: a JSON file for local development and tests (XRAY_DATA_DIR, default .xray-data/).
//     Never used on Vercel (the filesystem there is read-only and per-instance).
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PLAN_ACCESS_LEVEL, type Evidence, type Finding, type XrayOrder, type XrayOrderStatus, type XrayPlan, type XrayReport, type XrayRunMeta } from './types.js'

export interface NewOrder {
  plan: XrayPlan
  listing_url: string
  website_url?: string | null
  email: string
  notes?: string | null
  listing_text?: string | null
  terms_accepted: boolean
  source?: string | null
}

export type ReportStatus = 'draft' | 'approved' | 'superseded'

export interface StoredReport {
  id: string
  order_id: string
  created_at: string
  status: ReportStatus
  approved_at: string | null
  share_token: string
  harness_version: string
  score: number | null
  verdict: string | null
  cost_usd: number
  model_usage: Record<string, unknown>
  report: XrayReport
}

export type ReportSummary = Omit<StoredReport, 'report' | 'model_usage'>

export interface OrderWithReport extends XrayOrder {
  latest_report: ReportSummary | null
}

export type OrderPatch = Partial<Pick<XrayOrder, 'status' | 'paid_at' | 'payment_ref' | 'attempts' | 'last_error' | 'run_started_at' | 'notes'>>

export interface XrayStore {
  readonly kind: 'supabase' | 'file'
  createOrder(input: NewOrder): Promise<XrayOrder>
  getOrder(id: string): Promise<XrayOrder | null>
  listOrders(limit?: number): Promise<OrderWithReport[]>
  updateOrder(id: string, patch: OrderPatch): Promise<XrayOrder>
  /** Atomically move one order from `from` to `to`. Returns null if it was not in `from`. */
  transition(id: string, from: XrayOrderStatus[], to: XrayOrderStatus, patch?: OrderPatch): Promise<XrayOrder | null>
  listByStatus(status: XrayOrderStatus, limit?: number): Promise<XrayOrder[]>
  saveReport(orderId: string, report: XrayReport, meta: XrayRunMeta): Promise<StoredReport>
  getReport(id: string): Promise<StoredReport | null>
  getLatestReport(orderId: string): Promise<StoredReport | null>
  getReportByToken(token: string): Promise<StoredReport | null>
  approveReport(id: string): Promise<StoredReport>
}

export function newShareToken(): string {
  return randomBytes(24).toString('base64url') // 32 chars, 192 bits
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

let cached: XrayStore | undefined

/** The store for this process. Throws on Vercel when Supabase isn't configured (fails closed). */
export function getStore(): XrayStore {
  if (cached) return cached
  if (supabaseConfigured()) {
    cached = new SupabaseStore(createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }))
  } else if (process.env.VERCEL) {
    throw new Error('X-ray storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).')
  } else {
    cached = new FileStore(process.env.XRAY_DATA_DIR || '.xray-data')
  }
  return cached
}

/** For tests. */
export function setStore(store: XrayStore | undefined) {
  cached = store
}

function summarize(r: StoredReport): ReportSummary {
  const { report: _report, model_usage: _usage, ...rest } = r
  return rest
}

function reportRow(orderId: string, report: XrayReport, meta: XrayRunMeta) {
  return {
    order_id: orderId,
    status: 'draft' as ReportStatus,
    share_token: newShareToken(),
    harness_version: report.harnessVersion,
    score: report.verdict.score,
    verdict: report.verdict.color,
    cost_usd: Math.round(meta.costUsd * 10000) / 10000,
    model_usage: meta.modelUsage as Record<string, unknown>,
    report,
  }
}

function evidenceRows(reportId: string, evidence: Evidence[]) {
  return evidence.map((e) => ({
    report_id: reportId,
    evidence_key: e.key,
    collector: e.collector,
    title: e.title,
    summary: e.summary,
    source_url: e.sourceUrl ?? null,
    data: e.data,
    fetched_at: e.fetchedAt,
  }))
}

function findingRows(reportId: string, findings: Finding[]) {
  return findings.map((f) => ({
    report_id: reportId,
    finding_key: f.key,
    section: f.section,
    severity: f.severity,
    title: f.title,
    detail: f.detail,
    evidence_keys: f.evidenceKeys,
    status: f.status,
    skeptic_reason: f.skepticReason ?? null,
  }))
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

export class SupabaseStore implements XrayStore {
  readonly kind = 'supabase' as const
  private db: SupabaseClient

  constructor(db: SupabaseClient) {
    this.db = db
  }

  async createOrder(input: NewOrder): Promise<XrayOrder> {
    const { data, error } = await this.db
      .from('xray_orders')
      .insert({ ...input, access_level: PLAN_ACCESS_LEVEL[input.plan], status: 'awaiting_payment' })
      .select()
      .single()
    if (error) throw new Error(`createOrder: ${error.message}`)
    return data as XrayOrder
  }

  async getOrder(id: string) {
    const { data, error } = await this.db.from('xray_orders').select().eq('id', id).maybeSingle()
    if (error) throw new Error(`getOrder: ${error.message}`)
    return (data as XrayOrder) ?? null
  }

  async listOrders(limit = 100): Promise<OrderWithReport[]> {
    const { data, error } = await this.db.from('xray_orders').select().order('created_at', { ascending: false }).limit(limit)
    if (error) throw new Error(`listOrders: ${error.message}`)
    const orders = (data ?? []) as XrayOrder[]
    if (orders.length === 0) return []
    const { data: reps, error: rErr } = await this.db
      .from('xray_reports')
      .select('id, order_id, created_at, status, approved_at, share_token, harness_version, score, verdict, cost_usd')
      .in('order_id', orders.map((o) => o.id))
      .order('created_at', { ascending: false })
    if (rErr) throw new Error(`listOrders reports: ${rErr.message}`)
    const latest = new Map<string, ReportSummary>()
    for (const r of (reps ?? []) as ReportSummary[]) if (!latest.has(r.order_id)) latest.set(r.order_id, { ...r, cost_usd: Number(r.cost_usd) })
    return orders.map((o) => ({ ...o, latest_report: latest.get(o.id) ?? null }))
  }

  async updateOrder(id: string, patch: OrderPatch) {
    const { data, error } = await this.db.from('xray_orders').update(patch).eq('id', id).select().single()
    if (error) throw new Error(`updateOrder: ${error.message}`)
    return data as XrayOrder
  }

  async transition(id: string, from: XrayOrderStatus[], to: XrayOrderStatus, patch: OrderPatch = {}) {
    const { data, error } = await this.db
      .from('xray_orders')
      .update({ ...patch, status: to })
      .eq('id', id)
      .in('status', from)
      .select()
    if (error) throw new Error(`transition: ${error.message}`)
    return ((data ?? [])[0] as XrayOrder) ?? null
  }

  async listByStatus(status: XrayOrderStatus, limit = 10) {
    const { data, error } = await this.db.from('xray_orders').select().eq('status', status).order('created_at').limit(limit)
    if (error) throw new Error(`listByStatus: ${error.message}`)
    return (data ?? []) as XrayOrder[]
  }

  async saveReport(orderId: string, report: XrayReport, meta: XrayRunMeta) {
    const { data, error } = await this.db.from('xray_reports').insert(reportRow(orderId, report, meta)).select().single()
    if (error) throw new Error(`saveReport: ${error.message}`)
    const saved = data as StoredReport
    if (report.evidence.length) {
      const { error: eErr } = await this.db.from('xray_evidence').insert(evidenceRows(saved.id, report.evidence))
      if (eErr) throw new Error(`saveReport evidence: ${eErr.message}`)
    }
    if (meta.allFindings.length) {
      const { error: fErr } = await this.db.from('xray_findings').insert(findingRows(saved.id, meta.allFindings))
      if (fErr) throw new Error(`saveReport findings: ${fErr.message}`)
    }
    return { ...saved, cost_usd: Number(saved.cost_usd) }
  }

  private async oneReport(column: 'id' | 'share_token', value: string) {
    const { data, error } = await this.db.from('xray_reports').select().eq(column, value).maybeSingle()
    if (error) throw new Error(`getReport: ${error.message}`)
    return data ? ({ ...data, cost_usd: Number(data.cost_usd) } as StoredReport) : null
  }

  getReport(id: string) {
    return this.oneReport('id', id)
  }

  getReportByToken(token: string) {
    return this.oneReport('share_token', token)
  }

  async getLatestReport(orderId: string) {
    const { data, error } = await this.db.from('xray_reports').select().eq('order_id', orderId).order('created_at', { ascending: false }).limit(1)
    if (error) throw new Error(`getLatestReport: ${error.message}`)
    const r = (data ?? [])[0]
    return r ? ({ ...r, cost_usd: Number(r.cost_usd) } as StoredReport) : null
  }

  async approveReport(id: string) {
    const current = await this.getReport(id)
    if (!current) throw new Error('approveReport: report not found')
    const { error: supErr } = await this.db
      .from('xray_reports')
      .update({ status: 'superseded' })
      .eq('order_id', current.order_id)
      .eq('status', 'approved')
      .neq('id', id)
    if (supErr) throw new Error(`approveReport supersede: ${supErr.message}`)
    const { data, error } = await this.db
      .from('xray_reports')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(`approveReport: ${error.message}`)
    return { ...data, cost_usd: Number(data.cost_usd) } as StoredReport
  }
}

// ---------------------------------------------------------------------------
// Local JSON file (dev and tests)
// ---------------------------------------------------------------------------

interface FileDb {
  orders: XrayOrder[]
  reports: StoredReport[]
  evidence: ReturnType<typeof evidenceRows>
  findings: ReturnType<typeof findingRows>
}

export class FileStore implements XrayStore {
  readonly kind = 'file' as const
  private file: string

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'db.json')
  }

  private load(): FileDb {
    if (!existsSync(this.file)) return { orders: [], reports: [], evidence: [], findings: [] }
    return JSON.parse(readFileSync(this.file, 'utf8')) as FileDb
  }

  private save(db: FileDb) {
    const tmp = `${this.file}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(db, null, 2))
    renameSync(tmp, this.file)
  }

  async createOrder(input: NewOrder): Promise<XrayOrder> {
    const db = this.load()
    const now = new Date().toISOString()
    const order: XrayOrder = {
      id: randomUUID(),
      created_at: now,
      updated_at: now,
      plan: input.plan,
      access_level: PLAN_ACCESS_LEVEL[input.plan],
      listing_url: input.listing_url,
      website_url: input.website_url ?? null,
      email: input.email,
      notes: input.notes ?? null,
      listing_text: input.listing_text ?? null,
      status: 'awaiting_payment',
      paid_at: null,
      payment_ref: null,
      user_id: null,
      terms_accepted: input.terms_accepted,
      seller_consent: false,
      attempts: 0,
      last_error: null,
      run_started_at: null,
      source: input.source ?? null,
    }
    db.orders.push(order)
    this.save(db)
    return order
  }

  async getOrder(id: string) {
    return this.load().orders.find((o) => o.id === id) ?? null
  }

  async listOrders(limit = 100): Promise<OrderWithReport[]> {
    const db = this.load()
    return [...db.orders]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((o) => {
        const latest = db.reports.filter((r) => r.order_id === o.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
        return { ...o, latest_report: latest ? summarize(latest) : null }
      })
  }

  async updateOrder(id: string, patch: OrderPatch) {
    const db = this.load()
    const o = db.orders.find((x) => x.id === id)
    if (!o) throw new Error('updateOrder: order not found')
    Object.assign(o, patch, { updated_at: new Date().toISOString() })
    this.save(db)
    return o
  }

  async transition(id: string, from: XrayOrderStatus[], to: XrayOrderStatus, patch: OrderPatch = {}) {
    const db = this.load()
    const o = db.orders.find((x) => x.id === id)
    if (!o || !from.includes(o.status)) return null
    Object.assign(o, patch, { status: to, updated_at: new Date().toISOString() })
    this.save(db)
    return o
  }

  async listByStatus(status: XrayOrderStatus, limit = 10) {
    return this.load()
      .orders.filter((o) => o.status === status)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, limit)
  }

  async saveReport(orderId: string, report: XrayReport, meta: XrayRunMeta) {
    const db = this.load()
    const saved: StoredReport = { id: randomUUID(), created_at: new Date().toISOString(), approved_at: null, ...reportRow(orderId, report, meta) }
    db.reports.push(saved)
    db.evidence.push(...evidenceRows(saved.id, report.evidence))
    db.findings.push(...findingRows(saved.id, meta.allFindings))
    this.save(db)
    return saved
  }

  async getReport(id: string) {
    return this.load().reports.find((r) => r.id === id) ?? null
  }

  async getReportByToken(token: string) {
    return this.load().reports.find((r) => r.share_token === token) ?? null
  }

  async getLatestReport(orderId: string) {
    return this.load().reports.filter((r) => r.order_id === orderId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  }

  async approveReport(id: string) {
    const db = this.load()
    const r = db.reports.find((x) => x.id === id)
    if (!r) throw new Error('approveReport: report not found')
    for (const other of db.reports) if (other.order_id === r.order_id && other.status === 'approved' && other.id !== id) other.status = 'superseded'
    r.status = 'approved'
    r.approved_at = new Date().toISOString()
    this.save(db)
    return r
  }
}
