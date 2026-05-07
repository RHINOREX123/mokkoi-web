import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type GenerationRunStatus = 'running' | 'complete' | 'failed' | 'aborted'
export type GenerationRunMode = 'app' | 'flow' | 'plan'

export interface GenerationRun {
  id: string
  project_id: string
  mode: GenerationRunMode
  status: GenerationRunStatus
  current_screen_index: number | null
  total_screens: number | null
  error: string | null
  started_at: string
  completed_at: string | null
}

export interface UseGenerationRun {
  run: GenerationRun | null
  /** True only when the run is genuinely active. A row stuck on 'running'
   *  past STALE_THRESHOLD_MS (e.g., the serverless function was killed by
   *  maxDuration before it could finalize) is treated as not-running so
   *  the UI doesn't show a perpetual "Resuming…". */
  isRunning: boolean
  /** True when status='running' but started_at is older than the stale
   *  threshold. Consumers can show a "last run stalled — try again" notice. */
  isStale: boolean
  progress: { current: number; total: number } | null
  loaded: boolean
}

// Vercel maxDuration is 300s (vercel.json). Allow 2× headroom for the LLM
// + DB roundtrips before declaring a 'running' row stale. Anything older
// than this almost certainly means the function died without finalizing.
const STALE_THRESHOLD_MS = 10 * 60 * 1000

/**
 * Subscribe to the latest generation_run for a project. Loads once on mount,
 * then keeps a realtime channel open for INSERT/UPDATE events so live
 * progress updates trickle in. When a new run starts, we adopt it; when the
 * current run flips to a terminal status, we keep showing it (consumers can
 * render "last generation failed" etc.).
 *
 * Skips entirely when projectId is null/empty or the supabase client is not
 * configured. Consumers should treat `loaded=false` as "we don't know yet"
 * (avoid flashing UI based on null run).
 */
export function useGenerationRun(projectId: string | null): UseGenerationRun {
  const [run, setRun] = useState<GenerationRun | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!projectId || !supabase) {
      setRun(null)
      setLoaded(true)
      return
    }
    setLoaded(false)
    let cancelled = false

    const load = async () => {
      const { data, error } = await supabase!
        .from('generation_runs')
        .select('*')
        .eq('project_id', projectId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        console.warn('[useGenerationRun] load failed:', error.message)
        setRun(null)
      } else {
        setRun((data as GenerationRun | null) ?? null)
      }
      setLoaded(true)
    }
    load()

    // Realtime: catch new runs (INSERT) and progress / status changes (UPDATE).
    // We listen at the project level rather than per-row because the row id
    // changes when a new run starts after a previous one completed.
    const channel = supabase
      .channel(`generation_runs:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'generation_runs',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (cancelled) return
          const next = payload.new as GenerationRun
          setRun(prev => {
            // New run replaces older runs; prefer the most recently started.
            if (!prev) return next
            return new Date(next.started_at) > new Date(prev.started_at) ? next : prev
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'generation_runs',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (cancelled) return
          const next = payload.new as GenerationRun
          setRun(prev => (prev && prev.id === next.id ? next : prev))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      if (supabase) supabase.removeChannel(channel)
    }
  }, [projectId])

  const rawRunning = run?.status === 'running'
  const startedAtMs = run?.started_at ? new Date(run.started_at).getTime() : 0
  const isStale = rawRunning && startedAtMs > 0 && Date.now() - startedAtMs > STALE_THRESHOLD_MS
  const isRunning = rawRunning && !isStale
  const progress: UseGenerationRun['progress'] =
    run && typeof run.total_screens === 'number' && run.total_screens > 0
      ? { current: run.current_screen_index ?? 0, total: run.total_screens }
      : null

  return { run, isRunning, isStale, progress, loaded }
}
