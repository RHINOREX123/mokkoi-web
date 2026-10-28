// Homepage, headers, stack fingerprint, robots.txt and sitemap.
import { htmlToText, links, metaTags, pageTitle } from '../lib/html.js'
import type { Collector, CollectorContext } from './context.js'
import { robotsBlocks } from './context.js'

const SECURITY_HEADERS = ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy']

const HEADER_HINTS: { header: string; match?: RegExp; tech: string }[] = [
  { header: 'server', match: /passenger/i, tech: 'Phusion Passenger (Ruby/Rails app server)' },
  { header: 'x-powered-by', match: /passenger/i, tech: 'Phusion Passenger (Ruby/Rails app server)' },
  { header: 'server', match: /nginx/i, tech: 'nginx' },
  { header: 'server', match: /apache/i, tech: 'Apache' },
  { header: 'server', match: /cloudflare/i, tech: 'Cloudflare' },
  { header: 'server', match: /vercel/i, tech: 'Vercel' },
  { header: 'server', match: /netlify/i, tech: 'Netlify' },
  { header: 'server', match: /gws|google/i, tech: 'Google hosting' },
  { header: 'x-vercel-id', tech: 'Vercel' },
  { header: 'x-nf-request-id', tech: 'Netlify' },
  { header: 'fly-request-id', tech: 'Fly.io' },
  { header: 'x-amz-cf-id', tech: 'AWS CloudFront' },
  { header: 'cf-ray', tech: 'Cloudflare' },
  { header: 'x-shopify-stage', tech: 'Shopify' },
  { header: 'x-wix-request-id', tech: 'Wix' },
  { header: 'x-powered-by', match: /php/i, tech: 'PHP' },
  { header: 'x-powered-by', match: /express/i, tech: 'Express (Node.js)' },
  { header: 'x-powered-by', match: /next\.js/i, tech: 'Next.js' },
  { header: 'x-runtime', tech: 'Ruby on Rails (x-runtime header)' },
]

const HTML_HINTS: { re: RegExp; tech: string }[] = [
  { re: /wp-content|wp-includes/i, tech: 'WordPress' },
  { re: /cdn\.shopify\.com/i, tech: 'Shopify' },
  { re: /__NEXT_DATA__|\/_next\/static/i, tech: 'Next.js' },
  { re: /\/assets\/index-[\w-]+\.js/i, tech: 'Vite single-page app' },
  { re: /lovable|gpteng\.co/i, tech: 'Lovable (AI app builder)' },
  { re: /bolt\.new|stackblitz/i, tech: 'Bolt (AI app builder)' },
  { re: /webflow/i, tech: 'Webflow' },
  { re: /framerusercontent|framer\.com\/m\//i, tech: 'Framer' },
  { re: /static\.wixstatic|wix\.com/i, tech: 'Wix' },
  { re: /bubble\.io|bubbleapps/i, tech: 'Bubble' },
  { re: /name="csrf-param" content="authenticity_token"/i, tech: 'Ruby on Rails (CSRF meta tag)' },
  { re: /data-turbo|turbolinks/i, tech: 'Rails Hotwire/Turbolinks' },
  { re: /<div id="root"><\/div>|<div id="app"><\/div>/i, tech: 'Client-rendered SPA (empty root div)' },
]

const TRACKER_HINTS: { re: RegExp; name: string; note?: string }[] = [
  { re: /\bUA-\d{4,10}-\d{1,4}\b/, name: 'Google Universal Analytics', note: 'Google stopped processing Universal Analytics data in July 2023' },
  { re: /\bG-[A-Z0-9]{6,12}\b/, name: 'Google Analytics 4' },
  { re: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,8}/, name: 'Google Tag Manager' },
  { re: /fbds\.js/, name: 'Legacy Facebook pixel (fbds.js)', note: 'deprecated since 2017' },
  { re: /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(/, name: 'Meta pixel' },
  { re: /posthog/i, name: 'PostHog' },
  { re: /plausible\.io/i, name: 'Plausible' },
  { re: /hotjar/i, name: 'Hotjar' },
  { re: /clarity\.ms/i, name: 'Microsoft Clarity' },
  { re: /js\.stripe\.com/i, name: 'Stripe.js' },
  { re: /intercom/i, name: 'Intercom' },
  { re: /crisp\.chat/i, name: 'Crisp chat' },
]

export function fingerprint(headers: Record<string, string>, cookies: string[], html: string) {
  const stack = new Set<string>()
  for (const h of HEADER_HINTS) {
    const v = headers[h.header]
    if (v !== undefined && (!h.match || h.match.test(v))) stack.add(h.tech)
  }
  const cookieNames = cookies.map((c) => c.split('=')[0].trim())
  for (const name of cookieNames) {
    if (/^_[\w-]+_session$/.test(name)) stack.add(`Ruby on Rails (session cookie ${name})`)
    if (/^laravel_session$/i.test(name)) stack.add('Laravel (PHP)')
    if (/^PHPSESSID$/i.test(name)) stack.add('PHP')
    if (/^wordpress_|^wp-/i.test(name)) stack.add('WordPress')
    if (/^connect\.sid$/.test(name)) stack.add('Express (Node.js)')
    if (/^csrftoken$|^sessionid$/.test(name)) stack.add('Django (Python)')
  }
  for (const h of HTML_HINTS) if (h.re.test(html)) stack.add(h.tech)
  const trackers = TRACKER_HINTS.filter((t) => t.re.test(html)).map((t) => (t.note ? `${t.name} (${t.note})` : t.name))
  const libraries: string[] = []
  for (const m of html.matchAll(/(mapbox-gl|jquery|bootstrap|react|vue|angular)(?:-js)?[@/.-]v?(\d+\.\d+(?:\.\d+)?)/gi)) libraries.push(`${m[1].toLowerCase()} ${m[2]}`)
  return { stack: [...stack], trackers, libraries: [...new Set(libraries)], cookieNames }
}

export function parseRobots(txt: string) {
  const disallow: string[] = []
  const sitemaps: string[] = []
  let applies = false
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const [k, ...rest] = line.split(':')
    const v = rest.join(':').trim()
    if (!k) continue
    const key = k.toLowerCase()
    if (key === 'user-agent') applies = v === '*' || /mokkoi/i.test(v)
    else if (key === 'disallow' && applies && v) disallow.push(v)
    else if (key === 'sitemap') sitemaps.push(v)
  }
  return { disallow, sitemaps }
}

export const siteCollector: Collector = {
  name: 'site',
  async run(ctx: CollectorContext) {
    const site = ctx.target.websiteUrl
    if (!site) return
    const origin = new URL(site).origin

    // robots.txt first, so the rest of the run respects it.
    const robots = await ctx.http.get(`${origin}/robots.txt`, { accept: 'text/plain' }).catch((e: Error) => e)
    if (robots instanceof Error) {
      ctx.evidence.add({ collector: 'robots', title: 'robots.txt could not be fetched', summary: robots.message, sourceUrl: `${origin}/robots.txt`, data: {} })
    } else {
      const ct = robots.headers['content-type'] ?? ''
      const isHtml = /html/i.test(ct) || /^\s*<!doctype html|^\s*<html/i.test(robots.body)
      const valid = robots.status === 200 && !isHtml
      const parsed = valid ? parseRobots(robots.body) : { disallow: [], sitemaps: [] }
      ctx.shared.robotsDisallow = parsed.disallow
      ctx.evidence.add({
        collector: 'robots',
        title: 'robots.txt',
        summary: valid
          ? `robots.txt present: ${parsed.disallow.length} disallow rules for all crawlers, ${parsed.sitemaps.length} sitemap reference(s).`
          : isHtml
            ? `GET /robots.txt returns an HTML page (HTTP ${robots.status}, ${ct || 'no content type'}) instead of a robots file, so there are no real crawler rules.`
            : `No robots.txt (HTTP ${robots.status}).`,
        sourceUrl: `${origin}/robots.txt`,
        data: { status: robots.status, contentType: ct, returnsHtml: isHtml, disallow: parsed.disallow, sitemaps: parsed.sitemaps, excerpt: robots.body.slice(0, 1500) },
      })
    }

    if (robotsBlocks(ctx, site)) {
      ctx.evidence.add({ collector: 'site', title: 'Homepage disallowed by robots.txt', summary: 'robots.txt asks crawlers not to fetch the homepage, so Mokkoi did not.', sourceUrl: site, data: {} })
      return
    }

    const t0 = Date.now()
    const home = await ctx.http.get(site, { accept: 'text/html' }).catch((e: Error) => e)
    const ms = Date.now() - t0
    if (home instanceof Error) {
      ctx.evidence.add({ collector: 'site', title: 'Website unreachable', summary: `GET ${site} failed: ${home.message}`, sourceUrl: site, data: { error: home.message } })
      return
    }
    ctx.shared.homepage = home
    ctx.shared.websiteHost = new URL(home.finalUrl).hostname
    const present = SECURITY_HEADERS.filter((h) => home.headers[h] !== undefined)
    const missing = SECURITY_HEADERS.filter((h) => home.headers[h] === undefined)
    const fp = fingerprint(home.headers, home.setCookies, home.body)
    const meta = metaTags(home.body)
    const text = htmlToText(home.body)

    ctx.evidence.add({
      collector: 'http',
      title: `Homepage response (HTTP ${home.status})`,
      summary: `GET ${site} → ${home.status}${home.redirects.length ? ` via ${home.redirects.length} redirect(s) to ${home.finalUrl}` : ''} in ${ms} ms. Server: ${home.headers.server ?? 'not disclosed'}${home.headers['x-powered-by'] ? `, x-powered-by: ${home.headers['x-powered-by']}` : ''}${home.headers['x-runtime'] ? `, x-runtime: ${home.headers['x-runtime']}s` : ''}.`,
      sourceUrl: home.finalUrl,
      data: {
        status: home.status,
        finalUrl: home.finalUrl,
        redirects: home.redirects,
        responseMs: ms,
        headers: home.headers,
        cookieNames: fp.cookieNames,
        htmlBytes: home.body.length,
      },
    })
    ctx.evidence.add({
      collector: 'http',
      title: 'Security headers',
      summary: `Present: ${present.join(', ') || 'none'}. Missing: ${missing.join(', ') || 'none'}.`,
      sourceUrl: home.finalUrl,
      data: { present, missing, values: Object.fromEntries(present.map((h) => [h, home.headers[h]])), cors: home.headers['access-control-allow-origin'] ?? null },
    })
    ctx.evidence.add({
      collector: 'stack',
      title: 'Stack and third-party scripts (from headers, cookies and HTML)',
      summary: `Stack signals: ${fp.stack.join('; ') || 'none detected'}. Trackers: ${fp.trackers.join('; ') || 'none detected'}.${fp.libraries.length ? ` Library versions in URLs: ${fp.libraries.join(', ')}.` : ''}`,
      sourceUrl: home.finalUrl,
      data: fp,
    })
    const navLinks = links(home.body, home.finalUrl)
    ctx.evidence.add({
      collector: 'site',
      title: 'Homepage content',
      summary: `Title: "${pageTitle(home.body) ?? ''}". Description: "${meta.description ?? meta['og:description'] ?? ''}".`,
      sourceUrl: home.finalUrl,
      data: {
        title: pageTitle(home.body),
        description: meta.description ?? meta['og:description'],
        canonical: home.body.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1],
        ogImage: meta['og:image'],
        text: text.slice(0, 6000),
        links: navLinks.slice(0, 80),
      },
    })

    const pricing = navLinks.find((l) => new URL(l.href).hostname === ctx.shared.websiteHost && /pric|plans?\b/i.test(new URL(l.href).pathname + ' ' + l.text))
    if (pricing) ctx.shared.pricingUrl = pricing.href.split('#')[0]

    // Hosts on the same domain mentioned on the page (api., app., docs.) get a DNS lookup later.
    const domain = ctx.shared.websiteHost.replace(/^www\./, '')
    for (const m of home.body.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      const h = m[1].toLowerCase()
      if (h !== ctx.shared.websiteHost && (h === domain || h.endsWith(`.${domain}`))) ctx.shared.relatedHosts.add(h)
    }

    // Public developer docs say how the product is used (API hosts, how keys are sent).
    const docs = navLinks.find((l) => new URL(l.href).hostname === ctx.shared.websiteHost && /\/(docs?|documentation|api|developers?)(\/|$)/i.test(new URL(l.href).pathname))
    if (docs && !robotsBlocks(ctx, docs.href)) {
      const d = await ctx.http.get(docs.href.split('#')[0], { accept: 'text/html' }).catch(() => undefined)
      if (d?.status === 200) {
        const docText = htmlToText(d.body).replace(/\s+/g, ' ')
        const hosts = new Set<string>()
        for (const m of d.body.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
          const h = m[1].toLowerCase()
          if (h !== ctx.shared.websiteHost && (h === domain || h.endsWith(`.${domain}`))) {
            hosts.add(h)
            ctx.shared.relatedHosts.add(h)
          }
        }
        const keyMentions = [...docText.matchAll(/.{0,90}\b(?:api[ _-]?key|access[ _-]?key|token)\b.{0,90}/gi)].slice(0, 6).map((m) => m[0].trim())
        const exampleUrls = [...new Set([...docText.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0]))].filter((u) => [...hosts].some((h) => u.includes(h))).slice(0, 8)
        ctx.evidence.add({
          collector: 'site',
          title: 'Public developer documentation',
          summary: `Docs page ${docs.href}. API hosts mentioned: ${[...hosts].join(', ') || 'none'}. Example request URLs: ${exampleUrls.slice(0, 3).join(' ; ') || 'none'}.`,
          sourceUrl: d.finalUrl,
          data: { apiHosts: [...hosts], exampleUrls, keyMentions, excerpt: docText.slice(0, 3000) },
        })
      }
    }

    const sitemap = await ctx.http.get(`${origin}/sitemap.xml`, { accept: 'application/xml' }).catch(() => undefined)
    if (sitemap) {
      const isXml = sitemap.status === 200 && /<(urlset|sitemapindex)\b/i.test(sitemap.body)
      const urls = isXml ? (sitemap.body.match(/<loc>/gi) ?? []).length : 0
      ctx.evidence.add({
        collector: 'robots',
        title: 'sitemap.xml',
        summary: isXml ? `sitemap.xml present with ${urls} URL entries.` : `No valid sitemap.xml (HTTP ${sitemap.status}${sitemap.status === 200 ? ', but not a sitemap' : ''}).`,
        sourceUrl: `${origin}/sitemap.xml`,
        data: { status: sitemap.status, valid: isXml, urlCount: urls },
      })
    }
  },
}
