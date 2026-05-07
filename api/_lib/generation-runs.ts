import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Helpers for the generation_runs lifecycle. All ops are best-effort: failures
 * log and return null/false rather than throwing, so the existing generation
 * happy path keeps working even if persistence misbehaves. The only hard error
 * is a 23505 unique-constraint violation on the partial index — that signals
 * "another run is already active" and the caller MUST stop and return 409.
 */

export type GenerationRunMode = 'app' | 'flow' | 'plan'
export type GenerationRunStatus = 'running' | 'complete' | 'failed' | 'aborted'

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

export interface CreateRunResult {
  run: GenerationRun | null
  conflict: { existingRunId: string } | null
  error: string | null
}

/**
 * Defensive ownership check. RLS would block cross-user writes anyway, but
 * failing fast at the run boundary gives a cleaner error than a confusing
 * RLS-rejection mid-stream.
 */
export async function verifyProjectOwnership(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const { data, error } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .maybeSingle()
  if (error) {
    console.error('[generation-runs] ownership check failed:', error.message)
    return { ok: false, status: 500, error: 'ownership_check_failed' }
  }
  if (!data) return { ok: false, status: 404, error: 'project_not_found' }
  if (data.user_id !== userId) return { ok: false, status: 403, error: 'project_not_owned' }
  return { ok: true, status: 200 }
}

export async function createGenerationRun(
  supabase: SupabaseClient,
  projectId: string,
  mode: GenerationRunMode,
  totalScreens: number | null,
): Promise<CreateRunResult> {
  const { data, error } = await supabase
    .from('generation_runs')
    .insert({
      project_id: projectId,
      mode,
      status: 'running',
      total_screens: totalScreens,
      current_screen_index: 0,
    })
    .select()
    .single()
  if (error) {
    // Postgres unique-violation = another run is already active for this
    // project. Resolve the conflicting run so the client can subscribe to it.
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('generation_runs')
        .select('id')
        .eq('project_id', projectId)
        .eq('status', 'running')
        .maybeSingle()
      return {
        run: null,
        conflict: { existingRunId: existing?.id ?? '' },
        error: null,
      }
    }
    console.error('[generation-runs] insert failed:', error.message)
    return { run: null, conflict: null, error: error.message }
  }
  return { run: data as GenerationRun, conflict: null, error: null }
}

export async function setProjectState(
  supabase: SupabaseClient,
  projectId: string,
  state: 'planning' | 'building' | 'built',
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ state, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) {
    console.warn('[generation-runs] project state update failed:', state, error.message)
  }
}

export async function updateRunProgress(
  supabase: SupabaseClient,
  runId: string,
  currentScreenIndex: number,
  totalScreens?: number,
): Promise<void> {
  const patch: Record<string, unknown> = { current_screen_index: currentScreenIndex }
  if (typeof totalScreens === 'number') patch.total_screens = totalScreens
  const { error } = await supabase
    .from('generation_runs')
    .update(patch)
    .eq('id', runId)
  if (error) {
    console.warn('[generation-runs] progress update failed:', error.message)
  }
}

export async function completeRun(
  supabase: SupabaseClient,
  runId: string,
): Promise<void> {
  const { error } = await supabase
    .from('generation_runs')
    .update({ status: 'complete', completed_at: new Date().toISOString() })
    .eq('id', runId)
    .eq('status', 'running')
  if (error) {
    console.warn('[generation-runs] complete update failed:', error.message)
  }
}

export async function failRun(
  supabase: SupabaseClient,
  runId: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await supabase
    .from('generation_runs')
    .update({
      status: 'failed',
      error: errorMessage.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .eq('status', 'running')
  if (error) {
    console.warn('[generation-runs] fail update failed:', error.message)
  }
}

export async function abortRun(
  supabase: SupabaseClient,
  runId: string,
): Promise<void> {
  const { error } = await supabase
    .from('generation_runs')
    .update({ status: 'aborted', completed_at: new Date().toISOString() })
    .eq('id', runId)
    .eq('status', 'running')
  if (error) {
    console.warn('[generation-runs] abort update failed:', error.message)
  }
}
