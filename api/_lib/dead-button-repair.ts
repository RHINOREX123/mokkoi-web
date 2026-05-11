import type { ComponentNode, NavIntent } from '../../src/types/mokkoi'
import type { RouteGraph } from './planner'

// ── Dead-button repair ────────────────────────────────────────────────────────
//
// Runs AFTER validateNavIntents. validateNavIntents converts missing / dangling
// intents into `{ kind:'noop', toastMessage:'Coming soon' }` (a "validator-
// origin" noop). This pass walks those validator-origin noops and tries to
// infer a real navigation target from the button's visible text. If we can
// resolve a screen with confidence ≥ 0.7, we upgrade the intent to a push;
// otherwise we leave the noop in place so the runtime shows the "Coming soon"
// toast (safer than routing to the wrong screen — see food-delivery Profile
// rows → Orders bug).
//
// Buttons we MUST NOT touch:
//   - Valid push / openSheet (target resolves)
//   - noop WITHOUT toastMessage  → intentional legacy classifier fallthrough
//   - noop with a non-"Coming soon" toastMessage → deliberate custom toast
//
// Per-button try/catch isolates malformed nodes so one bad button can't kill
// the whole batch.

export interface RepairStats {
  buttonsScanned: number
  repaired: number
  toasted: number
  preserved: number
  errors: number
}

const VALIDATOR_TOAST = 'Coming soon'
const CONFIDENCE_THRESHOLD = 0.7

const STRIP_PREFIXES = [
  /^see all\s+/i,
  /^view all\s+/i,
  /^view\s+/i,
  /^show all\s+/i,
  /^show\s+/i,
  /^go to\s+/i,
  /^open\s+/i,
]

interface SemanticRule {
  pattern: RegExp
  candidates: string[]
  confidence: number
}

const SEMANTIC_RULES: SemanticRule[] = [
  { pattern: /\b(setting|preference|account setting)s?\b/i, candidates: ['settings', 'preferences', 'account'], confidence: 0.85 },
  { pattern: /\b(search|find)\b/i, candidates: ['search', 'explore', 'find'], confidence: 0.8 },
  { pattern: /\b(profile|my account|account|me)\b/i, candidates: ['profile', 'account', 'me'], confidence: 0.8 },
  { pattern: /\b(notif|alert|inbox)/i, candidates: ['notifications', 'alerts', 'inbox'], confidence: 0.8 },
  { pattern: /\b(history|past|previous|recent)\b/i, candidates: ['history', 'recent', 'past'], confidence: 0.8 },
  { pattern: /\b(help|support|faq)\b/i, candidates: ['help', 'support', 'faq'], confidence: 0.8 },
  { pattern: /\b(cart|basket|bag)\b/i, candidates: ['cart', 'basket', 'bag', 'checkout'], confidence: 0.8 },
  { pattern: /\b(home|dashboard|feed)\b/i, candidates: ['home', 'dashboard', 'feed'], confidence: 0.75 },
]

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

function extractText(node: ComponentNode | string | undefined | null): string {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (typeof node !== 'object') return ''
  let out = ''
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      const t = extractText(c)
      if (t) out += (out ? ' ' : '') + t
    }
  }
  if (node.props && typeof node.props === 'object') {
    const label = (node.props as Record<string, unknown>).label
    if (typeof label === 'string') out += (out ? ' ' : '') + label
  }
  return out
}

interface InferResult {
  target: string | null
  confidence: number
}

function inferTargetFromText(rawText: string, routeGraph: RouteGraph): InferResult {
  const text = normalize(rawText)
  if (!text) return { target: null, confidence: 0 }

  const screens = routeGraph?.screens ?? []
  // Only push-eligible (non-modal) targets — repairs are kind:'push'.
  const pushScreens = screens.filter(s => s.kind !== 'modal')
  if (pushScreens.length === 0) return { target: null, confidence: 0 }

  // a) Exact case-insensitive match against screen id.
  for (const s of pushScreens) {
    if (normalize(s.id) === text) return { target: s.id, confidence: 1.0 }
  }

  // b) Substring match after stripping common prefixes ("See all ..." etc.).
  let stripped = text
  for (const re of STRIP_PREFIXES) stripped = stripped.replace(re, '')
  stripped = stripped.trim()
  if (stripped && stripped !== text) {
    for (const s of pushScreens) {
      if (normalize(s.id) === stripped) return { target: s.id, confidence: 0.9 }
    }
  }
  if (stripped) {
    for (const s of pushScreens) {
      const sid = normalize(s.id)
      if (sid.includes(stripped) || stripped.includes(sid)) {
        return { target: s.id, confidence: 0.75 }
      }
    }
  }

  // c) Semantic keyword routing — only fires when the routeGraph actually
  //    contains a screen matching one of the rule's candidate names.
  for (const rule of SEMANTIC_RULES) {
    if (!rule.pattern.test(rawText)) continue
    for (const cand of rule.candidates) {
      const hit = pushScreens.find(s => normalize(s.id).includes(cand))
      if (hit) return { target: hit.id, confidence: rule.confidence }
    }
  }

  return { target: null, confidence: 0 }
}

function isValidatorOriginNoop(intent: NavIntent | undefined): boolean {
  if (!intent) return true // missing — treat like validator-origin (defensive)
  if (intent.kind !== 'noop') return false
  // Only the validator stamps the literal 'Coming soon' toast. Custom toasts
  // are deliberate; bare noop (no toastMessage) is intentional legacy.
  return intent.toastMessage === VALIDATOR_TOAST
}

function intentTargetResolves(intent: NavIntent | undefined, routeGraph: RouteGraph): boolean {
  if (!intent) return false
  if (intent.kind === 'push' || intent.kind === 'openSheet') {
    return (routeGraph?.screens ?? []).some(s => s.id === intent.target)
  }
  return false
}

export function repairDeadButtons(
  tree: ComponentNode,
  routeGraph: RouteGraph,
  screenLabel: string,
  stats?: RepairStats,
): ComponentNode {
  if (!tree || typeof tree !== 'object') return tree
  if (!routeGraph || !Array.isArray(routeGraph.screens)) return tree

  function walk(node: ComponentNode): void {
    if (!node || typeof node !== 'object') return

    if (node.type === 'TouchableOpacity') {
      try {
        if (stats) stats.buttonsScanned++
        const intent = node.navIntent

        // Valid navigation already — leave alone.
        if (intentTargetResolves(intent, routeGraph)) {
          if (stats) stats.preserved++
        } else if (intent && intent.kind === 'noop' && intent.toastMessage !== VALIDATOR_TOAST) {
          // Intentional bare noop or custom toast — leave alone.
          if (stats) stats.preserved++
        } else if (isValidatorOriginNoop(intent)) {
          const text = extractText(node)
          const inferred = inferTargetFromText(text, routeGraph)
          if (inferred.target && inferred.confidence >= CONFIDENCE_THRESHOLD) {
            node.navIntent = { kind: 'push', target: inferred.target }
            if (stats) stats.repaired++
          } else {
            // Ensure the canonical fallback shape.
            node.navIntent = { kind: 'noop', toastMessage: VALIDATOR_TOAST }
            if (stats) stats.toasted++
          }
        } else {
          // push/openSheet with unresolved target — fall back to toast.
          node.navIntent = { kind: 'noop', toastMessage: VALIDATOR_TOAST }
          if (stats) stats.toasted++
        }
      } catch (err) {
        if (stats) stats.errors++
        console.warn(`[repairDeadButtons] per-button failure on ${screenLabel}:`, err)
        // Leave node.navIntent unchanged.
      }
    }

    // Children access is wrapped in try/catch so a malformed node (getter
    // that throws, etc.) at this level doesn't kill the surrounding batch.
    try {
      if (Array.isArray(node.children)) {
        for (const c of node.children) {
          if (c && typeof c === 'object') walk(c as ComponentNode)
        }
      }
    } catch (err) {
      if (stats) stats.errors++
      console.warn(`[repairDeadButtons] children walk failure on ${screenLabel}:`, err)
    }
  }

  walk(tree)
  return tree
}

// ── Back-button heuristic (warn-only) ─────────────────────────────────────────
//
// Detail screens (presentation:'screen' with params:['id'] or similar) should
// have a visible back affordance in the first ~3 rows. We don't auto-add one
// (runtime back-stack already handles missing back buttons via glyph
// detection), but we log a warning so the planner / debugging surface knows.

const BACK_TEXT_RE = /^(back|cancel|close|done)$/i
const BACK_GLYPH_RE = /^(arrow_back|arrow_back_ios|arrow_back_ios_new|chevron_left|keyboard_backspace|west|arrow-left|arrow-back|chevron-left|×|✕)$/i

function buttonLooksLikeBack(node: ComponentNode): boolean {
  if (!node || typeof node !== 'object') return false
  if (node.type !== 'TouchableOpacity') return false
  const text = extractText(node).trim()
  if (text && BACK_TEXT_RE.test(text)) return true
  if (text && BACK_GLYPH_RE.test(text)) return true
  // Look one level deep for icon-only buttons whose label is on the Icon child.
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      if (c && typeof c === 'object') {
        const cn = c as ComponentNode
        const label = (cn.props as Record<string, unknown> | undefined)?.label
        if (typeof label === 'string' && BACK_GLYPH_RE.test(label.trim())) return true
        if (cn.type === 'Icon' || cn.type === 'IconButton') {
          const name = (cn.props as Record<string, unknown> | undefined)?.name
          if (typeof name === 'string' && BACK_GLYPH_RE.test(name.trim())) return true
        }
      }
    }
  }
  return false
}

function hasBackInFirstRows(tree: ComponentNode, rows = 3): boolean {
  if (!tree || typeof tree !== 'object') return false
  // Walk to first real row container. Only descend through neutral wrappers
  // (View / SafeAreaView / ScrollView). Stop at TouchableOpacity or any other
  // type — we want to inspect the FIRST row that contains buttons, not unwrap
  // the button itself.
  const WRAPPERS = new Set(['View', 'SafeAreaView', 'ScrollView'])
  let cursor: ComponentNode = tree
  for (let i = 0; i < 6; i++) {
    if (!WRAPPERS.has(cursor.type)) break
    if (!Array.isArray(cursor.children) || cursor.children.length !== 1) break
    const onlyChild = cursor.children[0]
    if (!onlyChild || typeof onlyChild !== 'object') break
    const cn = onlyChild as ComponentNode
    if (!WRAPPERS.has(cn.type)) break
    cursor = cn
  }
  const children = Array.isArray(cursor.children) ? cursor.children : []
  const slice = children.slice(0, rows)
  for (const child of slice) {
    if (!child || typeof child !== 'object') continue
    const cn = child as ComponentNode
    if (buttonLooksLikeBack(cn)) return true
    // One-level descent — header bars wrap the back button in a row View.
    if (Array.isArray(cn.children)) {
      for (const inner of cn.children) {
        if (inner && typeof inner === 'object' && buttonLooksLikeBack(inner as ComponentNode)) {
          return true
        }
      }
    }
  }
  return false
}

export interface BackButtonCheckResult {
  warnings: string[]
}

/** Returns warnings (does NOT mutate the tree). Caller logs them. */
export function checkBackButton(
  tree: ComponentNode,
  screenMeta: { id: string; presentation?: 'screen' | 'modal'; params?: string[] },
): BackButtonCheckResult {
  const warnings: string[] = []
  if (!tree || typeof tree !== 'object') return { warnings }
  const isDetail = screenMeta.presentation !== 'modal' &&
    Array.isArray(screenMeta.params) && screenMeta.params.length > 0
  if (!isDetail) return { warnings }
  if (!hasBackInFirstRows(tree, 3)) {
    warnings.push(`[back-button] detail screen "${screenMeta.id}" has no visible back affordance in first 3 rows`)
  }
  return { warnings }
}
