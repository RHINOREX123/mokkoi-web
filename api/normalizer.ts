const SPACING_SCALE = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]
const FONT_SIZE_SCALE = [11, 12, 13, 14, 16, 17, 20, 24, 28, 34, 40, 48]
const BORDER_RADIUS_SCALE = [0, 4, 8, 12, 16, 24, 9999]
const VALID_FONT_WEIGHTS = ['400', '500', '600', '700', 'normal', 'bold']
const MIN_TOUCH_TARGET = 44
// Safe area values that should not be snapped
const SAFE_AREA_VALUES = new Set([54, 34, 49, 83, 44, 98])

function snapToScale(value: number, scale: number[]): number {
  if (typeof value !== 'number' || isNaN(value)) return scale[0]
  if (value <= 0) return 0
  return scale.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  )
}

function normalizeStyle(style: Record<string, any>): Record<string, any> {
  const normalized = { ...style }

  // Snap spacing properties to scale
  const spacingProps = [
    'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
    'paddingHorizontal', 'paddingVertical', 'margin', 'marginTop', 'marginBottom',
    'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
    'gap', 'rowGap', 'columnGap'
  ]
  for (const prop of spacingProps) {
    if (typeof normalized[prop] === 'number') {
      // Don't snap safe area values
      if (!SAFE_AREA_VALUES.has(normalized[prop])) {
        normalized[prop] = snapToScale(normalized[prop], SPACING_SCALE)
      }
    }
  }

  // Snap font sizes (handle string values like "16px")
  if (normalized.fontSize !== undefined) {
    let fs = normalized.fontSize
    if (typeof fs === 'string') fs = parseFloat(fs)
    if (typeof fs !== 'number' || isNaN(fs) || fs <= 0) normalized.fontSize = 14
    else normalized.fontSize = snapToScale(fs, FONT_SIZE_SCALE)
  }

  // Snap border radius
  if (typeof normalized.borderRadius === 'number') {
    normalized.borderRadius = snapToScale(normalized.borderRadius, BORDER_RADIUS_SCALE)
  }

  // Validate font weight
  if (normalized.fontWeight && !VALID_FONT_WEIGHTS.includes(String(normalized.fontWeight))) {
    const weight = parseInt(String(normalized.fontWeight))
    if (isNaN(weight)) normalized.fontWeight = '400'
    else if (weight <= 450) normalized.fontWeight = '400'
    else if (weight <= 550) normalized.fontWeight = '500'
    else if (weight <= 650) normalized.fontWeight = '600'
    else normalized.fontWeight = '700'
  }

  // Fix extreme negative margins (allow small negative for intentional overlap)
  const marginProps = ['margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical']
  for (const prop of marginProps) {
    if (typeof normalized[prop] === 'number' && normalized[prop] < -16) {
      normalized[prop] = 0
    }
  }

  return normalized
}

function normalizeNode(node: any, depth: number = 0): any {
  if (!node || typeof node !== 'object') return node

  const normalized = { ...node }

  // Normalize top-level style
  if (normalized.style) {
    normalized.style = normalizeStyle(normalized.style)
  }

  // Also normalize props.style if present (legacy format used by some Text nodes)
  if (normalized.props?.style && typeof normalized.props.style === 'object') {
    normalized.props = { ...normalized.props, style: normalizeStyle(normalized.props.style) }
  }

  // Ensure root View has flex: 1
  if (depth === 0 && (normalized.type === 'View' || normalized.type === 'SafeAreaView') && normalized.style) {
    if (!normalized.style.flex) normalized.style.flex = 1
  }

  // Fix: TouchableOpacity minimum touch target
  if (normalized.type === 'TouchableOpacity') {
    if (!normalized.style) normalized.style = {}
    if (typeof normalized.style.height === 'number' && normalized.style.height < MIN_TOUCH_TARGET) {
      normalized.style.minHeight = MIN_TOUCH_TARGET
    }
    if (!normalized.style.height && !normalized.style.minHeight) {
      normalized.style.minHeight = MIN_TOUCH_TARGET
    }
  }

  // Fix: Remove empty children arrays
  if (Array.isArray(normalized.children) && normalized.children.length === 0) {
    delete normalized.children
  }

  // Fix: Nested vertical ScrollView → convert inner to View
  if (normalized.type === 'ScrollView' && !normalized.props?.horizontal && Array.isArray(normalized.children)) {
    normalized.children = normalized.children.map((child: any) => {
      if (child && typeof child === 'object' && child.type === 'ScrollView' && !child.props?.horizontal) {
        return { ...child, type: 'View' }
      }
      return child
    })
  }

  // Recursively normalize children
  if (Array.isArray(normalized.children)) {
    normalized.children = normalized.children
      .filter((child: any) => child != null)
      .map((child: any) => {
        if (typeof child === 'string') return child
        return normalizeNode(child, depth + 1)
      })
  }

  return normalized
}

export function normalizeComponentTree(tree: any): any {
  if (!tree) return tree
  return normalizeNode(tree, 0)
}
