import type { FlowConnection } from '../components/FlowConnectors'
import { fuzzyMatchScreen } from './fuzzyMatchScreen'

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

/** Three-stage navigation resolver mirroring RuntimeIframePreview's logic:
 *  1) Strict FlowConnection match (label === trigger from current screen).
 *  2) Fuzzy screen-name match (label ~= screen.name, "Profile" → "ProfileScreen").
 *  3) Single outgoing forward connection from the current screen.
 *
 *  Used by both the canvas-side bottom-nav handler (App.tsx) and the
 *  Preview-mode static fallback (usePreviewNavigation). The wirer's planner
 *  often emits triggers like "select_workout" rather than the visible tab
 *  label, so strict-match alone misses BottomNav taps — fuzzy + singleTarget
 *  catch those without inventing routes. */
export function resolveNavTarget<T extends { id: string; name: string }>(
  label: string | undefined,
  ctx: {
    connections: FlowConnection[]
    currentScreenId: string
    screens: T[]
  },
): string | null {
  const flow = findNavigationTarget(ctx.connections, ctx.currentScreenId, label)
  if (flow) return flow

  if (label && label.trim()) {
    const fuzzy = fuzzyMatchScreen(label, ctx.screens)
    if (fuzzy && fuzzy.id !== ctx.currentScreenId) return fuzzy.id
  }

  const outgoing = ctx.connections.filter(c =>
    c.fromScreenId === ctx.currentScreenId &&
    c.trigger !== 'nav_back' &&
    c.trigger !== 'back',
  )
  if (outgoing.length === 1) return outgoing[0].toScreenId

  return null
}
