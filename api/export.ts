import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, getSupabaseConfig } from './_lib/auth-helper.js'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// TSX Converter (inlined from export-tsx.ts)
// ============================================================

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

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_').slice(0, 25)
}

function textPreview(children: (ComponentNode | string)[] | undefined): string {
  if (!children) return ''
  for (const c of children) {
    if (typeof c === 'string' && c.trim()) return sanitize(c).toLowerCase().replace(/_/g, '_')
  }
  return ''
}

function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

interface StyleEntry { name: string; value: Record<string, unknown> }

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

function generateStyleName(node: ComponentNode, depth: number, index: number, ctx: ConvertContext): string {
  if (depth === 0) return uniqueStyleName(ctx, 'container')
  switch (node.type) {
    case 'Text': {
      const preview = textPreview(node.children)
      return uniqueStyleName(ctx, preview ? `text_${preview.slice(0, 20)}` : `text_${index}`)
    }
    case 'TextInput':
      return uniqueStyleName(ctx, node.props?.placeholder
        ? `input_${sanitize(String(node.props.placeholder)).toLowerCase().slice(0, 15)}`
        : `input_${index}`)
    case 'TouchableOpacity': {
      const label = textPreview(node.children)
      return uniqueStyleName(ctx, label ? `button_${label.slice(0, 15)}` : `button_${index}`)
    }
    case 'Image': return uniqueStyleName(ctx, `image_${index}`)
    case 'ScrollView': return uniqueStyleName(ctx, `scrollView`)
    case 'Switch': return uniqueStyleName(ctx, `switch_${index}`)
    case 'SafeAreaView': return uniqueStyleName(ctx, `safeArea`)
    case 'StatusBar': return uniqueStyleName(ctx, `statusBar`)
    default: return uniqueStyleName(ctx, `section_${index}`)
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

function escapeJSX(text: string): string {
  return text.replace(/[{}]/g, c => c === '{' ? '&#123;' : '&#125;')
}

function nodeToJSX(node: ComponentNode | string, depth: number, index: number, ctx: ConvertContext, indent: string): string {
  if (typeof node === 'string') return node.trim() ? `${indent}${escapeJSX(node)}` : ''
  if (!node || typeof node !== 'object') return ''

  let rnType = node.type
  if (rnType === 'FlatList') rnType = 'ScrollView'
  if (!RN_COMPONENTS.has(rnType) && rnType !== 'FlatList') rnType = 'View'
  ctx.usedComponents.add(rnType)

  let styleName: string | null = null
  if (node.style && Object.keys(node.style).length > 0) {
    styleName = generateStyleName(node, depth, index, ctx)
    ctx.styles.push({ name: styleName, value: node.style })
  }

  const propsArr: string[] = []
  if (styleName) propsArr.push(`style={styles.${styleName}}`)

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
    if (rnType === 'StatusBar') propsArr.push('barStyle="light-content"')
    if (rnType === 'Text' && p.numberOfLines) propsArr.push(`numberOfLines={${p.numberOfLines}}`)
  }

  const propsStr = propsArr.length > 0 ? ' ' + propsArr.join(' ') : ''

  const children = node.children?.filter(c => typeof c === 'string' ? c.trim().length > 0 : c != null) ?? []

  if (children.length === 0) return `${indent}<${rnType}${propsStr} />`

  if (rnType === 'Text') {
    const textChildren = children.filter(c => typeof c === 'string')
    const elementChildren = children.filter(c => typeof c !== 'string')
    if (elementChildren.length === 0) {
      return `${indent}<${rnType}${propsStr}>${escapeJSX(textChildren.join('').trim())}</${rnType}>`
    }
  }

  const childIndent = indent + '  '
  const childJSX = children.map((child, i) => nodeToJSX(child, depth + 1, i, ctx, childIndent)).filter(Boolean).join('\n')
  return `${indent}<${rnType}${propsStr}>\n${childJSX}\n${indent}</${rnType}>`
}

function formatStyleSheet(styles: StyleEntry[]): string {
  return styles.map(({ name, value }) => {
    const entries = Object.entries(value).map(([k, v]) => `    ${k}: ${formatStyleValue(k, v)},`).join('\n')
    return `  ${name}: {\n${entries}\n  },`
  }).join('\n')
}

function convertTreeToTSX(tree: ComponentNode, screenName?: string, addWatermark = false): string {
  const name = screenName ? screenName.replace(/[^a-zA-Z0-9]/g, '') + 'Screen' : 'GeneratedScreen'
  const componentName = name.charAt(0).toUpperCase() + name.slice(1)

  const ctx: ConvertContext = { styles: [], usedComponents: new Set(), styleNameCounts: new Map() }
  const innerIndent = addWatermark ? '      ' : '    '
  const jsx = nodeToJSX(tree, 0, 0, ctx, innerIndent)

  ctx.usedComponents.add('StyleSheet')
  if (addWatermark) {
    ctx.usedComponents.add('View')
    ctx.usedComponents.add('Text')
  }

  const rnImports = ['View', 'Text', 'ScrollView', 'Image', 'TouchableOpacity', 'TextInput', 'Switch', 'SafeAreaView', 'StatusBar', 'StyleSheet']
    .filter(c => ctx.usedComponents.has(c))

  const body = addWatermark
    ? `    <View style={{ flex: 1 }}>\n${jsx}\n      <Watermark />\n    </View>`
    : jsx

  return `import React from 'react';
import { ${rnImports.join(', ')} } from 'react-native';

export default function ${componentName}() {
  return (
${body}
  );
}

const styles = StyleSheet.create({
${formatStyleSheet(ctx.styles)}
});
`
}

// ============================================================
// Flow Converter (inlined from export-tsx-flow.ts)
// ============================================================

interface FlowScreen { id: string; name: string; tree: ComponentNode }

function convertFlowToTSX(screens: FlowScreen[], addWatermark = false): string {
  if (screens.length === 0) return '// No screens to export\n'
  if (screens.length === 1) return convertTreeToTSX(screens[0].tree, screens[0].name, addWatermark)

  const allImports = new Set<string>(['StyleSheet'])
  const componentBlocks: string[] = []
  const styleBlocks: string[] = []

  const RN_COMPONENT_ORDER = ['View', 'Text', 'ScrollView', 'Image', 'TouchableOpacity', 'TextInput', 'Switch', 'SafeAreaView', 'StatusBar']

  for (const screen of screens) {
    const fullTSX = convertTreeToTSX(screen.tree, screen.name, addWatermark)

    const importMatch = fullTSX.match(/import \{ (.+?) \} from 'react-native'/)
    if (importMatch) {
      for (const comp of importMatch[1].split(', ')) {
        if (comp !== 'StyleSheet') allImports.add(comp.trim())
      }
    }

    const funcMatch = fullTSX.match(/export default function (\w+)\(\) \{[\s\S]*?\n\}/)
    if (funcMatch) {
      const namedFunc = funcMatch[0].replace('export default function', 'export function')
      const screenStyleVar = screen.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + 'Styles'
      componentBlocks.push(namedFunc.replace(/styles\./g, `${screenStyleVar}.`))
    }

    const styleMatch = fullTSX.match(/const styles = StyleSheet\.create\(\{[\s\S]*?\}\);/)
    if (styleMatch) {
      const screenStyleVar = screen.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + 'Styles'
      styleBlocks.push(styleMatch[0].replace('const styles =', `const ${screenStyleVar} =`))
    }
  }

  allImports.add('StyleSheet')
  const sortedImports = RN_COMPONENT_ORDER.filter(c => allImports.has(c))
  sortedImports.push('StyleSheet')

  return `import React from 'react';
import { ${[...new Set(sortedImports)].join(', ')} } from 'react-native';

${componentBlocks.join('\n\n')}

// --- Styles ---

${styleBlocks.join('\n\n')}
`
}

// ============================================================
// Watermark suffix (free-tier exports)
// ============================================================

/**
 * Watermark function + styles appended to free-tier exports. Persists in the
 * exported code — user cannot remove without editing the file. Paid users get
 * no watermark and no Watermark code in their export.
 */
function watermarkSuffix(): string {
  return `
function Watermark() {
  return (
    <View style={watermarkStyles.badge} pointerEvents="none">
      <View style={watermarkStyles.dot} />
      <Text style={watermarkStyles.text}>Made with Mokkoi</Text>
    </View>
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
    paddingVertical: 6,
    zIndex: 9999,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#2dd4bf',
    marginRight: 6,
  },
  text: {
    color: '#f1f5f9',
    fontSize: 11,
    fontWeight: '600',
  },
});
`
}

/**
 * Determines if the user is on a paid plan. Mirrors the active-status check in
 * api/_lib/userPlan.ts so backend gate and export gate stay consistent:
 * paid iff plan IN ('pro','max') AND status IN ('active','trialing').
 */
async function isUserPaid(supabase: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle()
  if (error || !data) return false
  return data.plan === 'pro' || data.plan === 'max'
}

// ============================================================
// API Handler
// ============================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await authenticateRequest(req, res)
  if (!user) return

  const { url } = getSupabaseConfig()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const supabase = createClient(url, serviceKey)

  const projectId = (req.query?.projectId || req.body?.projectId) as string | undefined
  const screenId = (req.query?.screenId || req.body?.screenId) as string | undefined
  const format = ((req.query?.format || req.body?.format) as string) || 'tsx'

  if (!projectId) {
    return res.status(400).json({ error: 'Missing projectId' })
  }

  let query = supabase
    .from('screens')
    .select('id, name, component_tree')
    .eq('project_id', projectId)

  if (screenId) query = query.eq('id', screenId)

  const { data: screens, error } = await query.order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: 'Failed to fetch screens', detail: error.message })
  if (!screens || screens.length === 0) return res.status(404).json({ error: 'No screens found' })

  if (format === 'json') {
    return res.status(200).json({
      screens: screens.map(s => ({ id: s.id, name: s.name, tree: s.component_tree })),
    })
  }

  // Free-tier exports get a "Made with Mokkoi" watermark embedded in the TSX.
  // MCP / anonymous callers bypass — they're not consumer-facing exports.
  const isInternal = user.isMCP || user.id === 'anonymous' || user.id === 'mcp'
  const paid = isInternal ? true : await isUserPaid(supabase, user.id)
  const addWatermark = !paid

  let code: string
  if (screens.length === 1) {
    code = convertTreeToTSX(screens[0].component_tree, screens[0].name, addWatermark)
  } else {
    const flowScreens = screens.map(s => ({ id: s.id, name: s.name, tree: s.component_tree }))
    code = convertFlowToTSX(flowScreens, addWatermark)
  }

  if (addWatermark) {
    code = code + watermarkSuffix()
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  return res.status(200).send(code)
}
