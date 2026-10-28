import { describe, expect, it } from 'vitest'
import { findBackends, mask, scanForSecrets } from './bundle.js'
import { parseFlippa } from './listing.js'
import { fingerprint, parseRobots } from './site.js'
import { priceSnippets, registrableDomain } from '../lib/html.js'

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${b64(payload)}.c2lnbmF0dXJlc2lnbmF0dXJl`

describe('bundle secret scan', () => {
  it('flags secret keys and masks them', () => {
    const fakeStripe = ['sk', 'live', 'abcdefghijklmnopqrstuvwx1234'].join('_')
    const hits = scanForSecrets(`const k="${fakeStripe}"; const s="${jwt({ role: 'service_role' })}"`, 'main.js')
    expect(hits.map((h) => h.rule).sort()).toEqual(['stripe_secret', 'supabase_service_role'])
    expect(hits.every((h) => h.severity === 'critical')).toBe(true)
    expect(hits[0].masked).not.toContain('abcdefghijklmnop')
  })

  it('treats the Supabase anon key and publishable keys as public', () => {
    const hits = scanForSecrets(`a="${jwt({ role: 'anon', iss: 'supabase' })}" b="pk_live_${'x'.repeat(24)}"`, 'main.js')
    expect(hits.every((h) => h.severity === 'info')).toBe(true)
  })

  it('finds backends the front end calls', () => {
    expect(findBackends('fetch("https://qsqbawyubkrcosthiqzj.supabase.co/rest/v1")')).toEqual([{ kind: 'Supabase', host: 'qsqbawyubkrcosthiqzj.supabase.co' }])
  })

  it('mask keeps only a prefix and suffix', () => {
    expect(mask('sk-ant-api03-verylongsecretvalue-XYZ9')).toBe('sk-ant-a…XYZ9')
  })
})

describe('Flippa listing parser', () => {
  it('reads the summary metrics panel', () => {
    const html = `<html><head><title>T</title></head><body><nav>Browse</nav><h1>Listing title</h1>
      <div>Description Financials</div><p>Site Age 8 months Monthly Profit USD $557 /mo Profit Margin 82% Profit Multiple 5.6x
      Revenue Multiple 4.6x MRR USD $968 Total Active Subscribers 18 Overall Churn 10%</p>
      <span data-action="click->dropdown#toggle">Asking Price (Classified)</span> USD $25,000</body></html>`
    const p = parseFlippa(html)
    expect(p.title).toBe('Listing title')
    expect(p.fields).toMatchObject({ monthly_profit: '557', profit_margin: '82', mrr: '968', active_subscribers: '18', churn: '10', site_age: '8 months', revenue_multiple: '4.6', asking_price: '25,000' })
    expect(p.body.startsWith('Description Financials')).toBe(true)
  })
})

describe('site helpers', () => {
  it('fingerprints Rails and legacy trackers', () => {
    const fp = fingerprint({ server: 'nginx + Phusion Passenger 6.1.1', 'x-runtime': '0.1' }, ['_pointpin_dashboard_session=abc; path=/'], `<script src="//connect.facebook.net/en_US/fbds.js"></script> ga('create','UA-1234567-1')`)
    expect(fp.stack.some((s) => s.includes('Rails'))).toBe(true)
    expect(fp.trackers.some((t) => t.includes('Universal Analytics'))).toBe(true)
    expect(fp.trackers.some((t) => t.includes('fbds'))).toBe(true)
  })

  it('parses robots.txt rules for all crawlers', () => {
    const r = parseRobots('User-agent: Googlebot\nDisallow: /g\n\nUser-agent: *\nDisallow: /admin\nSitemap: https://x.com/sitemap.xml')
    expect(r.disallow).toEqual(['/admin'])
    expect(r.sitemaps).toEqual(['https://x.com/sitemap.xml'])
  })

  it('merges overlapping price snippets', () => {
    const s = priceSnippets('Plans Small $ 12 50k requests per month Medium $ 29 500k requests per month')
    expect(s).toHaveLength(1)
  })

  it('finds registrable domains', () => {
    expect(registrableDomain('geo.pointp.in')).toBe('pointp.in')
    expect(registrableDomain('app.shop.co.uk')).toBe('shop.co.uk')
  })
})
