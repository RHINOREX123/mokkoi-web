import { supabase } from './supabase'
import type { ComponentNode } from '../types/mokkoi'
import type { FlowConnection } from '../components/FlowConnectors'

export interface RuntimeProject {
  id: string
  name: string
  updated_at: string
}

export interface RuntimeScreenSummary {
  id: string
  name: string
  order_index: number | null
}

export interface RuntimeScreen {
  id: string
  name: string
  tree: ComponentNode
}

function ensureClient() {
  if (!supabase) throw new Error('Supabase not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
  return supabase
}

export async function fetchUserProjects(limit = 20): Promise<RuntimeProject[]> {
  const sb = ensureClient()
  const { data, error } = await sb
    .from('projects')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as RuntimeProject[]
}

export async function fetchProjectScreens(projectId: string): Promise<RuntimeScreenSummary[]> {
  const sb = ensureClient()
  const { data, error } = await sb
    .from('screens')
    .select('id, name, order_index')
    .eq('project_id', projectId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return (data ?? []) as RuntimeScreenSummary[]
}

export async function fetchProjectConnections(projectId: string): Promise<FlowConnection[]> {
  const sb = ensureClient()
  const { data, error } = await sb
    .from('projects')
    .select('connections')
    .eq('id', projectId)
    .single()
  if (error) throw error
  const raw = (data?.connections ?? []) as unknown
  if (!Array.isArray(raw)) return []
  // Defensive shape check — JSONB may contain rows missing fields.
  return raw.filter((c: any): c is FlowConnection =>
    c && typeof c.fromScreenId === 'string' && typeof c.toScreenId === 'string'
  )
}

export async function fetchScreenTree(projectId: string, screenId: string): Promise<RuntimeScreen> {
  const sb = ensureClient()
  const { data, error } = await sb
    .from('screens')
    .select('id, name, component_tree')
    .eq('project_id', projectId)
    .eq('id', screenId)
    .single()
  if (error) throw error
  return {
    id: data.id,
    name: data.name,
    tree: data.component_tree as ComponentNode,
  }
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Date.now() - then
  const sec = Math.round(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  const wk = Math.round(day / 7)
  if (wk < 5) return `${wk}w ago`
  const mo = Math.round(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.round(day / 365)}y ago`
}
