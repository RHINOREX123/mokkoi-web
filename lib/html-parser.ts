/**
 * DOM-Level HTML-to-React Native Parser
 *
 * Deterministic conversion of HTML/Tailwind/React code to Mokkoi ComponentNode trees.
 * Zero external dependencies. Zero AI. 100% text preservation.
 *
 * Pipeline: HTML string → tokenize → build tree → convert nodes → ComponentNode tree
 */

// ============================================================
// TYPES
// ============================================================

interface HtmlNode {
  tag: string
  attributes: Record<string, string>
  children: (HtmlNode | string)[]
}

interface ComponentNode {
  type: string
  style?: Record<string, unknown>
  props?: Record<string, unknown>
  children?: (ComponentNode | string)[]
}

// ============================================================
// CONSTANTS
// ============================================================

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

const TEXT_TAGS = new Set([
  'p', 'span', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'a', 'strong', 'b', 'em', 'i', 'u', 'small', 'sub', 'sup',
  'code', 'pre', 'mark', 'del', 's', 'abbr', 'time', 'cite',
])

const HEADING_STYLES: Record<string, Record<string, unknown>> = {
  h1: { fontSize: 34, fontWeight: '700' },
  h2: { fontSize: 28, fontWeight: '700' },
  h3: { fontSize: 24, fontWeight: '600' },
  h4: { fontSize: 20, fontWeight: '600' },
  h5: { fontSize: 17, fontWeight: '600' },
  h6: { fontSize: 14, fontWeight: '600' },
}

// ============================================================
// TAILWIND COLOR PALETTE
// ============================================================

const TW_COLORS: Record<string, Record<string, string>> = {
  slate:   { 50:'#F8FAFC',100:'#F1F5F9',200:'#E2E8F0',300:'#CBD5E1',400:'#94A3B8',500:'#64748B',600:'#475569',700:'#334155',800:'#1E293B',900:'#0F172A',950:'#020617' },
  gray:    { 50:'#F9FAFB',100:'#F3F4F6',200:'#E5E7EB',300:'#D1D5DB',400:'#9CA3AF',500:'#6B7280',600:'#4B5563',700:'#374151',800:'#1F2937',900:'#111827',950:'#030712' },
  zinc:    { 50:'#FAFAFA',100:'#F4F4F5',200:'#E4E4E7',300:'#D4D4D8',400:'#A1A1AA',500:'#71717A',600:'#52525B',700:'#3F3F46',800:'#27272A',900:'#18181B',950:'#09090B' },
  neutral: { 50:'#FAFAFA',100:'#F5F5F5',200:'#E5E5E5',300:'#D4D4D4',400:'#A3A3A3',500:'#737373',600:'#525252',700:'#404040',800:'#262626',900:'#171717',950:'#0A0A0A' },
  red:     { 50:'#FEF2F2',100:'#FEE2E2',200:'#FECACA',300:'#FCA5A5',400:'#F87171',500:'#EF4444',600:'#DC2626',700:'#B91C1C',800:'#991B1B',900:'#7F1D1D',950:'#450A0A' },
  orange:  { 50:'#FFF7ED',100:'#FFEDD5',200:'#FED7AA',300:'#FDBA74',400:'#FB923C',500:'#F97316',600:'#EA580C',700:'#C2410C',800:'#9A3412',900:'#7C2D12',950:'#431407' },
  amber:   { 50:'#FFFBEB',100:'#FEF3C7',200:'#FDE68A',300:'#FCD34D',400:'#FBBF24',500:'#F59E0B',600:'#D97706',700:'#B45309',800:'#92400E',900:'#78350F',950:'#451A03' },
  yellow:  { 50:'#FEFCE8',100:'#FEF9C3',200:'#FEF08A',300:'#FDE047',400:'#FACC15',500:'#EAB308',600:'#CA8A04',700:'#A16207',800:'#854D0E',900:'#713F12',950:'#422006' },
  green:   { 50:'#F0FDF4',100:'#DCFCE7',200:'#BBF7D0',300:'#86EFAC',400:'#4ADE80',500:'#22C55E',600:'#16A34A',700:'#15803D',800:'#166534',900:'#14532D',950:'#052E16' },
  emerald: { 50:'#ECFDF5',100:'#D1FAE5',200:'#A7F3D0',300:'#6EE7B7',400:'#34D399',500:'#10B981',600:'#059669',700:'#047857',800:'#065F46',900:'#064E3B',950:'#022C22' },
  teal:    { 50:'#F0FDFA',100:'#CCFBF1',200:'#99F6E4',300:'#5EEAD4',400:'#2DD4BF',500:'#14B8A6',600:'#0D9488',700:'#0F766E',800:'#115E59',900:'#134E4A',950:'#042F2E' },
  cyan:    { 50:'#ECFEFF',100:'#CFFAFE',200:'#A5F3FC',300:'#67E8F9',400:'#22D3EE',500:'#06B6D4',600:'#0891B2',700:'#0E7490',800:'#155E75',900:'#164E63',950:'#083344' },
  blue:    { 50:'#EFF6FF',100:'#DBEAFE',200:'#BFDBFE',300:'#93C5FD',400:'#60A5FA',500:'#3B82F6',600:'#2563EB',700:'#1D4ED8',800:'#1E40AF',900:'#1E3A8A',950:'#172554' },
  indigo:  { 50:'#EEF2FF',100:'#E0E7FF',200:'#C7D2FE',300:'#A5B4FC',400:'#818CF8',500:'#6366F1',600:'#4F46E5',700:'#4338CA',800:'#3730A3',900:'#312E81',950:'#1E1B4B' },
  violet:  { 50:'#F5F3FF',100:'#EDE9FE',200:'#DDD6FE',300:'#C4B5FD',400:'#A78BFA',500:'#8B5CF6',600:'#7C3AED',700:'#6D28D9',800:'#5B21B6',900:'#4C1D95',950:'#2E1065' },
  purple:  { 50:'#FAF5FF',100:'#F3E8FF',200:'#E9D5FF',300:'#D8B4FE',400:'#C084FC',500:'#A855F7',600:'#9333EA',700:'#7E22CE',800:'#6B21A8',900:'#581C87',950:'#3B0764' },
  pink:    { 50:'#FDF2F8',100:'#FCE7F3',200:'#FBCFE8',300:'#F9A8D4',400:'#F472B6',500:'#EC4899',600:'#DB2777',700:'#BE185D',800:'#9D174D',900:'#831843',950:'#500724' },
  rose:    { 50:'#FFF1F2',100:'#FFE4E6',200:'#FECDD3',300:'#FDA4AF',400:'#FB7185',500:'#F43F5E',600:'#E11D48',700:'#BE123C',800:'#9F1239',900:'#881337',950:'#4C0519' },
}

// Tailwind spacing scale: class number → pixels
const TW_SPACING: Record<string, number> = {
  '0':0,'0.5':2,'1':4,'1.5':6,'2':8,'2.5':10,'3':12,'3.5':14,'4':16,'5':20,
  '6':24,'7':28,'8':32,'9':36,'10':40,'11':44,'12':48,'14':56,'16':64,'20':80,'24':96,
  '28':112,'32':128,'36':144,'40':160,'44':176,'48':192,'52':208,'56':224,'60':240,'64':256,
  '72':288,'80':320,'96':384,
  'px':1,
}

// Common tab icon name mappings
const TAB_ICON_MAP: Record<string, string> = {
  home: 'home', dashboard: 'home', feed: 'home',
  search: 'search', explore: 'search', discover: 'search', browse: 'search',
  favorites: 'favorite', favourite: 'favorite', heart: 'favorite', liked: 'favorite', wishlist: 'favorite',
  profile: 'person', account: 'person', me: 'person', user: 'person',
  cart: 'shopping_cart', bag: 'shopping_bag', basket: 'shopping_cart',
  settings: 'settings', gear: 'settings', preferences: 'settings',
  notifications: 'notifications', alerts: 'notifications', bell: 'notifications',
  messages: 'chat', chat: 'chat', inbox: 'mail',
  activity: 'monitoring', history: 'history', recent: 'history',
  wallet: 'account_balance_wallet', payment: 'payment', money: 'payments',
  orders: 'receipt', receipt: 'receipt',
  map: 'map', location: 'location_on', places: 'place',
  camera: 'camera_alt', photo: 'photo_camera',
  add: 'add', create: 'add', new: 'add',
  menu: 'menu', more: 'more_horiz',
  ride: 'directions_car', trips: 'directions_car', travel: 'flight',
}

// ============================================================
// STEP 1: HTML TOKENIZER + TREE BUILDER
// ============================================================

interface Token {
  type: 'open' | 'close' | 'text'
  tag?: string
  attributes?: Record<string, string>
  selfClosing?: boolean
  text?: string
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = []
  let cursor = 0

  // Pre-process: normalize JSX to HTML
  html = html.replace(/className=/g, 'class=')
  html = html.replace(/htmlFor=/g, 'for=')
  // Strip JSX expressions like {variable} or {condition && ...}
  html = html.replace(/\{[^{}]*\}/g, '')

  while (cursor < html.length) {
    // Skip comments
    if (html.startsWith('<!--', cursor)) {
      const end = html.indexOf('-->', cursor)
      cursor = end === -1 ? html.length : end + 3
      continue
    }

    // Skip DOCTYPE
    if (html.startsWith('<!DOCTYPE', cursor) || html.startsWith('<!doctype', cursor)) {
      const end = html.indexOf('>', cursor)
      cursor = end === -1 ? html.length : end + 1
      continue
    }

    // Close tag
    if (html.startsWith('</', cursor)) {
      const match = html.slice(cursor).match(/^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/)
      if (match) {
        tokens.push({ type: 'close', tag: match[1].toLowerCase() })
        cursor += match[0].length
        continue
      }
    }

    // Open tag
    if (html[cursor] === '<' && html[cursor + 1] !== '/') {
      const match = html.slice(cursor).match(/^<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*?)?)\s*(\/?)>/)
      if (match) {
        const tag = match[1].toLowerCase()
        const attrString = match[2] || ''
        const selfClosing = match[3] === '/' || VOID_ELEMENTS.has(tag)
        const attributes = parseAttributes(attrString)
        tokens.push({ type: 'open', tag, attributes, selfClosing })
        cursor += match[0].length
        continue
      }
    }

    // Text content
    const nextTag = html.indexOf('<', cursor + 1)
    const end = nextTag === -1 ? html.length : nextTag
    const text = html.slice(cursor, end)
    const trimmed = text.replace(/\s+/g, ' ')
    if (trimmed.trim()) {
      tokens.push({ type: 'text', text: trimmed.trim() })
    }
    cursor = end
  }

  return tokens
}

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const regex = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  let match
  while ((match = regex.exec(attrString)) !== null) {
    const key = match[1]
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    attrs[key] = value
  }
  return attrs
}

function buildTree(tokens: Token[]): HtmlNode {
  const root: HtmlNode = { tag: 'root', attributes: {}, children: [] }
  const stack: HtmlNode[] = [root]

  for (const token of tokens) {
    const parent = stack[stack.length - 1]

    if (token.type === 'text') {
      parent.children.push(token.text!)
    } else if (token.type === 'open') {
      const node: HtmlNode = { tag: token.tag!, attributes: token.attributes || {}, children: [] }
      parent.children.push(node)
      if (!token.selfClosing) {
        stack.push(node)
      }
    } else if (token.type === 'close') {
      // Pop back to matching open tag (tolerate mismatches)
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === token.tag) {
          stack.length = i
          break
        }
      }
    }
  }

  return root
}

// ============================================================
// STEP 2: TAILWIND-TO-STYLE CONVERTER
// ============================================================

function resolveTwColor(colorName: string, shade: string): string | null {
  const palette = TW_COLORS[colorName]
  if (!palette) return null
  return palette[shade] || null
}

function tailwindToStyle(classString: string): { style: Record<string, unknown>; isHidden: boolean } {
  const style: Record<string, unknown> = {}
  let isHidden = false

  if (!classString) return { style, isHidden }

  const classes = classString.split(/\s+/).filter(c => c.length > 0)

  for (const cls of classes) {
    // Skip responsive and state prefixes
    if (/^(sm|md|lg|xl|2xl|hover|focus|active|disabled|dark|group-hover|peer|focus-within|focus-visible|placeholder):/.test(cls)) continue

    // Strip negative prefix for margins
    const isNeg = cls.startsWith('-')
    const c = isNeg ? cls.slice(1) : cls

    // Display
    if (c === 'hidden') { isHidden = true; continue }
    if (c === 'block' || c === 'inline') continue
    if (c === 'flex') { style.display = 'flex'; continue }
    if (c === 'grid') { style.display = 'flex'; style.flexDirection = 'row'; style.flexWrap = 'wrap'; continue }

    // Flex
    if (c === 'flex-row') { style.flexDirection = 'row'; continue }
    if (c === 'flex-col') { style.flexDirection = 'column'; continue }
    if (c === 'flex-1') { style.flex = 1; continue }
    if (c === 'flex-none') { style.flex = 0; continue }
    if (c === 'flex-grow' || c === 'grow') { style.flexGrow = 1; continue }
    if (c === 'flex-shrink-0' || c === 'shrink-0') { style.flexShrink = 0; continue }
    if (c === 'flex-wrap') { style.flexWrap = 'wrap'; continue }

    // Alignment
    if (c === 'items-center') { style.alignItems = 'center'; continue }
    if (c === 'items-start') { style.alignItems = 'flex-start'; continue }
    if (c === 'items-end') { style.alignItems = 'flex-end'; continue }
    if (c === 'items-stretch') { style.alignItems = 'stretch'; continue }
    if (c === 'justify-center') { style.justifyContent = 'center'; continue }
    if (c === 'justify-between') { style.justifyContent = 'space-between'; continue }
    if (c === 'justify-around') { style.justifyContent = 'space-around'; continue }
    if (c === 'justify-start') { style.justifyContent = 'flex-start'; continue }
    if (c === 'justify-end') { style.justifyContent = 'flex-end'; continue }
    if (c === 'self-center') { style.alignSelf = 'center'; continue }
    if (c === 'self-end') { style.alignSelf = 'flex-end'; continue }
    if (c === 'self-start') { style.alignSelf = 'flex-start'; continue }

    // Sizing
    if (c === 'w-full') { style.width = '100%'; continue }
    if (c === 'h-full') { style.height = '100%'; continue }
    if (c === 'min-h-screen') { style.flex = 1; continue }
    if (c === 'aspect-square') { style.aspectRatio = 1; continue }
    if (c === 'aspect-video') { style.aspectRatio = 16 / 9; continue }
    if (c === 'aspect-auto') { continue }

    // Object fit (maps to resizeMode for Images)
    if (c === 'object-cover') { style.resizeMode = 'cover'; continue }
    if (c === 'object-contain') { style.resizeMode = 'contain'; continue }
    if (c === 'object-fill') { style.resizeMode = 'stretch'; continue }
    if (c === 'object-none') { style.resizeMode = 'center'; continue }

    // Overflow
    if (c === 'overflow-hidden') { style.overflow = 'hidden'; continue }
    if (c === 'overflow-scroll' || c === 'overflow-auto') { style.overflow = 'scroll'; continue }

    // Position
    if (c === 'relative') { style.position = 'relative'; continue }
    if (c === 'absolute') { style.position = 'absolute'; continue }
    if (c === 'fixed' || c === 'sticky') { style.position = 'absolute'; continue }
    if (c === 'inset-0') { style.top = 0; style.right = 0; style.bottom = 0; style.left = 0; continue }
    if (c === 'top-0') { style.top = 0; continue }
    if (c === 'bottom-0') { style.bottom = 0; continue }
    if (c === 'left-0') { style.left = 0; continue }
    if (c === 'right-0') { style.right = 0; continue }

    // Typography
    if (c === 'text-xs') { style.fontSize = 12; continue }
    if (c === 'text-sm') { style.fontSize = 14; continue }
    if (c === 'text-base') { style.fontSize = 16; continue }
    if (c === 'text-lg') { style.fontSize = 18; continue }
    if (c === 'text-xl') { style.fontSize = 20; continue }
    if (c === 'text-2xl') { style.fontSize = 24; continue }
    if (c === 'text-3xl') { style.fontSize = 28; continue }
    if (c === 'text-4xl') { style.fontSize = 34; continue }
    if (c === 'text-5xl') { style.fontSize = 48; continue }
    if (c === 'font-thin') { style.fontWeight = '100'; continue }
    if (c === 'font-light') { style.fontWeight = '300'; continue }
    if (c === 'font-normal') { style.fontWeight = '400'; continue }
    if (c === 'font-medium') { style.fontWeight = '500'; continue }
    if (c === 'font-semibold') { style.fontWeight = '600'; continue }
    if (c === 'font-bold') { style.fontWeight = '700'; continue }
    if (c === 'font-extrabold') { style.fontWeight = '800'; continue }
    if (c === 'text-center') { style.textAlign = 'center'; continue }
    if (c === 'text-left') { style.textAlign = 'left'; continue }
    if (c === 'text-right') { style.textAlign = 'right'; continue }
    if (c === 'uppercase') { style.textTransform = 'uppercase'; continue }
    if (c === 'lowercase') { style.textTransform = 'lowercase'; continue }
    if (c === 'capitalize') { style.textTransform = 'capitalize'; continue }
    if (c === 'italic') { style.fontStyle = 'italic'; continue }
    if (c === 'underline') { style.textDecorationLine = 'underline'; continue }
    if (c === 'line-through') { style.textDecorationLine = 'line-through'; continue }
    if (c === 'truncate') { style.overflow = 'hidden'; continue }
    if (c === 'leading-none') { style.lineHeight = 1; continue }
    if (c === 'leading-tight') { style.lineHeight = 1.25; continue }
    if (c === 'leading-normal') { style.lineHeight = 1.5; continue }
    if (c === 'leading-relaxed') { style.lineHeight = 1.625; continue }
    if (c === 'tracking-tighter') { style.letterSpacing = -0.8; continue }
    if (c === 'tracking-tight') { style.letterSpacing = -0.5; continue }
    if (c === 'tracking-normal') { style.letterSpacing = 0; continue }
    if (c === 'tracking-wide') { style.letterSpacing = 0.5; continue }
    if (c === 'tracking-wider') { style.letterSpacing = 1; continue }
    if (c === 'tracking-widest') { style.letterSpacing = 1.6; continue }
    if (c === 'leading-loose') { style.lineHeight = 2; continue }
    if (c === 'no-underline') { style.textDecorationLine = 'none'; continue }
    if (c === 'not-italic') { style.fontStyle = 'normal'; continue }

    // Border radius
    if (c === 'rounded-none') { style.borderRadius = 0; continue }
    if (c === 'rounded-sm') { style.borderRadius = 2; continue }
    if (c === 'rounded' || c === 'rounded-DEFAULT') { style.borderRadius = 4; continue }
    if (c === 'rounded-md') { style.borderRadius = 6; continue }
    if (c === 'rounded-lg') { style.borderRadius = 8; continue }
    if (c === 'rounded-xl') { style.borderRadius = 12; continue }
    if (c === 'rounded-2xl') { style.borderRadius = 16; continue }
    if (c === 'rounded-3xl') { style.borderRadius = 24; continue }
    if (c === 'rounded-full') { style.borderRadius = 9999; continue }

    // Borders
    if (c === 'border') { style.borderWidth = 1; continue }
    if (c === 'border-2') { style.borderWidth = 2; continue }
    if (c === 'border-4') { style.borderWidth = 4; continue }
    if (c === 'border-t') { style.borderTopWidth = 1; continue }
    if (c === 'border-b') { style.borderBottomWidth = 1; continue }
    if (c === 'border-l') { style.borderLeftWidth = 1; continue }
    if (c === 'border-r') { style.borderRightWidth = 1; continue }

    // Shadows
    if (c === 'shadow-sm') { style.shadowColor = '#000'; style.shadowOffset = { width: 0, height: 1 }; style.shadowOpacity = 0.05; style.shadowRadius = 2; style.elevation = 1; continue }
    if (c === 'shadow' || c === 'shadow-DEFAULT') { style.shadowColor = '#000'; style.shadowOffset = { width: 0, height: 1 }; style.shadowOpacity = 0.1; style.shadowRadius = 3; style.elevation = 3; continue }
    if (c === 'shadow-md') { style.shadowColor = '#000'; style.shadowOffset = { width: 0, height: 4 }; style.shadowOpacity = 0.1; style.shadowRadius = 6; style.elevation = 6; continue }
    if (c === 'shadow-lg') { style.shadowColor = '#000'; style.shadowOffset = { width: 0, height: 10 }; style.shadowOpacity = 0.1; style.shadowRadius = 15; style.elevation = 10; continue }
    if (c === 'shadow-xl') { style.shadowColor = '#000'; style.shadowOffset = { width: 0, height: 20 }; style.shadowOpacity = 0.1; style.shadowRadius = 25; style.elevation = 15; continue }
    if (c === 'shadow-2xl') { style.shadowColor = '#000'; style.shadowOffset = { width: 0, height: 25 }; style.shadowOpacity = 0.25; style.shadowRadius = 50; style.elevation = 20; continue }
    if (c === 'shadow-none') { style.shadowOpacity = 0; style.elevation = 0; continue }

    // Pointer events
    if (c === 'pointer-events-none') { style.pointerEvents = 'none'; continue }
    if (c === 'pointer-events-auto') { style.pointerEvents = 'auto'; continue }

    // Opacity
    const opacityMatch = c.match(/^opacity-(\d+)$/)
    if (opacityMatch) { style.opacity = parseInt(opacityMatch[1]) / 100; continue }

    // Z-index
    const zMatch = c.match(/^z-(\d+)$/)
    if (zMatch) { style.zIndex = parseInt(zMatch[1]); continue }

    // Spacing: p, px, py, pt, pb, pl, pr, m, mx, my, mt, mb, ml, mr, gap, space-x, space-y
    const spacingMatch = c.match(/^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-(.+)$/)
    if (spacingMatch) {
      const prop = spacingMatch[1]
      const val = TW_SPACING[spacingMatch[2]]
      if (val !== undefined) {
        const v = isNeg ? -val : val
        const mapping: Record<string, string[]> = {
          p: ['padding'], px: ['paddingHorizontal'], py: ['paddingVertical'],
          pt: ['paddingTop'], pb: ['paddingBottom'], pl: ['paddingLeft'], pr: ['paddingRight'],
          m: ['margin'], mx: ['marginHorizontal'], my: ['marginVertical'],
          mt: ['marginTop'], mb: ['marginBottom'], ml: ['marginLeft'], mr: ['marginRight'],
          gap: ['gap'], 'space-x': ['gap'], 'space-y': ['gap'],
        }
        for (const key of mapping[prop] || []) style[key] = v
        continue
      }
    }

    // Width/height with spacing scale
    const sizeMatch = c.match(/^(w|h|min-w|min-h|max-w|max-h)-(.+)$/)
    if (sizeMatch) {
      const prop = sizeMatch[1]
      const valStr = sizeMatch[2]
      const propMap: Record<string, string> = { w: 'width', h: 'height', 'min-w': 'minWidth', 'min-h': 'minHeight', 'max-w': 'maxWidth', 'max-h': 'maxHeight' }
      const rnProp = propMap[prop]
      if (rnProp) {
        if (valStr === 'full') { style[rnProp] = '100%'; continue }
        if (valStr === 'screen') { style[rnProp] = '100%'; continue }
        if (valStr === 'auto') { continue }
        if (TW_SPACING[valStr] !== undefined) { style[rnProp] = TW_SPACING[valStr]; continue }
        // Fractional widths
        const fracMatch = valStr.match(/^(\d+)\/(\d+)$/)
        if (fracMatch) { style[rnProp] = `${Math.round((parseInt(fracMatch[1]) / parseInt(fracMatch[2])) * 100)}%`; continue }
      }
    }

    // Colors: bg-{color}-{shade}, text-{color}-{shade}, border-{color}-{shade}
    const colorMatch = c.match(/^(bg|text|border|ring)-(white|black|transparent|current)$/) ||
                       c.match(/^(bg|text|border|ring)-(slate|gray|zinc|neutral|red|orange|amber|yellow|green|emerald|teal|cyan|blue|indigo|violet|purple|pink|rose)-(\d{2,3})$/)
    if (colorMatch) {
      const prefix = colorMatch[1]
      const colorName = colorMatch[2]
      const shade = colorMatch[3]
      let hex: string | null = null
      if (colorName === 'white') hex = '#FFFFFF'
      else if (colorName === 'black') hex = '#000000'
      else if (colorName === 'transparent') hex = 'transparent'
      else if (shade) hex = resolveTwColor(colorName, shade)
      if (hex) {
        if (prefix === 'bg') style.backgroundColor = hex
        else if (prefix === 'text') style.color = hex
        else if (prefix === 'border' || prefix === 'ring') style.borderColor = hex
        continue
      }
    }

    // Arbitrary color values: text-[#hex], bg-[#hex]
    const arbColorMatch = c.match(/^(bg|text|border)-\[([^\]]+)\]$/)
    if (arbColorMatch) {
      const prefix = arbColorMatch[1]
      const val = arbColorMatch[2]
      if (prefix === 'bg') style.backgroundColor = val
      else if (prefix === 'text') style.color = val
      else if (prefix === 'border') style.borderColor = val
      continue
    }

    // Arbitrary values: w-[200px], h-[44px], text-[14px], rounded-[12px], p-[16px], max-w-[300px], etc.
    const arbMatch = c.match(/^(w|h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|rounded|text|min-w|min-h|max-w|max-h|top|bottom|left|right)-\[(\d+)(?:px)?\]$/)
    if (arbMatch) {
      const prop = arbMatch[1]
      const val = parseInt(arbMatch[2])
      if (prop === 'w') style.width = val
      else if (prop === 'h') style.height = val
      else if (prop === 'rounded') style.borderRadius = val
      else if (prop === 'text') style.fontSize = val
      else if (prop === 'gap') style.gap = val
      else if (prop === 'p') style.padding = val
      else if (prop === 'px') style.paddingHorizontal = val
      else if (prop === 'py') style.paddingVertical = val
      else if (prop === 'pt') style.paddingTop = val
      else if (prop === 'pb') style.paddingBottom = val
      else if (prop === 'pl') style.paddingLeft = val
      else if (prop === 'pr') style.paddingRight = val
      else if (prop === 'm') style.margin = val
      else if (prop === 'mx') style.marginHorizontal = val
      else if (prop === 'my') style.marginVertical = val
      else if (prop === 'mt') style.marginTop = val
      else if (prop === 'mb') style.marginBottom = val
      else if (prop === 'ml') style.marginLeft = val
      else if (prop === 'mr') style.marginRight = val
      else if (prop === 'min-w') style.minWidth = val
      else if (prop === 'min-h') style.minHeight = val
      else if (prop === 'max-w') style.maxWidth = val
      else if (prop === 'max-h') style.maxHeight = val
      else if (prop === 'top') style.top = val
      else if (prop === 'bottom') style.bottom = val
      else if (prop === 'left') style.left = val
      else if (prop === 'right') style.right = val
      continue
    }

    // Arbitrary percentage values: w-[50%], max-w-[75%]
    const arbPctMatch = c.match(/^(w|h|min-w|min-h|max-w|max-h)-\[(\d+)%\]$/)
    if (arbPctMatch) {
      const propMap2: Record<string, string> = { w: 'width', h: 'height', 'min-w': 'minWidth', 'min-h': 'minHeight', 'max-w': 'maxWidth', 'max-h': 'maxHeight' }
      const rnProp2 = propMap2[arbPctMatch[1]]
      if (rnProp2) { style[rnProp2] = `${arbPctMatch[2]}%`; continue }
    }

    // Arbitrary leading (line-height): leading-[24px], leading-[1.5]
    const arbLeadingMatch = c.match(/^leading-\[(\d+(?:\.\d+)?)(?:px)?\]$/)
    if (arbLeadingMatch) {
      const val = parseFloat(arbLeadingMatch[1])
      // Values < 4 are multipliers, >= 4 are pixel values
      style.lineHeight = val < 4 ? val : val
      continue
    }

    // Arbitrary tracking (letter-spacing): tracking-[0.05em], tracking-[2px]
    const arbTrackingMatch = c.match(/^tracking-\[(-?\d+(?:\.\d+)?)(?:px|em)?\]$/)
    if (arbTrackingMatch) {
      style.letterSpacing = parseFloat(arbTrackingMatch[1])
      continue
    }
  }

  return { style, isHidden }
}

// ============================================================
// STEP 3: INLINE STYLE PARSER
// ============================================================

const CSS_NAMED_COLORS: Record<string, string> = {
  white: '#FFFFFF', black: '#000000', red: '#FF0000', blue: '#0000FF',
  green: '#008000', yellow: '#FFFF00', transparent: 'transparent',
}

function parseInlineStyle(styleStr: string): Record<string, unknown> {
  const style: Record<string, unknown> = {}
  if (!styleStr) return style

  const declarations = styleStr.split(';').filter(d => d.trim())
  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':')
    if (colonIdx === -1) continue
    const prop = decl.slice(0, colonIdx).trim()
    const val = decl.slice(colonIdx + 1).trim()

    // Convert CSS property to RN camelCase
    const rnProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

    // Parse value
    const numMatch = val.match(/^(-?\d+(?:\.\d+)?)\s*(?:px|rem|em)?$/)
    if (numMatch) {
      let num = parseFloat(numMatch[1])
      if (val.includes('rem')) num *= 16
      else if (val.includes('em')) num *= 16
      style[rnProp] = num
      continue
    }

    // Color values
    if (val.startsWith('#') || val.startsWith('rgb') || val.startsWith('hsl')) {
      style[rnProp] = val
      continue
    }
    if (CSS_NAMED_COLORS[val]) {
      style[rnProp] = CSS_NAMED_COLORS[val]
      continue
    }

    // Special mappings
    if (rnProp === 'position' && val === 'fixed') { style.position = 'absolute'; continue }
    if (rnProp === 'position' && val === 'sticky') { style.position = 'absolute'; continue }
    if (rnProp === 'display' && val === 'none') { continue } // skip hidden
    if (rnProp === 'textDecoration') { style.textDecorationLine = val; continue }

    // String values (center, flex-start, etc.)
    style[rnProp] = val
  }

  return style
}

// ============================================================
// STEP 4: PATTERN DETECTORS
// ============================================================

function detectBottomNav(node: HtmlNode): ComponentNode | null {
  // A nav element at the bottom with 3-5 button-like children
  if (node.tag !== 'nav' && !hasClass(node, 'nav') && !hasClass(node, 'tab-bar') && !hasClass(node, 'bottom-nav')) return null

  // Check for bottom positioning
  const cls = node.attributes.class || ''
  const sty = node.attributes.style || ''
  const isBottom = cls.includes('bottom') || cls.includes('fixed') || cls.includes('sticky') ||
                   sty.includes('bottom') || sty.includes('fixed')

  if (!isBottom && node.tag !== 'nav') return null

  // Extract nav items
  const items: Array<{ icon: string; label: string; active: boolean }> = []
  const extractItems = (n: HtmlNode) => {
    for (const child of n.children) {
      if (typeof child === 'string') continue
      if (child.tag === 'button' || child.tag === 'a' || child.tag === 'div') {
        const texts: string[] = []
        const collectText = (nd: HtmlNode | string) => {
          if (typeof nd === 'string') { texts.push(nd.trim()); return }
          // Check for material icon
          if (hasClass(nd, 'material-symbols') || hasClass(nd, 'material-icons')) {
            const iconText = getTextContent(nd).trim()
            if (iconText) texts.push(`__icon__${iconText}`)
            return
          }
          for (const c of nd.children) collectText(c)
        }
        collectText(child)
        const iconText = texts.find(t => t.startsWith('__icon__'))?.replace('__icon__', '') || ''
        const label = texts.filter(t => !t.startsWith('__icon__')).join(' ').trim()
        if (label || iconText) {
          const isActive = hasClass(child, 'active') || hasClass(child, 'selected') || hasClass(child, 'current')
          const iconName = iconText || TAB_ICON_MAP[label.toLowerCase()] || 'circle'
          items.push({ icon: iconName, label: label || iconText, active: isActive })
        }
      } else {
        extractItems(child)
      }
    }
  }
  extractItems(node)

  if (items.length >= 2 && items.length <= 6) {
    // Ensure at least one is active
    if (!items.some(i => i.active)) items[0].active = true
    return { type: 'BottomNav', props: { items } }
  }

  return null
}

function detectIcon(node: HtmlNode): ComponentNode | null {
  const cls = node.attributes.class || ''
  if (cls.includes('material-symbols') || cls.includes('material-icons')) {
    const name = getTextContent(node).trim().replace(/ /g, '_')
    if (name) {
      const { style } = tailwindToStyle(cls)
      return { type: 'Icon', props: { name, size: 20, color: (style.color as string) || '#FFFFFF' } }
    }
  }
  return null
}

// ============================================================
// STEP 5: MAIN CONVERTER
// ============================================================

function hasClass(node: HtmlNode, cls: string): boolean {
  return (node.attributes.class || '').includes(cls)
}

function getTextContent(node: HtmlNode | string): string {
  if (typeof node === 'string') return node
  return node.children.map(c => getTextContent(c)).join('')
}

function convertNode(node: HtmlNode | string, depth: number = 0): ComponentNode | string | null {
  if (typeof node === 'string') {
    return node.trim() || null
  }

  // Skip hidden elements
  const { style: twStyle, isHidden } = tailwindToStyle(node.attributes.class || '')
  if (isHidden) return null

  // Skip script, style, head, meta, link
  if (['script', 'style', 'head', 'meta', 'link', 'noscript'].includes(node.tag)) return null

  // Check for icon
  const icon = detectIcon(node)
  if (icon) return icon

  // Check for bottom nav
  const bottomNav = detectBottomNav(node)
  if (bottomNav) return bottomNav

  // Parse inline style
  const inlineStyle = parseInlineStyle(node.attributes.style || '')
  const mergedStyle = { ...twStyle, ...inlineStyle }

  // Handle specific tags
  const tag = node.tag

  // Image
  if (tag === 'img') {
    const src = node.attributes.src || ''
    const alt = node.attributes.alt || ''
    const imgStyle = { ...mergedStyle }
    if (!imgStyle.width) imgStyle.width = '100%'
    if (!imgStyle.height) imgStyle.height = 200
    if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
      return { type: 'Image', style: imgStyle, props: { source: { uri: src } } }
    }
    // Use alt as searchQuery for placeholder
    return { type: 'Image', style: imgStyle, props: { searchQuery: alt || 'placeholder image' } }
  }

  // Input
  if (tag === 'input' || tag === 'textarea') {
    const inputType = node.attributes.type || 'text'
    const placeholder = node.attributes.placeholder || ''
    const inputStyle = {
      height: 48, borderRadius: 12, paddingHorizontal: 16,
      fontSize: 14, color: '#FFFFFF', backgroundColor: '#1E293B',
      ...mergedStyle,
    }
    return {
      type: 'TextInput',
      style: inputStyle,
      props: {
        placeholder,
        placeholderTextColor: '#64748B',
        ...(inputType === 'password' ? { secureTextEntry: true } : {}),
        ...(tag === 'textarea' ? { multiline: true } : {}),
      },
    }
  }

  // HR → Divider
  if (tag === 'hr') {
    return { type: 'Divider' }
  }

  // SVG → approximate with View
  if (tag === 'svg') {
    const svgStyle = { ...mergedStyle }
    if (!svgStyle.width) svgStyle.width = 24
    if (!svgStyle.height) svgStyle.height = 24
    return { type: 'View', style: svgStyle }
  }

  // Convert children
  const children: (ComponentNode | string)[] = []
  for (const child of node.children) {
    const converted = convertNode(child, depth + 1)
    if (converted !== null) {
      children.push(converted)
    }
  }

  // Determine component type
  let type: string
  if (TEXT_TAGS.has(tag)) {
    type = 'Text'
  } else if (tag === 'button' || (tag === 'a' && !isInlineLink(node))) {
    type = 'TouchableOpacity'
  } else if (tag === 'select') {
    type = 'TouchableOpacity'
  } else {
    type = 'View'
  }

  // Apply heading defaults
  if (HEADING_STYLES[tag]) {
    Object.assign(mergedStyle, { ...HEADING_STYLES[tag], ...mergedStyle })
  }

  // Text nodes: ensure children are strings or nested Text
  if (type === 'Text') {
    // Flatten simple text
    const textChildren = children.filter(c => c !== null)
    if (textChildren.length === 0) return null
    return { type: 'Text', style: mergedStyle, children: textChildren }
  }

  // TouchableOpacity: wrap string children in Text
  if (type === 'TouchableOpacity') {
    const wrapped = wrapStringsInText(children)
    if (wrapped.length === 0) return null
    return { type: 'TouchableOpacity', style: mergedStyle, children: wrapped }
  }

  // View: wrap string children in Text
  if (type === 'View') {
    const wrapped = wrapStringsInText(children)
    if (wrapped.length === 0 && !Object.keys(mergedStyle).length) return null
    return { type: 'View', style: mergedStyle, children: wrapped.length > 0 ? wrapped : undefined }
  }

  return { type, style: mergedStyle, children: children.length > 0 ? children : undefined }
}

function isInlineLink(node: HtmlNode): boolean {
  // An <a> inside text content should be Text, standalone should be TouchableOpacity
  return false // simplified — treat all links as TouchableOpacity
}

function wrapStringsInText(children: (ComponentNode | string)[]): (ComponentNode | string)[] {
  return children.map(child => {
    if (typeof child === 'string') {
      return { type: 'Text', style: { color: '#FFFFFF' }, children: [child] }
    }
    return child
  })
}

// ============================================================
// STEP 6: EXPORTS
// ============================================================

export function shouldUseDomParser(code: string, detected: { type: string; hasTailwind?: boolean }): boolean {
  // Use parser for standard HTML and Tailwind
  if (!['html', 'tailwind-html', 'react-jsx', 'react-tsx'].includes(detected.type)) return false
  // Skip if too large (AI handles better with summarization)
  if (code.length > 30000) return false
  // Skip if styled-components or CSS-in-JS
  if (code.includes('styled.') || code.includes('css`') || code.includes('emotion')) return false
  return true
}

/**
 * Post-process the tree to fix layout issues:
 * 1. Convert position:absolute to normal flex flow (absolute positioning
 *    in phone frames causes content to overlap and disappear)
 * 2. Remove empty Views (no children, no meaningful style)
 * 3. Flatten unnecessary single-child wrappers
 */
function postProcess(node: ComponentNode): ComponentNode {
  if (!node || typeof node === 'string') return node

  // Process children first (bottom-up)
  if (Array.isArray(node.children)) {
    node.children = node.children
      .map(child => typeof child === 'string' ? child : postProcess(child))
      .filter(child => {
        if (typeof child === 'string') return child.trim().length > 0
        // Remove empty Views with no children and no visual style
        if (child.type === 'View' && (!child.children || child.children.length === 0)) {
          const s = child.style || {}
          const hasVisual = s.backgroundColor || s.borderWidth || s.borderColor ||
            s.width || s.height || s.borderRadius
          return !!hasVisual
        }
        return true
      })
  }

  // Convert position:absolute to normal flow
  // In web, absolute positioning is common for overlays/headers/footers
  // In mobile phone frames, everything should be in normal flex flow
  if (node.style?.position === 'absolute') {
    delete node.style.position
    delete node.style.top
    delete node.style.right
    delete node.style.bottom
    delete node.style.left
    delete node.style.inset
    // Keep zIndex for visual layering context but remove it too (flex handles order)
    delete node.style.zIndex
  }

  // Remove overflow:hidden on containers (causes clipping in phone frames)
  if (node.style?.overflow === 'hidden' && node.type === 'View') {
    delete node.style.overflow
  }

  // Flatten single-child View wrappers that add no style
  if (node.type === 'View' && node.children?.length === 1 && typeof node.children[0] !== 'string') {
    const child = node.children[0] as ComponentNode
    const styleKeys = Object.keys(node.style || {})
    if (styleKeys.length === 0 || (styleKeys.length === 1 && styleKeys[0] === 'display')) {
      return child
    }
  }

  return node
}

export function parseHtmlToComponentTree(html: string): ComponentNode {
  // Tokenize
  const tokens = tokenize(html)
  // Build tree
  const tree = buildTree(tokens)
  // Convert to ComponentNode tree
  const children: (ComponentNode | string)[] = []
  for (const child of tree.children) {
    const converted = convertNode(child)
    if (converted !== null) children.push(converted)
  }

  // Build root
  let root: ComponentNode
  if (children.length === 1 && typeof children[0] !== 'string') {
    root = children[0] as ComponentNode
  } else {
    root = {
      type: 'View',
      style: {},
      children: children as ComponentNode[],
    }
  }

  // Post-process: fix absolute positioning, remove empties, flatten wrappers
  root = postProcess(root)

  // Ensure root has proper mobile screen defaults
  if (!root.style) root.style = {}
  if (!root.style.flex) root.style.flex = 1
  if (!root.style.backgroundColor) root.style.backgroundColor = '#0F172A'
  if (!root.style.paddingTop) root.style.paddingTop = 54

  return root
}
