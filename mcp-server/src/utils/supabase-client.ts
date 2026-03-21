/**
 * Canvas sync client for MCP-generated screens.
 *
 * Write operations (save, update) go through the /api/mcp-sync endpoint
 * which uses the service role key server-side. This means users only need
 * MOKKOI_API_KEY and MOKKOI_API_URL — no Supabase config required.
 *
 * Read operations (for sync-from-canvas, watch-canvas) still use direct
 * Supabase access when configured, as they need to query existing screens.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ComponentNode } from './api-client.js';

// --- Direct Supabase client (for read operations) ---

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

// --- API-based sync (for write operations) ---

function getSyncConfig() {
  const apiUrl = process.env.MOKKOI_API_URL || 'https://mokkoi.com';
  const apiKey = process.env.MOKKOI_API_KEY || '';
  const userId = process.env.MOKKOI_USER_ID || undefined;
  return { apiUrl, apiKey, userId };
}

async function callSyncAPI(action: string, params: Record<string, unknown> = {}): Promise<{
  success: boolean;
  screenId?: string;
  projectId?: string;
  viewUrl?: string;
  screens?: Array<{ id: string; name: string }>;
  found?: boolean;
  componentTree?: ComponentNode;
  error?: string;
} | null> {
  const { apiUrl, apiKey, userId } = getSyncConfig();

  if (!apiKey) {
    console.error('[MCP Sync] No MOKKOI_API_KEY set, cannot sync to canvas.');
    return null;
  }

  const url = `${apiUrl.replace(/\/$/, '')}/api/mcp-sync`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
        'X-Mokkoi-Source': 'mcp',
      },
      body: JSON.stringify({ action, userId, ...params }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      console.error(`[MCP Sync] API error (${response.status}):`, errorBody);
      return null;
    }

    return await response.json();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[MCP Sync] API request timed out');
    } else {
      console.error('[MCP Sync] API request failed:', err);
    }
    return null;
  }
}

/**
 * Canvas sync is always enabled when MOKKOI_API_KEY is set.
 * Direct Supabase access is only needed for read operations (sync-from-canvas, watch-canvas).
 */
export function isCanvasSyncEnabled(): boolean {
  // API-based sync only needs the API key
  const hasApiKey = !!process.env.MOKKOI_API_KEY;
  if (hasApiKey) return true;

  // Fall back to legacy direct Supabase check
  return !!(getClient() && getProjectId());
}

/**
 * Check if direct Supabase read access is available (for sync-from-canvas, watch-canvas).
 */
export function isDirectReadEnabled(): boolean {
  return !!(getClient() && getProjectId());
}

/**
 * Save a generated screen to the mokkoi.com canvas via the sync API.
 */
export async function saveScreenToProject(screenData: {
  name: string;
  componentTree: ComponentNode;
  originalPrompt: string;
}): Promise<{ id: string; projectId?: string; viewUrl?: string } | null> {
  const result = await callSyncAPI('save_screen', {
    screenName: screenData.name,
    componentTree: screenData.componentTree,
    prompt: screenData.originalPrompt,
  });

  if (!result?.success || !result.screenId) {
    // Fall back to legacy direct Supabase insert
    return await legacySaveScreen(screenData);
  }

  return {
    id: result.screenId,
    projectId: result.projectId,
    viewUrl: result.viewUrl,
  };
}

/**
 * Update an existing screen via the sync API.
 */
export async function updateScreen(
  screenId: string,
  updatedTree: ComponentNode,
  prompt?: string
): Promise<{ success: boolean; projectId?: string; viewUrl?: string }> {
  const result = await callSyncAPI('update_screen', {
    screenId,
    componentTree: updatedTree,
    prompt,
  });

  if (!result?.success) {
    // Fall back to legacy direct update
    const legacyResult = await legacyUpdateScreen(screenId, updatedTree, prompt);
    return { success: legacyResult };
  }

  return {
    success: true,
    projectId: result.projectId,
    viewUrl: result.viewUrl,
  };
}

/**
 * Find a screen by name via the sync API.
 */
export async function findScreenByName(
  name: string
): Promise<{ id: string; component_tree: ComponentNode; projectId?: string } | null> {
  const result = await callSyncAPI('find_screen', { screenName: name });

  if (result?.found && result.screenId && result.componentTree) {
    return {
      id: result.screenId,
      component_tree: result.componentTree,
      projectId: result.projectId,
    };
  }

  // Fall back to legacy direct query
  return await legacyFindScreenByName(name);
}

/**
 * Save multiple screens from a flow generation via the sync API.
 */
export async function saveFlowToProject(
  screens: Array<{
    name: string;
    componentTree: ComponentNode;
    originalPrompt: string;
  }>
): Promise<{ saved: Array<{ id: string; name: string }>; projectId?: string; viewUrl?: string }> {
  const result = await callSyncAPI('save_flow', {
    screens: screens.map(s => ({
      name: s.name,
      componentTree: s.componentTree,
    })),
    prompt: screens[0]?.originalPrompt,
  });

  if (!result?.success) {
    // Fall back to legacy
    const legacyResult = await legacySaveFlow(screens);
    return { saved: legacyResult };
  }

  return {
    saved: result.screens || [],
    projectId: result.projectId,
    viewUrl: result.viewUrl,
  };
}

// --- Read operations (direct Supabase, for sync-from-canvas and watch-canvas) ---

export async function getScreensByProject(): Promise<
  Array<{ id: string; name: string; component_tree: ComponentNode; updated_at: string; source: string }>
> {
  const client = getClient();
  const projectId = getProjectId();
  if (!client || !projectId) return [];

  try {
    const { data, error } = await client
      .from('screens')
      .select('id, name, component_tree, updated_at, source')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('[MCP Supabase] getScreensByProject error:', error.message);
      return [];
    }
    return (data ?? []) as Array<{ id: string; name: string; component_tree: ComponentNode; updated_at: string; source: string }>;
  } catch (err) {
    console.error('[MCP Supabase] getScreensByProject exception:', err);
    return [];
  }
}

export async function getRecentlyUpdatedScreens(
  sinceMinutes: number
): Promise<Array<{ id: string; name: string; updated_at: string; source: string }>> {
  const client = getClient();
  const projectId = getProjectId();
  if (!client || !projectId) return [];

  try {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
    const { data, error } = await client
      .from('screens')
      .select('id, name, updated_at, source')
      .eq('project_id', projectId)
      .gte('updated_at', since)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[MCP Supabase] getRecentlyUpdatedScreens error:', error.message);
      return [];
    }
    return (data ?? []) as Array<{ id: string; name: string; updated_at: string; source: string }>;
  } catch (err) {
    console.error('[MCP Supabase] getRecentlyUpdatedScreens exception:', err);
    return [];
  }
}

export async function getScreenByName(
  name: string
): Promise<{ id: string; name: string; component_tree: ComponentNode; updated_at: string; source: string } | null> {
  const client = getClient();
  const projectId = getProjectId();
  if (!client || !projectId) return null;

  try {
    const { data, error } = await client
      .from('screens')
      .select('id, name, component_tree, updated_at, source')
      .eq('project_id', projectId)
      .ilike('name', name)
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as { id: string; name: string; component_tree: ComponentNode; updated_at: string; source: string };
  } catch {
    return null;
  }
}

// --- Legacy direct Supabase write operations (fallback) ---

async function legacySaveScreen(screenData: {
  name: string;
  componentTree: ComponentNode;
  originalPrompt: string;
}): Promise<{ id: string } | null> {
  const client = getClient();
  const projectId = getProjectId();
  if (!client || !projectId) return null;

  try {
    const { data: lastScreen } = await client
      .from('screens')
      .select('order_index')
      .eq('project_id', projectId)
      .order('order_index', { ascending: false })
      .limit(1);

    const orderIndex = (lastScreen?.[0]?.order_index ?? -1) + 1;

    const { data, error } = await client
      .from('screens')
      .insert({
        project_id: projectId,
        name: screenData.name,
        component_tree: screenData.componentTree,
        prompt: screenData.originalPrompt,
        order_index: orderIndex,
        source: 'mcp',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[MCP Supabase] Legacy save failed:', error.message);
      return null;
    }

    return { id: data.id };
  } catch (err) {
    console.error('[MCP Supabase] Legacy save exception:', err);
    return null;
  }
}

async function legacyUpdateScreen(
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
    if (prompt) updateData.prompt = prompt;

    const { error } = await client
      .from('screens')
      .update(updateData)
      .eq('id', screenId);

    if (error) {
      console.error('[MCP Supabase] Legacy update failed:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function legacyFindScreenByName(
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

async function legacySaveFlow(
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
    const { data: lastScreen } = await client
      .from('screens')
      .select('order_index')
      .eq('project_id', projectId)
      .order('order_index', { ascending: false })
      .limit(1);

    const baseIndex = (lastScreen?.[0]?.order_index ?? -1) + 1;

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
      console.error('[MCP Supabase] Legacy flow save failed:', error.message);
      return [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}
