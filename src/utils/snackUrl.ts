// Expo Snack file builder.
// Constructs the files object and dependencies needed for an Expo Snack.
// Uses a simple state-based tab switcher instead of React Navigation
// to avoid native module crashes in the Snack runtime.

import { convertTreeToTSX } from './exportTsx'
import { expandComponents } from '../../lib/component-library'
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

// ─── FIX 2: Strip in-app BottomNav from tree (Snack tab switcher handles navigation) ───

const NAV_TYPES = new Set(['BottomNav', 'BottomNavigation', 'TabBar', 'BottomTab', 'NavigationBar'])

function stripBottomNav(node: ComponentNode): ComponentNode {
  if (!node) return node
  if (!node.children) return node

  // Remove direct children that are nav components
  const filtered = node.children.filter(child => {
    if (typeof child === 'string') return true
    if (NAV_TYPES.has(child.type)) return false
    // Also detect expanded BottomNav: a View at the bottom with flexDirection:'row' + 3-5 short text children
    if (child.type === 'View' && child.style) {
      const s = child.style as Record<string, unknown>
      if (s.flexDirection === 'row' && (s.position === 'absolute' || s.borderTopWidth)) {
        const textKids = (child.children || []).filter(c =>
          typeof c !== 'string' && (c.type === 'TouchableOpacity' || c.type === 'View')
        )
        if (textKids.length >= 3 && textKids.length <= 6) {
          // Check if it looks like a nav bar (short labels + icons)
          const hasShortLabels = textKids.every(c => {
            if (typeof c === 'string') return false
            const texts = (c.children || []).filter(gc => typeof gc === 'string' || (typeof gc !== 'string' && gc.type === 'Text'))
            return texts.length <= 2
          })
          if (hasShortLabels) return false
        }
      }
    }
    return true
  })

  return {
    ...node,
    children: filtered.map(c => typeof c === 'string' ? c : stripBottomNav(c)),
  }
}

// ─── FIX 3: Smart tab detection ───

const DETAIL_KEYWORDS = ['detail', 'details', 'checkout', 'payment', 'settings', 'edit', 'chat detail', 'post detail', 'workout detail', 'product detail', 'order detail']

function isDetailScreen(name: string): boolean {
  const lower = name.toLowerCase()
  return DETAIL_KEYWORDS.some(kw => lower.includes(kw))
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
  // Single word preferred for tab labels
  return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()
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

  // FIX 3: Separate tab screens from detail screens
  const tabIndices: number[] = []
  const detailIndices: number[] = []
  for (let i = 0; i < screens.length; i++) {
    if (isDetailScreen(screens[i].name)) {
      detailIndices.push(i)
    } else {
      tabIndices.push(i)
    }
  }
  // Cap tab screens at 5
  const finalTabIndices = tabIndices.slice(0, 5)
  // Detail screens that got bumped from tabs
  const extraDetailIndices = [...tabIndices.slice(5), ...detailIndices]

  // Build navigation targets from connections
  const connectionMap = new Map<string, string>()
  if (connections) {
    for (const conn of connections) {
      const fromIdx = screens.findIndex(s => s.id === conn.fromScreenId)
      const toIdx = screens.findIndex(s => s.id === conn.toScreenId)
      if (fromIdx >= 0 && toIdx >= 0) {
        connectionMap.set(names[fromIdx], names[toIdx])
      }
    }
  }

  // Generate files for ALL screens
  const files: Record<string, { type: string; contents: string }> = {}
  imageCounter = 0

  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i]
    const name = names[i]
    let navTargets: Map<string, string> | undefined
    if (connectionMap.has(name)) {
      navTargets = new Map([[name, connectionMap.get(name)!]])
    }
    // 1. Expand macro components
    let tree = expandComponents(screen.tree) as ComponentNode
    // 2. Replace image sources with picsum.photos
    tree = replaceImageSources(tree)
    // 3. Strip in-app BottomNav (Snack tab switcher handles navigation)
    tree = stripBottomNav(tree)
    const tsx = convertTreeToTSX(tree, name, { navigationTargets: navTargets })
    files[`screens/${name}.tsx`] = { type: 'CODE', contents: tsx }
  }

  // App.tsx — only tab screens get bottom tabs; detail screens are included but not tabbed
  const allIndices = [...finalTabIndices, ...extraDetailIndices]
  const imports = allIndices.map(i => `import ${names[i]}Screen from './screens/${names[i]}';`).join('\n')

  // Tab screens array + labels (only main screens)
  const tabScreenArray = finalTabIndices.map(i => `${names[i]}Screen`).join(', ')
  const tabLabels = finalTabIndices.map(i => `'${toShortLabel(screens[i].name)}'`).join(', ')

  // All screens array (tabs first, then details) for index-based access
  const allScreenArray = allIndices.map(i => `${names[i]}Screen`).join(', ')
  const allLabelsArray = allIndices.map(i => `'${toShortLabel(screens[i].name)}'`).join(', ')

  const hasDetailScreens = extraDetailIndices.length > 0
  const tabCount = finalTabIndices.length

  const appCode = `import React, { useState } from 'react';
import { View, TouchableOpacity, Text, SafeAreaView, StatusBar, ScrollView } from 'react-native';
${imports}

const tabScreens = [${tabScreenArray}];
const tabLabels = [${tabLabels}];
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
        <SafeAreaView style={{ backgroundColor: '#111' }}>
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: '#222', backgroundColor: '#111' }}>
            {tabLabels.map((label, i) => (
              <TouchableOpacity key={i} onPress={() => setActive(i)} style={{ flex: 1, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: active === i ? '#2563EB' : '#666', fontSize: 11, fontWeight: active === i ? '600' : '400' }}>{label}</Text>
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
  }

  return {
    name: projectName || 'Mokkoi App',
    files,
    dependencies,
  }
}
