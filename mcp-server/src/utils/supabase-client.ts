/**
 * Supabase client for syncing MCP-generated screens to the mokkoi.com canvas.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ComponentNode } from './api-client.js';

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (supabase) return supabase;

  const url = process.env.MOKKOI_SUPABASE_URL || '';
  const key = process.env.MOKKOI_SUPABASE_ANON_KEY || '';

  if (!url || !key) return null;

  supabase = createClient(url, key);
  return supabase;
}

function getProjectId(): string | null {
  return process.env.MOKKOI_PROJECT_ID || null;
}

export function isCanvasSyncEnabled(): boolean {
  const hasUrl = !!process.env.MOKKOI_SUPABASE_URL;
  const hasKey = !!process.env.MOKKOI_SUPABASE_ANON_KEY;
  const hasProjectId = !!process.env.MOKKOI_PROJECT_ID;
  console.error('[MCP Supabase] isCanvasSyncEnabled check:', {
    MOKKOI_SUPABASE_URL: hasUrl ? 'SET' : 'NOT SET',
    MOKKOI_SUPABASE_ANON_KEY: hasKey ? 'SET' : 'NOT SET',
    MOKKOI_PROJECT_ID: hasProjectId ? `SET (${process.env.MOKKOI_PROJECT_ID})` : 'NOT SET',
  });
  return !!(getClient() && getProjectId());
}

/**
 * Get the next available X position for a new screen on the canvas.
 * Places screens side by side with 400px spacing.
 */
async function getNextPosition(
  client: SupabaseClient,
  projectId: string
): Promise<{ x: number; y: number }> {
  const { data: screens } = await client
    .from('screens')
    .select('order_index')
    .eq('project_id', projectId)
    .order('order_index', { ascending: false })
    .limit(1);

  const lastIndex = screens?.[0]?.order_index ?? -1;
  return { x: (lastIndex + 1) * 400, y: 0 };
}

/**
 * Save a generated screen to Supabase so it appears on the mokkoi.com canvas.
 */
export async function saveScreenToProject(screenData: {
  name: string;
  componentTree: ComponentNode;
  originalPrompt: string;
}): Promise<{ id: string } | null> {
  const client = getClient();
  const projectId = getProjectId();
  if (!client || !projectId) {
    console.error('[MCP Supabase] saveScreenToProject: no client or projectId, skipping.', {
      hasClient: !!client,
      projectId,
    });
    return null;
  }

  try {
    console.error('[MCP Supabase] Attempting Supabase save...', {
      projectId,
      screenName: screenData.name,
      treeType: typeof screenData.componentTree,
      treeIsArray: Array.isArray(screenData.componentTree),
      treeKeys: screenData.componentTree ? Object.keys(screenData.componentTree) : 'null',
    });

    const position = await getNextPosition(client, projectId);
    const orderIndex = Math.floor(position.x / 400);

    const insertObj = {
      project_id: projectId,
      name: screenData.name,
      component_tree: screenData.componentTree,
      prompt: screenData.originalPrompt,
      order_index: orderIndex,
      source: 'mcp',
    };

    console.error('[MCP Supabase] Insert object:', JSON.stringify(insertObj, null, 2).slice(0, 1000));

    const { data, error } = await client
      .from('screens')
      .insert(insertObj)
      .select('id')
      .single();

    if (error) {
      console.error('[MCP Supabase] INSERT FAILED:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return null;
    }

    console.error('[MCP Supabase] Supabase save successful!', { id: data.id });
    return { id: data.id };
  } catch (err) {
    console.error('[MCP Supabase] Supabase save EXCEPTION:', err);
    return null;
  }
}

/**
 * Update an existing screen in Supabase.
 */
export async function updateScreen(
  screenId: string,
  updatedTree: ComponentNode,
  prompt?: string
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const updateData: Record<string, unknown> = {
      component_tree: updatedTree,
      updated_at: new Date().toISOString(),
      source: 'mcp',
    };
    if (prompt) {
      updateData.prompt = prompt;
    }

    const { error } = await client
      .from('screens')
      .update(updateData)
      .eq('id', screenId);

    if (error) {
      console.error('Failed to update screen in Supabase:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Supabase update error:', err);
    return false;
  }
}

/**
 * Find a screen by file path convention (screen name match).
 */
export async function findScreenByName(
  name: string
): Promise<{ id: string; component_tree: ComponentNode } | null> {
  const client = getClient();
  const projectId = getProjectId();
  if (!client || !projectId) return null;

  try {
    const { data, error } = await client
      .from('screens')
      .select('id, component_tree')
      .eq('project_id', projectId)
      .ilike('name', name)
      .limit(1)
      .single();

    if (error || !data) return null;
    return { id: data.id, component_tree: data.component_tree as ComponentNode };
  } catch {
    return null;
  }
}

/**
 * Save multiple screens from a flow generation.
 */
export async function saveFlowToProject(
  screens: Array<{
    name: string;
    componentTree: ComponentNode;
    originalPrompt: string;
  }>
): Promise<Array<{ id: string; name: string }>> {
  const client = getClient();
  const projectId = getProjectId();
  if (!client || !projectId) return [];

  try {
    const position = await getNextPosition(client, projectId);
    const baseIndex = Math.floor(position.x / 400);

    const rows = screens.map((s, i) => ({
      project_id: projectId,
      name: s.name,
      component_tree: s.componentTree,
      prompt: s.originalPrompt,
      order_index: baseIndex + i,
      source: 'mcp',
    }));

    const { data, error } = await client
      .from('screens')
      .insert(rows)
      .select('id, name');

    if (error) {
      console.error('Failed to save flow to Supabase:', error.message);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error('Supabase flow save error:', err);
    return [];
  }
}
