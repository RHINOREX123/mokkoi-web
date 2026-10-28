// The only way collectors touch the network.
//
// Level 0 rules, enforced here in code rather than left to prompts:
//   * GET and HEAD only. Anything else throws PolicyError before a socket opens.
//   * Hosts must be on the allow-list: the target's own domains plus a fixed set of
//     public data services (DNS-over-HTTPS, RDAP, Wayback, PageSpeed, Flippa listings).
//   * No private, loopback or link-local addresses (blocks SSRF via customer URLs).
//   * No cookies, no auth headers, no request bodies. Response bodies are size-capped.
//   * Every request is logged; the log becomes the report's evidence appendix.
//
// Fixture mode (XRAY_FIXTURE_MODE=record|replay, XRAY_FIXTURE_DIR) records responses so
// evals and tests can re-run offline.
import { createHash } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isIP } from 'node:net'
import { join } from 'node:path'
import tls from 'node:tls'
import type { RequestLogEntry } from '../../lib/xray/types.js'

export class PolicyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PolicyError'
  }
}

export class FixtureMissingError extends Error {
  constructor(url: string) {
    super(`No recorded fixture for ${url}`)
    this.name = 'FixtureMissingError'
  }
}

export const USER_AGENT = 'MokkoiXray/1.0 (+https://mokkoi.com/support; public-data due diligence)'

/** Public data services any Level 0 report may read. */
export const PUBLIC_DATA_HOSTS = [
  'dns.google',
  'rdap.org',
  'rdap.iana.org',
  'web.archive.org',
  'archive.org',
  'www.googleapis.com',
  'flippa.com',
  'acquire.com',
]

export type FixtureMode = 'live' | 'record' | 'replay'

export interface HttpResponse {
  url: string
  finalUrl: string
  status: number
  headers: Record<string, string>
  setCookies: string[]
  redirects: string[]
  body: string
  truncated: boolean
}

export interface TlsCertInfo {
  host: string
  subject: string
  issuer: string
  validFrom: string
  validTo: string
  altNames: string[]
  protocol: string | null
  authorized: boolean
  authorizationError?: string
}

export interface GetOptions {
  method?: 'GET' | 'HEAD'
  maxBytes?: number
  timeoutMs?: number
  accept?: string
  /** Follow redirects to any public host (used for RDAP referrals). Still GET-only and private-IP checked. */
  followAnyPublicRedirect?: boolean
}

export interface SafeHttpOptions {
  /** Registrable domains of the business being checked, e.g. ["pointp.in"]. Subdomains are allowed. */
  targetDomains: string[]
  extraHosts?: string[]
  mode?: FixtureMode
  fixtureDir?: string
  /** Minimum gap between requests to the same host. */
  perHostDelayMs?: number
}

const PRIVATE_V4: [number, number][] = [
  [0x00000000, 8], // 0.0.0.0/8
  [0x0a000000, 8], // 10/8
  [0x64400000, 10], // 100.64/10 (CGNAT)
  [0x7f000000, 8], // 127/8
  [0xa9fe0000, 16], // 169.254/16
  [0xac100000, 12], // 172.16/12
  [0xc0000000, 24], // 192.0.0/24
  [0xc0a80000, 16], // 192.168/16
  [0xc6120000, 15], // 198.18/15
  [0xe0000000, 4], // multicast
  [0xf0000000, 4], // reserved
]

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const n = ip.split('.').reduce((acc, p) => (acc << 8) + Number(p), 0) >>> 0
    return PRIVATE_V4.some(([base, bits]) => (n >>> (32 - bits)) === (base >>> (32 - bits)))
  }
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase()
    if (v === '::' || v === '::1') return true
    if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7))
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v)
  }
  return true
}

export function hostAllowed(host: string, allowed: string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, '')
  return allowed.some((d) => h === d || h.endsWith(`.${d}`))
}

/** Strip API keys from URLs before they are logged, stored or shown in a report. */
export function redactUrl(url: string): string {
  return url.replace(/([?&](?:key|api_key|apikey|token|access_token)=)[^&#]*/gi, '$1REDACTED')
}

function fixtureKey(kind: string, url: string) {
  return createHash('sha1').update(`${kind} ${redactUrl(url)}`).digest('hex').slice(0, 20)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class SafeHttp {
  readonly log: RequestLogEntry[] = []
  private allowed: string[]
  private mode: FixtureMode
  private fixtureDir?: string
  private lastHit = new Map<string, number>()
  private perHostDelayMs: number

  constructor(opts: SafeHttpOptions) {
    this.allowed = [...opts.targetDomains, ...PUBLIC_DATA_HOSTS, ...(opts.extraHosts ?? [])].map((d) => d.toLowerCase())
    this.mode = opts.mode ?? 'live'
    this.fixtureDir = opts.fixtureDir
    this.perHostDelayMs = opts.perHostDelayMs ?? 250
    if (this.mode !== 'live') {
      if (!this.fixtureDir) throw new Error('fixtureDir is required in record/replay mode')
      mkdirSync(this.fixtureDir, { recursive: true })
    }
  }

  /** Throws unless the method is allowed at Level 0. Exported so tests can prove it. */
  static assertMethod(method: string) {
    const m = method.toUpperCase()
    if (m !== 'GET' && m !== 'HEAD') throw new PolicyError(`Level 0 is read-only: ${m} requests are blocked`)
  }

  private assertUrl(raw: string, anyPublic = false): URL {
    let u: URL
    try {
      u = new URL(raw)
    } catch {
      throw new PolicyError(`Invalid URL: ${raw}`)
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new PolicyError(`Blocked scheme ${u.protocol}`)
    if (u.username || u.password) throw new PolicyError('URLs with credentials are blocked')
    if (u.port && u.port !== '80' && u.port !== '443') throw new PolicyError(`Blocked port ${u.port}`)
    if (isIP(u.hostname.replace(/^\[|\]$/g, '')) && isPrivateAddress(u.hostname.replace(/^\[|\]$/g, ''))) {
      throw new PolicyError(`Blocked private address ${u.hostname}`)
    }
    if (!anyPublic && !hostAllowed(u.hostname, this.allowed)) throw new PolicyError(`Host not on the Level 0 allow-list: ${u.hostname}`)
    return u
  }

  private async assertPublicDns(host: string) {
    if (this.mode === 'replay') return
    const bare = host.replace(/^\[|\]$/g, '')
    if (isIP(bare)) return
    const addrs = await lookup(bare, { all: true })
    const bad = addrs.find((a) => isPrivateAddress(a.address))
    if (bad) throw new PolicyError(`${host} resolves to a private address`)
  }

  private async pace(host: string) {
    if (this.mode === 'replay') return
    const last = this.lastHit.get(host) ?? 0
    const wait = last + this.perHostDelayMs - Date.now()
    if (wait > 0) await sleep(wait)
    this.lastHit.set(host, Date.now())
  }

  private readFixture<T>(kind: string, url: string): T | undefined {
    if (this.mode === 'live' || !this.fixtureDir) return undefined
    const file = join(this.fixtureDir, `${fixtureKey(kind, url)}.json`)
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).response as T
    if (this.mode === 'replay') throw new FixtureMissingError(url)
    return undefined
  }

  private writeFixture(kind: string, url: string, response: unknown) {
    if (this.mode !== 'record' || !this.fixtureDir) return
    writeFileSync(join(this.fixtureDir, `${fixtureKey(kind, url)}.json`), JSON.stringify({ kind, url: redactUrl(url), response: redactResponse(response) }, null, 1))
  }

  /** GET (or HEAD) a URL under the Level 0 policy. Never throws for HTTP error statuses. */
  async get(rawUrl: string, opts: GetOptions = {}): Promise<HttpResponse> {
    const method = opts.method ?? 'GET'
    SafeHttp.assertMethod(method)
    const started = Date.now()
    const at = new Date().toISOString()
    const kind = method
    try {
      this.assertUrl(rawUrl)
      const fx = this.readFixture<HttpResponse>(kind, rawUrl)
      if (fx) {
        this.log.push({ method, url: redactUrl(rawUrl), status: fx.status, ms: 0, at })
        return fx
      }
      const res = await this.fetchFollowing(rawUrl, method, opts)
      this.writeFixture(kind, rawUrl, res)
      this.log.push({ method, url: redactUrl(rawUrl), status: res.status, ms: Date.now() - started, at })
      return res
    } catch (err) {
      this.log.push({ method, url: redactUrl(rawUrl), ms: Date.now() - started, at, error: (err as Error).message })
      throw err
    }
  }

  private async fetchFollowing(rawUrl: string, method: 'GET' | 'HEAD', opts: GetOptions): Promise<HttpResponse> {
    const maxBytes = opts.maxBytes ?? 2_000_000
    const redirects: string[] = []
    let current = rawUrl
    for (let hop = 0; hop <= 5; hop++) {
      const u = this.assertUrl(current, hop > 0 && opts.followAnyPublicRedirect)
      await this.assertPublicDns(u.hostname)
      await this.pace(u.hostname)
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000)
      let res: Response
      try {
        res = await fetch(u, {
          method,
          redirect: 'manual',
          signal: ctrl.signal,
          headers: { 'user-agent': USER_AGENT, accept: opts.accept ?? '*/*', 'accept-language': 'en' },
        })
      } finally {
        clearTimeout(timer)
      }
      const location = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && location && hop < 5) {
        const next = new URL(location, u).toString()
        redirects.push(next)
        const nextHost = new URL(next).hostname
        if (!opts.followAnyPublicRedirect && !hostAllowed(nextHost, this.allowed)) {
          // Stop at the edge of the allow-list; the redirect itself is evidence.
          await res.body?.cancel()
          return this.toResponse(rawUrl, current, res, '', false, redirects)
        }
        await res.body?.cancel()
        current = next
        continue
      }
      const { text, truncated } = method === 'HEAD' ? { text: '', truncated: false } : await readCapped(res, maxBytes)
      return this.toResponse(rawUrl, current, res, text, truncated, redirects)
    }
    throw new Error(`Too many redirects for ${rawUrl}`)
  }

  private toResponse(url: string, finalUrl: string, res: Response, body: string, truncated: boolean, redirects: string[]): HttpResponse {
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => {
      if (k !== 'set-cookie') headers[k] = v
    })
    return { url, finalUrl, status: res.status, headers, setCookies: res.headers.getSetCookie?.() ?? [], redirects, body, truncated }
  }

  /** Read the TLS certificate of an allowed host (a handshake only; no HTTP request is sent). */
  async tlsCert(host: string): Promise<TlsCertInfo> {
    const url = `tls://${host}:443`
    const started = Date.now()
    const at = new Date().toISOString()
    try {
      if (!hostAllowed(host, this.allowed)) throw new PolicyError(`Host not on the Level 0 allow-list: ${host}`)
      const fx = this.readFixture<TlsCertInfo>('TLS', url)
      if (fx) {
        this.log.push({ method: 'TLS', url, ms: 0, at })
        return fx
      }
      await this.assertPublicDns(host)
      const info = await new Promise<TlsCertInfo>((resolve, reject) => {
        const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 10_000 }, () => {
          const c = socket.getPeerCertificate()
          const name = (o: Record<string, unknown> | undefined) => (o ? Object.entries(o).map(([k, v]) => `${k}=${String(v)}`).join(', ') : '')
          resolve({
            host,
            subject: name(c.subject as unknown as Record<string, unknown>),
            issuer: name(c.issuer as unknown as Record<string, unknown>),
            validFrom: new Date(c.valid_from).toISOString(),
            validTo: new Date(c.valid_to).toISOString(),
            altNames: (c.subjectaltname ?? '').split(',').map((s) => s.trim().replace(/^DNS:/, '')).filter(Boolean),
            protocol: socket.getProtocol(),
            authorized: socket.authorized,
            authorizationError: socket.authorizationError ? String(socket.authorizationError) : undefined,
          })
          socket.end()
        })
        socket.on('timeout', () => socket.destroy(new Error('TLS timeout')))
        socket.on('error', reject)
      })
      this.writeFixture('TLS', url, info)
      this.log.push({ method: 'TLS', url, ms: Date.now() - started, at })
      return info
    } catch (err) {
      this.log.push({ method: 'TLS', url, ms: Date.now() - started, at, error: (err as Error).message })
      throw err
    }
  }
}

function redactResponse(r: unknown): unknown {
  if (r && typeof r === 'object' && 'url' in r) {
    const x = r as HttpResponse
    return { ...x, url: redactUrl(x.url), finalUrl: redactUrl(x.finalUrl) }
  }
  return r
}

async function readCapped(res: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: '', truncated: false }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      chunks.push(value.subarray(0, value.byteLength - (total - maxBytes)))
      truncated = true
      await reader.cancel()
      break
    }
    chunks.push(value)
  }
  return { text: Buffer.concat(chunks).toString('utf8'), truncated }
}
