import type { FlowConnection } from '../components/FlowConnectors'

/** Normalize a trigger / button label for comparison: lowercase, trim,
 *  collapse internal whitespace. Keeps matching strict (exact after
 *  normalization) so we don't conflate "Buy" and "Buy Now". */
export function normalizeTrigger(s: string | undefined): string {
  if (!s) return ''
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Given the project's connections, the current screen, and a button
 *  label that was just clicked in the preview, return the target screen
 *  id if there's a matching connection — null otherwise.
 *
 *  Matching: normalize both sides, exact compare. First match wins on
 *  duplicates (rare; ambiguous LLM output). */
export function findNavigationTarget(
  connections: FlowConnection[],
  currentScreenId: string,
  label: string | undefined,
): string | null {
  const target = normalizeTrigger(label)
  if (!target) return null
  for (const c of connections) {
    if (c.fromScreenId !== currentScreenId) continue
    if (normalizeTrigger(c.trigger) === target) return c.toScreenId
  }
  return null
}
