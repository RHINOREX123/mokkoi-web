export type ValidatedSupabaseCreds = { url: string; anonKey: string }

export type ValidationResult =
  | { ok: true; creds: ValidatedSupabaseCreds }
  | { ok: false; code: 'invalid_url' | 'invalid_key_format' | 'service_role_rejected'; message: string }

const URL_PATTERN = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/

function base64UrlDecode(input: string): string | null {
  // base64url → base64: replace -/_ and re-pad. atob throws on bad input.
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad
  try {
    if (typeof atob === 'function') return atob(b64)
    // Node fallback (test envs without atob).
    return Buffer.from(b64, 'base64').toString('binary')
  } catch {
    return null
  }
}

export function validateSupabaseCreds(url: string, key: string): ValidationResult {
  const cleanUrl = (url ?? '').trim()
  const cleanKey = (key ?? '').trim()

  if (!URL_PATTERN.test(cleanUrl)) {
    return { ok: false, code: 'invalid_url', message: 'Supabase URL must look like https://your-project-ref.supabase.co' }
  }
  const normalizedUrl = cleanUrl.endsWith('/') ? cleanUrl.slice(0, -1) : cleanUrl

  const parts = cleanKey.split('.')
  if (parts.length !== 3) {
    return { ok: false, code: 'invalid_key_format', message: 'API key is not a valid JWT (expected three dot-separated segments).' }
  }
  const decoded = base64UrlDecode(parts[1])
  if (decoded === null) {
    return { ok: false, code: 'invalid_key_format', message: 'API key payload is not valid base64.' }
  }
  let payload: unknown
  try {
    payload = JSON.parse(decoded)
  } catch {
    return { ok: false, code: 'invalid_key_format', message: 'API key payload is not valid JSON.' }
  }
  const role = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>).role : undefined

  if (role === 'service_role') {
    return {
      ok: false,
      code: 'service_role_rejected',
      message: 'This is a service-role key — pasting it here would bypass Row Level Security and expose every row in your database to anyone using the published app. Use the anon (public) key instead.',
    }
  }
  if (role !== 'anon') {
    return {
      ok: false,
      code: 'invalid_key_format',
      message: typeof role === 'string'
        ? `API key role is "${role}" — only the anon (public) key is supported.`
        : 'API key payload is missing a role field.',
    }
  }

  return { ok: true, creds: { url: normalizedUrl, anonKey: cleanKey } }
}
