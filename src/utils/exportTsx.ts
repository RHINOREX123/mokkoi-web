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


/** BYO-Backend: kind of Supabase auth call to wire into a screen's primary
 * button. Mirrors the planner-emitted ScreenDataAction kinds — kept as a
 * string union here to avoid pulling api/* server types into the client bundle. */
export type ExportDataActionKind =
  | 'auth.signInWithPassword'
  | 'auth.signUp'
  | 'auth.signOut'

export interface ExportDataAction {
  kind: ExportDataActionKind
  /** PascalCase component name to navigation.navigate() after success.
   * Resolved by the caller from the planner's dataAction.redirectScreen
   * (a planId) to the matching screen file's exported component name. */
  redirectScreenName?: string
}

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
  /**
   * BYO-Backend: when set, the exporter wires the screen's primary auth button
   * (matched by the convention regex /sign in|log in|sign up|create account/i)
   * to the corresponding supabase.auth.* call, threads useState into email and
   * password TextInputs, and emits the supabase import. The actual
   * ./lib/supabase module is created by the Snack-runtime track; the exporter
   * just emits the import statement.
   */
  dataAction?: ExportDataAction
}

const AUTH_BUTTON_TEXT_RE = /sign\s*in|log\s*in|sign\s*up|create\s*account/i

/** Walk the (children-only) text content of a node and return the first
 * non-empty trimmed string. Used to test the convention regex against
 * a TouchableOpacity's button label. */
function firstTextChild(node: ComponentNode | string): string {
  if (typeof node === 'string') return node.trim()
  if (!node || typeof node !== 'object') return ''
  const kids = node.children || []
  for (const c of kids) {
    if (typeof c === 'string') {
      const t = c.trim()
      if (t) return t
    } else {
      const t = firstTextChild(c)
      if (t) return t
    }
  }
  return ''
}

/** Pre-walk pass for BYO-Backend auth wiring. Identifies the action button
 * (first <TouchableOpacity> whose visible text matches the convention regex,
 * OR has props.action === dataAction.kind) and the email/password TextInputs
 * (first non-secure / first secureTextEntry, respectively). Returns null
 * results for any node type that didn't match — the JSX emitter just no-ops
 * those checks via node-identity lookups. */
function findAuthNodes(
  tree: ComponentNode,
  kind: ExportDataActionKind,
): { actionButton: ComponentNode | null; emailInput: ComponentNode | null; passwordInput: ComponentNode | null } {
  let actionButton: ComponentNode | null = null
  let emailInput: ComponentNode | null = null
  let passwordInput: ComponentNode | null = null

  function walk(node: ComponentNode | string): void {
    if (typeof node !== 'object' || node === null) return
    if (node.type === 'TouchableOpacity' && !actionButton) {
      const action = node.props?.action
      if (typeof action === 'string' && action === kind) {
        actionButton = node
      } else {
        const txt = firstTextChild(node)
        if (txt && AUTH_BUTTON_TEXT_RE.test(txt)) actionButton = node
      }
    }
    if (node.type === 'TextInput') {
      const secure = node.props?.secureTextEntry === true
      if (secure && !passwordInput) passwordInput = node
      else if (!secure && !emailInput) emailInput = node
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) walk(c)
    }
  }
  walk(tree)
  return { actionButton, emailInput, passwordInput }
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

  // BYO-Backend auth wiring: identify the screen's action button + form fields
  // before emission so the JSX walker can swap onPress / inject value+onChangeText
  // by node identity. When no dataAction is provided this is a no-op (all three
  // refs stay null and the convention regex never matches).
  const dataAction = opts?.dataAction
  const auth = dataAction
    ? findAuthNodes(tree, dataAction.kind)
    : { actionButton: null, emailInput: null, passwordInput: null }
  const usesAuth = { value: false }

  const innerIndent = addWatermark ? '      ' : '    '
  const jsx = nodeJSXWithNav(tree, 0, 0, ctx, innerIndent, navTargets, usesNavigation, auth, dataAction, usesAuth)

  const rnOrder = ['View', 'Text', 'ScrollView', 'Image', 'TouchableOpacity', 'TextInput', 'Switch', 'SafeAreaView', 'StatusBar', 'Alert', 'Linking', 'StyleSheet']
  ctx.usedComponents.add('StyleSheet')
  if (addWatermark) {
    ctx.usedComponents.add('View')
    ctx.usedComponents.add('Text')
    ctx.usedComponents.add('TouchableOpacity')
    ctx.usedComponents.add('Linking')
  }
  if (usesAuth.value) {
    ctx.usedComponents.add('Alert')
  }
  const imports = rnOrder.filter(c => ctx.usedComponents.has(c))

  // BYO-Backend imports/hooks:
  //   - useState for the email/password fields
  //   - supabase from a generated './lib/supabase' module (created by the
  //     Snack-runtime track — the exporter only emits the import here)
  //   - navigation.navigate runs implicitly through useNavigation, which the
  //     existing nav-hook block already handles when usesNavigation flips.
  const reactImport = usesAuth.value
    ? "import React, { useState } from 'react';"
    : "import React from 'react';"
  const supabaseImport = usesAuth.value
    ? "\nimport { supabase } from './lib/supabase';"
    : ''
  // If auth wiring is in play and dataAction has a redirectScreen, we navigate
  // after a successful call — flip the navigation switch so useNavigation gets
  // imported even when no plain bindings were attached.
  if (usesAuth.value && dataAction?.redirectScreenName) {
    usesNavigation.value = true
  }
  const authHooks = usesAuth.value
    ? `  const [email, setEmail] = useState('');\n  const [password, setPassword] = useState('');\n`
    : ''

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

  const baseFile = `${reactImport}
import { ${imports.join(', ')} } from 'react-native';${supabaseImport}${navImport}${iconsImport}

export default function ${compName}() {${navHook}${authHooks}
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

/** Build the onPress handler body for a BYO-Backend auth action. Wraps a
 * supabase.auth.* call, error-toasts via Alert on failure, and navigates to
 * the success screen when one is wired. Indented to match the surrounding
 * JSX so the emitted file lints clean. */
function buildAuthOnPress(action: ExportDataAction, indent: string): string {
  const inner = indent + '  '
  const inner2 = inner + '  '
  let call: string
  if (action.kind === 'auth.signOut') {
    call = `${inner}const { error } = await supabase.auth.signOut();`
  } else if (action.kind === 'auth.signUp') {
    call = `${inner}const { error } = await supabase.auth.signUp({ email, password });`
  } else {
    call = `${inner}const { error } = await supabase.auth.signInWithPassword({ email, password });`
  }
  const successLine = action.redirectScreenName
    ? `${inner2}navigation.navigate('${action.redirectScreenName}');`
    : `${inner2}// signed in`
  const errLabel =
    action.kind === 'auth.signUp' ? 'Sign up failed'
      : action.kind === 'auth.signOut' ? 'Sign out failed'
        : 'Sign in failed'
  return [
    `async () => {`,
    call,
    `${inner}if (error) {`,
    `${inner2}Alert.alert('${errLabel}', error.message);`,
    `${inner}} else {`,
    successLine,
    `${inner}}`,
    `${indent}}`,
  ].join('\n')
}

/** Extended nodeJSX that can inject navigation.navigate() on TouchableOpacity */
function nodeJSXWithNav(
  node: ComponentNode | string, depth: number, idx: number, ctx: Ctx, indent: string,
  navTargets: Map<ComponentNode, string> | undefined,
  usesNavigation: { value: boolean },
  auth?: { actionButton: ComponentNode | null; emailInput: ComponentNode | null; passwordInput: ComponentNode | null },
  dataAction?: ExportDataAction,
  usesAuth?: { value: boolean },
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

  // BYO-Backend auth wiring takes precedence over a plain navigation binding.
  // If this TouchableOpacity is the matched action button, emit the
  // supabase.auth.* onPress and skip the regular navigation handler — the
  // success branch of the auth call already navigates.
  let authOnPressEmitted = false
  if (type === 'TouchableOpacity' && auth && dataAction && auth.actionButton === node) {
    props.push(`onPress={${buildAuthOnPress(dataAction, indent + '  ')}}`)
    if (usesAuth) usesAuth.value = true
    authOnPressEmitted = true
  }

  // Check if this TouchableOpacity should navigate (node-identity lookup)
  if (!authOnPressEmitted && type === 'TouchableOpacity' && navTargets) {
    const target = navTargets.get(node)
    if (target) {
      props.push(`onPress={() => navigation.navigate('${target}')}`)
      usesNavigation.value = true
    }
  }

  // BYO-Backend: thread useState into the matched email/password TextInputs.
  // value+onChangeText make the inputs controlled so the auth call above sees
  // current values. We add these BEFORE the regular TextInput prop emission so
  // the order in the JSX is value, onChangeText, placeholder, ... (no semantic
  // effect, just stable output for snapshots).
  if (type === 'TextInput' && auth) {
    if (auth.emailInput === node) {
      props.push('value={email}')
      props.push('onChangeText={setEmail}')
      if (usesAuth) usesAuth.value = true
    } else if (auth.passwordInput === node) {
      props.push('value={password}')
      props.push('onChangeText={setPassword}')
      if (usesAuth) usesAuth.value = true
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
  const cJSX = children.map((c, i) => nodeJSXWithNav(c, depth + 1, i, ctx, ci, navTargets, usesNavigation, auth, dataAction, usesAuth)).filter(Boolean).join('\n')
  return `${indent}<${type}${propsStr}>\n${cJSX}\n${indent}</${type}>`
}


