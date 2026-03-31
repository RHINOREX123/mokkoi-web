import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateMCPRequest, getSupabaseConfig } from './lib/auth-helper.js'
import { createClient } from '@supabase/supabase-js'

const MCP_PROJECT_NAME = 'MCP Imports'

function getServiceClient() {
  const { url } = getSupabaseConfig()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}

/**
 * Find or create the "MCP Imports" project.
 * Uses service role key to bypass RLS.
 * If userId is provided, creates under that user. Otherwise creates with null user_id.
 */
async function getOrCreateMCPProject(
  userId?: string
): Promise<{ id: string; name: string } | null> {
  const supabase = getServiceClient()
  if (!supabase) return null

  // Try to find existing MCP project
  let query = supabase
    .from('projects')
    .select('id, name')
    .eq('source', 'mcp')
    .eq('name', MCP_PROJECT_NAME)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data: existing } = await query.limit(1).single()

  if (existing) return existing

  // Create new MCP project
  const insertData: Record<string, unknown> = {
    name: MCP_PROJECT_NAME,
    source: 'mcp',
  }
  if (userId) {
    insertData.user_id = userId
  }

  const { data: created, error } = await supabase
    .from('projects')
    .insert(insertData)
    .select('id, name')
    .single()

  if (error) {
    console.error('[mcp-sync] Failed to create MCP project:', error.message)
    return null
  }

  return created
}

async function getNextOrderIndex(projectId: string): Promise<number> {
  const supabase = getServiceClient()
  if (!supabase) return 0

  const { data } = await supabase
    .from('screens')
    .select('order_index')
    .eq('project_id', projectId)
    .order('order_index', { ascending: false })
    .limit(1)

  return (data?.[0]?.order_index ?? -1) + 1
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — MCP clients don't use browser requests, but allow mokkoi.com for safety
  const allowedOrigin = process.env.MOKKOI_PUBLIC_URL || 'https://mokkoi.com'
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Mokkoi-Source')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Handle save_web_screen action BEFORE MCP auth (web UI doesn't have MCP credentials)
  const { action } = req.body || {}
  if (action === 'save_web_screen') {
    try {
      const supabase = getServiceClient()
      if (!supabase) {
        return res.status(500).json({ error: 'Database not configured' })
      }
      const { screenId, projectId, screenName, componentTree, prompt, orderIndex, source, xPos, yPos } = req.body
      if (!projectId || !componentTree) {
        return res.status(400).json({ error: 'projectId and componentTree are required' })
      }

      const row: Record<string, unknown> = {
        project_id: projectId,
        name: screenName || 'Imported Screen',
        component_tree: componentTree,
        original_prompt: prompt || null,
        order_index: orderIndex ?? 0,
        updated_at: new Date().toISOString(),
        source: source || 'web',
        x_pos: xPos ?? null,
        y_pos: yPos ?? null,
      }
      if (screenId) {
        row.id = screenId
      }

      const { data: saved, error } = await supabase
        .from('screens')
        .upsert(row)
        .select('id')
        .single()

      if (error) {
        console.error('[mcp-sync] save_web_screen error:', error.message, error)
        return res.status(500).json({ error: `Failed to save: ${error.message}` })
      }
      return res.status(200).json({ success: true, screenId: saved.id })
    } catch (err) {
      console.error('[mcp-sync] save_web_screen crash:', err)
      return res.status(500).json({ error: `Server error: ${(err as Error).message}` })
    }
  }

  // Authenticate MCP request
  const mcpAuth = authenticateMCPRequest(req)
  if (!mcpAuth) {
    return res.status(401).json({ error: 'Invalid MCP authentication' })
  }

  const supabase = getServiceClient()
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' })
  }

  const { action, userId, ...params } = req.body || {}
  const apiUrl = process.env.MOKKOI_PUBLIC_URL || 'https://mokkoi.com'

  try {
    switch (action) {
      case 'save_screen': {
        const { screenName, componentTree, prompt } = params
        if (!componentTree) {
          return res.status(400).json({ error: 'componentTree is required' })
        }

        const project = await getOrCreateMCPProject(userId)
        if (!project) {
          return res.status(500).json({ error: 'Failed to create/find MCP project' })
        }

        const orderIndex = await getNextOrderIndex(project.id)

        const { data: screen, error } = await supabase
          .from('screens')
          .insert({
            project_id: project.id,
            name: screenName || 'Untitled Screen',
            component_tree: componentTree,
            prompt: prompt || null,
            original_prompt: prompt || null,
            order_index: orderIndex,
            source: 'mcp',
          })
          .select('id')
          .single()

        if (error) {
          console.error('[mcp-sync] save_screen error:', error.message)
          return res.status(500).json({ error: 'Failed to save screen' })
        }

        return res.status(200).json({
          success: true,
          screenId: screen.id,
          projectId: project.id,
          viewUrl: `${apiUrl}/app/${project.id}`,
        })
      }

      case 'update_screen': {
        const { screenId, componentTree: updatedTree, prompt: editPrompt } = params
        if (!screenId || !updatedTree) {
          return res.status(400).json({ error: 'screenId and componentTree are required' })
        }

        const updateData: Record<string, unknown> = {
          component_tree: updatedTree,
          updated_at: new Date().toISOString(),
          source: 'mcp',
        }
        if (editPrompt) {
          updateData.prompt = editPrompt
        }

        const { data: updated, error } = await supabase
          .from('screens')
          .update(updateData)
          .eq('id', screenId)
          .select('id, project_id')
          .single()

        if (error || !updated) {
          if (error?.code === 'PGRST116') {
            return res.status(404).json({ error: 'Screen not found' })
          }
          console.error('[mcp-sync] update_screen error:', error?.message)
          return res.status(500).json({ error: 'Failed to update screen' })
        }

        return res.status(200).json({
          success: true,
          screenId,
          projectId: updated.project_id,
          viewUrl: updated.project_id ? `${apiUrl}/app/${updated.project_id}` : undefined,
        })
      }

      case 'save_flow': {
        const { screens, prompt: flowPrompt } = params
        if (!screens || !Array.isArray(screens) || screens.length === 0) {
          return res.status(400).json({ error: 'screens array is required' })
        }

        const project = await getOrCreateMCPProject(userId)
        if (!project) {
          return res.status(500).json({ error: 'Failed to create/find MCP project' })
        }

        const baseIndex = await getNextOrderIndex(project.id)

        const rows = screens.map((s: { name: string; componentTree: unknown }, i: number) => ({
          project_id: project.id,
          name: s.name || `Screen ${i + 1}`,
          component_tree: s.componentTree,
          prompt: flowPrompt || null,
          original_prompt: flowPrompt || null,
          order_index: baseIndex + i,
          source: 'mcp',
        }))

        const { data, error } = await supabase
          .from('screens')
          .insert(rows)
          .select('id, name')

        if (error) {
          console.error('[mcp-sync] save_flow error:', error.message)
          return res.status(500).json({ error: 'Failed to save flow' })
        }

        return res.status(200).json({
          success: true,
          screens: data,
          projectId: project.id,
          viewUrl: `${apiUrl}/app/${project.id}`,
        })
      }

      case 'find_screen': {
        const { screenName: findName, projectId } = params
        if (!findName) {
          return res.status(400).json({ error: 'screenName is required' })
        }

        // Escape ILIKE wildcards to prevent unintended pattern matching
        const escapedName = String(findName).replace(/[%_]/g, '\\$&')

        let query = supabase
          .from('screens')
          .select('id, component_tree, project_id')
          .ilike('name', escapedName)
          .eq('source', 'mcp')

        if (projectId) {
          query = query.eq('project_id', projectId)
        }

        const { data, error } = await query.limit(1).single()

        if (error || !data) {
          return res.status(200).json({ success: true, found: false })
        }

        return res.status(200).json({
          success: true,
          found: true,
          screenId: data.id,
          projectId: data.project_id,
          componentTree: data.component_tree,
        })
      }

      case 'get_project': {
        const project = await getOrCreateMCPProject(userId)
        if (!project) {
          return res.status(500).json({ error: 'Failed to get MCP project' })
        }

        return res.status(200).json({
          success: true,
          projectId: project.id,
          projectName: project.name,
          viewUrl: `${apiUrl}/app/${project.id}`,
        })
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[mcp-sync] Unhandled error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
