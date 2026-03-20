// Converts a Mokkoi component tree JSON into a copy-pasteable React Native .tsx file.

interface ComponentNode {
  type: string
  props?: Record<string, unknown>
  style?: Record<string, unknown>
  children?: (ComponentNode | string)[]
}

const RN_COMPONENTS = new Set([
  'View', 'Text', 'ScrollView', 'Image', 'TouchableOpacity',
  'TextInput', 'Switch', 'SafeAreaView', 'StatusBar',
])

// Style name generation helpers
function sanitize(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 25)
}

function textPreview(children: (ComponentNode | string)[] | undefined): string {
  if (!children) return ''
  for (const c of children) {
    if (typeof c === 'string' && c.trim()) {
      return sanitize(c).toLowerCase().replace(/_/g, '_')
    }
  }
  return ''
}

function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

interface StyleEntry {
  name: string
  value: Record<string, unknown>
}

interface ConvertContext {
  styles: StyleEntry[]
  usedComponents: Set<string>
  styleNameCounts: Map<string, number>
}

function uniqueStyleName(ctx: ConvertContext, base: string): string {
  const camel = toCamelCase(base)
  const count = ctx.styleNameCounts.get(camel) || 0
  ctx.styleNameCounts.set(camel, count + 1)
  return count === 0 ? camel : `${camel}${count + 1}`
}

function generateStyleName(
  node: ComponentNode,
  depth: number,
  index: number,
  ctx: ConvertContext
): string {
  if (depth === 0) return uniqueStyleName(ctx, 'container')

  const type = node.type
  switch (type) {
    case 'Text': {
      const preview = textPreview(node.children)
      if (preview) {
        const short = preview.slice(0, 20)
        return uniqueStyleName(ctx, `text_${short}`)
      }
      return uniqueStyleName(ctx, `text_${index}`)
    }
    case 'TextInput':
      return uniqueStyleName(ctx, node.props?.placeholder
        ? `input_${sanitize(String(node.props.placeholder)).toLowerCase().slice(0, 15)}`
        : `input_${index}`)
    case 'TouchableOpacity': {
      const label = textPreview(node.children)
      return uniqueStyleName(ctx, label
        ? `button_${label.slice(0, 15)}`
        : `button_${index}`)
    }
    case 'Image':
      return uniqueStyleName(ctx, `image_${index}`)
    case 'ScrollView':
      return uniqueStyleName(ctx, `scrollView`)
    case 'Switch':
      return uniqueStyleName(ctx, `switch_${index}`)
    case 'SafeAreaView':
      return uniqueStyleName(ctx, `safeArea`)
    case 'StatusBar':
      return uniqueStyleName(ctx, `statusBar`)
    case 'View':
    default:
      return uniqueStyleName(ctx, `section_${index}`)
  }
}

function formatStyleValue(key: string, value: unknown): string {
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${formatStyleValue(k, v)}`)
      .join(', ')
    return `{ ${entries} }`
  }
  return String(value)
}

function nodeToJSX(
  node: ComponentNode | string,
  depth: number,
  index: number,
  ctx: ConvertContext,
  indent: string,
): string {
  if (typeof node === 'string') {
    return node.trim() ? `${indent}${escapeJSX(node)}` : ''
  }

  if (!node || typeof node !== 'object') return ''

  let rnType = node.type
  // Map unsupported types
  if (rnType === 'FlatList') rnType = 'ScrollView'
  if (!RN_COMPONENTS.has(rnType) && rnType !== 'FlatList') {
    rnType = 'View'
  }

  ctx.usedComponents.add(rnType)

  // Collect style
  let styleName: string | null = null
  if (node.style && Object.keys(node.style).length > 0) {
    styleName = generateStyleName(node, depth, index, ctx)
    ctx.styles.push({ name: styleName, value: node.style })
  }

  // Build props string
  const propsArr: string[] = []
  if (styleName) propsArr.push(`style={styles.${styleName}}`)

  // Component-specific props
  if (node.props) {
    const p = node.props
    if (rnType === 'TextInput') {
      if (p.placeholder) propsArr.push(`placeholder="${p.placeholder}"`)
      if (p.placeholderTextColor) propsArr.push(`placeholderTextColor="${p.placeholderTextColor}"`)
      if (p.secureTextEntry) propsArr.push('secureTextEntry')
      if (p.keyboardType) propsArr.push(`keyboardType="${p.keyboardType}"`)
    }
    if (rnType === 'Image' && p.source) {
      const src = p.source as Record<string, string>
      if (src.uri) propsArr.push(`source={{ uri: '${src.uri}' }}`)
    }
    if (rnType === 'Switch') {
      propsArr.push(`value={${p.value ?? false}}`)
      if (p.trackColor) {
        const tc = p.trackColor as Record<string, string>
        propsArr.push(`trackColor={{ true: '${tc.true || '#34D399'}', false: '${tc.false || '#3F3F46'}' }}`)
      }
      if (p.thumbColor) propsArr.push(`thumbColor="${p.thumbColor}"`)
    }
    if (rnType === 'ScrollView') {
      if (p.horizontal) propsArr.push('horizontal')
      if (p.showsVerticalScrollIndicator === false) propsArr.push('showsVerticalScrollIndicator={false}')
    }
    if (rnType === 'StatusBar') {
      propsArr.push('barStyle="light-content"')
    }
    if (rnType === 'Text' && p.numberOfLines) {
      propsArr.push(`numberOfLines={${p.numberOfLines}}`)
    }
  }

  const propsStr = propsArr.length > 0 ? ' ' + propsArr.join(' ') : ''

  // Process children
  const children = node.children?.filter(c => {
    if (typeof c === 'string') return c.trim().length > 0
    return c != null
  }) ?? []

  if (children.length === 0) {
    return `${indent}<${rnType}${propsStr} />`
  }

  // Text nodes: inline string children
  if (rnType === 'Text') {
    const textChildren = children.filter(c => typeof c === 'string')
    const elementChildren = children.filter(c => typeof c !== 'string')

    if (elementChildren.length === 0) {
      const text = textChildren.join('').trim()
      return `${indent}<${rnType}${propsStr}>${escapeJSX(text)}</${rnType}>`
    }
  }

  const childIndent = indent + '  '
  const childJSX = children
    .map((child, i) => nodeToJSX(child, depth + 1, i, ctx, childIndent))
    .filter(Boolean)
    .join('\n')

  return `${indent}<${rnType}${propsStr}>\n${childJSX}\n${indent}</${rnType}>`
}

function escapeJSX(text: string): string {
  return text.replace(/[{}<>]/g, c => {
    switch (c) {
      case '{': return '&#123;'
      case '}': return '&#125;'
      default: return c
    }
  })
}

function formatStyleSheet(styles: StyleEntry[]): string {
  const lines: string[] = []
  for (const { name, value } of styles) {
    const entries = Object.entries(value)
      .map(([k, v]) => `    ${k}: ${formatStyleValue(k, v)},`)
      .join('\n')
    lines.push(`  ${name}: {\n${entries}\n  },`)
  }
  return lines.join('\n')
}

export function convertTreeToTSX(tree: ComponentNode, screenName?: string): string {
  const name = screenName
    ? screenName.replace(/[^a-zA-Z0-9]/g, '') + 'Screen'
    : 'GeneratedScreen'

  // Ensure valid component name (starts with uppercase)
  const componentName = name.charAt(0).toUpperCase() + name.slice(1)

  const ctx: ConvertContext = {
    styles: [],
    usedComponents: new Set(),
    styleNameCounts: new Map(),
  }

  const jsx = nodeToJSX(tree, 0, 0, ctx, '    ')

  // Always need StyleSheet
  ctx.usedComponents.add('StyleSheet')
  // StatusBar special — imported from react-native
  const hasStatusBar = ctx.usedComponents.has('StatusBar')

  // Build import list (only actually used components)
  const rnImports = [
    'View', 'Text', 'ScrollView', 'Image', 'TouchableOpacity',
    'TextInput', 'Switch', 'SafeAreaView', 'StatusBar', 'StyleSheet',
  ].filter(c => ctx.usedComponents.has(c))

  const importLine = `import { ${rnImports.join(', ')} } from 'react-native';`

  const styleSheetContent = formatStyleSheet(ctx.styles)

  return `import React from 'react';
${importLine}

export default function ${componentName}() {
  return (
${jsx}
  );
}

const styles = StyleSheet.create({
${styleSheetContent}
});
`
}

// Named export variant for flow usage
export function convertTreeToNamedTSX(
  tree: ComponentNode,
  screenName: string,
  stylesVarName: string,
): { component: string; styles: string } {
  const componentName = (screenName.replace(/[^a-zA-Z0-9]/g, '') || 'Screen')
  const name = componentName.charAt(0).toUpperCase() + componentName.slice(1) + 'Screen'

  const ctx: ConvertContext = {
    styles: [],
    usedComponents: new Set(),
    styleNameCounts: new Map(),
  }

  const jsx = nodeToJSX(tree, 0, 0, ctx, '    ')

  const styleSheetContent = formatStyleSheet(ctx.styles)

  const componentCode = `export function ${name}() {
  return (
${jsx}
  );
}`

  const stylesCode = `const ${stylesVarName} = StyleSheet.create({
${styleSheetContent}
});`

  // Collect used components for the caller
  for (const c of ctx.usedComponents) {
    // Store on the set for external access — caller handles imports
  }

  return { component: componentCode, styles: stylesCode }
}
