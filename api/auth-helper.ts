import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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

  console.log('MCP auth check:', { hasSourceHeader: !!source, isApiKeyInBearer: isApiKeyAuth })

  // Accept MCP if either: explicit header OR Bearer token is an API key (not a JWT)
  if (source !== 'mcp' && !isApiKeyAuth) return null

  // Try X-API-Key header first, then fall back to Bearer token
  const rawApiKey = req.headers['x-api-key'] || ''
  const apiKeyFromHeader = Array.isArray(rawApiKey) ? rawApiKey[0] : rawApiKey
  const apiKey = apiKeyFromHeader || bearerToken
  const serverKey = process.env.ANTHROPIC_API_KEY || ''

  if (!apiKey || !serverKey) return null
  if (apiKey !== serverKey) return null

  console.log('MCP request authenticated via API key')
  return { id: 'mcp', email: undefined, isMCP: true }
}

export async function authenticateRequest(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ id: string; email?: string; isMCP?: boolean } | null> {
  // --- MCP auth: check X-Mokkoi-Source header first ---
  const mcpAuth = authenticateMCPRequest(req)
  if (mcpAuth) return mcpAuth

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
    console.warn('WARNING: Supabase not configured, auth disabled. Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel dashboard.')
    return { id: 'anonymous', email: undefined }
  }

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

export async function checkRateLimit(
  userId: string,
  res: VercelResponse,
  dailyLimit = 10
): Promise<boolean> {
  if (userId === 'anonymous') return false

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

const CREDIT_COSTS: Record<string, Record<string, number>> = {
  free: { new_screen: 5, edit: 1, flow: 15, screenshot: 8 },
  pro: { new_screen: 5, edit: 1, flow: 15, screenshot: 8 },
  max: { new_screen: 3, edit: 1, flow: 10, screenshot: 5 },
}

export async function deductCredits(
  userId: string,
  generationType: 'new_screen' | 'edit' | 'flow' | 'screenshot'
): Promise<{ success: boolean; creditsRemaining: number; error?: string; upgradeUrl?: string }> {
  if (userId === 'anonymous' || userId === 'mcp') {
    return { success: true, creditsRemaining: -1 }
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
  userId: string
): Promise<{ plan: string; creditsRemaining: number; creditsLimit: number }> {
  if (userId === 'anonymous' || userId === 'mcp') {
    return { plan: 'free', creditsRemaining: -1, creditsLimit: -1 }
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

export async function getUserPlan(userId: string): Promise<string> {
  if (userId === 'anonymous' || userId === 'mcp') return 'pro' // MCP/anonymous get pro models

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
  generationType: 'new_screen' | 'edit' | 'flow' | 'variation' | 'regenerate'
  promptPreview?: string
  success: boolean
}): void {
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
  const supabase = createClient(url, key)

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
