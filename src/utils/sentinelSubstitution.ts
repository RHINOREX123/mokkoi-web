import type { ComponentNode } from '../types/mokkoi'

/** Planner-produced record-collection blob. Keyed by collection name, then
 *  by record id. */
export type AppData = Record<string, Record<string, Record<string, unknown>>>

/** Walks a dotted path "ingredients.0" → record.ingredients[0]. Returns
 *  undefined on a miss so callers can leave the sentinel untouched as a
 *  visible debug aid. */
export function lookupPath(
  record: Record<string, unknown> | undefined,
  path: string,
): unknown {
  if (!record) return undefined
  const parts = path.split('.')
  let cur: unknown = record
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

/** Replace {{path}} sentinels in every Text node's string children using the
 *  given record. Non-Text nodes are recursed. Unresolved sentinels are left
 *  in place. Pure — returns a new tree, never mutates input. */
export function substituteSentinels(
  node: ComponentNode | string,
  record: Record<string, unknown> | undefined,
): ComponentNode | string {
  if (typeof node === 'string') return node
  if (!node || typeof node !== 'object') return node
  const isText = node.type === 'Text'
  const children = node.children?.map(c => {
    if (typeof c === 'string' && isText && record) {
      return c.replace(/\{\{([\w.]+)\}\}/g, (whole, path: string) => {
        const v = lookupPath(record, path)
        if (v == null) return whole
        return String(v)
      })
    }
    return substituteSentinels(c, record)
  })
  return { ...node, children }
}
