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
  if (normalized.fontSize) {
    const fs = typeof normalized.fontSize === 'number' ? normalized.fontSize : parseFloat(normalized.fontSize)
    if (!isNaN(fs) && fs > 0) {
      if (normalized.lineHeight) {
        const lh = typeof normalized.lineHeight === 'number' ? normalized.lineHeight : parseFloat(normalized.lineHeight)
        if (!isNaN(lh) && lh <= fs) {
          normalized.lineHeight = Math.round(fs * 1.2)
        }
      } else if (fs >= 24) {
        // Large text without lineHeight — React Native defaults can clip; add safe lineHeight
        normalized.lineHeight = Math.round(fs * 1.3)
      }
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

// ─── Deep-navigation: infer card params from card text ────────────────────────
//
// Bug observed in production smoke test: tap any restaurant card on Home →
// Restaurant Detail opens with raw `{{name}}` and `{{description}}` sentinels
// instead of the tapped restaurant's data. Root cause: the screen-gen LLM
// emits navIntent: { kind:'push', target:'restaurantDetail' } on the card
// but OMITS the params object, so the runtime's resolveRecord has no id to
// look up and returns undefined — sentinel substitution silently no-ops.
//
// This pass infers params.id from the card's visible text content: walk the
// card subtree, collect Text descendants, look for any appData record name
// that appears in the card text. The longest matching record name wins
// (avoids a "Spice" record stealing a "Spice Palace" card).
//
// Sentinel-only cards (like the detail screen template itself) don't match
// any literal name, so they're left untouched — no false-positive inference.

function collectTextContent(node: any): string {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (typeof node !== 'object') return ''
  const parts: string[] = []
  if (Array.isArray(node.children)) {
    for (const c of node.children) parts.push(collectTextContent(c))
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export interface InferParamsRouteGraph {
  screens: Array<{
    id: string
    kind?: 'screen' | 'modal'
    dataSource?: string
    params?: string[]
  }>
}

export function inferCardParamsFromText(
  tree: any,
  appData: Record<string, unknown> | null | undefined,
  routeGraph: InferParamsRouteGraph,
): number {
  if (!appData || typeof appData !== 'object') return 0
  // Map: screenId → { collection, paramKey } for any push-targetable screen
  // declaring a dataSource. We need both — without a paramKey we have no
  // navIntent.params field to populate.
  const screenInfo = new Map<string, { collection: string; paramKey: string }>()
  for (const s of routeGraph?.screens ?? []) {
    if (s.kind === 'modal') continue
    if (typeof s.dataSource !== 'string' || s.dataSource.length === 0) continue
    if (!Array.isArray(s.params) || typeof s.params[0] !== 'string') continue
    screenInfo.set(s.id, { collection: s.dataSource, paramKey: s.params[0] })
  }
  if (screenInfo.size === 0) return 0

  let inferred = 0

  function walk(node: any): void {
    if (!node || typeof node !== 'object') return
    if (node.type === 'TouchableOpacity') {
      const intent = node.navIntent
      if (intent && typeof intent === 'object' && intent.kind === 'push' &&
          typeof intent.target === 'string') {
        const info = screenInfo.get(intent.target)
        if (info) {
          const existingParams = (intent.params && typeof intent.params === 'object')
            ? intent.params as Record<string, unknown>
            : undefined
          const hasParamKey = existingParams && typeof existingParams[info.paramKey] === 'string' &&
            (existingParams[info.paramKey] as string).length > 0
          if (!hasParamKey) {
            const records = (appData as Record<string, unknown>)[info.collection]
            if (Array.isArray(records)) {
              const cardText = collectTextContent(node).toLowerCase()
              if (cardText) {
                // Find every record whose name appears in cardText, sort by
                // name length DESC so the most specific match wins.
                const matches = records
                  .map(r => {
                    if (!r || typeof r !== 'object') return null
                    const rec = r as Record<string, unknown>
                    const name = rec.name
                    if (typeof name !== 'string' || name.length === 0) return null
                    return { rec, name }
                  })
                  .filter((m): m is { rec: Record<string, unknown>; name: string } =>
                    m !== null && cardText.includes(m.name.toLowerCase()),
                  )
                  .sort((a, b) => b.name.length - a.name.length)
                const best = matches[0]
                if (best && typeof best.rec.id === 'string' && best.rec.id.length > 0) {
                  intent.params = { ...(existingParams ?? {}), [info.paramKey]: best.rec.id }
                  inferred++
                }
              }
            }
          }
        }
      }
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) walk(c)
    }
  }

  walk(tree)
  return inferred
}

// ─── Deep-navigation: stamp toggleState on filter pill rows ───────────────────
//
// Production smoke test surfaced: filter pill rows ("All / Pizza / Burgers /
// Sushi / Indian") still classified at runtime as Deferred reason=filter-chip
// even after the planner-prompt rewrite instructing the model to emit
// toggleState on every pill. Model compliance is poor — the prior "pills MUST
// NOT carry navIntent" rule it was trained on overrides the new instruction
// for a non-trivial fraction of generations.
//
// Server-side fix: detect filter-pill rows by structural signature (a View
// with flexDirection:'row' whose direct children are all TouchableOpacities,
// 3+ of them, each with a short text label and no real navIntent) and stamp
// toggleState onto each pill. Group id is derived from the row's pill labels
// so multiple pill rows on the same screen get distinct groups; stateKey is
// the slug of each pill's text.
//
// Mirrors the runtime's `isFilterChipClick` heuristic in src/runtime/main.tsx
// so the same shapes get the same classification — except we fix them at
// the tree level instead of just deferring at runtime.

function slugifyText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function stampFilterChipToggleState(tree: any): number {
  let stamped = 0

  function isPillRow(node: any): { pills: any[] } | null {
    if (!node || typeof node !== 'object') return null
    if (!Array.isArray(node.children) || node.children.length < 3) return null
    // Every direct child must be a TouchableOpacity (no Text/View mixed in —
    // those are headers, not chip rows).
    for (const c of node.children) {
      if (!c || typeof c !== 'object' || c.type !== 'TouchableOpacity') return null
    }
    // Exclude BottomNav-shaped containers (paddingBottom safe-area inset +
    // top border). The runtime's isBottomNavRow uses the same signal.
    const style = (node.style && typeof node.style === 'object')
      ? node.style as Record<string, unknown>
      : {}
    const padBottom = typeof style.paddingBottom === 'number' ? style.paddingBottom
      : typeof style.paddingBottom === 'string' ? parseFloat(style.paddingBottom) : 0
    const borderTop = typeof style.borderTopWidth === 'number' ? style.borderTopWidth
      : typeof style.borderTopWidth === 'string' ? parseFloat(style.borderTopWidth) : 0
    if (padBottom >= 24 && borderTop >= 1) return null
    // Exclude obviously-vertical containers (column layouts of buttons like
    // Sign In / Sign Up / Forgot — those are NOT filter pills). If style.flexDirection
    // is explicitly 'column', bail. Anything else (row, undefined, default) → eligible.
    if (style.flexDirection === 'column') return null
    return { pills: node.children }
  }

  function countDescendants(n: any): number {
    if (!n || typeof n !== 'object') return 0
    let c = 1
    if (Array.isArray(n.children)) for (const k of n.children) c += countDescendants(k)
    return c
  }

  function isEligiblePill(p: any): { label: string } | null {
    // Pill must have NO existing real navIntent. noop is fine — we'll overwrite.
    const intent = p.navIntent
    if (intent && typeof intent === 'object' && typeof intent.kind === 'string') {
      if (intent.kind === 'push' || intent.kind === 'openSheet' ||
          intent.kind === 'back' || intent.kind === 'toggleState') {
        return null
      }
    }
    // Pill must have a short text label (≤25 chars).
    const text = collectTextContent(p)
    if (text.length === 0 || text.length > 25) return null
    // Pill must have a small subtree (chip-y). This is what distinguishes a
    // 5-icon Cuisines row from a 3-button login stack: a chip is icon+text
    // (~3-6 descendants), a form button or card wraps more structure (10+).
    // Excludes false-positives where the parent's children include
    // structurally-complex TouchableOpacities like cards.
    if (countDescendants(p) > 8) return null
    return { label: text }
  }

  function walk(node: any): void {
    if (!node || typeof node !== 'object') return
    const row = isPillRow(node)
    if (row) {
      const pillLabels: Array<{ pill: any; label: string }> = []
      let allEligible = true
      for (const p of row.pills) {
        const meta = isEligiblePill(p)
        if (!meta) { allEligible = false; break }
        pillLabels.push({ pill: p, label: meta.label })
      }
      if (allEligible && pillLabels.length >= 3) {
        // Derive a group id from the concatenated labels — stable per row,
        // unique across rows on the same screen with different pill sets.
        const groupSeed = pillLabels.map(p => p.label).join('|')
        const group = `filter-${slugifyText(groupSeed)}` || 'filter'
        const seenStateKeys = new Set<string>()
        for (const { pill, label } of pillLabels) {
          let stateKey = slugifyText(label) || `pill-${seenStateKeys.size}`
          // Disambiguate if two pills slugify to the same key (e.g. emoji-only).
          while (seenStateKeys.has(stateKey)) stateKey = `${stateKey}-x`
          seenStateKeys.add(stateKey)
          pill.navIntent = { kind: 'toggleState', group, stateKey }
          stamped++
        }
        // Don't recurse into stamped pills — their children are leaf Text.
        return
      }
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) walk(c)
    }
  }

  walk(tree)
  return stamped
}

// ─── Deep-navigation: navIntent validator ─────────────────────────────────────
//
// Walks every TouchableOpacity node in the tree. If a touchable is missing
// navIntent, or its navIntent.target points at a screen/sheet id not present
// in the planner's routeGraph, we log a warning and replace it with a noop
// intent. There is NO regeneration loop here — validate, log, fallback.
//
// Inputs:
//   tree       — a ComponentNode (typed `any` to stay consistent with the rest
//                of this file; the public schema lives in src/types/mokkoi.ts).
//   routeGraph — { screens: [{ id, kind }, ...], tabs: [id, ...] } from the
//                planner. We accept anything shaped like that to avoid an
//                import cycle with api/_lib/planner.ts.
//
// Returns:
//   { tree, warnings } — the tree (mutated in place for performance; callers
//   that need immutability should clone first) and a list of human-readable
//   warning strings for log / telemetry surfacing.

export interface NavIntentRouteGraph {
  screens: Array<{ id: string; kind?: 'screen' | 'modal' }>
  tabs?: string[]
}

export interface ValidateNavIntentsResult {
  tree: any
  warnings: string[]
}

/**
 * Hoist a navIntent placed on an inner element up to the wrapping
 * TouchableOpacity (Package A.2).
 *
 * Without this pass, screen-gen rows like
 *   <TouchableOpacity>              ← no navIntent set on the wrapper
 *     <Icon />
 *     <View>
 *       <Text navIntent={...}>Title</Text>  ← intent stranded on inner Text
 *       <Text>Subtitle</Text>
 *     </View>
 *     <Chevron />
 *   </TouchableOpacity>
 * get classified at runtime as "Deferred reason=compound" — the click
 * event bubbles to the outer TouchableOpacity which has no
 * data-mokkoi-nav set, so no push fires. Observed in production smoke
 * test on Profile menu rows where the model put navIntent on the
 * "Addresses" Text instead of the row's TouchableOpacity wrapper.
 *
 * Rules:
 *  - Only hoist when the outer TouchableOpacity has NO navIntent OR a
 *    noop one. Never overwrite an explicit push/openSheet/back/toggleState
 *    the model deliberately set.
 *  - Only hoist if EXACTLY ONE hoistable descendant intent exists.
 *    Multiple inner intents = ambiguous, leave alone (validator will
 *    flag whichever survives).
 *  - Do NOT traverse into nested TouchableOpacities — their descendants
 *    belong to them. Stops the walk at the first inner TouchableOpacity.
 *
 * Mutates in place to match the rest of the normalizer's style.
 */
export function hoistInnerNavIntents(tree: any): number {
  let hoistCount = 0

  function findHoistable(node: any, results: any[], topLevel: boolean): void {
    if (!node || typeof node !== 'object') return
    // Stop at nested TouchableOpacity boundaries (except the outer one
    // we're currently considering).
    if (!topLevel && node.type === 'TouchableOpacity') return
    const intent = node.navIntent
    if (intent && typeof intent === 'object' && typeof intent.kind === 'string') {
      const kind = intent.kind
      if (kind === 'push' || kind === 'openSheet' || kind === 'back' || kind === 'toggleState') {
        if (!topLevel) results.push(node)
      }
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) findHoistable(c, results, false)
    }
  }

  function walk(node: any): void {
    if (!node || typeof node !== 'object') return
    if (node.type === 'TouchableOpacity') {
      const ownIntent = node.navIntent
      const ownIsHoistTarget =
        !ownIntent ||
        typeof ownIntent !== 'object' ||
        typeof ownIntent.kind !== 'string' ||
        ownIntent.kind === 'noop'

      if (ownIsHoistTarget) {
        const candidates: any[] = []
        findHoistable(node, candidates, true)
        if (candidates.length === 1) {
          node.navIntent = candidates[0].navIntent
          delete candidates[0].navIntent
          hoistCount++
        }
      }
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) walk(c)
    }
  }

  walk(tree)
  return hoistCount
}

export function validateNavIntents(tree: any, routeGraph: NavIntentRouteGraph): ValidateNavIntentsResult {
  const warnings: string[] = []

  // Package A.2: hoist stranded navIntents on inner elements up to the
  // wrapping TouchableOpacity BEFORE validation. Compound rows where the
  // model placed navIntent on an inner Text would otherwise be backfilled
  // to noop here and toast "Coming soon" at runtime.
  const hoisted = hoistInnerNavIntents(tree)
  if (hoisted > 0) {
    warnings.push(`[navIntent] hoisted ${hoisted} inner navIntent${hoisted === 1 ? '' : 's'} to outer TouchableOpacity wrappers`)
  }

  const screenIds = new Set<string>()
  const sheetIds = new Set<string>()
  for (const s of routeGraph?.screens ?? []) {
    if (!s || typeof s.id !== 'string') continue
    if (s.kind === 'modal') sheetIds.add(s.id)
    else screenIds.add(s.id)
  }

  function walk(node: any, path: string): void {
    if (!node || typeof node !== 'object') return
    if (node.type === 'TouchableOpacity') {
      const intent = node.navIntent
      if (!intent || typeof intent !== 'object' || typeof intent.kind !== 'string') {
        warnings.push(`[navIntent] missing on TouchableOpacity at ${path} — replacing with noop`)
        node.navIntent = { kind: 'noop', toastMessage: 'Coming soon' }
      } else if (intent.kind === 'push') {
        if (typeof intent.target !== 'string' || !screenIds.has(intent.target)) {
          warnings.push(`[navIntent] push target "${intent.target}" not in routeGraph at ${path} — replacing with noop`)
          node.navIntent = { kind: 'noop', toastMessage: 'Coming soon' }
        }
      } else if (intent.kind === 'openSheet') {
        if (typeof intent.target !== 'string' || !sheetIds.has(intent.target)) {
          warnings.push(`[navIntent] openSheet target "${intent.target}" not in routeGraph modals at ${path} — replacing with noop`)
          node.navIntent = { kind: 'noop', toastMessage: 'Coming soon' }
        }
      } else if (intent.kind === 'toggleState') {
        // Pure-visual filter-pill toggle (Workstream D). No routeGraph reference;
        // group + stateKey must both be non-empty strings, otherwise strip.
        if (typeof intent.group !== 'string' || intent.group.length === 0 ||
            typeof intent.stateKey !== 'string' || intent.stateKey.length === 0) {
          warnings.push(`[navIntent] toggleState missing group/stateKey at ${path} — replacing with noop`)
          node.navIntent = { kind: 'noop', toastMessage: 'Coming soon' }
        }
      } else if (intent.kind === 'back') {
        // Back chevron — no target needed. Allow through.
      } else if (intent.kind !== 'noop') {
        warnings.push(`[navIntent] unknown kind "${intent.kind}" at ${path} — replacing with noop`)
        node.navIntent = { kind: 'noop', toastMessage: 'Coming soon' }
      }
    }
    if (Array.isArray(node.children)) {
      for (let i = 0; i < node.children.length; i++) {
        const c = node.children[i]
        if (c && typeof c === 'object') walk(c, `${path}/${node.type ?? 'node'}[${i}]`)
      }
    }
  }

  walk(tree, '')

  if (routeGraph && Array.isArray(routeGraph.tabs) && routeGraph.tabs.length > 5) {
    warnings.push(`[validateNavIntents] routeGraph.tabs has ${routeGraph.tabs.length} entries — clamping to 5`)
    console.warn(`[validateNavIntents] tab overflow: clamping ${routeGraph.tabs.length} -> 5`)
    routeGraph.tabs = routeGraph.tabs.slice(0, 5)
  }

  if (warnings.length > 0) {
    console.warn(`[validateNavIntents] ${warnings.length} issue(s):`, warnings.slice(0, 10))
  }

  return { tree, warnings }
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
