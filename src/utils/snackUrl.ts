// Expo Snack file builder.
// Constructs the files object and dependencies needed for an Expo Snack.
// Uses a simple state-based tab switcher instead of React Navigation
// to avoid native module crashes in the Snack runtime.

import { convertTreeToTSX } from './exportTsx'
import { expandComponents } from '../../lib/component-library'
import { wireScreen } from './wirer'
import type { ScreenInfo } from './wirer'
import type { ComponentNode } from '../types/mokkoi'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import type { FlowConnection } from '../components/FlowConnectors'

// ─── FIX 1: Image URL replacement (picsum.photos) ───

let imageCounter = 0
function replaceImageSources(node: ComponentNode): ComponentNode {
  if (!node) return node

  if (node.type === 'Image' && node.props) {
    const props = { ...node.props }
    if (props.searchQuery) {
      // picsum.photos works reliably in Expo Go (source.unsplash.com does not)
      props.source = { uri: `https://picsum.photos/400/300?random=${imageCounter++}` }
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

const FILLER_WORDS = new Set(['create', 'a', 'an', 'the', 'build', 'me', 'make', 'design', 'generate', 'screen', 'for', 'with', 'app', 'page', 'style', 'that'])
function toShortLabel(name: string): string {
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0 && !FILLER_WORDS.has(w.toLowerCase()))
  if (words.length === 0) return name.slice(0, 12).trim() || 'Screen'
  return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()
}

/** Map screen name to a tab emoji icon */
const TAB_ICONS: Record<string, string> = {
  home: '🏠', feed: '🏠', dashboard: '🏠',
  explore: '🔍', search: '🔍', discover: '🔍', browse: '🔍',
  messages: '💬', chat: '💬', inbox: '💬', conversations: '💬',
  profile: '👤', account: '👤', me: '👤', user: '👤',
  notifications: '🔔', alerts: '🔔', activity: '🔔',
  cart: '🛒', bag: '🛒', basket: '🛒', order: '🛒', orders: '🛒',
  settings: '⚙️', preferences: '⚙️',
  favorites: '❤️', saved: '❤️', wishlist: '❤️', likes: '❤️',
  workouts: '💪', fitness: '💪', exercise: '💪', training: '💪',
  progress: '📊', stats: '📊', analytics: '📊', tracking: '📊',
  library: '📚', recipes: '🍳', menu: '🍽️', restaurants: '🍔',
  music: '🎵', player: '🎵', playlists: '🎵',
  wallet: '💳', finance: '💳', banking: '💳', cards: '💳',
  map: '📍', location: '📍', nearby: '📍',
}
function getTabIcon(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, icon] of Object.entries(TAB_ICONS)) {
    if (lower.includes(key)) return icon
  }
  return '📱'
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
}

export interface SnackPayload {
  name: string
  files: Record<string, { type: string; contents: string }>
  dependencies: Record<string, { version: string }>
}

export function buildSnackPayload(opts: SnackFilesOpts): SnackPayload {
  const { projectName, screens, connections } = opts

  if (screens.length === 0) throw new Error('No screens to preview')

  // Build screen names
  const rawNames = screens.map(s => toPascalCase(s.name))
  const names = deduplicateNames(rawNames)

  // Pre-process trees for Snack (expand, fix images, clean) so we can check content
  imageCounter = 0
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
    if (isDetailScreen(screens[i].name) || isEmptyScreen(processedTrees[i])) {
      detailIndices.push(i)
    } else {
      tabIndices.push(i)
    }
  }
  // Cap tab screens at 5
  const finalTabIndices = tabIndices.slice(0, 5)
  // Detail screens that got bumped from tabs
  const extraDetailIndices = [...tabIndices.slice(5), ...detailIndices]

  // Build ScreenInfo array for wirer (uses post-processed trees)
  const allScreenInfos: ScreenInfo[] = screens.map((s, i) => ({
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
    const tsx = convertTreeToTSX(processedTrees[i], name, { bindings: bindings.size > 0 ? bindings : undefined })
    files[`screens/${name}.tsx`] = { type: 'CODE', contents: tsx }
  }

  if (allUnmatched.length > 0) {
    const preview = allUnmatched.slice(0, 5).map(u => `'${u.trigger}' → ${u.target}`).join(', ')
    console.info(`[wirer] ${allUnmatched.length} unmatched connection(s): ${preview}`)
  }

  // App.tsx — only tab screens get bottom tabs; detail screens are included but not tabbed
  const allIndices = [...finalTabIndices, ...extraDetailIndices]
  const imports = allIndices.map(i => `import ${names[i]}Screen from './screens/${names[i]}';`).join('\n')

  // Tab screens array + labels + icons (only main screens)
  const tabScreenArray = finalTabIndices.map(i => `${names[i]}Screen`).join(', ')
  const tabLabels = finalTabIndices.map(i => `'${toShortLabel(screens[i].name)}'`).join(', ')
  const tabIcons = finalTabIndices.map(i => `'${getTabIcon(screens[i].name)}'`).join(', ')

  // All screens array (tabs first, then details) for index-based access
  const allScreenArray = allIndices.map(i => `${names[i]}Screen`).join(', ')
  const allLabelsArray = allIndices.map(i => `'${toShortLabel(screens[i].name)}'`).join(', ')

  const hasDetailScreens = extraDetailIndices.length > 0
  const tabCount = finalTabIndices.length

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
      {${tabCount} > 1 && (
        <SafeAreaView style={{ backgroundColor: '#0D1117' }}>
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: '#1C2333', backgroundColor: '#0D1117', paddingTop: 6, paddingBottom: 4 }}>
            {tabLabels.map((label, i) => (
              <TouchableOpacity key={i} onPress={() => setActive(i)} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                <Text style={{ fontSize: 20, marginBottom: 2 }}>{tabIcons[i]}</Text>
                <Text style={{ color: active === i ? '#2563EB' : '#555', fontSize: 10, fontWeight: active === i ? '600' : '400' }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}
`
  files['App.tsx'] = { type: 'CODE', contents: appCode }

  const dependencies: Record<string, { version: string }> = {
    'expo-status-bar': { version: '~1.11.1' },
    // lucide-react-native renders Icon components; react-native-svg is its peer dep.
    // Expo Snack pins react-native-svg to the version it bundles, but declaring it
    // explicitly avoids "peer dep missing" warnings on some SDK versions.
    'lucide-react-native': { version: '^0.469.0' },
    'react-native-svg': { version: '15.2.0' },
  }

  return {
    name: projectName || 'Mokkoi App',
    files,
    dependencies,
  }
}
