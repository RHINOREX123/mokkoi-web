// Diff analyzer for comparing component trees before/after user edits.
// Extracts color changes, spacing changes, added/removed components, and text changes.

export interface ColorChange {
  path: string
  property: string
  from: string
  to: string
}

export interface SpacingChange {
  path: string
  property: string
  from: number | string
  to: number | string
}

export interface ComponentChange {
  path: string
  type: string
  name?: string
}

export interface TextChange {
  path: string
  from: string
  to: string
}

export interface DiffResult {
  colorChanges: ColorChange[]
  spacingChanges: SpacingChange[]
  addedComponents: ComponentChange[]
  removedComponents: ComponentChange[]
  textChanges: TextChange[]
  layoutChanges: { path: string; property: string; from: any; to: any }[]
}

const COLOR_PROPS = new Set([
  'color', 'backgroundColor', 'background', 'borderColor',
  'shadowColor', 'tintColor', 'placeholderTextColor',
  'background-color', 'border-color',
])

const SPACING_PROPS = new Set([
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'paddingHorizontal', 'paddingVertical',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical',
  'gap', 'rowGap', 'columnGap',
])

const LAYOUT_PROPS = new Set([
  'flexDirection', 'justifyContent', 'alignItems', 'alignSelf',
  'flex', 'flexWrap', 'position', 'display',
])

function isColorValue(value: any): boolean {
  if (typeof value !== 'string') return false
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ||
    value.startsWith('rgb') ||
    value.startsWith('hsl')
}

function getComponentType(node: any): string {
  return node?.type || node?.component || node?.name || 'unknown'
}

function getComponentName(node: any): string | undefined {
  return node?.props?.testID || node?.props?.accessibilityLabel || node?.name
}

function compareStyles(
  styleBefore: Record<string, any>,
  styleAfter: Record<string, any>,
  path: string,
  result: DiffResult
) {
  const allKeys = new Set([...Object.keys(styleBefore), ...Object.keys(styleAfter)])

  for (const key of allKeys) {
    const before = styleBefore[key]
    const after = styleAfter[key]

    if (before === after) continue
    if (JSON.stringify(before) === JSON.stringify(after)) continue

    if (COLOR_PROPS.has(key) || isColorValue(before) || isColorValue(after)) {
      if (before !== undefined && after !== undefined) {
        result.colorChanges.push({ path, property: key, from: String(before), to: String(after) })
      }
    } else if (SPACING_PROPS.has(key)) {
      if (before !== undefined && after !== undefined) {
        result.spacingChanges.push({ path, property: key, from: before, to: after })
      }
    } else if (LAYOUT_PROPS.has(key)) {
      result.layoutChanges.push({ path, property: key, from: before, to: after })
    }
  }
}

function extractStyle(node: any): Record<string, any> {
  if (!node) return {}
  const style = node.style || node.props?.style || {}
  // Flatten array styles
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean))
  }
  return typeof style === 'object' ? style : {}
}

function getChildren(node: any): any[] {
  if (!node) return []
  if (Array.isArray(node.children)) return node.children
  if (Array.isArray(node.props?.children)) return node.props.children
  return []
}

function getTextContent(node: any): string | undefined {
  if (typeof node === 'string') return node
  const children = getChildren(node)
  if (children.length === 1 && typeof children[0] === 'string') return children[0]
  if (node.props?.text) return node.props.text
  if (node.props?.value) return node.props.value
  return undefined
}

function walkAndCompare(
  before: any,
  after: any,
  path: string,
  result: DiffResult
) {
  if (!before && !after) return

  // Node added
  if (!before && after) {
    result.addedComponents.push({
      path,
      type: getComponentType(after),
      name: getComponentName(after),
    })
    return
  }

  // Node removed
  if (before && !after) {
    result.removedComponents.push({
      path,
      type: getComponentType(before),
      name: getComponentName(before),
    })
    return
  }

  // Both exist — compare styles
  const styleBefore = extractStyle(before)
  const styleAfter = extractStyle(after)
  compareStyles(styleBefore, styleAfter, path, result)

  // Compare text content
  const textBefore = getTextContent(before)
  const textAfter = getTextContent(after)
  if (textBefore && textAfter && textBefore !== textAfter) {
    result.textChanges.push({ path, from: textBefore, to: textAfter })
  }

  // Recurse into children
  const childrenBefore = getChildren(before)
  const childrenAfter = getChildren(after)
  const maxLen = Math.max(childrenBefore.length, childrenAfter.length)

  for (let i = 0; i < maxLen; i++) {
    walkAndCompare(
      childrenBefore[i],
      childrenAfter[i],
      `${path}[${i}]`,
      result
    )
  }
}

export function analyzeComponentDiff(treeBefore: any, treeAfter: any): DiffResult {
  const result: DiffResult = {
    colorChanges: [],
    spacingChanges: [],
    addedComponents: [],
    removedComponents: [],
    textChanges: [],
    layoutChanges: [],
  }

  walkAndCompare(treeBefore, treeAfter, 'root', result)
  return result
}

export type ChangeCategory =
  | 'color_change'
  | 'spacing_change'
  | 'component_add'
  | 'component_remove'
  | 'text_change'
  | 'layout_change'

export function categorizeChanges(diff: DiffResult): ChangeCategory[] {
  const categories: ChangeCategory[] = []
  if (diff.colorChanges.length > 0) categories.push('color_change')
  if (diff.spacingChanges.length > 0) categories.push('spacing_change')
  if (diff.addedComponents.length > 0) categories.push('component_add')
  if (diff.removedComponents.length > 0) categories.push('component_remove')
  if (diff.textChanges.length > 0) categories.push('text_change')
  if (diff.layoutChanges.length > 0) categories.push('layout_change')
  return categories
}
