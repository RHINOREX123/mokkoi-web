import type { ComponentNode } from '../types/mokkoi'

/**
 * Scan a component tree for a bottom tab bar pattern.
 * Returns the tab labels if found, otherwise null.
 *
 * Detection heuristic:
 * - A View near the bottom of the tree (last child or child with position: absolute + bottom: 0)
 * - flexDirection: 'row'
 * - 3-5 children that look like tab items (short text labels)
 */
export function detectTabBar(tree: ComponentNode): string[] | null {
  if (!tree.children || tree.children.length === 0) return null

  // Check last few children of the root (tab bar is usually at the bottom)
  const candidates: ComponentNode[] = []
  for (let i = tree.children.length - 1; i >= Math.max(0, tree.children.length - 3); i--) {
    const child = tree.children[i]
    if (typeof child === 'string') continue
    candidates.push(child)
  }

  for (const candidate of candidates) {
    const labels = extractTabLabels(candidate)
    if (labels) return labels
  }

  return null
}

function extractTabLabels(node: ComponentNode): string[] | null {
  const style = node.style || {}
  const isRow = style.flexDirection === 'row'

  if (!isRow || !node.children) return null

  // Must have 2-6 children (typical tab count)
  const childNodes = node.children.filter((c): c is ComponentNode => typeof c !== 'string')
  if (childNodes.length < 2 || childNodes.length > 6) return null

  // Each child should contain a short text label
  const labels: string[] = []
  for (const child of childNodes) {
    const label = findShortText(child)
    if (!label) return null // every tab must have a label
    labels.push(label)
  }

  // Sanity: labels should be short (typical tab labels: "Home", "Search", "Profile")
  if (labels.some(l => l.length > 20)) return null

  return labels
}

/** Recursively find the first short text string in a node tree */
function findShortText(node: ComponentNode, depth = 0): string | null {
  if (depth > 4) return null

  if (node.children) {
    for (const child of node.children) {
      if (typeof child === 'string') {
        const trimmed = child.trim()
        if (trimmed.length > 0 && trimmed.length <= 20) return trimmed
      } else {
        const found = findShortText(child, depth + 1)
        if (found) return found
      }
    }
  }

  // Check props.children or props.placeholder for Text nodes
  if (node.props?.children && typeof node.props.children === 'string') {
    const text = (node.props.children as string).trim()
    if (text.length > 0 && text.length <= 20) return text
  }

  return null
}

/**
 * Given multiple screens with their trees, detect which ones share a tab bar.
 * Returns a tab group if 2+ screens share the same set of tab labels.
 */
export function detectTabGroup(
  screens: { name: string; tree: ComponentNode }[]
): { screenNames: string[]; labels: string[] } | undefined {
  const labelMap = new Map<string, string[]>() // serialized labels → screen names

  for (const screen of screens) {
    const labels = detectTabBar(screen.tree)
    if (!labels) continue

    const key = labels.map(l => l.toLowerCase()).join('|')
    const existing = labelMap.get(key) || []
    existing.push(screen.name)
    labelMap.set(key, existing)
  }

  // Find the largest group with 2+ screens sharing same tabs
  let bestGroup: { screenNames: string[]; labels: string[] } | undefined
  for (const [key, names] of labelMap) {
    if (names.length >= 2 && (!bestGroup || names.length > bestGroup.screenNames.length)) {
      bestGroup = { screenNames: names, labels: key.split('|') }
    }
  }

  return bestGroup
}
