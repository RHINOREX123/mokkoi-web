/**
 * wirer.ts — resolves planner navigation connections to button-level onPress bindings
 * Uses Jaccard token-overlap fuzzy matching with deterministic fallback.
 * Pure module: no network, no disk, no globals.
 */

import type { ComponentNode } from '../types/mokkoi'
import type { FlowConnection } from '../components/FlowConnectors'

// ── Public types ──────────────────────────────────────────────────────────────

export interface ScreenInfo {
  id: string
  name: string
  tree: ComponentNode
}

export interface WireResult {
  tree: ComponentNode
  bindings: Map<ComponentNode, string>
  usesNavigation: boolean
  unmatched: Array<{ trigger: string; target: string; reason: string }>
}

// ── Stopwords ─────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'and', 'or', 'of', 'for',
  'my', 'your', 'on', 'in', 'at',
])

const DIRECTIONAL_VERBS = new Set([
  'go', 'open', 'view', 'see', 'continue', 'next',
  'start', 'browse', 'explore',
])

// ── Exported pure functions ───────────────────────────────────────────────────

/** Lowercase, split on non-alphanumeric, drop stopwords, dedupe. */
export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  const unique: string[] = []
  const seen = new Set<string>()
  for (const t of raw) {
    if (!STOPWORDS.has(t) && !seen.has(t)) {
      seen.add(t)
      unique.push(t)
    }
  }
  return unique
}

/** Jaccard similarity: |intersection| / |union|. Returns 0 if both empty. */
export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let intersection = 0
  for (const t of setA) {
    if (setB.has(t)) intersection++
  }
  const union = new Set([...setA, ...setB]).size
  return intersection / union
}

// ── Private helpers ───────────────────────────────────────────────────────────

/** Collect all text string descendants from a node (does NOT mutate). */
function collectAllText(node: ComponentNode): string {
  const parts: string[] = []
  if (node.children) {
    for (const child of node.children) {
      if (typeof child === 'string') {
        parts.push(child.trim())
      } else {
        parts.push(collectAllText(child))
      }
    }
  }
  if (node.props?.children && typeof node.props.children === 'string') {
    parts.push(node.props.children)
  }
  return parts.filter(Boolean).join(' ')
}

interface TouchableEntry {
  node: ComponentNode
  text: string
}

/** Walk tree and return all TouchableOpacity nodes with their concatenated text. */
function findTouchables(node: ComponentNode): TouchableEntry[] {
  const results: TouchableEntry[] = []

  if (node.type === 'TouchableOpacity') {
    results.push({ node, text: collectAllText(node).trim() })
  }

  if (node.children) {
    for (const child of node.children) {
      if (typeof child !== 'string') {
        results.push(...findTouchables(child))
      }
    }
  }

  return results
}

// ── Main export ───────────────────────────────────────────────────────────────

export function wireScreen(
  screen: ScreenInfo,
  allConnections: FlowConnection[],
  allScreens: ScreenInfo[],
): WireResult {
  const bindings = new Map<ComponentNode, string>()
  const unmatched: Array<{ trigger: string; target: string; reason: string }> = []

  // Filter to only this screen's outgoing connections
  const outgoing = allConnections.filter(c => c.fromScreenId === screen.id)

  if (outgoing.length === 0) {
    return { tree: screen.tree, bindings, usesNavigation: false, unmatched }
  }

  // Build a lookup: screenId → screen name
  const screenNameById = new Map<string, string>()
  for (const s of allScreens) {
    screenNameById.set(s.id, s.name)
  }

  // Discover all touchable buttons in document order
  const touchables = findTouchables(screen.tree)

  // ── Greedy Jaccard scoring ────────────────────────────────────────────────

  interface Candidate {
    button: TouchableEntry
    connection: FlowConnection
    score: number
  }

  const candidates: Candidate[] = []

  for (const conn of outgoing) {
    const triggerTokens = tokenize(conn.trigger ?? '')
    for (const button of touchables) {
      const buttonTokens = tokenize(button.text)
      let score = jaccard(triggerTokens, buttonTokens)

      // allTokensPresent boost
      if (
        triggerTokens.length > 0 &&
        triggerTokens.every(t => buttonTokens.includes(t))
      ) {
        score = Math.max(score, 0.5)
      }

      if (score >= 0.34) {
        candidates.push({ button, connection: conn, score })
      }
    }
  }

  // Sort: score desc, then shorter button text first
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.button.text.length - b.button.text.length
  })

  const assignedButtons = new Set<ComponentNode>()
  const assignedConnections = new Set<FlowConnection>()

  for (const { button, connection, score: _score } of candidates) {
    if (assignedButtons.has(button.node)) continue
    if (assignedConnections.has(connection)) continue

    const targetName = screenNameById.get(connection.toScreenId) ?? connection.toScreenId
    bindings.set(button.node, targetName)
    assignedButtons.add(button.node)
    assignedConnections.add(connection)
  }

  // ── Fallback for unassigned connections ───────────────────────────────────

  for (const conn of outgoing) {
    if (assignedConnections.has(conn)) continue

    const triggerTokens = tokenize(conn.trigger ?? '')
    const targetName = screenNameById.get(conn.toScreenId) ?? conn.toScreenId
    const targetTokens = tokenize(targetName)

    // Find unbound buttons
    const unboundTouchables = touchables.filter(b => !assignedButtons.has(b.node) && b.text.length > 0)

    // Check fallback conditions independently
    const hasDirectionalVerb = triggerTokens.some(t => DIRECTIONAL_VERBS.has(t))

    const hasTargetNameToken = unboundTouchables.some(button => {
      const buttonTokens = tokenize(button.text)
      return targetTokens.some(t => buttonTokens.includes(t))
    })

    const shouldFallback = hasDirectionalVerb || hasTargetNameToken

    if (shouldFallback) {
      const candidate = unboundTouchables.find(b => collectAllText(b.node).trim().length > 0)
      if (candidate) {
        bindings.set(candidate.node, targetName)
        assignedButtons.add(candidate.node)
        assignedConnections.add(conn)
        continue
      }
    }

    // Truly unmatched
    unmatched.push({
      trigger: conn.trigger ?? '',
      target: targetName,
      reason: `no button matched trigger '${conn.trigger ?? ''}'`,
    })
  }

  return {
    tree: screen.tree,
    bindings,
    usesNavigation: bindings.size > 0,
    unmatched,
  }
}
