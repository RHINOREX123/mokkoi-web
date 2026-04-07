// Expo Snack file builder.
// Constructs the files object and dependencies needed for an Expo Snack.
// The actual save is done server-side via /api/export?mode=save-snack.

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

/**
 * Build the files object and dependencies for an Expo Snack.
 * This is sent to /api/export with mode: "save-snack" to get a snack ID back.
 */
export function buildSnackPayload(opts: SnackFilesOpts): SnackPayload {
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
  const dependencies: Record<string, { version: string }> = {
    '@react-navigation/native': { version: '6.x' },
    '@react-navigation/native-stack': { version: '6.x' },
    'react-native-screens': { version: '*' },
    'react-native-safe-area-context': { version: '*' },
    'expo-status-bar': { version: '*' },
  }
  if (tabGroup) {
    dependencies['@react-navigation/bottom-tabs'] = { version: '6.x' }
  }

  return {
    name: projectName || 'Mokkoi App',
    files,
    dependencies,
  }
}
