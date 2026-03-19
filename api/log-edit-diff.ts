import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest, getSupabaseConfig } from './auth-helper.js'

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
