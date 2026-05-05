import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './auth-helper.js'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function isAdmin(email?: string | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

/**
 * Binary plan tier used by the free-app gate.
 *
 * Schema (supabase/subscriptions.sql):
 *   plan   ∈ ('free','pro','max')
 *   status ∈ ('active','cancelled','past_due','trialing')
 *
 * 'paid' iff plan != 'free' AND status ∈ ('active','trialing'). MCP, anonymous,
 * and admin emails always resolve to 'paid' (no gating). On any failure (no
 * Supabase config, missing row, query error) we fail closed to 'free' — the
 * gate is the safer default for a paywall.
 */
export async function getUserPlan(
  userId: string,
  email?: string | null,
): Promise<'free' | 'paid'> {
  if (userId === 'anonymous' || userId === 'mcp') return 'paid'
  if (isAdmin(email)) return 'paid'

  const { url, key } = getSupabaseConfig()
  if (!url || !key) return 'free'

  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || key)
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .single()

  if (error || !data) return 'free'

  const plan = data.plan || 'free'
  const status = data.status || 'active'
  if (plan !== 'free' && (status === 'active' || status === 'trialing')) {
    return 'paid'
  }
  return 'free'
}

export const FREE_APP_LIMIT = 2

export type AppGateDecision =
  | { allow: true }
  | {
      allow: false
      reason: 'free_app_limit_reached'
      free_apps_used: number
      free_apps_limit: typeof FREE_APP_LIMIT
    }

/**
 * Pure gate decision for full-app generations. Paid users are never gated; free
 * users are blocked once they have FREE_APP_LIMIT successful 'app' rows. Kept
 * pure so it can be unit-tested without Supabase.
 */
export function decideAppGate(
  tier: 'free' | 'paid',
  freeAppsUsed: number,
): AppGateDecision {
  if (tier === 'paid') return { allow: true }
  if (freeAppsUsed >= FREE_APP_LIMIT) {
    return {
      allow: false,
      reason: 'free_app_limit_reached',
      free_apps_used: freeAppsUsed,
      free_apps_limit: FREE_APP_LIMIT,
    }
  }
  return { allow: true }
}

/**
 * Lifetime count of successful full-app generations for this user. Used by the
 * free-tier gate (limit = 2). Counts only rows with generation_type='app' AND
 * success=true; iteration/edit/flow rows do not count.
 */
export async function getFreeAppCount(userId: string): Promise<number> {
  if (userId === 'anonymous' || userId === 'mcp') return 0

  const { url, key } = getSupabaseConfig()
  if (!url || !key) return 0

  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || key)
  const { count, error } = await supabase
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('generation_type', 'app')
    .eq('success', true)

  if (error) {
    console.warn('getFreeAppCount: query failed:', error.message)
    return 0
  }
  return count ?? 0
}
