// Client-side JSON-to-TSX converter for Mokkoi component trees.
// Produces copy-pasteable React Native .tsx with StyleSheet.create().

import type { ComponentNode } from '../types/mokkoi'
import { toIoniconsName } from './iconMap'

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_').slice(0, 25)
}

function textPreview(children: (ComponentNode | string)[] | undefined): string {
  if (!children) return ''
  for (const c of children) {
    if (typeof c === 'string' && c.trim()) return sanitize(c).toLowerCase()
  }
  return ''
}

function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

interface StyleEntry { name: string; value: Record<string, unknown> }
interface Ctx {
  styles: StyleEntry[]
  usedComponents: Set<string>
  usesIonicons: boolean
  nameCount: Map<string, number>
}

function uniq(ctx: Ctx, base: string): string {
  const camel = toCamelCase(base)
  const n = ctx.nameCount.get(camel) || 0
  ctx.nameCount.set(camel, n + 1)
  return n === 0 ? camel : `${camel}${n + 1}`
}

function styleName(node: ComponentNode, depth: number, idx: number, ctx: Ctx): string {
  if (depth === 0) return uniq(ctx, 'container')
  switch (node.type) {
    case 'Text': { const p = textPreview(node.children); return uniq(ctx, p ? `text_${p.slice(0, 20)}` : `text_${idx}`) }
    case 'TextInput': return uniq(ctx, node.props?.placeholder ? `input_${sanitize(String(node.props.placeholder)).toLowerCase().slice(0, 15)}` : `input_${idx}`)
    case 'TouchableOpacity': { const l = textPreview(node.children); return uniq(ctx, l ? `button_${l.slice(0, 15)}` : `button_${idx}`) }
    case 'Image': return uniq(ctx, `image_${idx}`)
    case 'ScrollView': return uniq(ctx, 'scrollView')
    case 'Switch': return uniq(ctx, `switch_${idx}`)
    case 'SafeAreaView': return uniq(ctx, 'safeArea')
    case 'StatusBar': return uniq(ctx, 'statusBar')
    default: return uniq(ctx, `section_${idx}`)
  }
}

function fmtVal(_key: string, v: unknown): string {
  if (typeof v === 'string') return `'${v.replace(/'/g, "\\'")}'`
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object' && v !== null) {
    return `{ ${Object.entries(v as Record<string, unknown>).map(([k, val]) => `${k}: ${fmtVal(k, val)}`).join(', ')} }`
  }
  return String(v)
}

const RN_SET = new Set(['View', 'Text', 'ScrollView', 'Image', 'TouchableOpacity', 'TextInput', 'Switch', 'SafeAreaView', 'StatusBar'])


export interface TSXExportOpts {
  /** Map of ComponentNode → target screen PascalCase name for navigation.navigate() */
  bindings?: Map<ComponentNode, string>
  /**
   * When true, wraps the screen JSX with a `<View style={{flex:1}}>...<Watermark /></View>`
   * and appends a self-contained Watermark component + styles. Used for free-tier
   * exports to embed "Made with Mokkoi" attribution that persists in the exported
   * file. Mirrors the server-side path in api/export.ts.
   */
  addWatermark?: boolean
}

/**
 * Watermark function + styles appended to free-tier exports. Persists in the
 * exported code — user cannot remove without editing the file.
 *
 * Self-contained: uses only React Native primitives (View, Text,
 * TouchableOpacity, Linking) — no extra packages, works in any Expo SDK.
 * Tapping the pill opens https://mokkoi.com.
 */
function watermarkSuffix(): string {
  return `
function Watermark() {
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL('https://mokkoi.com')}
      activeOpacity={0.8}
      style={watermarkStyles.badge}
    >
      <View style={watermarkStyles.iconBox}>
        <Text style={watermarkStyles.iconLetter}>M</Text>
      </View>
      <Text style={watermarkStyles.text}>
        Made with <Text style={watermarkStyles.brand}>Mokkoi</Text>
      </Text>
    </TouchableOpacity>
  );
}

const watermarkStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 17, 19, 0.85)',
    borderColor: 'rgba(45, 212, 191, 0.4)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 9999,
  },
  iconBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#2dd4bf',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  iconLetter: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  text: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  brand: {
    color: '#5eead4',
    fontSize: 13,
    fontWeight: '700',
  },
});
`
}

export function convertTreeToTSX(tree: ComponentNode, screenName?: string, opts?: TSXExportOpts): string {
  const name = screenName ? screenName.replace(/[^a-zA-Z0-9]/g, '') + 'Screen' : 'GeneratedScreen'
  const compName = name.charAt(0).toUpperCase() + name.slice(1)
  const addWatermark = opts?.addWatermark === true

  const ctx: Ctx = { styles: [], usedComponents: new Set(), usesIonicons: false, nameCount: new Map() }
  const navTargets = opts?.bindings
  const usesNavigation = { value: false }
  const innerIndent = addWatermark ? '      ' : '    '
  const jsx = nodeJSXWithNav(tree, 0, 0, ctx, innerIndent, navTargets, usesNavigation)

  const rnOrder = ['View', 'Text', 'ScrollView', 'Image', 'TouchableOpacity', 'TextInput', 'Switch', 'SafeAreaView', 'StatusBar', 'Linking', 'StyleSheet']
  ctx.usedComponents.add('StyleSheet')
  if (addWatermark) {
    ctx.usedComponents.add('View')
    ctx.usedComponents.add('Text')
    ctx.usedComponents.add('TouchableOpacity')
    ctx.usedComponents.add('Linking')
  }
  const imports = rnOrder.filter(c => ctx.usedComponents.has(c))

  const navImport = usesNavigation.value ? "\nimport { useNavigation } from '@react-navigation/native';" : ''
  const navHook = usesNavigation.value ? '\n  const navigation = useNavigation();\n' : ''

  // Emit `import { Ionicons } from '@expo/vector-icons';` when any Icon was used.
  // @expo/vector-icons is pre-bundled in every Expo Snack SDK — no peer-dep
  // resolution, no version conflicts with react-native-svg. Single import
  // regardless of how many distinct icons appear in the tree.
  const iconsImport = ctx.usesIonicons
    ? `\nimport { Ionicons } from '@expo/vector-icons';`
    : ''

  const styleLines = ctx.styles.map(({ name: n, value }) => {
    const entries = Object.entries(value).map(([k, v]) => `    ${k}: ${fmtVal(k, v)},`).join('\n')
    return `  ${n}: {\n${entries}\n  },`
  }).join('\n')

  const body = addWatermark
    ? `    <View style={{ flex: 1 }}>\n${jsx}\n      <Watermark />\n    </View>`
    : jsx

  const baseFile = `import React from 'react';
import { ${imports.join(', ')} } from 'react-native';${navImport}${iconsImport}

export default function ${compName}() {${navHook}
  return (
${body}
  );
}

const styles = StyleSheet.create({
${styleLines}
});
`

  return addWatermark ? baseFile + watermarkSuffix() : baseFile
}

/** Extended nodeJSX that can inject navigation.navigate() on TouchableOpacity */
function nodeJSXWithNav(
  node: ComponentNode | string, depth: number, idx: number, ctx: Ctx, indent: string,
  navTargets: Map<ComponentNode, string> | undefined,
  usesNavigation: { value: boolean },
): string {
  if (typeof node === 'string') {
    const trimmed = node.trim()
    // Filter AI junk strings: _HORIZONTAL, TRUE, VERTICAL, etc.
    if (!trimmed || /^[_A-Z][_A-Z0-9]+$|^(true|false|null|undefined|horizontal|vertical)$/i.test(trimmed)) return ''
    return `${indent}${trimmed.replace(/[{}]/g, c => c === '{' ? '&#123;' : '&#125;')}`
  }
  if (!node || typeof node !== 'object') return ''

  // --- Icon: emit an @expo/vector-icons Ionicons component, never silently
  //     fall back to View. Ionicons is pre-bundled in Expo Snack, so no
  //     runtime crash like we saw with lucide-react-native + react-native-svg
  //     version mismatches ("Cannot read property 'ReactCurrentOwner' of
  //     undefined"). Unknown icon names map to 'ellipse' (a plain circle).
  if (node.type === 'Icon') {
    const rawName = (node.props?.name as string) ?? 'ellipse'
    const iconSize = (node.props?.size as number) ?? 24
    const iconColor = (node.props?.color as string) ?? '#FFFFFF'
    const ioniconName = toIoniconsName(rawName)
    ctx.usesIonicons = true
    const colorAttr = ` color="${iconColor.replace(/"/g, '\\"')}"`
    const sizeAttr = ` size={${iconSize}}`
    return `${indent}<Ionicons name="${ioniconName}"${sizeAttr}${colorAttr} />`
  }

  let type = node.type
  if (type === 'FlatList') type = 'ScrollView'
  if (!RN_SET.has(type)) type = 'View'
  ctx.usedComponents.add(type)

  let sName: string | null = null
  if (node.style && Object.keys(node.style).length > 0) {
    sName = styleName(node, depth, idx, ctx)
    ctx.styles.push({ name: sName, value: node.style })
  }

  const props: string[] = []
  if (sName) props.push(`style={styles.${sName}}`)

  // Check if this TouchableOpacity should navigate (node-identity lookup)
  if (type === 'TouchableOpacity' && navTargets) {
    const target = navTargets.get(node)
    if (target) {
      props.push(`onPress={() => navigation.navigate('${target}')}`)
      usesNavigation.value = true
    }
  }

  if (node.props) {
    const p = node.props
    if (type === 'TextInput') {
      if (p.placeholder) props.push(`placeholder="${p.placeholder}"`)
      if (p.placeholderTextColor) props.push(`placeholderTextColor="${p.placeholderTextColor}"`)
      if (p.secureTextEntry) props.push('secureTextEntry')
      if (p.keyboardType) props.push(`keyboardType="${p.keyboardType}"`)
    }
    if (type === 'Image' && p.source) {
      const src = p.source as Record<string, string>
      if (src.uri) props.push(`source={{ uri: '${src.uri}' }}`)
    }
    if (type === 'Switch') {
      props.push(`value={${p.value ?? false}}`)
      if (p.trackColor) {
        const tc = p.trackColor as Record<string, string>
        props.push(`trackColor={{ true: '${tc.true || '#34D399'}', false: '${tc.false || '#3F3F46'}' }}`)
      }
      if (p.thumbColor) props.push(`thumbColor="${p.thumbColor}"`)
    }
    if (type === 'ScrollView') {
      if (p.horizontal) props.push('horizontal')
      if (p.showsVerticalScrollIndicator === false) props.push('showsVerticalScrollIndicator={false}')
    }
    if (type === 'Text' && p.numberOfLines) props.push(`numberOfLines={${p.numberOfLines}}`)
  }

  const propsStr = props.length > 0 ? ' ' + props.join(' ') : ''
  const children = (node.children ?? []).filter(c => typeof c === 'string' ? c.trim().length > 0 : c != null)
  if (children.length === 0) return `${indent}<${type}${propsStr} />`

  if (type === 'Text' && children.every(c => typeof c === 'string')) {
    return `${indent}<${type}${propsStr}>${children.join('').trim()}</${type}>`
  }

  const ci = indent + '  '
  const cJSX = children.map((c, i) => nodeJSXWithNav(c, depth + 1, i, ctx, ci, navTargets, usesNavigation)).filter(Boolean).join('\n')
  return `${indent}<${type}${propsStr}>\n${cJSX}\n${indent}</${type}>`
}


