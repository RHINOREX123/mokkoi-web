// Converts multiple Mokkoi screen trees into a single .tsx file with named exports.

interface ComponentNode {
  type: string
  props?: Record<string, unknown>
  style?: Record<string, unknown>
  children?: (ComponentNode | string)[]
}

interface FlowScreen {
  id: string
  name: string
  tree: ComponentNode
}

import { convertTreeToTSX } from './export-tsx.js'

/**
 * Converts a multi-screen flow into a single .tsx file with named exports
 * and per-screen StyleSheets.
 */
export function convertFlowToTSX(screens: FlowScreen[]): string {
  if (screens.length === 0) return '// No screens to export\n'
  if (screens.length === 1) {
    return convertTreeToTSX(screens[0].tree, screens[0].name)
  }

  // For multi-screen, we generate each individually then combine.
  // We need to collect all RN component imports across all screens.
  const allImports = new Set<string>(['StyleSheet'])
  const componentBlocks: string[] = []
  const styleBlocks: string[] = []

  const RN_COMPONENTS = [
    'View', 'Text', 'ScrollView', 'Image', 'TouchableOpacity',
    'TextInput', 'Switch', 'SafeAreaView', 'StatusBar',
  ]

  for (const screen of screens) {
    // Generate each screen's TSX, then extract the parts
    const fullTSX = convertTreeToTSX(screen.tree, screen.name)

    // Extract which RN components are imported
    const importMatch = fullTSX.match(/import \{ (.+?) \} from 'react-native'/)
    if (importMatch) {
      for (const comp of importMatch[1].split(', ')) {
        if (comp !== 'StyleSheet') allImports.add(comp.trim())
      }
    }

    // Extract the component function (change from default to named export)
    const funcMatch = fullTSX.match(/export default function (\w+)\(\) \{[\s\S]*?\n\}/)
    if (funcMatch) {
      const namedFunc = funcMatch[0].replace('export default function', 'export function')
      // Replace styles. references with screen-specific style var
      const screenStyleVar = screen.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + 'Styles'
      const updatedFunc = namedFunc.replace(/styles\./g, `${screenStyleVar}.`)
      componentBlocks.push(updatedFunc)
    }

    // Extract the StyleSheet.create block and rename
    const styleMatch = fullTSX.match(/const styles = StyleSheet\.create\(\{[\s\S]*?\}\);/)
    if (styleMatch) {
      const screenStyleVar = screen.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + 'Styles'
      const renamedStyle = styleMatch[0].replace('const styles =', `const ${screenStyleVar} =`)
      styleBlocks.push(renamedStyle)
    }
  }

  // Always include StyleSheet
  allImports.add('StyleSheet')

  const sortedImports = RN_COMPONENTS.filter(c => allImports.has(c))
  sortedImports.push('StyleSheet')

  const importLine = `import { ${[...new Set(sortedImports)].join(', ')} } from 'react-native';`

  return `import React from 'react';
${importLine}

${componentBlocks.join('\n\n')}

// --- Styles ---

${styleBlocks.join('\n\n')}
`
}
