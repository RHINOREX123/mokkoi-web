import type { FlowConnection } from '../components/FlowConnectors'

const TAB_VOCABULARY = new Set([
  'home', 'menu', 'profile', 'feed', 'discover', 'search',
  'cart', 'account', 'settings', 'inbox', 'notifications', 'library', 'tab',
])

/** Returns true if the trigger string represents a bottom-tab navigation
 *  (rather than a deep-link button like "Checkout" or "Place Order"). */
export function isTabTrigger(trigger: string | undefined): boolean {
  if (!trigger) return false
  const normalized = trigger.trim().toLowerCase()
  if (!normalized) return false
  if (TAB_VOCABULARY.has(normalized)) return true
  if (normalized.includes('tab')) return true
  return false
}

/** Returns the subset of screens that are "entry points" — top-level
 *  destinations the user should be able to jump to directly via the
 *  hamburger SCREENS list. A screen is an entry point if it satisfies any of:
 *    1. Reachable from at least one tab-trigger connection
 *    2. Is screens[0] (defensive — never strand the user)
 *    3. The project has zero connections at all (pre-wirer / single-screen
 *       fallback — every screen is treated as an entry point because we have
 *       no nav graph evidence to classify with)
 *
 *  When a screen has BOTH tab and deep-link incoming edges, the tab
 *  classification wins and it is an entry point.
 *
 *  Note: in a non-empty connection graph, screens with zero incoming edges
 *  are EXCLUDED (treated as unwired/dead screens). This is intentional —
 *  a screen the wirer never connected has no in-app way for the user to
 *  reach it, so surfacing it in the SCREENS list would be misleading. The
 *  defensive screens[0] rule guarantees at least one entry point exists.
 *
 *  Output preserves the input `screens` order. */
export function getEntryPointScreens<T extends { id: string }>(
  screens: T[],
  connections: FlowConnection[],
): T[] {
  if (screens.length === 0) return []

  const tabTargets = new Set<string>()
  const allTargets = new Set<string>()
  for (const c of connections) {
    allTargets.add(c.toScreenId)
    if (isTabTrigger(c.trigger)) tabTargets.add(c.toScreenId)
  }

  const firstScreenId = screens[0].id
  return screens.filter(s => {
    if (s.id === firstScreenId) return true           // defensive: always include first
    if (tabTargets.has(s.id)) return true             // tab target: include
    if (allTargets.has(s.id)) return false            // has incoming but only deep-link: exclude
    // Screen has no incoming edges.
    // Empty graph: every screen is an entry point (caller has no info to classify).
    if (connections.length === 0) return true
    // Non-empty graph: exclude screens that are unreachable via any connection —
    // they are not tab targets and the graph gives no evidence they're top-level.
    return false
  })
}
