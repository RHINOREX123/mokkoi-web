// eval/scoring.mjs — pure functions to score generated screens.
//
// Multi-axis to avoid Goodhart's law: optimizing only for macro density would
// let the AI use macros where they don't fit (e.g. ListRow for unrelated
// content). The 7 mechanical axes + AI-judge cover quality from different
// angles so a prompt rewrite that wins one but breaks another is visible.
//
// All functions are pure: take a tree, return a number/object. No side effects.

// 26 canonical macros from lib/component-library.ts COMPONENT_EXPANSIONS
export const MACRO_TYPES = new Set([
  'AvatarCircle', 'BottomNav', 'Button', 'ChatInputBar', 'ChipSelector', 'Divider',
  'FeatureCard', 'FormInput', 'HeaderBar', 'ImageCarousel', 'ListRow', 'MessageBubble',
  'PriceBreakdown', 'ProductCard', 'ProfileStats', 'ProgressBar', 'ProgressRing',
  'PromoCard', 'RatingStars', 'SearchBar', 'SectionHeader', 'SocialButton', 'StatCard',
  'StatusBadge', 'TabBar', 'TransactionRow',
])

// Macros named in Day 1's findings as the most-missed by current AI output.
// Tracked as their own adoption rates so Day 3-4 prompt iterations can target
// these specifically without averaging-them-out across 26 macros.
export const TARGETED_MACROS = ['BottomNav', 'ListRow', 'ChipSelector', 'RatingStars', 'SectionHeader']

// Patterns that mark fake/placeholder content. Lowercase comparison.
const FAKE_CONTENT_PATTERNS = [
  /\bitem [0-9]+\b/i,        // "Item 1", "Item 2"
  /\blorem ipsum\b/i,
  /\blorem\b/i,
  /\btodo\b/i,
  /\bplaceholder\b/i,
  /^sample( |$)/i,           // "Sample text", "Sample"
  /^example( |$)/i,
  /\bjohn doe\b/i,
  /\bjane doe\b/i,
  /\btest\s*\d/i,            // "Test 1"
]

// Walk the tree, yielding every node (depth-first).
export function* walkNodes(node) {
  if (!node || typeof node !== 'object') return
  yield node
  const children = node.children
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child && typeof child === 'object') yield* walkNodes(child)
    }
  }
}

// Walk and collect text strings (the leaf string in Text nodes' children).
export function* walkTextStrings(node) {
  for (const n of walkNodes(node)) {
    if (n.type === 'Text' && Array.isArray(n.children)) {
      for (const c of n.children) {
        if (typeof c === 'string' && c.trim()) yield c
      }
    }
  }
}

// ─── 1. Macro density ────────────────────────────────────────────────────
// macro_count / total_nodes. The headline metric.
export function macroDensity(tree) {
  let total = 0
  let macros = 0
  for (const n of walkNodes(tree)) {
    total++
    if (MACRO_TYPES.has(n.type)) macros++
  }
  return {
    macro_count: macros,
    total_nodes: total,
    density: total > 0 ? macros / total : 0,
  }
}

// ─── 2. Macro presence ───────────────────────────────────────────────────
// Per-screen "has at least one macro" boolean. Less sensitive than density.
export function macroPresence(tree) {
  for (const n of walkNodes(tree)) {
    if (MACRO_TYPES.has(n.type)) return true
  }
  return false
}

// ─── 3. Specific-macro adoption ──────────────────────────────────────────
// Whether each of the targeted macros appears at least once. Returns object
// keyed by macro name → bool. Aggregates across screens become adoption rates.
export function targetedMacroAdoption(tree) {
  const result = {}
  for (const m of TARGETED_MACROS) result[m] = false
  for (const n of walkNodes(tree)) {
    if (TARGETED_MACROS.includes(n.type)) result[n.type] = true
  }
  return result
}

// ─── 4. Icon name validity ───────────────────────────────────────────────
// Every Icon node's `name` prop must resolve to a known icon. Fails when AI
// emits names like "footprints_alt" that don't exist in either iconMap.
// Returns { total, valid, invalid_names }. Caller passes a validator fn so
// we don't have to load the full iconMap inside this scoring module.
export function iconValidity(tree, isKnown) {
  let total = 0
  let valid = 0
  const invalid = []
  for (const n of walkNodes(tree)) {
    if (n.type === 'Icon') {
      total++
      const name = n.props?.name
      if (typeof name === 'string' && isKnown(name)) valid++
      else if (typeof name === 'string') invalid.push(name)
      else invalid.push('(missing name)')
    }
  }
  return {
    total,
    valid,
    rate: total > 0 ? valid / total : 1, // empty tree = no icons = 100% valid
    invalid_names: invalid,
  }
}

// ─── 5. Content realism ──────────────────────────────────────────────────
// No "Item 1" / "Lorem" / "Sample" placeholder strings. Returns the
// fraction of text strings that are realistic.
export function contentRealism(tree) {
  let total = 0
  let fake = 0
  const fakeStrings = []
  for (const s of walkTextStrings(tree)) {
    total++
    if (FAKE_CONTENT_PATTERNS.some(p => p.test(s))) {
      fake++
      fakeStrings.push(s.slice(0, 60))
    }
  }
  return {
    total,
    realistic: total - fake,
    rate: total > 0 ? (total - fake) / total : 1,
    fake_strings: fakeStrings,
  }
}

// ─── 6. Tree size sanity ─────────────────────────────────────────────────
// 50-180 nodes is the sweet spot per Day 1's findings. Outside = AI confused
// (too few = empty/incomplete, too many = raw-stack hellscape).
export function treeSizeSanity(tree) {
  let total = 0
  for (const _n of walkNodes(tree)) total++
  return {
    nodes: total,
    in_range: total >= 50 && total <= 180,
    too_small: total < 50,
    too_large: total > 180,
  }
}

// ─── Aggregate scoring for one screen ────────────────────────────────────
export function scoreScreen(tree, isKnownIcon) {
  const dens = macroDensity(tree)
  const present = macroPresence(tree)
  const targeted = targetedMacroAdoption(tree)
  const icons = iconValidity(tree, isKnownIcon)
  const realism = contentRealism(tree)
  const sanity = treeSizeSanity(tree)
  return {
    macro_count: dens.macro_count,
    total_nodes: dens.total_nodes,
    macro_density: dens.density,
    has_any_macro: present,
    targeted_macros: targeted,
    icon_total: icons.total,
    icon_valid: icons.valid,
    icon_validity_rate: icons.rate,
    icon_invalid_names: icons.invalid_names,
    text_total: realism.total,
    text_realistic: realism.realistic,
    content_realism_rate: realism.rate,
    fake_strings: realism.fake_strings,
    size_in_range: sanity.in_range,
    size_too_small: sanity.too_small,
    size_too_large: sanity.too_large,
  }
}

// ─── Aggregate across many screens ───────────────────────────────────────
export function aggregate(scores) {
  if (scores.length === 0) return { count: 0 }
  const n = scores.length
  const mean = (key) => scores.reduce((a, s) => a + s[key], 0) / n
  const rate = (pred) => scores.filter(pred).length / n

  const targetedRates = {}
  for (const m of TARGETED_MACROS) {
    targetedRates[m] = rate(s => s.targeted_macros[m])
  }

  return {
    count: n,
    macro_density_mean: mean('macro_density'),
    macro_presence_rate: rate(s => s.has_any_macro),
    targeted_adoption: targetedRates,
    icon_validity_mean: mean('icon_validity_rate'),
    content_realism_mean: mean('content_realism_rate'),
    size_in_range_rate: rate(s => s.size_in_range),
    size_too_small_rate: rate(s => s.size_too_small),
    size_too_large_rate: rate(s => s.size_too_large),
    nodes_mean: mean('total_nodes'),
    nodes_median: median(scores.map(s => s.total_nodes)),
  }
}

function median(xs) {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
