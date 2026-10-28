// DNS (via DNS-over-HTTPS), RDAP (domain and IP ownership) and the TLS certificate.
import { registrableDomain } from '../lib/html.js'
import type { SafeHttp } from '../lib/http.js'
import type { Collector, CollectorContext } from './context.js'

type DnsType = 'A' | 'AAAA' | 'NS' | 'MX' | 'TXT' | 'CNAME'
const DNS_TYPES: Record<number, DnsType> = { 1: 'A', 28: 'AAAA', 2: 'NS', 15: 'MX', 16: 'TXT', 5: 'CNAME' }

export interface DnsAnswer {
  name: string
  type: DnsType
  status: 'NOERROR' | 'NXDOMAIN' | 'SERVFAIL' | string
  records: string[]
}

const RCODES: Record<number, string> = { 0: 'NOERROR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 5: 'REFUSED' }

export async function resolve(http: SafeHttp, name: string, type: DnsType): Promise<DnsAnswer> {
  const res = await http.get(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, { accept: 'application/dns-json' })
  const j = JSON.parse(res.body) as { Status: number; Answer?: { type: number; data: string }[] }
  const records = (j.Answer ?? []).filter((a) => DNS_TYPES[a.type] === type).map((a) => a.data.replace(/^"|"$/g, ''))
  return { name, type, status: RCODES[j.Status] ?? String(j.Status), records }
}

export const dnsCollector: Collector = {
  name: 'dns',
  async run(ctx: CollectorContext) {
    const host = ctx.shared.websiteHost ?? (ctx.target.websiteUrl ? new URL(ctx.target.websiteUrl).hostname : undefined)
    if (!host) return
    const apex = registrableDomain(host)
    const answers: DnsAnswer[] = []
    for (const t of ['A', 'AAAA', 'NS', 'MX', 'TXT'] as DnsType[]) answers.push(await resolve(ctx.http, apex, t))
    if (host !== apex) answers.push(await resolve(ctx.http, host, 'A'))
    const dmarc = await resolve(ctx.http, `_dmarc.${apex}`, 'TXT')
    const pick = (t: DnsType, n = apex) => answers.find((a) => a.type === t && a.name === n)?.records ?? []
    const spf = pick('TXT').find((r) => r.startsWith('v=spf1'))
    ctx.evidence.add({
      collector: 'dns',
      title: `DNS records for ${apex}`,
      summary: `A ${pick('A').join(', ') || 'none'}; NS ${pick('NS').join(', ') || 'none'}; MX ${pick('MX').join(', ') || 'none'}. SPF ${spf ? 'present' : 'missing'}, DMARC ${dmarc.records.some((r) => r.startsWith('v=DMARC1')) ? 'present' : 'missing'}.`,
      sourceUrl: `https://dns.google/resolve?name=${apex}`,
      data: { apex, host, answers, spf: spf ?? null, dmarc: dmarc.records },
    })

    const related = [...ctx.shared.relatedHosts].filter((h) => h !== host).slice(0, 6)
    if (related.length) {
      const rel = await Promise.all(related.map((h) => resolve(ctx.http, h, 'A')))
      ctx.evidence.add({
        collector: 'dns',
        title: 'Related hosts on the same domain',
        summary: rel.map((r) => `${r.name}: ${r.status === 'NOERROR' ? r.records.join(', ') || 'no A record' : r.status}`).join('; '),
        data: { hosts: rel },
      })
    }

    // Who hosts the IPs (RDAP for IP networks).
    const ips = [...new Set([...pick('A'), ...(host !== apex ? pick('A', host) : [])])].filter((ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip)).slice(0, 3)
    const owners = []
    for (const ip of ips) {
      const r = await ctx.http.get(`https://rdap.org/ip/${ip}`, { accept: 'application/rdap+json', followAnyPublicRedirect: true }).catch(() => undefined)
      if (!r || r.status !== 200) continue
      try {
        const j = JSON.parse(r.body) as { name?: string; country?: string; handle?: string; entities?: RdapEntity[] }
        owners.push({ ip, network: j.name, country: j.country, handle: j.handle, org: entityName(j.entities, ['registrant']) ?? entityName(j.entities, ['abuse']) })
      } catch {
        /* non-JSON */
      }
    }
    if (owners.length) {
      ctx.evidence.add({
        collector: 'rdap',
        title: 'IP address owners',
        summary: owners.map((o) => `${o.ip}: ${o.org ?? o.network ?? 'unknown'}${o.country ? ` (${o.country})` : ''}`).join('; '),
        data: { owners },
      })
    }
  },
}

interface RdapEntity {
  roles?: string[]
  vcardArray?: [string, [string, unknown, string, string][]]
  entities?: RdapEntity[]
}

function entityName(entities: RdapEntity[] | undefined, roles: string[]): string | undefined {
  for (const e of entities ?? []) {
    if (e.roles?.some((r) => roles.includes(r))) {
      const fn = e.vcardArray?.[1]?.find((f) => f[0] === 'fn')
      if (fn) return String(fn[3])
    }
    const nested = entityName(e.entities, roles)
    if (nested) return nested
  }
  return undefined
}

export const rdapCollector: Collector = {
  name: 'rdap',
  async run(ctx: CollectorContext) {
    const host = ctx.shared.websiteHost ?? (ctx.target.websiteUrl ? new URL(ctx.target.websiteUrl).hostname : undefined)
    if (!host) return
    const apex = registrableDomain(host)
    const res = await ctx.http.get(`https://rdap.org/domain/${apex}`, { accept: 'application/rdap+json', followAnyPublicRedirect: true }).catch((e: Error) => e)
    if (res instanceof Error || res.status !== 200) {
      ctx.evidence.add({
        collector: 'rdap',
        title: `Domain registration for ${apex} unavailable`,
        summary: res instanceof Error ? res.message : `RDAP returned HTTP ${res.status}. Some country-code registries don't publish RDAP.`,
        sourceUrl: `https://rdap.org/domain/${apex}`,
        data: {},
      })
      return
    }
    const j = JSON.parse(res.body) as { events?: { eventAction: string; eventDate: string }[]; status?: string[]; entities?: RdapEntity[]; nameservers?: { ldhName: string }[] }
    const events: Record<string, string> = {}
    for (const e of j.events ?? []) if (!(e.eventAction in events)) events[e.eventAction] = e.eventDate
    const registered = events['registration']
    const ageYears = registered ? (Date.now() - Date.parse(registered)) / (365.25 * 86400_000) : undefined
    ctx.evidence.add({
      collector: 'rdap',
      title: `Domain registration for ${apex}`,
      summary: `Registered ${registered?.slice(0, 10) ?? 'unknown'}${ageYears ? ` (about ${ageYears.toFixed(1)} years ago)` : ''}; expires ${events['expiration']?.slice(0, 10) ?? 'unknown'}; last changed ${events['last changed']?.slice(0, 10) ?? 'unknown'}${events['transfer'] ? `; transferred ${events['transfer'].slice(0, 10)}` : ''}. Registrar: ${entityName(j.entities, ['registrar']) ?? 'unknown'}.`,
      sourceUrl: res.finalUrl,
      data: {
        domain: apex,
        events,
        ageYears: ageYears ? Math.round(ageYears * 10) / 10 : null,
        status: j.status ?? [],
        registrar: entityName(j.entities, ['registrar']) ?? null,
        nameservers: (j.nameservers ?? []).map((n) => n.ldhName.toLowerCase()),
      },
    })
  },
}

export const tlsCollector: Collector = {
  name: 'tls',
  async run(ctx: CollectorContext) {
    const host = ctx.shared.websiteHost
    if (!host) return
    const cert = await ctx.http.tlsCert(host).catch((e: Error) => e)
    if (cert instanceof Error) {
      ctx.evidence.add({ collector: 'tls', title: 'TLS certificate unavailable', summary: cert.message, data: { host } })
      return
    }
    const daysLeft = Math.round((Date.parse(cert.validTo) - Date.now()) / 86400_000)
    ctx.evidence.add({
      collector: 'tls',
      title: `TLS certificate for ${host}`,
      summary: `Issuer ${cert.issuer.match(/O=([^,]+)/)?.[1] ?? cert.issuer}; valid ${cert.validFrom.slice(0, 10)} to ${cert.validTo.slice(0, 10)} (${daysLeft} days left); ${cert.authorized ? 'trusted chain' : `not trusted: ${cert.authorizationError}`}; ${cert.protocol ?? ''}.`,
      sourceUrl: `https://${host}`,
      data: { ...cert, daysLeft },
    })
  },
}
