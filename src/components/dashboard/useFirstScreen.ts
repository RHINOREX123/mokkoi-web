import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { ComponentNode } from '../../types/mokkoi'

export interface FirstScreenState {
  tree: ComponentNode | null
  loading: boolean
  error: string | null
}

/**
 * useFirstScreen — lazily fetch the first (lowest order_index) screen of a
 * project so the dashboard can render its component_tree as a thumbnail.
 *
 * Behavior:
 *  - tree = null while loading or when the project has zero screens
 *  - error is non-null on a fetch failure (the caller falls back to the
 *    calm-pulse PhoneThumbnail default — we don't want a single failed
 *    project to break the whole dashboard)
 *  - the request kicks off on mount and cancels via an AbortController
 *    on unmount or when projectId changes
 *
 * NOTE: each card calls this independently so we issue one query per
 * project. For 4–8 cards on the dashboard this is fine. If we ever scale
 * recents to 50+ cards, batch-fetch by project_id IN(...) instead.
 */
export function useFirstScreen(projectId: string | undefined): FirstScreenState {
  const [state, setState] = useState<FirstScreenState>({
    tree: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!projectId || !supabase) {
      setState({ tree: null, loading: false, error: null })
      return
    }

    let cancelled = false
    setState({ tree: null, loading: true, error: null })

    supabase
      .from('screens')
      .select('component_tree')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setState({ tree: null, loading: false, error: error.message })
          return
        }
        const tree = (data?.component_tree ?? null) as ComponentNode | null
        setState({ tree, loading: false, error: null })
      })

    return () => {
      cancelled = true
    }
  }, [projectId])

  return state
}
