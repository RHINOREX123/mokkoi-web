// Expo Snack file builder.
// Constructs the files object and dependencies needed for an Expo Snack.
// Uses a simple state-based tab switcher instead of React Navigation
// to avoid native module crashes in the Snack runtime.

import { convertTreeToTSX, convertAppToTSX } from './exportTsx'
import type { DeepNavRouteGraph } from './exportTsx'
import { expandComponents } from '../../lib/component-library'
import { wireScreen } from './wirer'
import type { ScreenInfo } from './wirer'
import type { ComponentNode } from '../types/mokkoi'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import type { FlowConnection } from '../components/FlowConnectors'
import { getCachedImageUrl } from '../components/ScreenRenderer'

// ─── FIX 1: Image URL replacement (loremflickr keyword-locked) ───
//
// Previously used `picsum.photos/400/300?random=N` — the `random` param is a
// cache-buster, NOT a seed, so every image came back as a different random
// stock photo (vintage cars, Machu Picchu, etc.) with no relation to the
// user's prompt. The canvas shows real food photos via our /api/generate?
// action=image proxy, so the Snack preview looked completely different.
//
// loremflickr.com serves keyword-matched Flickr images AND supports a `lock`
// param for deterministic results — same lock + tags → same image. We derive
// tags from the node's `searchQuery` (e.g. "margherita pizza") and a stable
// hash of the same string as the lock.

/** Simple deterministic 32-bit string hash (FNV-1a). Stable across runs. */
function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Convert a free-form search phrase into loremflickr tags:
 * "Margherita Pizza with basil" → "margherita,pizza,basil"
 * Returns a safe fallback (`food`) if nothing usable remains.
 */
function toLoremflickrTags(query: string): string {
  const stop = new Set(['a', 'an', 'the', 'of', 'with', 'and', 'or', 'for', 'in', 'on', 'at', 'to'])
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stop.has(w))
    .slice(0, 3)
  return words.length > 0 ? words.join(',') : 'food'
}

function replaceImageSources(node: ComponentNode): ComponentNode {
  if (!node) return node

  if (node.type === 'Image' && node.props) {
    const props = { ...node.props }
    if (props.searchQuery) {
      const query = String(props.searchQuery)
      // Bug 3: prefer the real Pexels/Unsplash URL the canvas already resolved
      // via /api/generate?action=image. Those are public CDN URLs that Expo Go
      // can load directly — and they match the canvas exactly, eliminating the
      // "canvas shows pizza, Expo Go shows a cat" surprise. We only fall back
      // to loremflickr if the canvas never resolved this query (e.g. user hit
      // Preview before the image finished loading).
      const cached = getCachedImageUrl(query)
      if (cached) {
        props.source = { uri: cached }
      } else {
        const tags = toLoremflickrTags(query)
        const lock = hashString(query) % 1_000_000
        props.source = { uri: `https://loremflickr.com/400/300/${tags}?lock=${lock}` }
      }
      delete props.searchQuery
    } else if (props.avatar) {
      const name = String(props.avatar)
      props.source = { uri: `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(name)}&size=100` }
      delete props.avatar
    }
    return { ...node, props, children: node.children?.map(c => typeof c === 'string' ? c : replaceImageSources(c)) }
  }

  if (node.children) {
    return {
      ...node,
      children: node.children.map(c => typeof c === 'string' ? c : replaceImageSources(c)),
    }
  }
  return node
}

// ─── FIX 2: Strip in-app BottomNav + floating UI elements from tree ───

const NAV_TYPES = new Set(['BottomNav', 'BottomNavigation', 'TabBar', 'BottomTab', 'NavigationBar'])

/** Check if a node looks like a floating pill/FAB (position:absolute, small, top-right area) */
function isFloatingPill(node: ComponentNode): boolean {
  if (!node.style) return false
  const s = node.style as Record<string, unknown>
  // Detect position:absolute floating elements (refresh/more pill, FABs)
  if (s.position === 'absolute') {
    const top = Number(s.top) || 0
    const right = Number(s.right) || 0
    const w = Number(s.width) || 0
    const h = Number(s.height) || 0
    // Small floating element in top-right or mid-right area
    if (right <= 20 && top <= 200 && w <= 80 && h <= 120 && w > 0) return true
    // Any small absolute element with borderRadius (pill/circle shape)
    if (s.borderRadius && w <= 60 && h <= 100) return true
  }
  return false
}

/** Check if a node looks like a bottom nav bar */
function isBottomNavPattern(node: ComponentNode): boolean {
  if (node.type !== 'View' || !node.style) return false
  const s = node.style as Record<string, unknown>
  // Row layout with border or absolute bottom positioning
  const isRow = s.flexDirection === 'row'
  const isBottom = s.position === 'absolute' && (s.bottom === 0 || s.bottom === '0')
  const hasBorderTop = !!s.borderTopWidth || !!s.borderTopColor
  if (!isRow && !isBottom) return false
  if (!isRow && !hasBorderTop) return false

  const touchKids = (node.children || []).filter(c =>
    typeof c !== 'string' && (c.type === 'TouchableOpacity' || c.type === 'View')
  )
  // 3-6 tab items with short content (icon + label)
  return touchKids.length >= 3 && touchKids.length <= 6
}

function cleanTreeForSnack(node: ComponentNode): ComponentNode {
  if (!node) return node
  if (!node.children) return node

  const filtered = node.children.filter(child => {
    if (typeof child === 'string') return true
    // Strip macro nav types
    if (NAV_TYPES.has(child.type)) return false
    // Strip expanded bottom nav patterns
    if (isBottomNavPattern(child)) return false
    // Strip floating pills (refresh/more button overlays)
    if (isFloatingPill(child)) return false
    return true
  })

  return {
    ...node,
    children: filtered.map(c => typeof c === 'string' ? c : cleanTreeForSnack(c)),
  }
}

// ─── FIX 3: Smart tab detection ───

const DETAIL_KEYWORDS = ['detail', 'details', 'checkout', 'payment', 'edit', 'chat detail', 'post detail', 'workout detail', 'product detail', 'order detail']

function isDetailScreen(name: string): boolean {
  const lower = name.toLowerCase()
  return DETAIL_KEYWORDS.some(kw => lower.includes(kw))
}

/** Count meaningful content nodes in a tree (skip empty Views) */
function countContentNodes(node: ComponentNode): number {
  if (!node) return 0
  let count = 0
  if (node.type === 'Text' || node.type === 'Image' || node.type === 'TextInput' || node.type === 'Switch') count = 1
  if (node.children) {
    for (const c of node.children) {
      if (typeof c === 'string') { count++; continue }
      count += countContentNodes(c)
    }
  }
  return count
}

function isEmptyScreen(tree: ComponentNode): boolean {
  return countContentNodes(tree) < 3
}

// ─── Name helpers ───

function toPascalCase(name: string): string {
  let result = name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
    .slice(0, 30)
  if (!result || /^\d/.test(result)) result = 'Screen' + (result || '')
  return result
}

const FILLER_WORDS = new Set(['create', 'a', 'an', 'the', 'build', 'me', 'make', 'design', 'generate', 'screen', 'for', 'with', 'app', 'page', 'style', 'that', 'delivery', 'tracking'])
/** Names that look like the user's original prompt rather than a screen title.
 * These should fall back to "Home" when they appear at screen index 0. */
function looksLikePromptNotName(name: string): boolean {
  const wordCount = name.trim().split(/\s+/).length
  if (wordCount >= 4) return true                            // "Build a food delivery app"
  if (/^(build|create|make|design|generate)\b/i.test(name)) return true
  return false
}
function toShortLabel(name: string, fallback = 'Screen'): string {
  if (looksLikePromptNotName(name)) return fallback
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0 && !FILLER_WORDS.has(w.toLowerCase()))
  if (words.length === 0) return name.slice(0, 12).trim() || fallback
  return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()
}

/** Map screen name to a tab emoji icon.
 *
 * Match uses WORD BOUNDARIES, not substring. Previously `.includes("me")` was
 * matching "menu" → mapped Restaurant Menu to the 👤 profile icon. Same class
 * of bug would hit "bag" in "baggage", "map" in "shampoo", etc. Word-boundary
 * regex eliminates the false positives. Entries are evaluated in order so put
 * more specific/longer keys first. */
const TAB_ICON_ENTRIES: Array<[string, string]> = [
  ['restaurants', '🍔'], ['restaurant', '🍔'], ['recipes', '🍳'],
  ['menu', '🍽️'], ['food', '🍔'], ['dishes', '🍽️'],
  ['home', '🏠'], ['feed', '🏠'], ['dashboard', '🏠'],
  ['explore', '🔍'], ['search', '🔍'], ['discover', '🔍'], ['browse', '🔍'],
  ['messages', '💬'], ['chat', '💬'], ['inbox', '💬'], ['conversations', '💬'],
  ['profile', '👤'], ['account', '👤'], ['user', '👤'],
  ['notifications', '🔔'], ['alerts', '🔔'], ['activity', '🔔'],
  ['orders', '🛒'], ['order', '🛒'], ['cart', '🛒'], ['bag', '🛒'], ['basket', '🛒'], ['checkout', '🛒'],
  ['settings', '⚙️'], ['preferences', '⚙️'],
  ['favorites', '❤️'], ['saved', '❤️'], ['wishlist', '❤️'], ['likes', '❤️'],
  ['workouts', '💪'], ['fitness', '💪'], ['exercise', '💪'], ['training', '💪'],
  ['progress', '📊'], ['stats', '📊'], ['analytics', '📊'], ['tracking', '📊'],
  ['library', '📚'],
  ['music', '🎵'], ['player', '🎵'], ['playlists', '🎵'],
  ['wallet', '💳'], ['finance', '💳'], ['banking', '💳'], ['cards', '💳'],
  ['map', '📍'], ['location', '📍'], ['nearby', '📍'],
]
function getTabIcon(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, icon] of TAB_ICON_ENTRIES) {
    const re = new RegExp(`\\b${key}\\b`, 'i')
    if (re.test(lower)) return icon
  }
  return '📱'
}

/** Find the index of the home/landing screen.
 *
 * The planner emits an `isHome` flag but we don't currently thread it through
 * to the client, so we detect heuristically. Without this the first-emitted
 * screen wins tab position 0, which may be a random detail/landing variant
 * that the LLM happened to produce first. Order of preference:
 *   1. Exact name "Home" / "home"
 *   2. Name contains word "home", "feed", or "dashboard"
 *   3. Explicit param (for future homeScreenId threading)
 *   4. First screen index. */
function findHomeIndex(screens: GeneratedScreen[], homeScreenId?: string): number {
  if (homeScreenId) {
    const idx = screens.findIndex(s => s.id === homeScreenId)
    if (idx !== -1) return idx
  }
  for (let i = 0; i < screens.length; i++) {
    if (screens[i].name.trim().toLowerCase() === 'home') return i
  }
  for (let i = 0; i < screens.length; i++) {
    if (/\b(home|feed|dashboard)\b/i.test(screens[i].name)) return i
  }
  return 0
}

function deduplicateNames(names: string[]): string[] {
  const counts = new Map<string, number>()
  return names.map(name => {
    const count = counts.get(name) || 0
    counts.set(name, count + 1)
    return count === 0 ? name : `${name}${count + 1}`
  })
}

// ─── Main export ───

export interface SnackFilesOpts {
  projectName: string
  screens: GeneratedScreen[]
  connections?: FlowConnection[]
  /** Optional explicit home screen id from the planner. If omitted we fall back
   *  to heuristic name-matching ("Home"/"Feed"/"Dashboard"), then index 0.
   *  Ensures Expo Go opens to the same first screen as the Mokkoi canvas
   *  instead of whichever screen the LLM happened to emit first. */
  homeScreenId?: string
  /** When true, each screen file embeds the "Made with Mokkoi" watermark.
   *  Used for free-tier previews via Mokkoi's Preview/QR → Expo Go flow. The
   *  watermark renders bottom-right of every screen on the user's real device.
   *  Mirrors the export path so free-tier users see consistent attribution
   *  whenever their app leaves Mokkoi's private web canvas. */
  addWatermark?: boolean
  /** Bring-your-own Supabase credentials. When set, the Snack bundle gets the
   *  @supabase/supabase-js dep plus a generated lib/supabase.ts that creates a
   *  client with the URL/anonKey inlined as string literals (Snack has no env
   *  vars, so values must live in the source). Validation lives upstream
   *  (byoSupabaseValidation); we still defensively skip emission if either
   *  field is empty. */
  byoSupabase?: { url: string; anonKey: string } | null
}

export interface SnackPayload {
  name: string
  files: Record<string, { type: string; contents: string }>
  dependencies: Record<string, { version: string }>
}

export function buildSnackPayload(opts: SnackFilesOpts): SnackPayload {
  const { projectName, screens, connections, homeScreenId, addWatermark, byoSupabase } = opts

  if (screens.length === 0) throw new Error('No screens to preview')

  // Bug 1: identify the home screen so App.tsx opens to it first. The planner
  // emits an isHome flag but only the explicit id (when threaded through) is
  // authoritative; otherwise we fall back to heuristic detection.
  const homeIdx = findHomeIndex(screens, homeScreenId)

  // Build screen names. If the first-emitted screen's name looks like the
  // user's original prompt ("Build a food delivery app"), rewrite it to "Home"
  // so the generated file and tab label are sensible.
  const rewrittenScreens = screens.map((s, i) => {
    if (i === homeIdx && looksLikePromptNotName(s.name)) {
      return { ...s, name: 'Home' }
    }
    return s
  })
  const rawNames = rewrittenScreens.map(s => toPascalCase(s.name))
  const names = deduplicateNames(rawNames)

  // Pre-process trees for Snack (expand, fix images, clean) so we can check content
  const processedTrees: ComponentNode[] = screens.map(s => {
    let tree = expandComponents(s.tree) as ComponentNode
    tree = replaceImageSources(tree)
    tree = cleanTreeForSnack(tree)
    return tree
  })

  // FIX 3: Separate tab screens from detail screens (also exclude empty screens)
  const tabIndices: number[] = []
  const detailIndices: number[] = []
  for (let i = 0; i < screens.length; i++) {
    if (isDetailScreen(rewrittenScreens[i].name) || isEmptyScreen(processedTrees[i])) {
      detailIndices.push(i)
    } else {
      tabIndices.push(i)
    }
  }
  // Bug 1: promote the home screen to tab position 0 if it's a tab candidate.
  // This is what makes Expo Go open to Home instead of whichever screen the
  // LLM happened to emit first.
  const homeTabPos = tabIndices.indexOf(homeIdx)
  if (homeTabPos > 0) {
    tabIndices.splice(homeTabPos, 1)
    tabIndices.unshift(homeIdx)
  }
  // Cap tab screens at 5
  const finalTabIndices = tabIndices.slice(0, 5)
  // Detail screens that got bumped from tabs
  const extraDetailIndices = [...tabIndices.slice(5), ...detailIndices]

  // Build ScreenInfo array for wirer (uses post-processed trees + rewritten names)
  const allScreenInfos: ScreenInfo[] = rewrittenScreens.map((s, i) => ({
    id: s.id,
    name: names[i],
    tree: processedTrees[i],
  }))

  // Generate files for ALL screens (using pre-processed trees + wirer bindings)
  const files: Record<string, { type: string; contents: string }> = {}
  const allUnmatched: Array<{ trigger: string; target: string; reason: string }> = []

  for (let i = 0; i < screens.length; i++) {
    const name = names[i]
    const { bindings, unmatched } = wireScreen(allScreenInfos[i], connections ?? [], allScreenInfos)
    allUnmatched.push(...unmatched)
    const tsx = convertTreeToTSX(processedTrees[i], name, {
      bindings: bindings.size > 0 ? bindings : undefined,
      addWatermark,
    })
    files[`screens/${name}.tsx`] = { type: 'CODE', contents: tsx }
  }

  if (allUnmatched.length > 0) {
    const preview = allUnmatched.slice(0, 5).map(u => `'${u.trigger}' → ${u.target}`).join(', ')
    console.info(`[wirer] ${allUnmatched.length} unmatched connection(s): ${preview}`)
  }

  // App.tsx — only tab screens get bottom tabs; detail screens are included but not tabbed
  const allIndices = [...finalTabIndices, ...extraDetailIndices]
  const imports = allIndices.map(i => `import ${names[i]}Screen from './screens/${names[i]}';`).join('\n')

  // Tab screens array + labels + icons (only main screens). Use rewrittenScreens
  // so the home tab (if its original name was the user's prompt) shows "Home"
  // with the 🏠 icon rather than a garbled label like "Food" 📱.
  const tabScreenArray = finalTabIndices.map(i => `${names[i]}Screen`).join(', ')
  const realLabels = finalTabIndices.map(i => toShortLabel(rewrittenScreens[i].name))
  const realIcons = finalTabIndices.map(i => getTabIcon(rewrittenScreens[i].name))

  // FIX 3: Always render a tab bar so single-screen previews still look like a
  // real mobile app (matching the canvas). When only one real tab exists, pad
  // with disabled placeholder tabs — present but greyed out and non-tappable.
  const PLACEHOLDER_TABS: Array<{ icon: string; label: string }> = [
    { icon: '🔍', label: 'Search' },
    { icon: '🔔', label: 'Activity' },
    { icon: '👤', label: 'Profile' },
  ]
  const realTabCount = finalTabIndices.length
  const placeholderCount = realTabCount === 1 ? 3 : 0
  // Drop placeholder candidates that would collide with the real tab's label
  const usedLabels = new Set(realLabels.map(l => l.toLowerCase()))
  const chosenPlaceholders = PLACEHOLDER_TABS
    .filter(p => !usedLabels.has(p.label.toLowerCase()))
    .slice(0, placeholderCount)

  const displayLabels = [...realLabels, ...chosenPlaceholders.map(p => p.label)]
  const displayIcons = [...realIcons, ...chosenPlaceholders.map(p => p.icon)]

  const tabLabels = displayLabels.map(l => `'${l.replace(/'/g, "\\'")}'`).join(', ')
  const tabIcons = displayIcons.map(ic => `'${ic}'`).join(', ')

  // All screens array (tabs first, then details) for index-based access
  const allScreenArray = allIndices.map(i => `${names[i]}Screen`).join(', ')
  const allLabelsArray = allIndices.map(i => `'${toShortLabel(rewrittenScreens[i].name)}'`).join(', ')

  const hasDetailScreens = extraDetailIndices.length > 0

  const appCode = `import React, { useState } from 'react';
import { View, TouchableOpacity, Text, SafeAreaView, StatusBar } from 'react-native';
${imports}

const tabScreens = [${tabScreenArray}];
const tabLabels = [${tabLabels}];
const tabIcons = [${tabIcons}];
${hasDetailScreens ? `const allScreens = [${allScreenArray}];\nconst allLabels = [${allLabelsArray}];` : ''}

export default function App() {
  const [active, setActive] = useState(0);
  const ActiveScreen = ${hasDetailScreens ? 'active < tabScreens.length ? tabScreens[active] : allScreens[active]' : 'tabScreens[active]'};
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A1A' }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>
        <ActiveScreen />
      </View>
      <SafeAreaView style={{ backgroundColor: '#0D1117' }}>
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: '#1C2333', backgroundColor: '#0D1117', paddingTop: 6, paddingBottom: 4 }}>
          {tabLabels.map((label, i) => {
            const isPlaceholder = i >= ${realTabCount};
            return (
              <TouchableOpacity
                key={i}
                onPress={isPlaceholder ? undefined : () => setActive(i)}
                disabled={isPlaceholder}
                activeOpacity={isPlaceholder ? 1 : 0.7}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 4, opacity: isPlaceholder ? 0.35 : 1 }}
              >
                <Text style={{ fontSize: 20, marginBottom: 2 }}>{tabIcons[i]}</Text>
                <Text style={{ color: active === i ? '#2563EB' : '#555', fontSize: 10, fontWeight: active === i ? '600' : '400' }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}
`
  files['App.tsx'] = { type: 'CODE', contents: appCode }

  const dependencies: Record<string, { version: string }> = {
    'expo-status-bar': { version: '~1.11.1' },
    // Icons render via @expo/vector-icons (Ionicons). That package is
    // pre-bundled in every Expo Snack SDK, so we deliberately DO NOT declare
    // it here — declaring it can force Snack to resolve a version that
    // conflicts with its bundled one. Pre-bundled === zero version hell.
    //
    // Previously we shipped lucide-react-native + a pinned react-native-svg.
    // That crashed Expo Go with "Cannot read property 'ReactCurrentOwner' of
    // undefined" whenever the pinned svg version disagreed with Snack's
    // bundled one (e.g. our 15.2.0 pin vs Snack SDK 52/53's newer svg).
  }

  // BYO-Backend: only emit Supabase wiring when creds are present and well-formed.
  // Validation upstream (byoSupabaseValidation) is the source of truth, but we
  // double-check here so a misconfigured project never produces a half-broken
  // bundle that imports a client created with empty strings.
  if (byoSupabase) {
    const url = String(byoSupabase.url || '').trim()
    const anonKey = String(byoSupabase.anonKey || '').trim()
    if (!url || !anonKey) {
      console.warn('[buildSnackPayload] byoSupabase provided but url/anonKey empty — skipping Supabase emission')
    } else {
      dependencies['@supabase/supabase-js'] = { version: '^2.105.3' }
      // String literal injection (Snack has no envs). Use JSON.stringify so any
      // embedded quotes/backslashes/newlines in the values are escaped safely.
      files['lib/supabase.ts'] = {
        type: 'CODE',
        contents: `import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  ${JSON.stringify(url)},
  ${JSON.stringify(anonKey)}
)
`,
      }
    }
  }

  return {
    name: projectName || 'Mokkoi App',
    files,
    dependencies,
  }
}

// ─── Deep-navigation Snack builder ───────────────────────────────────────────
//
// Counterpart to buildSnackPayload that emits a React Navigation App.tsx
// (NavigationContainer + native-stack) instead of the tab-based shim. Used by
// the deep-nav generation flow where each TouchableOpacity carries a
// navIntent and the planner provides a routeGraph + appData blob.
//
// Each per-screen file is generated with convertTreeToTSX — the navIntent
// branch already emits navigation.navigate calls. The new App.tsx is produced
// by convertAppToTSX.

export interface DeepNavSnackOpts {
  projectName: string
  screens: GeneratedScreen[]
  routeGraph: DeepNavRouteGraph
  appData: unknown
  addWatermark?: boolean
  byoSupabase?: { url: string; anonKey: string } | null
}

export function buildDeepNavSnackPayload(opts: DeepNavSnackOpts): SnackPayload {
  const { projectName, screens, routeGraph, appData, addWatermark, byoSupabase } = opts

  if (screens.length === 0) throw new Error('No screens to preview')

  // PascalCase + dedupe component names. Screens are keyed by planner id
  // (stable, planner-controlled) but the file/component names must be valid
  // JS identifiers, so we derive them from screen.name with the same pipeline
  // the tab-based builder uses.
  const rawNames = screens.map(s => toPascalCase(s.name))
  const names = deduplicateNames(rawNames)

  // Pre-process trees: macro expansion, image-source rewrite, nav cleanup.
  // Same pipeline as buildSnackPayload so the resulting screens look identical
  // to what users see on the canvas.
  const processedTrees: ComponentNode[] = screens.map(s => {
    let tree = expandComponents(s.tree) as ComponentNode
    tree = replaceImageSources(tree)
    tree = cleanTreeForSnack(tree)
    return tree
  })

  // Map planner screen id → component name + import path. The routeGraph
  // references screens by id, so the App.tsx scaffold needs that lookup. Any
  // screen present in `screens` but not in routeGraph is still emitted as a
  // file (defensive) but won't show up in the Stack.
  const componentNameByScreenId: Record<string, string> = {}
  const importPathByScreenId: Record<string, string> = {}

  const files: Record<string, { type: string; contents: string }> = {}
  for (let i = 0; i < screens.length; i++) {
    const compName = names[i]
    const id = screens[i].id
    componentNameByScreenId[id] = `${compName}Screen`
    importPathByScreenId[id] = `./screens/${compName}`
    const tsx = convertTreeToTSX(processedTrees[i], compName, { addWatermark })
    files[`screens/${compName}.tsx`] = { type: 'CODE', contents: tsx }
  }

  // Validate that every routeGraph screen has a corresponding generated file.
  // If a planner-promised screen never materialized (e.g. partial-failure
  // stub was filtered out upstream) we emit a tiny placeholder so React
  // Navigation doesn't crash trying to resolve the route.
  for (const s of routeGraph.screens ?? []) {
    if (!componentNameByScreenId[s.id]) {
      const fallbackName = toPascalCase(s.id) || 'Missing'
      componentNameByScreenId[s.id] = `${fallbackName}Screen`
      importPathByScreenId[s.id] = `./screens/${fallbackName}`
      const stub = `import React from 'react';
import { View, Text } from 'react-native';
export default function ${fallbackName}Screen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A1A' }}>
      <Text style={{ color: '#94a3b8' }}>Screen unavailable</Text>
    </View>
  );
}
`
      files[`screens/${fallbackName}.tsx`] = { type: 'CODE', contents: stub }
    }
  }

  files['App.tsx'] = {
    type: 'CODE',
    contents: convertAppToTSX({
      componentNameByScreenId,
      importPathByScreenId,
      appData,
      routeGraph,
    }),
  }

  const dependencies: Record<string, { version: string }> = {
    'expo-status-bar': { version: '~1.11.1' },
    // React Navigation native-stack — pinned to versions known to work on the
    // Expo SDK Snack bundles ship today. Peer deps (react-native-screens,
    // react-native-safe-area-context) are pre-bundled into Snack so we don't
    // declare them here; declaring them risks version conflicts.
    '@react-navigation/native': { version: '^6.1.18' },
    '@react-navigation/native-stack': { version: '^6.11.0' },
  }

  if (byoSupabase) {
    const url = String(byoSupabase.url || '').trim()
    const anonKey = String(byoSupabase.anonKey || '').trim()
    if (url && anonKey) {
      dependencies['@supabase/supabase-js'] = { version: '^2.105.3' }
      files['lib/supabase.ts'] = {
        type: 'CODE',
        contents: `import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  ${JSON.stringify(url)},
  ${JSON.stringify(anonKey)}
)
`,
      }
    }
  }

  return {
    name: projectName || 'Mokkoi App',
    files,
    dependencies,
  }
}
