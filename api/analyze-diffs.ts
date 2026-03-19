import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './auth-helper.js'

// Types inlined here since Vercel serverless can't import from src/
interface ColorChange { property: string; from: string; to: string }
interface SpacingChange { property: string; from: number | string; to: number | string }
interface ComponentChange { type: string; name?: string }

interface DiffResult {
  colorChanges: ColorChange[]
  spacingChanges: SpacingChange[]
  addedComponents: ComponentChange[]
  removedComponents: ComponentChange[]
  textChanges: { from: string; to: string }[]
  layoutChanges: { property: string; from: any; to: any }[]
}

// --- Inline diff analyzer (mirrors src/utils/diffAnalyzer.ts) ---

const COLOR_PROPS = new Set([
  'color', 'backgroundColor', 'background', 'borderColor',
  'shadowColor', 'tintColor', 'placeholderTextColor',
])
const SPACING_PROPS = new Set([
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'paddingHorizontal', 'paddingVertical',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'gap', 'rowGap', 'columnGap',
])
const LAYOUT_PROPS = new Set([
  'flexDirection', 'justifyContent', 'alignItems', 'alignSelf',
  'flex', 'flexWrap', 'position', 'display',
])

function isColorValue(v: any): boolean {
  return typeof v === 'string' && (/^#[0-9a-fA-F]{3,8}$/.test(v) || v.startsWith('rgb') || v.startsWith('hsl'))
}

function extractStyle(node: any): Record<string, any> {
  if (!node) return {}
  const s = node.style || node.props?.style || {}
  return Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : (typeof s === 'object' ? s : {})
}

function getChildren(node: any): any[] {
  if (!node) return []
  return Array.isArray(node.children) ? node.children : (Array.isArray(node.props?.children) ? node.props.children : [])
}

function getTextContent(node: any): string | undefined {
  if (typeof node === 'string') return node
  const ch = getChildren(node)
  if (ch.length === 1 && typeof ch[0] === 'string') return ch[0]
  return node?.props?.text || node?.props?.value || undefined
}

function getType(node: any): string { return node?.type || node?.component || node?.name || 'unknown' }
function getName(node: any): string | undefined { return node?.props?.testID || node?.props?.accessibilityLabel || node?.name }

function walkAndCompare(before: any, after: any, result: DiffResult) {
  if (!before && !after) return
  if (!before && after) { result.addedComponents.push({ type: getType(after), name: getName(after) }); return }
  if (before && !after) { result.removedComponents.push({ type: getType(before), name: getName(before) }); return }

  const sb = extractStyle(before), sa = extractStyle(after)
  for (const key of new Set([...Object.keys(sb), ...Object.keys(sa)])) {
    if (sb[key] === sa[key] || JSON.stringify(sb[key]) === JSON.stringify(sa[key])) continue
    if (COLOR_PROPS.has(key) || isColorValue(sb[key]) || isColorValue(sa[key])) {
      if (sb[key] !== undefined && sa[key] !== undefined) result.colorChanges.push({ property: key, from: String(sb[key]), to: String(sa[key]) })
    } else if (SPACING_PROPS.has(key)) {
      if (sb[key] !== undefined && sa[key] !== undefined) result.spacingChanges.push({ property: key, from: sb[key], to: sa[key] })
    } else if (LAYOUT_PROPS.has(key)) {
      result.layoutChanges.push({ property: key, from: sb[key], to: sa[key] })
    }
  }

  const tb = getTextContent(before), ta = getTextContent(after)
  if (tb && ta && tb !== ta) result.textChanges.push({ from: tb, to: ta })

  const cb = getChildren(before), ca = getChildren(after)
  for (let i = 0; i < Math.max(cb.length, ca.length); i++) walkAndCompare(cb[i], ca[i], result)
}

function analyzeComponentDiff(treeBefore: any, treeAfter: any): DiffResult {
  const result: DiffResult = { colorChanges: [], spacingChanges: [], addedComponents: [], removedComponents: [], textChanges: [], layoutChanges: [] }
  walkAndCompare(treeBefore, treeAfter, result)
  return result
}

// --- Pattern aggregation ---

interface PatternCount { key: string; data: any; count: number }

function aggregatePatterns(diffs: DiffResult[]): {
  colorPatterns: PatternCount[]
  spacingPatterns: PatternCount[]
  addedPatterns: PatternCount[]
  removedPatterns: PatternCount[]
} {
  const colorMap = new Map<string, { data: any; count: number }>()
  const spacingMap = new Map<string, { data: any; count: number }>()
  const addedMap = new Map<string, { data: any; count: number }>()
  const removedMap = new Map<string, { data: any; count: number }>()

  for (const diff of diffs) {
    for (const c of diff.colorChanges) {
      const key = `${c.from}->${c.to}`
      const existing = colorMap.get(key)
      if (existing) existing.count++
      else colorMap.set(key, { data: { from: c.from, to: c.to, property: c.property }, count: 1 })
    }
    for (const s of diff.spacingChanges) {
      const key = `${s.property}:${s.from}->${s.to}`
      const existing = spacingMap.get(key)
      if (existing) existing.count++
      else spacingMap.set(key, { data: { property: s.property, from: s.from, to: s.to }, count: 1 })
    }
    for (const a of diff.addedComponents) {
      const key = a.type
      const existing = addedMap.get(key)
      if (existing) existing.count++
      else addedMap.set(key, { data: { type: a.type, name: a.name }, count: 1 })
    }
    for (const r of diff.removedComponents) {
      const key = r.type
      const existing = removedMap.get(key)
      if (existing) existing.count++
      else removedMap.set(key, { data: { type: r.type, name: r.name }, count: 1 })
    }
  }

  const toSorted = (map: Map<string, { data: any; count: number }>) =>
    Array.from(map.entries())
      .map(([key, v]) => ({ key, data: v.data, count: v.count }))
      .sort((a, b) => b.count - a.count)

  return {
    colorPatterns: toSorted(colorMap),
    spacingPatterns: toSorted(spacingMap),
    addedPatterns: toSorted(addedMap),
    removedPatterns: toSorted(removedMap),
  }
}

// --- Handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Simple admin check — require service role key or a secret header
  const adminSecret = req.headers['x-admin-secret']
  const expectedSecret = process.env.ADMIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!expectedSecret || adminSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { url } = getSupabaseConfig()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const supabase = createClient(url, serviceKey)

  // 1. Fetch last 100 edit diffs
  const { data: diffs, error: fetchError } = await supabase
    .from('edit_diffs')
    .select('id, edit_type, component_tree_before, component_tree_after, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (fetchError) {
    return res.status(500).json({ error: 'Failed to fetch diffs', detail: fetchError.message })
  }

  if (!diffs || diffs.length === 0) {
    return res.status(200).json({ message: 'No diffs to analyze', patterns: [] })
  }

  // 2. Analyze each diff
  const diffResults: DiffResult[] = []
  for (const diff of diffs) {
    try {
      const result = analyzeComponentDiff(diff.component_tree_before, diff.component_tree_after)
      diffResults.push(result)
    } catch (e) {
      // Skip malformed diffs
      console.warn('Failed to analyze diff', diff.id, e)
    }
  }

  // 3. Aggregate patterns
  const patterns = aggregatePatterns(diffResults)

  // 4. Store results in design_patterns table (upsert by pattern key)
  const toInsert: { pattern_type: string; pattern_data: any; frequency: number }[] = []

  for (const p of patterns.colorPatterns.slice(0, 20)) {
    toInsert.push({ pattern_type: 'color_change', pattern_data: p.data, frequency: p.count })
  }
  for (const p of patterns.spacingPatterns.slice(0, 20)) {
    toInsert.push({ pattern_type: 'spacing_change', pattern_data: p.data, frequency: p.count })
  }
  for (const p of patterns.addedPatterns.slice(0, 20)) {
    toInsert.push({ pattern_type: 'component_add', pattern_data: p.data, frequency: p.count })
  }
  for (const p of patterns.removedPatterns.slice(0, 20)) {
    toInsert.push({ pattern_type: 'component_remove', pattern_data: p.data, frequency: p.count })
  }

  if (toInsert.length > 0) {
    // Clear old patterns and insert fresh
    await supabase.from('design_patterns').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    const { error: insertError } = await supabase.from('design_patterns').insert(
      toInsert.map(p => ({
        pattern_type: p.pattern_type,
        pattern_data: p.pattern_data,
        frequency: p.frequency,
        last_seen: new Date().toISOString(),
      }))
    )
    if (insertError) {
      console.warn('Failed to store patterns:', insertError.message)
    }
  }

  return res.status(200).json({
    analyzed: diffs.length,
    patterns: {
      colorChanges: patterns.colorPatterns.slice(0, 10),
      spacingChanges: patterns.spacingPatterns.slice(0, 10),
      commonlyAdded: patterns.addedPatterns.slice(0, 10),
      commonlyRemoved: patterns.removedPatterns.slice(0, 10),
    },
    storedPatterns: toInsert.length,
  })
}
