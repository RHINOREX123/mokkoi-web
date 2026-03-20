// Client-side JSON-to-TSX converter for Mokkoi component trees.
// Produces copy-pasteable React Native .tsx with StyleSheet.create().

import type { ComponentNode } from '../types/mokkoi'

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

function nodeJSX(node: ComponentNode | string, depth: number, idx: number, ctx: Ctx, indent: string): string {
  if (typeof node === 'string') return node.trim() ? `${indent}${node.replace(/[{}]/g, c => c === '{' ? '&#123;' : '&#125;')}` : ''
  if (!node || typeof node !== 'object') return ''

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
  const cJSX = children.map((c, i) => nodeJSX(c, depth + 1, i, ctx, ci)).filter(Boolean).join('\n')
  return `${indent}<${type}${propsStr}>\n${cJSX}\n${indent}</${type}>`
}

export function convertTreeToTSX(tree: ComponentNode, screenName?: string): string {
  const name = screenName ? screenName.replace(/[^a-zA-Z0-9]/g, '') + 'Screen' : 'GeneratedScreen'
  const compName = name.charAt(0).toUpperCase() + name.slice(1)

  const ctx: Ctx = { styles: [], usedComponents: new Set(), nameCount: new Map() }
  const jsx = nodeJSX(tree, 0, 0, ctx, '    ')

  const rnOrder = ['View', 'Text', 'ScrollView', 'Image', 'TouchableOpacity', 'TextInput', 'Switch', 'SafeAreaView', 'StatusBar', 'StyleSheet']
  ctx.usedComponents.add('StyleSheet')
  const imports = rnOrder.filter(c => ctx.usedComponents.has(c))

  const styleLines = ctx.styles.map(({ name: n, value }) => {
    const entries = Object.entries(value).map(([k, v]) => `    ${k}: ${fmtVal(k, v)},`).join('\n')
    return `  ${n}: {\n${entries}\n  },`
  }).join('\n')

  return `import React from 'react';
import { ${imports.join(', ')} } from 'react-native';

export default function ${compName}() {
  return (
${jsx}
  );
}

const styles = StyleSheet.create({
${styleLines}
});
`
}
