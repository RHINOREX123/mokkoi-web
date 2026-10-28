// Public marketplace listing parser (Flippa today; Acquire listings are login-only).
// Reads the public listing page only. Flippa's traffic and financial tabs need a login,
// so we never see them; the buyer can paste details into the order form instead.
import { firstHeading, htmlToText, metaTags, pageTitle } from '../lib/html.js'
import type { Collector, CollectorContext } from './context.js'

export function marketplaceOf(url: string): 'flippa' | 'acquire' | undefined {
  const host = new URL(url).hostname.toLowerCase()
  if (host === 'flippa.com' || host.endsWith('.flippa.com')) return 'flippa'
  if (host === 'acquire.com' || host.endsWith('.acquire.com')) return 'acquire'
  return undefined
}

const MONEY = String.raw`(?:USD\s*)?\$\s?([\d,.]+\s?[kKmM]?)`

/** Labelled metrics as Flippa renders them in the listing's summary panel. */
const FLIPPA_FIELDS: { key: string; re: RegExp }[] = [
  { key: 'asking_price', re: new RegExp(String.raw`Asking Price(?:\s*\([^)]*\))?\s*${MONEY}`, 'i') },
  { key: 'starting_bid', re: new RegExp(String.raw`Starting Bid(?: Price)?\s*${MONEY}`, 'i') },
  { key: 'current_bid', re: new RegExp(String.raw`Current Bid(?: Price)?\s*${MONEY}`, 'i') },
  { key: 'buy_it_now', re: new RegExp(String.raw`Buy It Now\s*${MONEY}`, 'i') },
  { key: 'monthly_profit', re: new RegExp(String.raw`Monthly Profit\s*${MONEY}`, 'i') },
  { key: 'monthly_revenue', re: new RegExp(String.raw`Monthly Revenue\s*${MONEY}`, 'i') },
  { key: 'profit_margin', re: /Profit Margin\s*(-?[\d.]+)\s*%/i },
  { key: 'profit_multiple', re: /Profit Multiple\s*([\d.]+)\s*x/i },
  { key: 'revenue_multiple', re: /Revenue Multiple\s*([\d.]+)\s*x/i },
  { key: 'mrr', re: new RegExp(String.raw`\bMRR\s*${MONEY}`) },
  { key: 'active_subscribers', re: /Total Active Subscribers\s*([\d,]+)/i },
  { key: 'churn', re: /Overall Churn\s*([\d.]+)\s*%/i },
  { key: 'site_age', re: /Site Age\s*([\d.]+\s*(?:years?|months?|days?))/i },
  { key: 'business_location', re: /Business Location\s*([A-Z][A-Za-z .]+?)(?=\s+(?:Site Age|Monthly|Profit|$))/ },
  { key: 'reserve', re: /(Reserve (?:not )?met)/i },
]

export function parseFlippa(html: string) {
  const text = htmlToText(html)
  const flat = text.replace(/\s+/g, ' ')
  const meta = metaTags(html)
  const fields: Record<string, string> = {}
  for (const f of FLIPPA_FIELDS) {
    const m = flat.match(f.re)
    if (m) fields[f.key] = m[1].trim()
  }
  const title = firstHeading(html) || pageTitle(html) || meta['og:title'] || ''
  // Skip the site navigation: the listing content starts at its tab bar
  // ("Description Financials ..."). The summary fields above are exact; the body is a
  // bounded slice of visible text for the model.
  const tabs = flat.search(/Description Financials/)
  const start = tabs >= 0 ? tabs : 0
  const body = flat.slice(start, start + 9000)
  return { title, description: meta['og:description'] || meta.description || '', fields, body }
}

export const listingCollector: Collector = {
  name: 'listing',
  async run(ctx: CollectorContext) {
    const { target, evidence } = ctx
    const market = marketplaceOf(target.listingUrl)

    if (target.listingText?.trim()) {
      evidence.add({
        collector: 'listing',
        title: 'Listing details supplied by the buyer',
        summary: 'Text the buyer pasted into the order form (for example Flippa tabs that need a login). Treated as claims, not facts.',
        data: { text: target.listingText.trim().slice(0, 20000) },
      })
    }

    if (!market) return
    if (market === 'acquire') {
      evidence.add({
        collector: 'listing',
        title: 'Acquire.com listing not readable',
        summary: 'Acquire.com listings are only visible to signed-in buyers, so Mokkoi did not read it. Paste the listing details into the order to have them checked.',
        sourceUrl: target.listingUrl,
        data: { marketplace: 'acquire' },
      })
      return
    }

    const res = await ctx.http.get(target.listingUrl, { accept: 'text/html' })
    if (res.status !== 200) {
      evidence.add({
        collector: 'listing',
        title: 'Flippa listing could not be loaded',
        summary: `GET returned HTTP ${res.status}.`,
        sourceUrl: target.listingUrl,
        data: { status: res.status },
      })
      return
    }
    const parsed = parseFlippa(res.body)
    const idMatch = res.finalUrl.match(/flippa\.com\/(\d+)/)
    evidence.add({
      collector: 'listing',
      title: 'Flippa listing: summary metrics',
      summary: `Listing "${parsed.title}". Metrics shown on the public page: ${Object.entries(parsed.fields).map(([k, v]) => `${k}=${v}`).join(', ') || 'none found'}.`,
      sourceUrl: res.finalUrl,
      data: { marketplace: 'flippa', listingId: idMatch?.[1], title: parsed.title, metaDescription: parsed.description, fields: parsed.fields },
    })
    evidence.add({
      collector: 'listing',
      title: 'Flippa listing: public page text',
      summary: 'Visible text of the public listing page (seller description and listing panels). Seller statements are claims to be checked.',
      sourceUrl: res.finalUrl,
      data: { text: parsed.body },
    })
    evidence.add({
      collector: 'listing',
      title: 'Not visible at Level 0',
      summary: "Flippa's traffic, financials and attachments tabs need a signed-in account. Mokkoi does not log in on a buyer's behalf, so those numbers are unverified here.",
      sourceUrl: res.finalUrl,
      data: { hidden: ['traffic tab', 'financials tab', 'attachments'] },
    })
  },
}
