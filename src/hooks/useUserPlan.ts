import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export type UserPlan = 'free' | 'pro' | 'max'

export interface UserPlanState {
  plan: UserPlan
  freeAppCount: number
  loading: boolean
  refresh: () => Promise<void>
}

const FREE_APP_LIMIT = 2

/**
 * Loads the current user's plan + count of successful free-tier app generations.
 *
 * Plan resolution: a row in `subscriptions` with status='active' establishes the
 * plan; absence of an active row implies 'free'. Free-app count is `usage_logs`
 * rows with generation_type='app' and success=true. The count is only
 * meaningful while plan='free'; for paid plans we skip the second query.
 *
 * Subscribes to realtime UPDATE on the user's subscriptions row so plan
 * upgrades flip the navbar chip without a refresh.
 */
export function useUserPlan(): UserPlanState {
  const [plan, setPlan] = useState<UserPlan>('free')
  const [freeAppCount, setFreeAppCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)

  const loadCount = useCallback(async (userId: string) => {
    if (!supabase) return
    const { count } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('generation_type', 'app')
      .eq('success', true)
    setFreeAppCount(count ?? 0)
  }, [])

  const refresh = useCallback(async () => {
    const userId = userIdRef.current
    if (!userId) return
    await loadCount(userId)
  }, [loadCount])

  useEffect(() => {
    let realtimeSub: ReturnType<NonNullable<typeof supabase>['channel']> | null = null
    let cancelled = false

    void (async () => {
      if (!supabase) {
        setLoading(false)
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) {
        setLoading(false)
        return
      }
      userIdRef.current = user.id

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .maybeSingle()

      if (cancelled) return
      const resolvedPlan: UserPlan = sub?.plan === 'pro' || sub?.plan === 'max' ? sub.plan : 'free'
      setPlan(resolvedPlan)

      if (resolvedPlan === 'free') {
        await loadCount(user.id)
      }
      if (cancelled) return
      setLoading(false)

      realtimeSub = supabase.channel('user-plan-updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`,
        }, (payload: { new: { plan?: string; status?: string } | null }) => {
          const row = payload.new
          if (!row) return
          const next: UserPlan = (row.status === 'active' || row.status === 'trialing') && (row.plan === 'pro' || row.plan === 'max')
            ? row.plan
            : 'free'
          setPlan(next)
        })
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (realtimeSub) supabase?.removeChannel(realtimeSub)
    }
  }, [loadCount])

  return { plan, freeAppCount, loading, refresh }
}

export { FREE_APP_LIMIT }
