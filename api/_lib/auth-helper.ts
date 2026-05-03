import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function getSupabaseConfig() {
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

/** Check if this is an MCP request authenticated via API key */
export function authenticateMCPRequest(
  req: VercelRequest
): { id: string; email?: string; isMCP: true } | null {
  const rawSource = req.headers['x-mokkoi-source'] || ''
  const source = Array.isArray(rawSource) ? rawSource[0] : rawSource

  // Also check if Bearer token is an API key (starts with sk-ant-)
  const rawAuth = req.headers['authorization'] || req.headers['Authorization'] || ''
  const authValue = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth
  const bearerToken = authValue.replace(/^bearer\s+/i, '').trim()
  const isApiKeyAuth = bearerToken.startsWith('sk-ant-')


  // Accept MCP if either: explicit header OR Bearer token is an API key (not a JWT)
  if (source !== 'mcp' && !isApiKeyAuth) return null

  // Try X-API-Key header first, then fall back to Bearer token
  const rawApiKey = req.headers['x-api-key'] || ''
  const apiKeyFromHeader = Array.isArray(rawApiKey) ? rawApiKey[0] : rawApiKey
  const apiKey = apiKeyFromHeader || bearerToken

  // Accept ANTHROPIC_API_KEY, MOKKOI_API_KEY, or SUPABASE_SERVICE_ROLE_KEY as valid server keys
  const validKeys = [
    process.env.ANTHROPIC_API_KEY,
    process.env.MOKKOI_API_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter(Boolean) as string[]

  if (!apiKey || validKeys.length === 0) return null
  if (!validKeys.some((key) => safeCompare(apiKey, key))) return null

  return { id: 'mcp', email: undefined, isMCP: true }
}

export async function authenticateRequest(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ id: string; email?: string; isMCP?: boolean } | null> {
  // --- MCP auth: check X-Mokkoi-Source header first ---
  const mcpAuth = authenticateMCPRequest(req)
  if (mcpAuth) return mcpAuth

  const { url, key } = getSupabaseConfig()
  const supabaseConfigured = Boolean(url && key)

  if (!supabaseConfigured) {
    console.warn('WARNING: Supabase not configured, auth disabled. Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel dashboard.')
    return { id: 'anonymous', email: undefined }
  }

  const rawHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
  if (!headerValue || !headerValue.toLowerCase().startsWith('bearer ')) {
    res.status(401).json({ error: 'Please sign in to generate screens.' })
    return null
  }

  const bearerToken = headerValue.replace(/^bearer\s+/i, '').trim()
  if (!bearerToken) {
    res.status(401).json({ error: 'Please sign in to generate screens.' })
    return null
  }

  try {
    const supabase = createClient(url, key)
    const { data, error } = await supabase.auth.getUser(bearerToken)

    if (error || !data.user) {
      console.warn('Auth rejected: token verification failed -', error?.message || 'no user returned')
      res.status(401).json({ error: 'Invalid session. Please sign in again.' })
      return null
    }

    return { id: data.user.id, email: data.user.email }
  } catch (err) {
    console.error('Auth error (Supabase call failed):', err)
    res.status(500).json({ error: 'Authentication service error. Please try again.' })
    return null
  }
}

export async function checkRateLimit(
  userId: string,
  res: VercelResponse,
  dailyLimit = 10,
  email?: string | null
): Promise<boolean> {
  if (userId === 'anonymous') return false

  // Admin bypass — no rate limit for founders/admins
  if (isAdmin(email)) return false

  const { url, key } = getSupabaseConfig()
  if (!url || !key) return false
  const supabase = createClient(url, key)

  // BUG 5 FIX: Use UTC explicitly to avoid server timezone inconsistencies
  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const { count, error } = await supabase
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayUTC.toISOString())

  if (error) {
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

// --- Credit-based system ---

// Credit costs by plan + generation type. Aligned with src/lib/pricing.ts CREDIT_COSTS.
// Edit bumped 1 → 2 to keep edit-heavy users above 50% gross margin.
// `max` retained as legacy alias for `team` so existing DB rows keep working.
const CREDIT_COSTS: Record<string, Record<string, number>> = {
  free:  { new_screen: 5, edit: 2, flow: 15, screenshot: 8, app: 20 },
  hobby: { new_screen: 5, edit: 2, flow: 15, screenshot: 8, app: 20 },
  pro:   { new_screen: 5, edit: 2, flow: 15, screenshot: 8, app: 20 },
  team:  { new_screen: 5, edit: 2, flow: 15, screenshot: 8, app: 20 },
  max:   { new_screen: 5, edit: 2, flow: 15, screenshot: 8, app: 20 }, // legacy alias for team
}

/**
 * Admin bypass: users whose email is listed in the ADMIN_EMAILS env var
 * skip all credit checks, rate limits, and deductions. Intended for founders
 * and internal testers so they never run out of credits while iterating.
 *
 * To add a new admin (e.g., Ishan), edit the Vercel env var — NO code change needed:
 *
 *   ADMIN_EMAILS=sihmarsahil@gmail.com,ishan@example.com,another@founder.com
 *
 * Comma-separated, case-insensitive, whitespace tolerated. Redeploy to apply.
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function isAdmin(email?: string | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function checkCredits(
  userId: string,
  generationType: 'new_screen' | 'edit' | 'flow' | 'screenshot' | 'app',
  email?: string | null
): Promise<{ hasCredits: boolean; creditsRemaining: number; cost: number; error?: string; upgradeUrl?: string }> {
  if (userId === 'anonymous' || userId === 'mcp') {
    return { hasCredits: true, creditsRemaining: -1, cost: 0 }
  }

  // Admin bypass — see ADMIN_EMAILS docs above
  if (isAdmin(email)) {
    return { hasCredits: true, creditsRemaining: 99999, cost: 0 }
  }

  const { url, key } = getSupabaseConfig()
  if (!url || !key) return { hasCredits: true, creditsRemaining: -1, cost: 0 }

  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || key)

  let { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, credits_remaining')
    .eq('user_id', userId)
    .single()

  if (!sub) {
    // Default free tier
    sub = { plan: 'free', credits_remaining: 50 }
  }

  const plan = sub.plan || 'free'
  const costs = CREDIT_COSTS[plan] || CREDIT_COSTS.free
  const cost = costs[generationType] || 1

  if (sub.credits_remaining < cost) {
    return {
      hasCredits: false,
      creditsRemaining: sub.credits_remaining,
      cost,
      error: 'No credits remaining',
      upgradeUrl: '/pricing',
    }
  }

  return { hasCredits: true, creditsRemaining: sub.credits_remaining, cost }
}

export async function deductCredits(
  userId: string,
  generationType: 'new_screen' | 'edit' | 'flow' | 'screenshot' | 'app',
  email?: string | null
): Promise<{ success: boolean; creditsRemaining: number; error?: string; upgradeUrl?: string }> {
  if (userId === 'anonymous' || userId === 'mcp') {
    return { success: true, creditsRemaining: -1 }
  }

  // Admin bypass — no deduction, always succeed
  if (isAdmin(email)) {
    return { success: true, creditsRemaining: 99999 }
  }

  const { url, key } = getSupabaseConfig()
  if (!url || !key) return { success: true, creditsRemaining: -1 }

  const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || key)

  // Get or create subscription
  let { data: sub, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !sub) {
    // Create default free subscription
    const { data: newSub, error: insertError } = await supabaseAdmin
      .from('subscriptions')
      .insert({ user_id: userId, plan: 'free', credits_remaining: 50, credits_monthly_limit: 50, status: 'active' })
      .select()
      .single()

    if (insertError) {
      console.warn('Failed to create default subscription:', insertError.message)
      return { success: true, creditsRemaining: -1 }
    }
    sub = newSub
  }

  const plan = sub.plan || 'free'
  const costs = CREDIT_COSTS[plan] || CREDIT_COSTS.free
  const cost = costs[generationType] || 1

  if (sub.credits_remaining < cost) {
    return {
      success: false,
      creditsRemaining: sub.credits_remaining,
      error: 'No credits remaining',
      upgradeUrl: '/pricing',
    }
  }

  const newBalance = sub.credits_remaining - cost
  await supabaseAdmin
    .from('subscriptions')
    .update({ credits_remaining: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  return { success: true, creditsRemaining: newBalance }
}

export async function getUserCredits(
  userId: string,
  email?: string | null
): Promise<{ plan: string; creditsRemaining: number; creditsLimit: number }> {
  if (userId === 'anonymous' || userId === 'mcp') {
    return { plan: 'free', creditsRemaining: -1, creditsLimit: -1 }
  }

  // Admin bypass — UI shows effectively unlimited
  if (isAdmin(email)) {
    return { plan: 'max', creditsRemaining: 99999, creditsLimit: 99999 }
  }

  const { url, key } = getSupabaseConfig()
  if (!url || !key) return { plan: 'free', creditsRemaining: -1, creditsLimit: -1 }

  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || key)

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, credits_remaining, credits_monthly_limit')
    .eq('user_id', userId)
    .single()

  if (!sub) {
    return { plan: 'free', creditsRemaining: 50, creditsLimit: 50 }
  }

  return {
    plan: sub.plan || 'free',
    creditsRemaining: sub.credits_remaining,
    creditsLimit: sub.credits_monthly_limit,
  }
}

export async function getUserPlan(userId: string, email?: string | null): Promise<string> {
  if (userId === 'anonymous' || userId === 'mcp') return 'pro' // MCP/anonymous get pro models

  // Admin bypass — admins get Max-tier model quality
  if (isAdmin(email)) return 'max'

  const { url, key } = getSupabaseConfig()
  if (!url || !key) return 'free'

  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || key)
  const { data } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .single()

  return data?.plan || 'free'
}

export function logUsage(params: {
  userId: string
  projectId?: string
  modelUsed: string
  tokensIn?: number
  tokensOut?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  generationType: 'new_screen' | 'edit' | 'flow' | 'variation' | 'regenerate' | 'app' | 'screenshot'
  promptPreview?: string
  success: boolean
}): void {
  if (params.userId === 'anonymous') return

  const { url, key } = getSupabaseConfig()
  if (!url || !key) return
  // Use service role key to bypass RLS (logUsage has no auth session context)
  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || key)

  // Calculate estimated cost based on model pricing
  let costUsd: number | null = null
  if (params.tokensIn || params.tokensOut) {
    const isSonnet = params.modelUsed.includes('sonnet')
    const inputPrice = isSonnet ? 3.0 : 0.8       // per 1M tokens
    const outputPrice = isSonnet ? 15.0 : 4.0      // per 1M tokens
    const cacheReadPrice = isSonnet ? 0.3 : 0.08   // per 1M tokens
    const cacheWritePrice = isSonnet ? 3.75 : 1.0  // per 1M tokens

    const cacheRead = params.cacheReadTokens || 0
    const cacheWrite = params.cacheCreationTokens || 0
    const uncachedInput = (params.tokensIn || 0) - cacheRead - cacheWrite

    costUsd = (
      (uncachedInput * inputPrice / 1_000_000) +
      (cacheRead * cacheReadPrice / 1_000_000) +
      (cacheWrite * cacheWritePrice / 1_000_000) +
      ((params.tokensOut || 0) * outputPrice / 1_000_000)
    )
  }

  // Log cache hit status to console for debugging
  if (params.cacheReadTokens || params.cacheCreationTokens) {
    console.log(`[token-usage] model=${params.modelUsed} in=${params.tokensIn} out=${params.tokensOut} cache_read=${params.cacheReadTokens || 0} cache_write=${params.cacheCreationTokens || 0} cost=$${costUsd?.toFixed(4)}`)
  }

  supabase
    .from('usage_logs')
    .insert({
      user_id: params.userId,
      project_id: params.projectId || null,
      model_used: params.modelUsed,
      tokens_in: params.tokensIn || null,
      tokens_out: params.tokensOut || null,
      cache_read_tokens: params.cacheReadTokens || null,
      cache_creation_tokens: params.cacheCreationTokens || null,
      cost_usd: costUsd,
      generation_type: params.generationType,
      prompt_preview: params.promptPreview?.slice(0, 100) || null,
      success: params.success,
    })
    .then(({ error }) => {
      if (error) console.warn('Usage log insert failed:', error.message)
    })
}

/**
 * Log edit diffs to the edit_diffs table. Fire-and-forget (does not block).
 */
export function logEditDiff(params: {
  userId: string
  projectId?: string
  screenId?: string
  editType: 'ai_edit' | 'variation' | 'regenerate'
  prompt?: string
  treeBefore: any
  treeAfter: any
  modelUsed?: string
}): void {
  if (params.userId === 'anonymous') return

  const { url, key } = getSupabaseConfig()
  if (!url || !key) return
  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || key)

  supabase
    .from('edit_diffs')
    .insert({
      user_id: params.userId,
      project_id: params.projectId || null,
      screen_id: params.screenId || null,
      edit_type: params.editType,
      prompt: params.prompt?.slice(0, 500) || null,
      component_tree_before: params.treeBefore,
      component_tree_after: params.treeAfter,
      model_used: params.modelUsed || null,
    })
    .then(({ error }) => {
      if (error) console.warn('Edit diff log insert failed:', error.message)
    })
}
