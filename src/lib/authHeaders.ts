import { supabase } from './supabase'

/**
 * Build the Authorization header for an authenticated Mokkoi API call.
 * Single source of truth — both useAIGeneration and the voice transcribe
 * flow read the user's bearer token through this so we don't drift.
 *
 * Throws when no session is available — callers either catch and toast, or
 * (for non-critical paths) just skip the call.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) throw new Error('Not authenticated. Please sign in.')
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated. Please sign in.')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}
