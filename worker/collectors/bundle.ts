// Public JavaScript bundle scan: leaked secrets, backend services the front end talks to,
// and bundle weight. Only scripts served from the target's own domain are read.
// Secret values are masked before they reach the evidence store or any model.
import { hostAllowed } from '../lib/http.js'
import { inlineScripts, registrableDomain, scriptSrcs } from '../lib/html.js'
import { resolve } from './domain.js'
import type { Collector, CollectorContext } from './context.js'

export type SecretSeverity = 'critical' | 'high' | 'info'

const SECRET_RULES: { id: string; label: string; re: RegExp; severity: SecretSeverity }[] = [
  { id: 'stripe_secret', label: 'Stripe secret or restricted key', re: /\b[sr]k_live_[0-9a-zA-Z]{20,}\b/g, severity: 'critical' },
  { id: 'anthropic', label: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, severity: 'critical' },
  { id: 'openai', label: 'OpenAI API key', re: /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}|\bsk-[A-Za-z0-9]{48}\b/g, severity: 'critical' },
  { id: 'aws', label: 'AWS access key ID', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, severity: 'critical' },
  { id: 'github', label: 'GitHub token', re: /\b(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{30,}\b/g, severity: 'critical' },
  { id: 'slack', label: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, severity: 'critical' },
  { id: 'sendgrid', label: 'SendGrid API key', re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, severity: 'critical' },
  { id: 'resend', label: 'Resend API key', re: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}\b/g, severity: 'high' },
  { id: 'google_api', label: 'Google API key (often a restricted public key for Maps/Firebase)', re: /\bAIza[0-9A-Za-z_-]{35}\b/g, severity: 'info' },
  { id: 'stripe_publishable', label: 'Stripe publishable key (public by design)', re: /\bpk_live_[0-9a-zA-Z]{20,}\b/g, severity: 'info' },
]

const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g

export function mask(secret: string): string {
  return secret.length <= 12 ? `${secret.slice(0, 3)}…` : `${secret.slice(0, 8)}…${secret.slice(-4)}`
}

function jwtRole(token: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { role?: string; iss?: string }
    return payload.role ?? (payload.iss?.includes('supabase') ? 'supabase' : undefined)
  } catch {
    return undefined
  }
}

export interface SecretHit {
  rule: string
  label: string
  severity: SecretSeverity
  masked: string
  where: string
}

export function scanForSecrets(code: string, where: string): SecretHit[] {
  const hits: SecretHit[] = []
  const seen = new Set<string>()
  for (const rule of SECRET_RULES) {
    for (const m of code.matchAll(rule.re)) {
      if (seen.has(m[0])) continue
      seen.add(m[0])
      hits.push({ rule: rule.id, label: rule.label, severity: rule.severity, masked: mask(m[0]), where })
    }
  }
  for (const m of code.matchAll(JWT)) {
    if (seen.has(m[0])) continue
    seen.add(m[0])
    const role = jwtRole(m[0])
    if (role === 'service_role') hits.push({ rule: 'supabase_service_role', label: 'Supabase service-role key (bypasses all row-level security)', severity: 'critical', masked: mask(m[0]), where })
    else if (role === 'anon') hits.push({ rule: 'supabase_anon', label: 'Supabase anon key (public by design; safety depends on RLS)', severity: 'info', masked: mask(m[0]), where })
  }
  return hits
}

export function findBackends(code: string): { kind: string; host: string }[] {
  const out = new Map<string, string>()
  for (const m of code.matchAll(/\b([a-z0-9]{20})\.supabase\.(?:co|in)\b/g)) out.set(`${m[1]}.supabase.co`, 'Supabase')
  for (const m of code.matchAll(/\b([a-z0-9-]+)\.firebaseapp\.com\b/g)) out.set(`${m[1]}.firebaseapp.com`, 'Firebase')
  for (const m of code.matchAll(/\b([a-z0-9-]+)\.firebaseio\.com\b/g)) out.set(`${m[1]}.firebaseio.com`, 'Firebase Realtime Database')
  for (const m of code.matchAll(/\b([a-z0-9-]+)\.appwrite\.io\b/g)) out.set(`${m[1]}.appwrite.io`, 'Appwrite')
  for (const m of code.matchAll(/\b([a-z0-9-]+\.)?convex\.cloud\b/g)) if (m[1]) out.set(`${m[1]}convex.cloud`, 'Convex')
  for (const m of code.matchAll(/https:\/\/([a-z0-9-]+\.(?:herokuapp\.com|railway\.app|onrender\.com|fly\.dev))/g)) out.set(m[1], 'App host')
  return [...out].map(([host, kind]) => ({ kind, host }))
}

export const bundleCollector: Collector = {
  name: 'bundle',
  async run(ctx: CollectorContext) {
    const home = ctx.shared.homepage
    if (!home || home.status >= 400) return
    const domain = registrableDomain(new URL(home.finalUrl).hostname)
    const all = scriptSrcs(home.body, home.finalUrl)
    const own = all.filter((u) => hostAllowed(new URL(u).hostname, [domain])).slice(0, 8)
    const thirdPartyHosts = [...new Set(all.filter((u) => !own.includes(u)).map((u) => new URL(u).hostname))]

    const scripts: { url: string; bytes: number; status: number; truncated: boolean }[] = []
    let code = inlineScripts(home.body).join('\n')
    const hits: SecretHit[] = scanForSecrets(code, 'inline <script> on the homepage')
    for (const url of own) {
      const r = await ctx.http.get(url, { accept: '*/*', maxBytes: 4_000_000 }).catch(() => undefined)
      if (!r) continue
      scripts.push({ url, bytes: r.body.length, status: r.status, truncated: r.truncated })
      if (r.status !== 200) continue
      code += '\n' + r.body
      hits.push(...scanForSecrets(r.body, new URL(url).pathname))
    }
    const totalBytes = scripts.reduce((n, s) => n + s.bytes, 0)
    const critical = hits.filter((h) => h.severity !== 'info')
    ctx.evidence.add({
      collector: 'bundle',
      title: 'Public JavaScript: leaked secrets scan',
      summary: critical.length
        ? `Found ${critical.length} likely secret(s) in public JavaScript: ${critical.map((h) => `${h.label} ${h.masked} in ${h.where}`).join('; ')}.`
        : `No secret keys found in ${scripts.length} first-party script(s) and inline scripts.${hits.length ? ` Public-by-design keys seen: ${[...new Set(hits.map((h) => h.label))].join('; ')}.` : ''}`,
      sourceUrl: home.finalUrl,
      data: { hits, scanned: scripts.map((s) => s.url), inlineScripts: inlineScripts(home.body).length },
    })
    ctx.evidence.add({
      collector: 'bundle',
      title: 'JavaScript bundle weight',
      summary: `${scripts.length} first-party script(s), ${(totalBytes / 1_000_000).toFixed(2)} MB uncompressed in total${scripts.length ? `; largest ${(Math.max(...scripts.map((s) => s.bytes)) / 1_000_000).toFixed(2)} MB` : ''}. Third-party script hosts: ${thirdPartyHosts.join(', ') || 'none'}.`,
      sourceUrl: home.finalUrl,
      data: { scripts, totalBytes, thirdPartyHosts },
    })

    // Backend services referenced by the front end: is each one still alive (DNS only)?
    const backends = findBackends(code + home.body)
    for (const b of backends.slice(0, 4)) {
      const a = await resolve(ctx.http, b.host, 'A').catch((e: Error) => ({ status: `error: ${e.message}`, records: [] as string[] }))
      const alive = a.status === 'NOERROR' && a.records.length > 0
      const key = ctx.evidence.add({
        collector: 'backend',
        title: `${b.kind} backend ${alive ? 'resolves' : 'does not resolve'}`,
        summary: alive
          ? `The front end calls ${b.kind} at ${b.host}, which resolves (${a.records.slice(0, 2).join(', ')}).`
          : `The front end calls ${b.kind} at ${b.host}, but DNS returns ${a.status}${a.status === 'NXDOMAIN' ? ' (the host does not exist)' : ''}. Sign-in, data and anything after it cannot work.`,
        sourceUrl: `https://dns.google/resolve?name=${b.host}`,
        data: { ...b, dnsStatus: a.status, records: a.records, alive },
      })
      ctx.shared.backends.push({ ...b, evidenceKey: key })
    }
  },
}
