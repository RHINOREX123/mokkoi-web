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
  /**
   * BYO-Backend Track B: when set, the exporter wires the first <Button>/
   * TouchableOpacity matching AUTH_BUTTON_TEXT_REGEX to a Supabase auth call
   * and emits the supporting useState/imports. `redirectScreenName` is the
   * PascalCase screen name to navigate to after a successful call.
   */
  dataAction?: {
    kind: 'auth.signInWithPassword' | 'auth.signUp' | 'auth.signOut'
    redirectScreenName?: string
  }
}

/**
 * Convention regex used to identify the auth submit button on auth screens.
 * Must mirror the comment in api/_lib/plan-prompt.ts. The first
 * TouchableOpacity in the tree whose visible Text matches this is the action
 * button — see exportTsx README block / Track B docs.
 */
export const AUTH_BUTTON_TEXT_REGEX = /sign in|log in|sign up|create account/i

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

/**
 * Recursively collect all TouchableOpacity nodes in tree order so we can find
 * the first one matching AUTH_BUTTON_TEXT_REGEX. Returns the matching node, or
 * null if none.
 */
function findAuthButton(node: ComponentNode | string | undefined): ComponentNode | null {
  if (!node || typeof node !== 'object') return null
  if (node.type === 'TouchableOpacity') {
    // Look for visible text — direct or one level deep (Text child or Text grandchild).
    const collectText = (n: ComponentNode | string | undefined): string => {
      if (!n) return ''
      if (typeof n === 'string') return n
      if (typeof n !== 'object') return ''
      if (n.type === 'Text' && Array.isArray(n.children)) {
        return n.children.filter(c => typeof c === 'string').join(' ')
      }
      if (Array.isArray(n.children)) {
        return n.children.map(collectText).join(' ')
      }
      return ''
    }
    const text = collectText(node)
    if (AUTH_BUTTON_TEXT_REGEX.test(text)) return node
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      const found = findAuthButton(c)
      if (found) return found
    }
  }
  return null
}

interface AuthFieldRefs {
  emailNode: ComponentNode | null
  passwordNode: ComponentNode | null
}

/**
 * Find email + password TextInput nodes in the tree. Matches by:
 *  - props.id === 'email' / 'password' (preferred — see component-library passthrough)
 *  - secureTextEntry → password
 *  - placeholder containing "email"/"password" → fallback heuristic
 */
function findAuthFields(node: ComponentNode | string | undefined, refs: AuthFieldRefs): void {
  if (!node || typeof node !== 'object') return
  if (node.type === 'TextInput') {
    const p = (node.props || {}) as Record<string, unknown>
    const id = typeof p.id === 'string' ? p.id.toLowerCase() : ''
    const placeholder = typeof p.placeholder === 'string' ? p.placeholder.toLowerCase() : ''
    if (!refs.emailNode && (id === 'email' || /email|e-mail/.test(placeholder))) {
      refs.emailNode = node
    } else if (!refs.passwordNode && (id === 'password' || p.secureTextEntry === true || /password/.test(placeholder))) {
      refs.passwordNode = node
    }
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) findAuthFields(c, refs)
  }
}

export function convertTreeToTSX(tree: ComponentNode, screenName?: string, opts?: TSXExportOpts): string {
  const name = screenName ? screenName.replace(/[^a-zA-Z0-9]/g, '') + 'Screen' : 'GeneratedScreen'
  const compName = name.charAt(0).toUpperCase() + name.slice(1)
  const addWatermark = opts?.addWatermark === true

  // BYO-Backend Track B: detect auth button + fields up front so the rendering
  // pass can substitute the onPress handler and onChangeText bindings.
  const dataAction = opts?.dataAction
  const isAuthAction =
    dataAction?.kind === 'auth.signInWithPassword' || dataAction?.kind === 'auth.signUp'
  const authButtonNode: ComponentNode | null = isAuthAction ? findAuthButton(tree) : null
  const authFieldRefs: AuthFieldRefs = { emailNode: null, passwordNode: null }
  if (isAuthAction && authButtonNode) {
    findAuthFields(tree, authFieldRefs)
  }
  const wireAuth = isAuthAction && authButtonNode !== null

  const ctx: Ctx = { styles: [], usedComponents: new Set(), usesIonicons: false, nameCount: new Map() }
  const navTargets = opts?.bindings
  const usesNavigation = { value: false }
  const innerIndent = addWatermark ? '      ' : '    '
  const authCtx = wireAuth
    ? {
        kind: dataAction!.kind,
        redirectScreenName: dataAction!.redirectScreenName,
        buttonNode: authButtonNode!,
        emailNode: authFieldRefs.emailNode,
        passwordNode: authFieldRefs.passwordNode,
      }
    : null
  const jsx = nodeJSXWithNav(tree, 0, 0, ctx, innerIndent, navTargets, usesNavigation, authCtx)

  const rnOrder = ['View', 'Text', 'ScrollView', 'Image', 'TouchableOpacity', 'TextInput', 'Switch', 'SafeAreaView', 'StatusBar', 'Linking', 'Alert', 'StyleSheet']
  ctx.usedComponents.add('StyleSheet')
  if (addWatermark) {
    ctx.usedComponents.add('View')
    ctx.usedComponents.add('Text')
    ctx.usedComponents.add('TouchableOpacity')
    ctx.usedComponents.add('Linking')
  }
  if (wireAuth) {
    // Alert is used by the auth onPress error handler.
    ctx.usedComponents.add('Alert')
  }
  const imports = rnOrder.filter(c => ctx.usedComponents.has(c))

  // wireAuth implies navigation may be used (post-success redirect). Hook in
  // useNavigation regardless of whether other buttons triggered it so the
  // emitted onPress can call navigation.navigate().
  if (wireAuth && dataAction?.redirectScreenName) {
    usesNavigation.value = true
  }

  const navImport = usesNavigation.value ? "\nimport { useNavigation } from '@react-navigation/native';" : ''
  // navHook keeps its original trailing newline only when auth state is NOT
  // appended, so the existing back-compat snapshot stays byte-for-byte. When
  // auth state IS appended, drop the trailing newline so the useState block
  // sits flush with the navigation hook (no spurious blank line in the body).
  const navHook = usesNavigation.value
    ? (wireAuth ? '\n  const navigation = useNavigation();' : '\n  const navigation = useNavigation();\n')
    : ''

  // BYO-Backend Track B: emit useState for email/password + the supabase
  // import. The supabase module file (`./lib/supabase`) is created by Track C —
  // this code just emits the import string.
  const supabaseImport = wireAuth ? "\nimport { supabase } from './lib/supabase';" : ''
  const authStateLines = wireAuth
    ? `\n  const [email, setEmail] = useState('');\n  const [password, setPassword] = useState('');\n`
    : ''

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

  const reactImport = wireAuth
    ? "import React, { useState } from 'react';"
    : "import React from 'react';"

  const baseFile = `${reactImport}
import { ${imports.join(', ')} } from 'react-native';${navImport}${iconsImport}${supabaseImport}

export default function ${compName}() {${navHook}${authStateLines}
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

interface AuthCtx {
  kind: 'auth.signInWithPassword' | 'auth.signUp' | 'auth.signOut'
  redirectScreenName: string | undefined
  buttonNode: ComponentNode
  emailNode: ComponentNode | null
  passwordNode: ComponentNode | null
}

/** Extended nodeJSX that can inject navigation.navigate() on TouchableOpacity */
function nodeJSXWithNav(
  node: ComponentNode | string, depth: number, idx: number, ctx: Ctx, indent: string,
  navTargets: Map<ComponentNode, string> | undefined,
  usesNavigation: { value: boolean },
  authCtx: AuthCtx | null = null,
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

  // BYO-Backend Track B: auth button takes precedence over plain navigation
  // bindings — its onPress wraps a Supabase call and does the redirect itself.
  if (type === 'TouchableOpacity' && authCtx && node === authCtx.buttonNode) {
    const method = authCtx.kind === 'auth.signUp' ? 'signUp' : 'signInWithPassword'
    const redirect = authCtx.redirectScreenName
      ? `\n        if (!error) navigation.navigate('${authCtx.redirectScreenName}');\n        else Alert.alert('Sign in failed', error.message);`
      : `\n        if (error) Alert.alert('Sign in failed', error.message);`
    props.push(
      `onPress={async () => {\n        const { error } = await supabase.auth.${method}({ email, password });${redirect}\n      }}`
    )
  } else if (type === 'TouchableOpacity') {
    // Prefer navIntent (deep-nav schema, see src/types/mokkoi.ts NavIntent).
    // Falls back to the legacy bindings map so existing single-screen exports
    // and tests keep working through Stream A's collapse migration.
    const intent = node.navIntent
    if (intent && (intent.kind === 'push' || intent.kind === 'openSheet') && typeof intent.target === 'string') {
      const paramsArg = intent.params && Object.keys(intent.params).length > 0
        ? `, ${JSON.stringify(intent.params)}`
        : ''
      props.push(`onPress={() => navigation.navigate('${intent.target}'${paramsArg})}`)
      usesNavigation.value = true
    } else if (navTargets) {
      // Legacy bindings path (single-screen export wirer flow).
      const target = navTargets.get(node)
      if (target) {
        props.push(`onPress={() => navigation.navigate('${target}')}`)
        usesNavigation.value = true
      }
    }
  }

  // BYO-Backend Track B: bind TextInput onChangeText to the email/password
  // setters when this TextInput is the recognized email/password field.
  if (type === 'TextInput' && authCtx) {
    if (authCtx.emailNode && node === authCtx.emailNode) {
      props.push('value={email}')
      props.push('onChangeText={setEmail}')
    } else if (authCtx.passwordNode && node === authCtx.passwordNode) {
      props.push('value={password}')
      props.push('onChangeText={setPassword}')
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
  const cJSX = children.map((c, i) => nodeJSXWithNav(c, depth + 1, i, ctx, ci, navTargets, usesNavigation, authCtx)).filter(Boolean).join('\n')
  return `${indent}<${type}${propsStr}>\n${cJSX}\n${indent}</${type}>`
}

// ── Deep-navigation App.tsx scaffold ─────────────────────────────────────────
//
// Emits a top-level App.tsx that wires up React Navigation's native-stack with
// one Stack.Screen per planner routeGraph entry, embeds the planner's appData
// as a const, and passes it into each screen as a prop. Detail screens read
// `route.params.id` and look up `appData[collection][id]`.
//
// Per-screen files are still produced by convertTreeToTSX — they accept
// `appData` and `route` via React Navigation's standard screen-component
// signature so this scaffold can mount them directly.

export interface DeepNavScreenEntry {
  id: string
  kind?: 'screen' | 'modal'
  /** Planner-supplied: the appData collection this screen reads from
   *  (deep-nav detail screens only). */
  dataSource?: string
  /** Planner-supplied: required route params for this screen (e.g.
   *  ["workoutId"]). Used at runtime to map navIntent params to the
   *  record-key lookup. */
  params?: string[]
  /** Planner-supplied: a 1-line description of what the user does on
   *  this screen. Carried through for completeness; not yet consumed
   *  by the runtime. */
  purpose?: string
}

export interface DeepNavRouteGraph {
  screens: DeepNavScreenEntry[]
  tabs?: string[]
  entryScreenId?: string
}

export interface AppTsxOptions {
  /** Imported screen component names, keyed by planner screen id.
   *  Caller is responsible for emitting matching `import` lines for each. */
  componentNameByScreenId: Record<string, string>
  /** Relative import path (without extension) for each screen, keyed by id.
   *  Example: `./screens/Home` */
  importPathByScreenId: Record<string, string>
  /** Inlined planner appData blob. Stringified via JSON.stringify so any
   *  nested objects survive untouched. */
  appData: unknown
  routeGraph: DeepNavRouteGraph
}

/**
 * Generates a stand-alone App.tsx string for the deep-navigation export.
 * Pure / deterministic — no I/O. Designed to be dropped into the Snack
 * bundle (or a real Expo project) alongside the per-screen files.
 */
export function convertAppToTSX(opts: AppTsxOptions): string {
  const { componentNameByScreenId, importPathByScreenId, appData, routeGraph } = opts
  const screens = routeGraph.screens ?? []
  if (screens.length === 0) {
    throw new Error('convertAppToTSX: routeGraph.screens must contain at least one screen')
  }

  // Initial route: planner-provided entry id wins; otherwise first non-modal.
  const firstNonModal = screens.find(s => s.kind !== 'modal') ?? screens[0]
  const initialId = (routeGraph.entryScreenId && screens.some(s => s.id === routeGraph.entryScreenId))
    ? routeGraph.entryScreenId
    : firstNonModal.id

  // Imports: one per screen. Stable order = routeGraph order.
  const importLines = screens.map(s => {
    const compName = componentNameByScreenId[s.id]
    const importPath = importPathByScreenId[s.id]
    if (!compName || !importPath) {
      throw new Error(`convertAppToTSX: missing componentName/importPath for screen "${s.id}"`)
    }
    return `import ${compName} from '${importPath}';`
  }).join('\n')

  // Stack.Screen entries — modal screens get presentation: "modal" so they
  // slide up from the bottom on iOS like a sheet.
  const stackScreens = screens.map(s => {
    const compName = componentNameByScreenId[s.id]
    const optionsArg = s.kind === 'modal'
      ? ' options={{ presentation: "modal" }}'
      : ''
    return `        <Stack.Screen name="${s.id}"${optionsArg}>
          {(props) => <${compName} {...props} appData={appData} />}
        </Stack.Screen>`
  }).join('\n')

  // Stringify appData as a JSON literal. JSON.stringify is safe inside JS
  // source because it never emits the closing-script-tag pattern and the
  // result is valid JS object-literal syntax.
  const appDataLiteral = JSON.stringify(appData, null, 2)

  return `import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
${importLines}

const Stack = createNativeStackNavigator();

const appData = ${appDataLiteral};

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="${initialId}">
${stackScreens}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
`
}
