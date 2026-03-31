const DEFAULT_SPACING_SCALE = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]
const DEFAULT_FONT_SIZE_SCALE = [11, 12, 13, 14, 16, 17, 20, 24, 28, 34, 40, 48]
const DEFAULT_BORDER_RADIUS_SCALE = [0, 4, 8, 12, 16, 24, 9999]

// --- Color contrast helpers ---
function parseHexColor(hex: string): [number, number, number] | null {
  if (typeof hex !== 'string') return null
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i)
  if (!m) return null
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function isDark(hex: string): boolean {
  const rgb = parseHexColor(hex)
  if (!rgb) return false
  return relativeLuminance(...rgb) < 0.15
}

function isLight(hex: string): boolean {
  const rgb = parseHexColor(hex)
  if (!rgb) return false
  return relativeLuminance(...rgb) > 0.6
}

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
  'Icon', 'LinearGradient',
  // Macro components (expanded by component-library.ts before normalization;
  // if expansion fails, these fallback to safe defaults in the type map below)
  'BottomNav', 'HeaderBar', 'TabBar', 'SectionHeader', 'Divider', 'SearchBar',
  'StatCard', 'ListRow', 'ProductCard', 'TransactionRow', 'FeatureCard', 'PriceBreakdown', 'RatingStars', 'StatusBadge',
  'AvatarCircle', 'ProfileStats',
  'FormInput', 'Button', 'SocialButton', 'ChipSelector',
  'MessageBubble', 'ChatInputBar',
  'ProgressRing', 'ProgressBar', 'ImageCarousel',
  'PromoCard',
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

  // Fix lineHeight: must be > fontSize to prevent text clipping
  if (normalized.fontSize && normalized.lineHeight) {
    const fs = typeof normalized.fontSize === 'number' ? normalized.fontSize : parseFloat(normalized.fontSize)
    const lh = typeof normalized.lineHeight === 'number' ? normalized.lineHeight : parseFloat(normalized.lineHeight)
    if (!isNaN(fs) && !isNaN(lh) && lh <= fs) {
      normalized.lineHeight = Math.round(fs * 1.2)
    }
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

  // Fix extreme negative margins (allow up to -64 for intentional card overlaps and badges)
  const marginProps = ['margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical']
  for (const prop of marginProps) {
    if (typeof normalized[prop] === 'number' && normalized[prop] < -64) {
      normalized[prop] = -64
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
      // Macro component fallbacks (if expansion failed to run)
      'BottomNav': 'View', 'HeaderBar': 'View', 'TabBar': 'View', 'SectionHeader': 'View',
      'Divider': 'View', 'SearchBar': 'View', 'StatCard': 'View', 'ListRow': 'View',
      'ProductCard': 'View', 'TransactionRow': 'View', 'FeatureCard': 'View',
      'PriceBreakdown': 'View', 'RatingStars': 'View', 'StatusBadge': 'View',
      'AvatarCircle': 'Image', 'ProfileStats': 'View', 'FormInput': 'View',
      'Button': 'TouchableOpacity', 'SocialButton': 'TouchableOpacity',
      'ChipSelector': 'View', 'MessageBubble': 'View', 'ChatInputBar': 'View',
      'ProgressRing': 'View', 'ProgressBar': 'View', 'ImageCarousel': 'View',
      'PromoCard': 'View',
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

  // Strip flex:1 ONLY when a parent has 3+ sibling Views all with flex:1
  // (the actual problem case where AI distributes space evenly, creating gaps).
  // Single flex:1 children or 2 siblings are likely intentional layout splits.
  if (depth >= 2 &&
      (normalized.type === 'View' || normalized.type === 'SafeAreaView') &&
      normalized.type !== 'ScrollView' &&
      normalized.style?.flex === 1 &&
      Array.isArray(normalized.children) && normalized.children.length >= 3) {
    const flexOneChildren = normalized.children.filter((c: any) =>
      c && typeof c === 'object' && c.style?.flex === 1 && (c.type === 'View' || c.type === 'SafeAreaView')
    )
    if (flexOneChildren.length >= 3) {
      for (const child of flexOneChildren) {
        child.style = { ...child.style }
        delete child.style.flex
        child.style.flexShrink = 0
      }
    }
  }

  // Fix: Image node constraints — prevent oversized images from dominating viewport
  if (normalized.type === 'Image') {
    if (!normalized.style) normalized.style = {}
    const hasAvatar = !!normalized.props?.avatar
    const hasSearchQuery = !!normalized.props?.searchQuery
    const hasSource = !!normalized.props?.source?.uri

    // Avatar images: cap at 100px (they're profile circles, not hero images)
    if (hasAvatar) {
      if (typeof normalized.style.height === 'number' && normalized.style.height > 100) {
        normalized.style.height = 100
        normalized.style.width = 100
      }
    }
    // Content images with searchQuery: cap based on depth
    // depth 0-2 = hero/top-level → max 200px, depth 3+ = inside cards/bubbles → max 120px
    else if (hasSearchQuery) {
      const maxH = depth <= 2 ? 200 : 120
      if (typeof normalized.style.height === 'number' && normalized.style.height > maxH) {
        normalized.style.height = maxH
      }
    }
    // Images without ANY content source — try to auto-fix
    else if (!hasSource) {
      const isCircle = normalized.style.borderRadius === 9999 || normalized.style.borderRadius === '50%'
      const isSmall = (typeof normalized.style.width === 'number' && normalized.style.width <= 100) ||
                      (typeof normalized.style.height === 'number' && normalized.style.height <= 100)
      // Circular small Images are clearly meant to be avatars — auto-add avatar prop
      // so they render as initial-letter circles instead of dark blocks
      if (isCircle && isSmall) {
        if (!normalized.props) normalized.props = {}
        normalized.props.avatar = normalized.props.avatar || 'User'
      }
      // Non-avatar empty images: collapse to 48px placeholder
      else {
        if (typeof normalized.style.height === 'number' && normalized.style.height > 48) {
          normalized.style.height = 48
        }
        if (typeof normalized.style.width === 'number' && normalized.style.width > 48) {
          if (normalized.style.width > 100) normalized.style.width = 48
        }
      }
    }
    // Direct URI source: allow larger images (hero images, product shots)
    // Only cap at 500px to prevent absurdly tall single images
    else {
      if (typeof normalized.style.height === 'number' && normalized.style.height > 500) {
        normalized.style.height = 500
      }
    }

    if (typeof normalized.style.minHeight === 'number' && normalized.style.minHeight > 500) {
      normalized.style.minHeight = 500
    }

    // Strip cartoon avatar styles — force professional "initials" style
    if (normalized.props?.avatarStyle && /avataaars|adventurer|fun-emoji|lorelei|notionists|pixel-art|thumbs/i.test(normalized.props.avatarStyle)) {
      normalized.props = { ...normalized.props }
      delete normalized.props.avatarStyle // defaults to "initials" in renderer
    }
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

  // Fix: Empty TouchableOpacity buttons — replace empty View child with a circle icon placeholder
  // AI generates <TouchableOpacity><View /></TouchableOpacity> for icon buttons without actual icons
  if (normalized.type === 'TouchableOpacity' && Array.isArray(normalized.children)) {
    const hasOnlyEmptyView = normalized.children.length === 1 &&
      normalized.children[0]?.type === 'View' &&
      (!normalized.children[0].children || normalized.children[0].children.length === 0)
    if (hasOnlyEmptyView) {
      // Replace empty View with a subtle dot indicator so button isn't invisible
      normalized.children = [{
        type: 'View',
        style: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)' },
      }]
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

  // Strip Image children from message-bubble containers ONLY when inside a MessageBubble
  // or when the parent is a confirmed chat context (has ChatInputBar sibling).
  // Previously this fired on any View with maxWidth + borderRadius, catching product cards too.
  if (normalized.type === 'MessageBubble' && Array.isArray(normalized.children)) {
    normalized.children = normalized.children.filter((child: any) => {
      if (child && typeof child === 'object' && child.type === 'Image') {
        const h = child.style?.height
        return typeof h === 'number' && h <= 48
      }
      return true
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

  // Auto-infer avatar names from sibling Text nodes
  // If an Image got auto-fixed with avatar="User", look for a nearby Text child with a name
  if (Array.isArray(normalized.children)) {
    const avatarImages = normalized.children.filter((c: any) =>
      c?.type === 'Image' && c?.props?.avatar === 'User'
    )
    if (avatarImages.length > 0) {
      // Find the first Text child (or nested Text) that looks like a name
      const findName = (node: any): string | null => {
        if (!node || typeof node !== 'object') return null
        if (node.type === 'Text' && Array.isArray(node.children)) {
          const text = node.children.find((c: any) => typeof c === 'string')
          if (text && text.length >= 2 && text.length <= 30 && /^[A-Z]/.test(text)) return text
        }
        if (Array.isArray(node.children)) {
          for (const child of node.children) {
            const name = findName(child)
            if (name) return name
          }
        }
        return null
      }
      const inferredName = findName(normalized)
      if (inferredName) {
        for (const img of avatarImages) {
          img.props.avatar = inferredName
        }
      }
    }
  }

  // Color contrast enforcement: fix dark text on dark backgrounds
  // Check Text children against this container's background color
  const bg = normalized.style?.backgroundColor as string | undefined
  if (bg && Array.isArray(normalized.children)) {
    const bgIsDark = isDark(bg)
    const bgIsLight = isLight(bg)
    for (const child of normalized.children) {
      if (child && typeof child === 'object' && child.type === 'Text' && child.style?.color) {
        const textColor = child.style.color as string
        // Dark text on dark bg → fix to white
        if (bgIsDark && isDark(textColor)) {
          child.style = { ...child.style, color: '#F1F5F9' }
        }
        // Light text on light bg → fix to dark
        else if (bgIsLight && isLight(textColor)) {
          child.style = { ...child.style, color: '#1A1A2E' }
        }
      }
    }
  }

  return normalized
}

/** Strip position:absolute from bottom nav-like containers and convert to normal flex flow */
function fixAbsoluteBottomNavs(node: any): any {
  if (!node || typeof node !== 'object') return node

  // Recurse children first
  if (Array.isArray(node.children)) {
    node.children = node.children.map((child: any) =>
      typeof child === 'string' ? child : fixAbsoluteBottomNavs(child)
    )
  }

  // Detect absolute-positioned bottom nav: position:absolute + bottom:0 + flexDirection:row
  const s = node.style
  if (s?.position === 'absolute' && (s.bottom === 0 || s.bottom === '0') && s.flexDirection === 'row') {
    delete s.position
    delete s.top
    delete s.right
    delete s.bottom
    delete s.left
    delete s.inset
    delete s.zIndex
  }

  return node
}

/** Strip maxWidth:'75%' bubble styling from Views that aren't inside a chat context */
function stripBubbleStylingFromNonChat(node: any, insideChat: boolean = false): any {
  if (!node || typeof node !== 'object') return node

  // Detect chat context: has ChatInputBar or MessageBubble among children
  const isChat = insideChat || (Array.isArray(node.children) && node.children.some((c: any) =>
    c?.type === 'ChatInputBar' || c?.type === 'MessageBubble'
  ))

  if (!isChat && node.type === 'View' && node.style?.maxWidth === '75%') {
    delete node.style.maxWidth
    if (node.style.alignSelf === 'flex-start' || node.style.alignSelf === 'flex-end') {
      delete node.style.alignSelf
    }
  }

  if (Array.isArray(node.children)) {
    node.children = node.children.map((child: any) =>
      typeof child === 'string' ? child : stripBubbleStylingFromNonChat(child, isChat)
    )
  }

  return node
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

  let result = normalizeNode(tree, 0, spacingScale, fontSizeScale, borderRadiusScale)

  // Post-normalization: fix absolute-positioned bottom navs (common in Sonnet polish output)
  result = fixAbsoluteBottomNavs(result)

  // Post-normalization: strip chat bubble styling from non-chat screens
  result = stripBubbleStylingFromNonChat(result)

  return result
}
