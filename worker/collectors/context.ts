import type { Evidence } from '../../lib/xray/types.js'
import type { HttpResponse, SafeHttp } from '../lib/http.js'

export interface Target {
  listingUrl: string
  /** The business's own website, if known (from the order, or the listing URL itself). */
  websiteUrl?: string
  /** Listing details the buyer pasted into the order form. */
  listingText?: string
}

/** Collects evidence rows and hands out stable keys (E1, E2, ...). */
export class EvidenceLog {
  readonly items: Evidence[] = []

  add(e: Omit<Evidence, 'key' | 'fetchedAt'> & { fetchedAt?: string }): string {
    const key = `E${this.items.length + 1}`
    this.items.push({ ...e, key, fetchedAt: e.fetchedAt ?? new Date().toISOString() })
    return key
  }

  get(key: string) {
    return this.items.find((e) => e.key === key)
  }
}

/** Values one collector produces for another (e.g. the homepage HTML for the bundle scan). */
export interface Shared {
  homepage?: HttpResponse
  websiteHost?: string
  /** Hosts on the target's domain worth a DNS lookup (API subdomains etc.). */
  relatedHosts: Set<string>
  /** Third-party backends the front end talks to (Supabase, Firebase...). */
  backends: { kind: string; host: string; evidenceKey: string }[]
  pricingUrl?: string
  robotsDisallow: string[]
}

export interface CollectorContext {
  http: SafeHttp
  target: Target
  evidence: EvidenceLog
  shared: Shared
  env: { pagespeedKey?: string; skipPagespeed?: boolean }
}

export interface Collector {
  name: string
  run(ctx: CollectorContext): Promise<void>
}

/** True if robots.txt (User-agent: *) disallows this path for us. */
export function robotsBlocks(ctx: CollectorContext, url: string): boolean {
  const path = new URL(url).pathname
  return ctx.shared.robotsDisallow.some((rule) => {
    if (!rule) return false
    const rx = new RegExp('^' + rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'))
    return rx.test(path)
  })
}
