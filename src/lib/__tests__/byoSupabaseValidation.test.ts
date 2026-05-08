import { describe, it, expect } from 'vitest'
import { validateSupabaseCreds } from '../byoSupabaseValidation'

// Helper: forge an unsigned JWT with the given payload. The validator only
// inspects the payload (middle segment); signature is not verified.
function makeJwt(payload: object): string {
  const enc = (obj: object) => {
    const b64 = (typeof Buffer !== 'undefined'
      ? Buffer.from(JSON.stringify(obj)).toString('base64')
      : btoa(JSON.stringify(obj)))
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.fake-signature`
}

const ANON = makeJwt({ role: 'anon', iss: 'supabase', ref: 'abcd' })
const SERVICE = makeJwt({ role: 'service_role', iss: 'supabase', ref: 'abcd' })
const AUTHENTICATED = makeJwt({ role: 'authenticated' })
const NO_ROLE = makeJwt({ iss: 'supabase' })

describe('validateSupabaseCreds', () => {
  it('accepts a valid URL + anon JWT', () => {
    const r = validateSupabaseCreds('https://abcd.supabase.co', ANON)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.creds.url).toBe('https://abcd.supabase.co')
      expect(r.creds.anonKey).toBe(ANON)
    }
  })

  it('strips trailing slash from URL', () => {
    const r = validateSupabaseCreds('https://abcd.supabase.co/', ANON)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.creds.url).toBe('https://abcd.supabase.co')
  })

  it('trims whitespace from inputs', () => {
    const r = validateSupabaseCreds('  https://abcd.supabase.co  ', `  ${ANON}  `)
    expect(r.ok).toBe(true)
  })

  it('rejects service-role key with service_role_rejected', () => {
    const r = validateSupabaseCreds('https://abcd.supabase.co', SERVICE)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('service_role_rejected')
      expect(r.message.toLowerCase()).toContain('service-role')
    }
  })

  it('rejects authenticated role as invalid_key_format', () => {
    const r = validateSupabaseCreds('https://abcd.supabase.co', AUTHENTICATED)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('invalid_key_format')
  })

  it('rejects JWT missing the role field', () => {
    const r = validateSupabaseCreds('https://abcd.supabase.co', NO_ROLE)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('invalid_key_format')
  })

  it('rejects a non-three-part token', () => {
    const r = validateSupabaseCreds('https://abcd.supabase.co', 'not.a.jwt.at-all')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('invalid_key_format')
  })

  it('rejects undecodable base64 in the payload', () => {
    const r = validateSupabaseCreds('https://abcd.supabase.co', 'header.@@@notbase64@@@.sig')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('invalid_key_format')
  })

  it('rejects a non-supabase.co URL', () => {
    const r = validateSupabaseCreds('https://example.com', ANON)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('invalid_url')
  })

  it('rejects http (non-https) URL', () => {
    const r = validateSupabaseCreds('http://abcd.supabase.co', ANON)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('invalid_url')
  })

  it('rejects URL with extra path segments', () => {
    const r = validateSupabaseCreds('https://abcd.supabase.co/some/path', ANON)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('invalid_url')
  })
})
