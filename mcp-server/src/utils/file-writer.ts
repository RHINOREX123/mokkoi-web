/**
 * Converts Mokkoi component tree JSON to production-ready React Native .tsx files.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { ComponentNode } from './api-client.js';

/** All React Native imports we might need */
const RN_COMPONENTS = new Set([
  'View', 'Text', 'TextInput', 'TouchableOpacity', 'ScrollView',
  'Image', 'FlatList', 'SectionList', 'ActivityIndicator',
  'Switch', 'Modal', 'Pressable', 'StatusBar', 'ImageBackground',
  'KeyboardAvoidingView',
]);

const SAFE_AREA_TYPE = 'SafeAreaView';

/**
 * Recursively collect all component type names used in a tree.
 */
function collectTypes(node: ComponentNode | string, types: Set<string>): void {
  if (typeof node === 'string') return;
  types.add(node.type);
  if (node.children) {
    for (const child of node.children) {
      collectTypes(child, types);
    }
  }
}

/**
 * Extract all unique style objects from the tree and assign them names.
 */
function extractStyles(
  node: ComponentNode | string,
  styles: Map<string, Record<string, unknown>>,
  counter: { n: number }
): string | undefined {
  if (typeof node === 'string') return undefined;

  let styleName: string | undefined;
  if (node.style && Object.keys(node.style).length > 0) {
    // Check if this exact style already exists
    const styleJson = JSON.stringify(node.style);
    for (const [name, existing] of styles) {
      if (JSON.stringify(existing) === styleJson) {
        styleName = name;
        break;
      }
    }
    if (!styleName) {
      const typeLower = node.type.charAt(0).toLowerCase() + node.type.slice(1);
      styleName = `${typeLower}${counter.n++}`;
      styles.set(styleName, node.style);
    }
  }

  if (node.children) {
    for (const child of node.children) {
      extractStyles(child, styles, counter);
    }
  }

  return styleName;
}

/**
 * Render a component node to JSX string.
 */
function renderNode(
  node: ComponentNode | string,
  styles: Map<string, Record<string, unknown>>,
  counter: { n: number },
  indent: number
): string {
  if (typeof node === 'string') {
    return `${'  '.repeat(indent)}{${JSON.stringify(node)}}`;
  }

  const pad = '  '.repeat(indent);
  const tag = node.type;

  // Build props string
  const propParts: string[] = [];

  // Style prop
  if (node.style && Object.keys(node.style).length > 0) {
    const styleJson = JSON.stringify(node.style);
    let styleName: string | undefined;
    for (const [name, existing] of styles) {
      if (JSON.stringify(existing) === styleJson) {
        styleName = name;
        break;
      }
    }
    if (!styleName) {
      const typeLower = tag.charAt(0).toLowerCase() + tag.slice(1);
      styleName = `${typeLower}${counter.n++}`;
      styles.set(styleName, node.style);
    }
    propParts.push(`style={styles.${styleName}}`);
  }

  // Other props
  if (node.props) {
    for (const [key, value] of Object.entries(node.props)) {
      if (key === 'style') continue; // handled above
      if (typeof value === 'string') {
        propParts.push(`${key}=${JSON.stringify(value)}`);
      } else if (typeof value === 'boolean') {
        propParts.push(value ? key : `${key}={false}`);
      } else if (typeof value === 'number') {
        propParts.push(`${key}={${value}}`);
      } else {
        propParts.push(`${key}={${JSON.stringify(value)}}`);
      }
    }
  }

  const propsStr = propParts.length > 0 ? ' ' + propParts.join(' ') : '';

  // Self-closing if no children
  if (!node.children || node.children.length === 0) {
    return `${pad}<${tag}${propsStr} />`;
  }

  // Check if single text child
  if (
    node.children.length === 1 &&
    typeof node.children[0] === 'string'
  ) {
    return `${pad}<${tag}${propsStr}>{${JSON.stringify(node.children[0])}}</${tag}>`;
  }

  // Multi-child
  const childLines = node.children
    .map(child => renderNode(child, styles, counter, indent + 1))
    .join('\n');

  return `${pad}<${tag}${propsStr}>\n${childLines}\n${pad}</${tag}>`;
}

/**
 * Convert a ComponentNode tree into a complete React Native .tsx file string.
 */
export function componentTreeToTSX(
  tree: ComponentNode,
  screenName: string
): string {
  // Collect all types used
  const usedTypes = new Set<string>();
  collectTypes(tree, usedTypes);

  // Separate RN imports from SafeAreaView
  const rnImports = [...usedTypes].filter(t => RN_COMPONENTS.has(t)).sort();
  const needsSafeArea = usedTypes.has(SAFE_AREA_TYPE);

  // Always include StyleSheet
  if (!rnImports.includes('StyleSheet')) {
    rnImports.push('StyleSheet');
  }

  // Extract styles
  const styles = new Map<string, Record<string, unknown>>();
  const counter = { n: 1 };
  extractStyles(tree, styles, counter);

  // Reset counter for render pass (reuses same style names)
  const renderCounter = { n: 1 };
  const jsx = renderNode(tree, styles, renderCounter, 2);

  // Build file
  const lines: string[] = [];
  lines.push("import React from 'react';");
  lines.push(
    `import { ${rnImports.join(', ')} } from 'react-native';`
  );
  if (needsSafeArea) {
    lines.push(
      "import { SafeAreaView } from 'react-native-safe-area-context';"
    );
  }
  lines.push('');

  // Sanitize screen name for function
  const funcName = screenName.replace(/[^a-zA-Z0-9]/g, '') + 'Screen';

  lines.push(`export default function ${funcName}() {`);
  lines.push('  return (');
  lines.push(jsx);
  lines.push('  );');
  lines.push('}');
  lines.push('');

  // StyleSheet
  lines.push('const styles = StyleSheet.create({');
  for (const [name, style] of styles) {
    const styleStr = JSON.stringify(style, null, 2)
      .split('\n')
      .map((line, i) => (i === 0 ? line : '  ' + line))
      .join('\n');
    lines.push(`  ${name}: ${styleStr},`);
  }
  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate a React Navigation stack file connecting multiple screens.
 */
export function generateNavigationTSX(
  screens: Array<{ name: string; fileName: string }>
): string {
  const lines: string[] = [];
  lines.push("import React from 'react';");
  lines.push("import { NavigationContainer } from '@react-navigation/native';");
  lines.push("import { createNativeStackNavigator } from '@react-navigation/native-stack';");
  lines.push('');

  for (const screen of screens) {
    const importName = screen.name.replace(/[^a-zA-Z0-9]/g, '') + 'Screen';
    const importPath = `./${screen.fileName.replace(/\.tsx$/, '')}`;
    lines.push(`import ${importName} from '${importPath}';`);
  }

  lines.push('');
  lines.push('const Stack = createNativeStackNavigator();');
  lines.push('');
  lines.push('export default function AppNavigation() {');
  lines.push('  return (');
  lines.push('    <NavigationContainer>');
  lines.push('      <Stack.Navigator');
  lines.push('        screenOptions={{');
  lines.push('          headerShown: false,');
  lines.push("          contentStyle: { backgroundColor: '#0F172A' },");
  lines.push('        }}');
  lines.push('      >');

  for (const screen of screens) {
    const componentName = screen.name.replace(/[^a-zA-Z0-9]/g, '') + 'Screen';
    lines.push(
      `        <Stack.Screen name="${screen.name}" component={${componentName}} />`
    );
  }

  lines.push('      </Stack.Navigator>');
  lines.push('    </NavigationContainer>');
  lines.push('  );');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * Write a string to a file, creating directories as needed.
 */
export async function writeScreenFile(
  filePath: string,
  content: string
): Promise<string> {
  const absolutePath = resolve(process.cwd(), filePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, 'utf-8');
  return absolutePath;
}
