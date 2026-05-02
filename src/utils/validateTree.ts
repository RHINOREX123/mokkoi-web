import type { ComponentNode } from '../types/mokkoi'

export type TreeValidationResult =
  | { valid: true; tree: ComponentNode }
  | { valid: false; reason: string }

/** Light root-only structural validation for trees posted into the runtime
 *  iframe. Catches obviously-broken shapes (null, non-object, missing/empty
 *  type, non-array children) so the renderer never sees them. Deep validation
 *  is intentionally skipped — the ErrorBoundary around ScreenRenderer catches
 *  any mid-tree crashes that slip past these root checks.
 *
 *  `reason` is a short diagnostic string for console.warn — never user-facing. */
export function validateTree(input: unknown): TreeValidationResult {
  if (input === null) return { valid: false, reason: 'tree-null' }
  if (input === undefined) return { valid: false, reason: 'tree-undefined' }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, reason: 'tree-not-object' }
  }
  const node = input as Record<string, unknown>
  if (!('type' in node)) return { valid: false, reason: 'type-missing' }
  if (typeof node.type !== 'string') return { valid: false, reason: 'type-not-string' }
  if (node.type === '') return { valid: false, reason: 'type-empty' }
  if (node.children !== undefined && !Array.isArray(node.children)) {
    return { valid: false, reason: 'children-not-array' }
  }
  return { valid: true, tree: input as ComponentNode }
}
