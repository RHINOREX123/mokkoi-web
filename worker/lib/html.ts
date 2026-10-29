// Small, dependency-free HTML helpers for collectors. Regex-based on purpose: we only
// need text, links, scripts and meta tags, and we never execute page code.

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+|#39);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return ENTITIES[code.toLowerCase()] ?? m
  })
}

/** An HTML tag, allowing '>' inside quoted attribute values (e.g. data-action="click->x"). */
const TAG = /<[a-zA-Z/!](?:[^>"']|"[^"]*"|'[^']*')*>/g

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, '\n')
    .replace(TAG, ' ')
  return decodeEntities(stripped)
    .replace(/[ \t\f\v\r]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export function pageTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : undefined
}

export function firstHeading(html: string): string | undefined {
  const m = html.match(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/i)
  if (m) return htmlToText(m[1]).replace(/\s+/g, ' ').trim() || undefined
  return undefined
}

export function metaTags(html: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = attr(tag, 'property') ?? attr(tag, 'name')
    const content = attr(tag, 'content')
    if (key && content !== undefined && !(key.toLowerCase() in out)) out[key.toLowerCase()] = decodeEntities(content)
  }
  return out
}

export function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined
}

export function scriptSrcs(html: string, base: string): string[] {
  const out = new Set<string>()
  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    const src = attr(tag, 'src')
    if (src) {
      try {
        out.add(new URL(decodeEntities(src), base).toString())
      } catch {
        /* ignore malformed */
      }
    }
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase()
    const href = attr(tag, 'href')
    if (href && (rel === 'modulepreload' || (rel === 'preload' && (attr(tag, 'as') ?? '') === 'script'))) {
      try {
        out.add(new URL(decodeEntities(href), base).toString())
      } catch {
        /* ignore */
      }
    }
  }
  return [...out]
}

export function inlineScripts(html: string): string[] {
  const out: string[] = []
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) if (!/\bsrc\s*=/.test(m[1]) && m[2].trim()) out.push(m[2])
  return out
}

export function links(html: string, base: string): { href: string; text: string }[] {
  const out: { href: string; text: string }[] = []
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const href = attr(m[1], 'href')
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue
    try {
      out.push({ href: new URL(decodeEntities(href), base).toString(), text: htmlToText(m[2]).slice(0, 80) })
    } catch {
      /* ignore */
    }
  }
  return out
}

/** Short windows of text around money and quota mentions, for pricing-page comparisons. */
export function priceSnippets(text: string, max = 12): string[] {
  const re = /(?:[$€£]\s?\d[\d,.]*\s*(?:k|K)?(?:\s*\/\s*(?:mo|month|yr|year))?|\d[\d,.]*\s*(?:k|K|M|million)?\s*(?:requests|lookups|credits|videos|minutes|users|seats|queries)\b)/gi
  // Windows of +-60 chars around each match, merged where they overlap.
  const ranges: [number, number][] = []
  for (const m of text.matchAll(re)) {
    const start = Math.max(0, m.index - 60)
    const end = Math.min(text.length, m.index + m[0].length + 60)
    const last = ranges.at(-1)
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else ranges.push([start, end])
  }
  return ranges.slice(0, max).map(([s, e]) => text.slice(s, e).replace(/\s+/g, ' ').trim())
}

const MULTI_PART_TLDS = new Set(['co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.in', 'co.jp', 'com.br', 'com.mx', 'co.za', 'com.sg', 'com.tr'])

/** Best-effort registrable domain ("app.example.co.uk" -> "example.co.uk"). */
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, '').split('.')
  if (parts.length <= 2) return parts.join('.')
  const lastTwo = parts.slice(-2).join('.')
  return MULTI_PART_TLDS.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo
}
