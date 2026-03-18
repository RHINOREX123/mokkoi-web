import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Resolve Supabase config from all possible env var names.
 * Returns empty strings if not configured (auth will be skipped gracefully).
 */
function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  return { url, key }
}

/**
 * Verify the Supabase auth token from the request.
 *
 * Behavior:
 * - If Supabase is NOT configured (no env vars): skips auth, returns a
 *   pseudo-user so the app still works. Logs a warning.
 * - If Supabase IS configured but no token sent: 401
 * - If Supabase IS configured but token is invalid: 401
 * - If Supabase IS configured and token is valid: returns real user
 */
export async function authenticateRequest(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ id: string; email?: string } | null> {
  // === ENV VAR DEBUG (remove after confirming in Vercel logs) ===
  console.log('=== ENV VAR DEBUG ===', {
    SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV,
  })

  const { url, key } = getSupabaseConfig()
  const supabaseConfigured = Boolean(url && key)

  if (!supabaseConfigured) {
    // Supabase not configured — skip auth entirely so app still works
    console.warn('WARNING: Supabase not configured, auth disabled. Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel dashboard.')
    return { id: 'anonymous', email: undefined }
  }

  // --- Extract auth header (handle Vercel edge cases) ---
  const rawHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
  console.log('Auth header:', headerValue ? 'present' : 'missing')

  if (!headerValue || !headerValue.toLowerCase().startsWith('bearer ')) {
    console.log('Auth rejected: no Bearer token in header')
    res.status(401).json({ error: 'Please sign in to generate screens.' })
    return null
  }

  const bearerToken = headerValue.replace(/^bearer\s+/i, '').trim()
  if (!bearerToken) {
    console.log('Auth rejected: empty token after Bearer prefix')
    res.status(401).json({ error: 'Please sign in to generate screens.' })
    return null
  }

  // --- Verify token with Supabase ---
  try {
    const supabase = createClient(url, key)
    const { data, error } = await supabase.auth.getUser(bearerToken)

    if (error || !data.user) {
      console.log('Auth rejected: token verification failed -', error?.message || 'no user returned')
      res.status(401).json({ error: 'Invalid session. Please sign in again.' })
      return null
    }

    console.log('Auth success: user', data.user.id)
    return { id: data.user.id, email: data.user.email }
  } catch (err) {
    console.error('Auth error (Supabase call failed):', err)
    res.status(500).json({ error: 'Authentication service error. Please try again.' })
    return null
  }
}

/**
 * Check if user has exceeded daily generation limit.
 * Returns true if rate-limited (and sends 429 response).
 */
export async function checkRateLimit(
  userId: string,
  res: VercelResponse,
  dailyLimit = 10
): Promise<boolean> {
  // Skip for anonymous or unconfigured
  if (userId === 'anonymous') return false

  const { url, key } = getSupabaseConfig()
  if (!url || !key) return false
  const supabase = createClient(url, key)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { count, error } = await supabase
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', today.toISOString())

  if (error) {
    // If table doesn't exist yet, skip rate limiting
    console.warn('Rate limit check failed (table may not exist yet):', error.message)
    return false
  }

  if (count !== null && count >= dailyLimit) {
    res.status(429).json({
      error: `Daily limit reached (${count}/${dailyLimit}). Upgrade to Pro for unlimited generations.`,
    })
    return true
  }

  return false
}

/**
 * Log usage to the usage_logs table. Fire-and-forget (does not block).
 */
export function logUsage(params: {
  userId: string
  projectId?: string
  modelUsed: string
  tokensIn?: number
  tokensOut?: number
  generationType: 'new_screen' | 'edit' | 'flow' | 'variation' | 'regenerate'
  promptPreview?: string
  success: boolean
}): void {
  // Skip for anonymous or unconfigured
  if (params.userId === 'anonymous') return

  const { url, key } = getSupabaseConfig()
  if (!url || !key) return
  const supabase = createClient(url, key)

  supabase
    .from('usage_logs')
    .insert({
      user_id: params.userId,
      project_id: params.projectId || null,
      model_used: params.modelUsed,
      tokens_in: params.tokensIn || null,
      tokens_out: params.tokensOut || null,
      generation_type: params.generationType,
      prompt_preview: params.promptPreview?.slice(0, 100) || null,
      success: params.success,
    })
    .then(({ error }) => {
      if (error) console.warn('Usage log insert failed:', error.message)
    })
}
