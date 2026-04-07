// Expo Snack file builder.
// Constructs the files object and dependencies needed for an Expo Snack.
// Uses a simple state-based tab switcher instead of React Navigation
// to avoid native module crashes in the Snack runtime.

import { convertTreeToTSX } from './exportTsx'
import type { ComponentNode } from '../types/mokkoi'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import type { FlowConnection } from '../components/FlowConnectors'

/** Sanitize screen name to valid PascalCase JS identifier */
function toPascalCase(name: string): string {
  let result = name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
    .slice(0, 30)

  // JS identifiers can't start with a number
  if (!result || /^\d/.test(result)) {
    result = 'Screen' + (result || '')
  }
  return result
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

  // App.tsx — simple state-based tab switcher (no React Navigation needed in Snack)
  // React Navigation has native module deps that crash in Expo Snack.
  const imports = names.map(n => `import ${n}Screen from './screens/${n}';`).join('\n')
  const screenArray = names.map(n => `${n}Screen`).join(', ')
  const labelArray = names.map(n => `'${n}'`).join(', ')

  const appCode = `import React, { useState } from 'react';
import { View, TouchableOpacity, Text, SafeAreaView, StatusBar } from 'react-native';
${imports}

const screens = [${screenArray}];
const labels = [${labelArray}];

export default function App() {
  const [active, setActive] = useState(0);
  const ActiveScreen = screens[active];
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A1A' }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>
        <ActiveScreen />
      </View>
      {screens.length > 1 && (
        <SafeAreaView style={{ backgroundColor: '#111' }}>
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: '#222', backgroundColor: '#111' }}>
            {labels.map((label, i) => (
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

  // Minimal dependencies — no React Navigation needed for Snack preview
  const dependencies: Record<string, { version: string }> = {
    'expo-status-bar': { version: '~1.11.1' },
  }

  return {
    name: projectName || 'Mokkoi App',
    files,
    dependencies,
  }
}
