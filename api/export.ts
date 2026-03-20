import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest } from './auth-helper.js'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './auth-helper.js'
import { convertTreeToTSX } from './export-tsx.js'
import { convertFlowToTSX } from './export-tsx-flow.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await authenticateRequest(req, res)
  if (!user) return

  const { url } = getSupabaseConfig()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const supabase = createClient(url, serviceKey)

  const projectId = (req.query?.projectId || req.body?.projectId) as string | undefined
  const screenId = (req.query?.screenId || req.body?.screenId) as string | undefined
  const format = ((req.query?.format || req.body?.format) as string) || 'tsx'

  if (!projectId) {
    return res.status(400).json({ error: 'Missing projectId' })
  }

  // Fetch screens
  let query = supabase
    .from('screens')
    .select('id, name, component_tree')
    .eq('project_id', projectId)

  if (screenId) {
    query = query.eq('id', screenId)
  }

  const { data: screens, error } = await query.order('created_at', { ascending: true })

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch screens', detail: error.message })
  }

  if (!screens || screens.length === 0) {
    return res.status(404).json({ error: 'No screens found' })
  }

  if (format === 'json') {
    return res.status(200).json({
      screens: screens.map(s => ({
        id: s.id,
        name: s.name,
        tree: s.component_tree,
      })),
    })
  }

  // TSX export
  if (screens.length === 1) {
    const code = convertTreeToTSX(screens[0].component_tree, screens[0].name)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    return res.status(200).send(code)
  }

  // Multiple screens — flow export
  const flowScreens = screens.map(s => ({
    id: s.id,
    name: s.name,
    tree: s.component_tree,
  }))
  const code = convertFlowToTSX(flowScreens)
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  return res.status(200).send(code)
}
