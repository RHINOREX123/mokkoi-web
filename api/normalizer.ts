const DEFAULT_SPACING_SCALE = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]
const DEFAULT_FONT_SIZE_SCALE = [11, 12, 13, 14, 16, 17, 20, 24, 28, 34, 40, 48]
const DEFAULT_BORDER_RADIUS_SCALE = [0, 4, 8, 12, 16, 24, 9999]

export interface NormalizerOptions {
  customSpacing?: number[]
  customFontSizes?: number[]
  customBorderRadius?: number[]
}
const VALID_FONT_WEIGHTS = ['400', '500', '600', '700', 'normal', 'bold']
const MIN_TOUCH_TARGET = 44
// Safe area values that should not be snapped
const SAFE_AREA_VALUES = new Set([54, 34, 49, 83, 44, 98])
const SUPPORTED_TYPES = new Set([
  'View', 'SafeAreaView', 'ScrollView', 'Text', 'TextInput',
  'TouchableOpacity', 'Image', 'ActivityIndicator', 'Switch', 'FlatList',
  // SVG data visualization components
  'Svg', 'Circle', 'Path', 'Rect', 'Line', 'Defs', 'SvgLinearGradient', 'Stop',
  // Enhanced components
  'Icon', 'LinearGradient'
])

// SVG types that should skip spacing/font normalization
const SVG_TYPES = new Set(['Svg', 'Circle', 'Path', 'Rect', 'Line', 'Defs', 'SvgLinearGradient', 'Stop'])

function snapToScale(value: number, scale: number[]): number {
  if (typeof value !== 'number' || isNaN(value)) return scale[0]
  if (value <= 0) return 0
  return scale.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  )
}

function normalizeStyle(
  style: Record<string, any>,
  spacingScale: number[],
  fontSizeScale: number[],
  borderRadiusScale: number[],
): Record<string, any> {
  const normalized = { ...style }

  // Snap spacing properties to scale
  const spacingProps = [
    'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
    'paddingHorizontal', 'paddingVertical', 'margin', 'marginTop', 'marginBottom',
    'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
    'gap', 'rowGap', 'columnGap'
  ]
  for (const prop of spacingProps) {
    if (normalized[prop] !== undefined) {
      let v = normalized[prop]
      // Handle string values like "16px" or "16"
      if (typeof v === 'string') v = parseFloat(v)
      if (typeof v === 'number' && !isNaN(v)) {
        // Don't snap safe area values
        normalized[prop] = SAFE_AREA_VALUES.has(v) ? v : snapToScale(v, spacingScale)
      } else {
        delete normalized[prop]
      }
    }
  }

  // Snap font sizes (handle string values like "16px")
  if (normalized.fontSize !== undefined) {
    let fs = normalized.fontSize
    if (typeof fs === 'string') fs = parseFloat(fs)
    if (typeof fs !== 'number' || isNaN(fs) || fs <= 0) normalized.fontSize = 14
    else normalized.fontSize = snapToScale(fs, fontSizeScale)
  }

  // Snap border radius (including corner-specific props)
  const radiusProps = [
    'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
    'borderBottomLeftRadius', 'borderBottomRightRadius'
  ]
  for (const prop of radiusProps) {
    if (typeof normalized[prop] === 'number') {
      normalized[prop] = snapToScale(normalized[prop], borderRadiusScale)
    }
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

  // Clamp explicit height values to prevent screens from being too tall
  // Max reasonable component height is ~600px (most of a phone screen)
  // Full-screen components should use flex:1 not explicit height
  if (typeof normalized.height === 'number' && normalized.height > 600) {
    // Exception: borderRadius 9999 means it's a pill/circle, don't clamp
    if (normalized.borderRadius !== 9999) {
      normalized.height = Math.min(normalized.height, 600)
    }
  }

  // Clamp minHeight similarly
  if (typeof normalized.minHeight === 'number' && normalized.minHeight > 600) {
    normalized.minHeight = Math.min(normalized.minHeight, 600)
  }

  return normalized
}

function normalizeNode(
  node: any,
  depth: number,
  spacingScale: number[],
  fontSizeScale: number[],
  borderRadiusScale: number[],
): any {
  if (!node || typeof node !== 'object') return node

  const normalized = { ...node }

  // Fix unsupported component types
  if (normalized.type && !SUPPORTED_TYPES.has(normalized.type)) {
    // Map common unsupported types to supported equivalents
    const typeMap: Record<string, string> = {
      'Pressable': 'TouchableOpacity',
      'KeyboardAvoidingView': 'View',
      'Modal': 'View',
      'StatusBar': 'View',
      'Animated.View': 'View',
    }
    normalized.type = typeMap[normalized.type] || 'View'
  }

  // Skip spacing/font normalization for SVG elements — only recurse children
  if (SVG_TYPES.has(normalized.type)) {
    if (Array.isArray(normalized.children)) {
      normalized.children = normalized.children
        .filter((child: any) => child != null)
        .map((child: any) => {
          if (typeof child === 'string') return child
          return normalizeNode(child, depth + 1, spacingScale, fontSizeScale, borderRadiusScale)
        })
    }
    return normalized
  }

  // Normalize top-level style
  if (normalized.style) {
    normalized.style = normalizeStyle(normalized.style, spacingScale, fontSizeScale, borderRadiusScale)
  }

  // Also normalize props.style if present (legacy format used by some Text nodes)
  if (normalized.props?.style && typeof normalized.props.style === 'object') {
    normalized.props = { ...normalized.props, style: normalizeStyle(normalized.props.style, spacingScale, fontSizeScale, borderRadiusScale) }
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
        return normalizeNode(child, depth + 1, spacingScale, fontSizeScale, borderRadiusScale)
      })
  }

  return normalized
}

export function normalizeComponentTree(tree: any, options?: NormalizerOptions): any {
  if (!tree) return tree

  // Merge custom scales with defaults (dedup and sort)
  const spacingScale = options?.customSpacing
    ? [...new Set([...DEFAULT_SPACING_SCALE, ...options.customSpacing])].sort((a, b) => a - b)
    : DEFAULT_SPACING_SCALE
  const fontSizeScale = options?.customFontSizes
    ? [...new Set([...DEFAULT_FONT_SIZE_SCALE, ...options.customFontSizes])].sort((a, b) => a - b)
    : DEFAULT_FONT_SIZE_SCALE
  const borderRadiusScale = options?.customBorderRadius
    ? [...new Set([...DEFAULT_BORDER_RADIUS_SCALE, ...options.customBorderRadius])].sort((a, b) => a - b)
    : DEFAULT_BORDER_RADIUS_SCALE

  return normalizeNode(tree, 0, spacingScale, fontSizeScale, borderRadiusScale)
}
