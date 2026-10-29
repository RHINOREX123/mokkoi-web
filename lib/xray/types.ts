// Mokkoi X-ray domain types, shared by the API, the report worker and the web pages.
// Pure TypeScript (no runtime deps) so the browser bundle can import it.

export type XrayPlan = 'quick' | 'full' | 'deep' | 'verified'

export type XrayOrderStatus =
  | 'awaiting_payment'
  | 'queued'
  | 'running'
  | 'review'
  | 'approved'
  | 'manual'
  | 'failed'
  | 'cancelled'

export const PLAN_LABELS: Record<XrayPlan, string> = {
  quick: 'Quick X-ray',
  full: 'Full X-ray',
  deep: 'Deep X-ray',
  verified: 'Mokkoi Verified',
}

/** Only Quick X-rays are produced by the engine; the rest are recorded and delivered by hand. */
export const AUTOMATED_PLANS: readonly XrayPlan[] = ['quick']

export const PLAN_ACCESS_LEVEL: Record<XrayPlan, 0 | 1 | 2> = { quick: 0, full: 1, deep: 2, verified: 1 }

export interface XrayOrder {
  id: string
  created_at: string
  updated_at: string
  plan: XrayPlan
  access_level: 0 | 1 | 2
  listing_url: string
  website_url: string | null
  email: string
  notes: string | null
  listing_text: string | null
  status: XrayOrderStatus
  paid_at: string | null
  payment_ref: string | null
  user_id: string | null
  terms_accepted: boolean
  seller_consent: boolean
  attempts: number
  last_error: string | null
  run_started_at: string | null
  source: string | null
}

// ---------------------------------------------------------------------------
// Evidence and findings
// ---------------------------------------------------------------------------

/** One collector result. Every finding in a report must cite at least one evidence key. */
export interface Evidence {
  key: string // "E1", "E2", ...
  collector: string
  title: string
  summary: string
  sourceUrl?: string
  data: Record<string, unknown>
  fetchedAt: string
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

export type SectionKey = 'listing_financials' | 'tech_security' | 'traffic_seo' | 'market_platform' | 'transferability'

export const SECTION_TITLES: Record<SectionKey, string> = {
  listing_financials: 'Listing claims and financials',
  tech_security: 'Tech and security',
  traffic_seo: 'Traffic and SEO',
  market_platform: 'Market and platform risk',
  transferability: 'Transferability',
}

export type FindingStatus = 'kept' | 'downgraded' | 'dropped' | 'rejected'

export interface Finding {
  key: string // "F1", ...
  section: SectionKey
  severity: Severity
  title: string
  detail: string
  evidenceKeys: string[]
  status: FindingStatus
  skepticReason?: string
}

export type ClaimStatus = 'verified' | 'unverified' | 'contradicted'

export interface ClaimCheck {
  claim: string
  status: ClaimStatus
  finding: string
  evidenceKeys: string[]
}

export interface EvidencedPoint {
  text: string
  evidenceKeys: string[]
}

export interface RequestLogEntry {
  method: 'GET' | 'HEAD' | 'TLS'
  url: string
  status?: number
  ms: number
  at: string
  error?: string
}

export type VerdictColor = 'green' | 'yellow' | 'red'

/** The report as stored in xray_reports.report and rendered at /r/:token. */
export interface XrayReport {
  schemaVersion: 1
  harnessVersion: string
  generatedAt: string
  plan: XrayPlan
  accessLevel: 0 | 1 | 2
  target: {
    listingUrl: string
    websiteUrl?: string
    title?: string
    marketplace?: 'flippa' | 'acquire' | 'website'
  }
  verdict: {
    color: VerdictColor
    score: number
    headline: string
    summary: string[]
  }
  claims: ClaimCheck[]
  /** Kept findings, most severe first. */
  redFlags: Finding[]
  strengths: EvidencedPoint[]
  questions: string[]
  verifyBeforeClosing: string[]
  valuation: string | null
  first30Days: string[]
  /** What this level could not see (e.g. Flippa's login-only tabs). */
  limits: string[]
  evidence: Evidence[]
  requestLog: RequestLogEntry[]
}

/** Engine-side bookkeeping returned alongside a report (never shown to customers). */
export interface XrayRunMeta {
  costUsd: number
  modelUsage: Record<string, { calls: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number }>
  allFindings: Finding[]
  durationMs: number
  aborted?: string
}

// ---------------------------------------------------------------------------
// Stored rows (as returned by the store and the admin API)
// ---------------------------------------------------------------------------

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

export const REPORT_DISCLAIMER =
  'Informational only. Not legal, financial or investment advice. Verify before you buy.'
