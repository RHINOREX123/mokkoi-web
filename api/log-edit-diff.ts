import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ===== Inlined auth logic (no separate _auth module for Vercel compatibility) =====

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

async function authenticateRequest(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ id: string; email?: string } | null> {
  const { url, key } = getSupabaseConfig()
  const supabaseConfigured = Boolean(url && key)

  if (!supabaseConfigured) {
    return { id: 'anonymous', email: undefined }
  }

  const rawHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader

  if (!headerValue || !headerValue.toLowerCase().startsWith('bearer ')) {
    res.status(401).json({ error: 'Please sign in.' })
    return null
  }

  const bearerToken = headerValue.replace(/^bearer\s+/i, '').trim()
  if (!bearerToken) {
    res.status(401).json({ error: 'Please sign in.' })
    return null
  }

  try {
    const supabase = createClient(url, key)
    const { data, error } = await supabase.auth.getUser(bearerToken)

    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid session. Please sign in again.' })
      return null
    }

    return { id: data.user.id, email: data.user.email }
  } catch (err) {
    console.error('Auth error:', err)
    res.status(500).json({ error: 'Authentication service error.' })
    return null
  }
}

// ===== End inlined auth logic =====

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await authenticateRequest(req, res)
  if (!user) return

  if (user.id === 'anonymous') {
    return res.status(200).json({ ok: true })
  }

  const { projectId, screenId, editType, prompt, treeBefore, treeAfter } = req.body ?? {}

  if (!editType || !treeBefore || !treeAfter) {
    return res.status(400).json({ error: 'Missing required fields: editType, treeBefore, treeAfter' })
  }

  const { url, key } = getSupabaseConfig()
  if (!url || !key) {
    return res.status(200).json({ ok: true })
  }

  const supabase = createClient(url, key)
  const { error } = await supabase.from('edit_diffs').insert({
    user_id: user.id,
    project_id: projectId || null,
    screen_id: screenId || null,
    edit_type: editType,
    prompt: prompt?.slice(0, 500) || null,
    component_tree_before: treeBefore,
    component_tree_after: treeAfter,
  })

  if (error) {
    console.warn('Edit diff insert failed:', error.message)
  }

  return res.status(200).json({ ok: true })
}
