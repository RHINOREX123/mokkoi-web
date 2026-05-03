/**
 * BottomNav label validator.
 *
 * Sonnet-class models do not reliably honor the "label = destination screen
 * name" rule from design-system.ts and frequently emit Material Symbols icon
 * names ("list", "person", "bar_chart") as labels. The runtime click classifier
 * routes by label text, so icon-name labels never match a real screen and
 * navigation silently breaks.
 *
 * This is a defense-in-depth pass that runs on the AI's output BEFORE
 * expandComponents/normalizer, while BottomNav still exists as a typed node
 * with `props.items: [{icon, label, active?}]`. For each tab whose label does
 * not match any screen name (case-insensitive substring match in either
 * direction, mirroring src/utils/fuzzyMatchScreen.ts), we substitute the
 * positionally-corresponding screen name from the supplied list. If the tab's
 * position has no corresponding screen (more tabs than screens), the bad label
 * is left alone and a warning is logged.
 *
 * Runs pre-expansion intentionally — the post-expansion tree replaces
 * BottomNav with a generic View whose children include TouchableOpacity nodes
 * each containing an Icon and a Text whose first child is the label string.
 * Walking that structure to identify "BottomNav" reliably would require
 * heuristics; pre-expansion the macro is unambiguous.
 */

interface BottomNavItem {
  icon?: string
  label?: string
  active?: boolean
}

/** Normalize a name for comparison. Mirrors src/utils/fuzzyMatchScreen.ts. */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*screen$/, '').trim()
}

/** True if `label` matches any of `screenNames` by exact-after-normalize OR
 *  bidirectional substring (covers "Profile" tab → "ProfileScreen", "Home" tab
 *  → "Home"). */
function matchesAnyScreen(label: string, screenNames: string[]): boolean {
  const target = normalize(label)
  if (!target) return false
  for (const n of screenNames) {
    const ns = normalize(n)
    if (!ns) continue
    if (ns === target) return true
    if (ns.includes(target) || target.includes(ns)) return true
  }
  return false
}

function walkAndFix(node: unknown, screenNames: string[]): void {
  if (!node || typeof node !== 'object') return
  const n = node as { type?: unknown; props?: unknown; children?: unknown }

  if (n.type === 'BottomNav' && n.props && typeof n.props === 'object') {
    const props = n.props as { items?: unknown }
    if (Array.isArray(props.items)) {
      for (let i = 0; i < props.items.length; i++) {
        const item = props.items[i] as BottomNavItem | null | undefined
        if (!item || typeof item !== 'object') continue
        const label = String(item.label ?? '').trim()
        if (matchesAnyScreen(label, screenNames)) continue
        if (i < screenNames.length && screenNames[i]) {
          // Tab label didn't match any screen — substitute by position.
          if (label) {
            console.warn(
              `[bottomnav-validator] tab[${i}] label='${label}' → '${screenNames[i]}' (no screen match, positional fallback)`,
            )
          } else {
            console.warn(
              `[bottomnav-validator] tab[${i}] label was empty → '${screenNames[i]}' (positional fallback)`,
            )
          }
          item.label = screenNames[i]
        } else {
          console.warn(
            `[bottomnav-validator] tab[${i}] label='${label}' has no screen match and no positional fallback (screenNames.length=${screenNames.length}); leaving as-is`,
          )
        }
      }
    }
  }

  if (Array.isArray(n.children)) {
    for (const child of n.children) walkAndFix(child, screenNames)
  }
}

/**
 * Validate BottomNav tab labels against a list of screen names. Mutates the
 * tree in place and returns it for ergonomic chaining.
 *
 * Single responsibility: only fixes BottomNav `props.items[].label`. Does not
 * touch icons, other macros, or any non-BottomNav node. Safe to compose with
 * `expandComponents` and `normalizeComponentTree`.
 */
export function validateBottomNavLabels<T>(tree: T, screenNames: string[]): T {
  if (!Array.isArray(screenNames) || screenNames.length === 0) return tree
  walkAndFix(tree as unknown, screenNames)
  return tree
}
