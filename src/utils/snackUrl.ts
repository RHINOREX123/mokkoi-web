// Expo Snack URL builder.
// Constructs a snack.expo.dev URL with files, dependencies, and config
// embedded as query parameters. No server-side API needed.

import { convertTreeToTSX } from './exportTsx'
import { generateMultiScreenAppTsx } from './expoScaffold'
import { detectTabGroup } from './detectTabBar'
import type { ComponentNode } from '../types/mokkoi'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import type { FlowConnection } from '../components/FlowConnectors'

/** Sanitize screen name to valid PascalCase component name */
function toPascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
    .slice(0, 30) || 'Screen'
}

/** Deduplicate screen names */
function deduplicateNames(names: string[]): string[] {
  const counts = new Map<string, number>()
  return names.map(name => {
    const count = counts.get(name) || 0
    counts.set(name, count + 1)
    return count === 0 ? name : `${name}${count + 1}`
  })
}

export interface SnackUrlOpts {
  projectName: string
  screens: GeneratedScreen[]
  connections?: FlowConnection[]
}

/**
 * Build a snack.expo.dev URL that opens the generated screens
 * as a runnable Expo app in the browser or on a phone via QR code.
 *
 * Uses URL query parameters (no API key needed):
 * - files: JSON object of file paths → {type: 'CODE', contents: string}
 * - dependencies: comma-separated package list
 * - name: project name
 * - platform: default preview platform
 * - theme: dark
 */
export function buildSnackUrl(opts: SnackUrlOpts): string {
  const { projectName, screens, connections } = opts

  if (screens.length === 0) throw new Error('No screens to preview')

  // Build screen names
  const rawNames = screens.map(s => toPascalCase(s.name))
  const names = deduplicateNames(rawNames)

  // Detect tab groups
  const tabGroup = detectTabGroup(screens.map((s, i) => ({
    name: names[i],
    tree: s.tree,
  })))

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

  // Generate files
  const files: Record<string, { type: string; contents: string }> = {}

  // Each screen file
  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i]
    const name = names[i]
    let navTargets: Map<string, string> | undefined
    if (connectionMap.has(name)) {
      navTargets = new Map([[name, connectionMap.get(name)!]])
    }
    const tsx = convertTreeToTSX(screen.tree as ComponentNode, name, { navigationTargets: navTargets })
    files[`screens/${name}.tsx`] = { type: 'CODE', contents: tsx }
  }

  // App.tsx with navigation
  const multiOpts = {
    projectName,
    screens: names.map((name, i) => ({
      name,
      prompt: screens[i].originalPrompt,
      tabLabels: tabGroup?.screenNames.includes(name) ? tabGroup.labels : undefined,
    })),
    tabGroup: tabGroup || undefined,
  }
  files['App.tsx'] = { type: 'CODE', contents: generateMultiScreenAppTsx(multiOpts) }

  // Dependencies
  const deps = [
    '@react-navigation/native',
    '@react-navigation/native-stack',
    'react-native-screens',
    'react-native-safe-area-context',
    'expo-status-bar',
  ]
  if (tabGroup) {
    deps.push('@react-navigation/bottom-tabs')
  }

  // Build URL
  const params = new URLSearchParams()
  params.set('name', projectName || 'Mokkoi App')
  params.set('description', 'Built with Mokkoi — AI Mobile App Builder')
  params.set('files', JSON.stringify(files))
  params.set('dependencies', deps.join(','))
  params.set('platform', 'ios')
  params.set('theme', 'dark')
  params.set('preview', 'true')

  return `https://snack.expo.dev?${params.toString()}`
}

/** Build a shorter embed URL for iframe display */
export function buildSnackEmbedUrl(opts: SnackUrlOpts): string {
  const base = buildSnackUrl(opts)
  return base.replace('https://snack.expo.dev?', 'https://snack.expo.dev/embedded?')
}
