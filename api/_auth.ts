import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

/**
 * Verify the Supabase auth token from the request.
 * Returns the user object if valid, or sends a 401 and returns null.
 */
export async function authenticateRequest(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: missing auth token' })
    return null
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    res.status(401).json({ error: 'Unauthorized: invalid auth token' })
    return null
  }

  return { id: data.user.id, email: data.user.email }
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
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
