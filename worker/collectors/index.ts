// Runs the plain-code collectors in order. A failing collector becomes an evidence row
// saying so; it never stops the report.
import { SafeHttp, type FixtureMode } from '../lib/http.js'
import { registrableDomain } from '../lib/html.js'
import { bundleCollector } from './bundle.js'
import { EvidenceLog, type Collector, type CollectorContext, type Target } from './context.js'
import { dnsCollector, rdapCollector, tlsCollector } from './domain.js'
import { pagespeedCollector, waybackCollector } from './history.js'
import { listingCollector, marketplaceOf } from './listing.js'
import { siteCollector } from './site.js'

export const COLLECTORS: Collector[] = [listingCollector, siteCollector, dnsCollector, rdapCollector, tlsCollector, bundleCollector, waybackCollector, pagespeedCollector]

export interface CollectOptions {
  mode?: FixtureMode
  fixtureDir?: string
  pagespeedKey?: string
  skipPagespeed?: boolean
  only?: string[]
}

/** Normalise the order's URLs: a non-marketplace listing URL is the website itself. */
export function resolveTarget(listingUrl: string, websiteUrl?: string | null, listingText?: string | null): Target {
  const website = websiteUrl?.trim() || (marketplaceOf(listingUrl) ? undefined : listingUrl)
  return { listingUrl, websiteUrl: website ? normaliseUrl(website) : undefined, listingText: listingText ?? undefined }
}

export function normaliseUrl(u: string): string {
  const withScheme = /^https?:\/\//i.test(u) ? u : `https://${u}`
  const url = new URL(withScheme)
  url.hash = ''
  return url.toString()
}

export async function collectEvidence(target: Target, opts: CollectOptions = {}) {
  const domains = target.websiteUrl ? [registrableDomain(new URL(target.websiteUrl).hostname)] : []
  const http = new SafeHttp({ targetDomains: domains, mode: opts.mode, fixtureDir: opts.fixtureDir })
  const ctx: CollectorContext = {
    http,
    target,
    evidence: new EvidenceLog(),
    shared: { relatedHosts: new Set(), backends: [], robotsDisallow: [] },
    env: { pagespeedKey: opts.pagespeedKey, skipPagespeed: opts.skipPagespeed },
  }
  const timings: Record<string, number> = {}
  for (const c of COLLECTORS) {
    if (opts.only && !opts.only.includes(c.name)) continue
    const t0 = Date.now()
    try {
      await c.run(ctx)
    } catch (err) {
      ctx.evidence.add({ collector: c.name, title: `${c.name} check failed`, summary: `This check could not complete: ${(err as Error).message}`, data: { error: (err as Error).message } })
    }
    timings[c.name] = Date.now() - t0
  }
  return { evidence: ctx.evidence.items, requestLog: http.log, shared: ctx.shared, timings }
}
