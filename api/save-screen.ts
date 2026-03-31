import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}

/**
 * POST /api/save-screen
 * Saves a screen to the database using the service role key (bypasses RLS).
 * Called by the web UI after importing a screen.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = getServiceClient()
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' })
  }

  const { screenId, projectId, screenName, componentTree, prompt, orderIndex, source, xPos, yPos } = req.body || {}

  if (!projectId || !componentTree) {
    return res.status(400).json({ error: 'projectId and componentTree are required' })
  }

  // Verify the project exists
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()

  if (!project) {
    return res.status(404).json({ error: 'Project not found' })
  }

  const { data: saved, error } = await supabase
    .from('screens')
    .upsert({
      id: screenId || undefined,
      project_id: projectId,
      name: screenName || 'Imported Screen',
      component_tree: componentTree,
      original_prompt: prompt || null,
      order_index: orderIndex ?? 0,
      updated_at: new Date().toISOString(),
      source: source || 'web',
      x_pos: xPos ?? null,
      y_pos: yPos ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[save-screen] upsert error:', error.message)
    return res.status(500).json({ error: `Failed to save: ${error.message}` })
  }

  return res.status(200).json({ success: true, screenId: saved.id })
}
