// Site history from the Wayback Machine (CDX API) and pricing-page history, plus PageSpeed.
import { htmlToText, priceSnippets, registrableDomain } from '../lib/html.js'
import type { Collector, CollectorContext } from './context.js'
import { robotsBlocks } from './context.js'

interface Snapshot {
  timestamp: string
  original: string
}

async function cdx(ctx: CollectorContext, url: string, perYear = true, limit = 40): Promise<Snapshot[]> {
  const q = new URLSearchParams({ url, output: 'json', fl: 'timestamp,original', filter: 'statuscode:200', limit: String(limit) })
  if (perYear) q.set('collapse', 'timestamp:4')
  const res = await ctx.http.get(`https://web.archive.org/cdx/search/cdx?${q}`, { accept: 'application/json', timeoutMs: 30_000 })
  if (res.status !== 200 || !res.body.trim()) return []
  const rows = JSON.parse(res.body) as string[][]
  return rows.slice(1).map(([timestamp, original]) => ({ timestamp, original }))
}

const day = (ts: string) => `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`

/** Spread picks: first, last and evenly spaced ones in between. */
function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items
  const out: T[] = []
  for (let i = 0; i < n; i++) out.push(items[Math.round((i * (items.length - 1)) / (n - 1))])
  return [...new Set(out)]
}

export const waybackCollector: Collector = {
  name: 'wayback',
  async run(ctx: CollectorContext) {
    const host = ctx.shared.websiteHost
    if (!host) return
    const apex = registrableDomain(host)
    const snaps = await cdx(ctx, apex).catch((e: Error) => e)
    if (snaps instanceof Error) {
      ctx.evidence.add({ collector: 'wayback', title: 'Wayback Machine unavailable', summary: snaps.message, data: {} })
      return
    }
    const years = [...new Set(snaps.map((s) => s.timestamp.slice(0, 4)))]
    ctx.evidence.add({
      collector: 'wayback',
      title: `Wayback Machine history for ${apex}`,
      summary: snaps.length
        ? `Archived homepage snapshots in ${years.length} distinct year(s): first ${day(snaps[0].timestamp)}, latest ${day(snaps[snaps.length - 1].timestamp)}. Years: ${years.join(', ')}.`
        : 'No archived snapshots of the homepage.',
      sourceUrl: `https://web.archive.org/web/*/${apex}`,
      data: { years, first: snaps[0]?.timestamp ?? null, last: snaps.at(-1)?.timestamp ?? null, snapshots: snaps.map((s) => s.timestamp) },
    })

    // How did the homepage pitch change? Compare the oldest and a middle snapshot's title/text.
    const homeSamples = spread(snaps, 3)
    const homeHistory = []
    for (const s of homeSamples) {
      const r = await ctx.http.get(`https://web.archive.org/web/${s.timestamp}id_/${s.original}`, { accept: 'text/html', timeoutMs: 30_000, maxBytes: 1_500_000 }).catch(() => undefined)
      if (!r || r.status !== 200) continue
      const text = htmlToText(r.body).replace(/\s+/g, ' ')
      homeHistory.push({ date: day(s.timestamp), title: r.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim().slice(0, 140) ?? '', excerpt: text.slice(0, 400) })
    }
    if (homeHistory.length) {
      ctx.evidence.add({
        collector: 'wayback',
        title: 'Archived homepage pitch over time',
        summary: homeHistory.map((h) => `${h.date}: "${h.title}"`).join(' → '),
        sourceUrl: `https://web.archive.org/web/*/${apex}`,
        data: { samples: homeHistory },
      })
    }

    // Pricing page history: same page, years apart.
    const pricingUrl = ctx.shared.pricingUrl
    if (!pricingUrl) return
    const now = robotsBlocks(ctx, pricingUrl) ? undefined : await ctx.http.get(pricingUrl, { accept: 'text/html' }).catch(() => undefined)
    const pSnaps = await cdx(ctx, pricingUrl.replace(/^https?:\/\//, '')).catch(() => [] as Snapshot[])
    const history: { date: string; source: string; snippets: string[] }[] = []
    for (const s of spread(pSnaps, 3)) {
      const r = await ctx.http.get(`https://web.archive.org/web/${s.timestamp}id_/${s.original}`, { accept: 'text/html', timeoutMs: 30_000, maxBytes: 1_500_000 }).catch(() => undefined)
      if (r?.status === 200) history.push({ date: day(s.timestamp), source: `https://web.archive.org/web/${s.timestamp}/${s.original}`, snippets: priceSnippets(htmlToText(r.body).replace(/\s+/g, ' '), 16) })
    }
    if (now?.status === 200) history.push({ date: new Date().toISOString().slice(0, 10), source: pricingUrl, snippets: priceSnippets(htmlToText(now.body).replace(/\s+/g, ' '), 16) })
    ctx.evidence.add({
      collector: 'pricing-history',
      title: 'Pricing page over time',
      summary: history.length
        ? `Pricing text captured at ${history.map((h) => h.date).join(', ')} (${pSnaps.length} archived snapshot year(s)). Compare plan prices and limits across dates in the data.`
        : 'No pricing page history available.',
      sourceUrl: pricingUrl,
      data: { pricingUrl, history },
    })
  },
}

export const pagespeedCollector: Collector = {
  name: 'pagespeed',
  async run(ctx: CollectorContext) {
    const home = ctx.shared.homepage
    if (!home || ctx.env.skipPagespeed) return
    const q = new URLSearchParams({ url: home.finalUrl, strategy: 'mobile', category: 'performance' })
    if (ctx.env.pagespeedKey) q.set('key', ctx.env.pagespeedKey)
    // The request URL may carry an API key, so it is never stored as a source link.
    const res = await ctx.http.get(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { accept: 'application/json', timeoutMs: 90_000, maxBytes: 8_000_000 }).catch((e: Error) => e)
    const publicUrl = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(home.finalUrl)}`
    if (res instanceof Error || res.status !== 200) {
      ctx.evidence.add({ collector: 'pagespeed', title: 'PageSpeed Insights unavailable', summary: res instanceof Error ? res.message : `HTTP ${res.status} (rate limit without an API key is common).`, sourceUrl: publicUrl, data: {} })
      return
    }
    type Audit = { numericValue?: number; displayValue?: string }
    const j = JSON.parse(res.body) as { lighthouseResult?: { categories?: { performance?: { score?: number } }; audits?: Record<string, Audit> } }
    const lh = j.lighthouseResult
    const a = (id: string) => lh?.audits?.[id]
    const score = lh?.categories?.performance?.score
    ctx.evidence.add({
      collector: 'pagespeed',
      title: 'PageSpeed Insights (mobile)',
      summary: `Performance ${score !== undefined ? Math.round(score * 100) : '?'} / 100. LCP ${a('largest-contentful-paint')?.displayValue ?? '?'}, TBT ${a('total-blocking-time')?.displayValue ?? '?'}, CLS ${a('cumulative-layout-shift')?.displayValue ?? '?'}, page weight ${a('total-byte-weight')?.displayValue ?? '?'}.`,
      sourceUrl: publicUrl,
      data: {
        performance: score !== undefined ? Math.round(score * 100) : null,
        lcpMs: a('largest-contentful-paint')?.numericValue ?? null,
        tbtMs: a('total-blocking-time')?.numericValue ?? null,
        cls: a('cumulative-layout-shift')?.numericValue ?? null,
        totalBytes: a('total-byte-weight')?.numericValue ?? null,
        ttfbMs: a('server-response-time')?.numericValue ?? null,
      },
    })
  },
}
