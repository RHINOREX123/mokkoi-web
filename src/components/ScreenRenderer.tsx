import { useState, useEffect, useCallback } from 'react'
import type { ComponentNode } from '../types/mokkoi'
import { toMaterialSymbol, KNOWN_MATERIAL_SYMBOLS } from '../utils/iconMap'
import { getActivePillStateKey, type PillState } from '../runtime/state'

// === Workstream D: filter-pill toggleState rendering ===
// Module-scoped context for the current ScreenRenderer pass. Only one tree
// renders at a time inside the iframe runtime; safe to use module state.
// Reset on every ScreenRenderer invocation BEFORE renderNode walks the tree.
let currentPillState: PillState | undefined
let currentActiveScreenId: string | undefined
let currentGroupFirsts: Record<string, string> = {}

/** Pre-walk the tree once to record the first stateKey encountered per
 *  toggleState group. Used as the active fallback when pillState has no entry
 *  yet for that (screen, group), so a pill row never renders with all pills
 *  inactive. */
function collectGroupFirsts(node: ComponentNode | string | null | undefined, out: Record<string, string>): void {
  if (!node || typeof node === 'string' || typeof node !== 'object') return
  const intent = node.navIntent
  if (intent && intent.kind === 'toggleState') {
    if (!(intent.group in out)) out[intent.group] = intent.stateKey
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectGroupFirsts(child as ComponentNode, out)
  }
}

// Track icon names we've already warned about, so console.warn fires once per
// unknown name per session — feeds the "missing icon" backlog without spamming.
const warnedUnknownIcons = new Set<string>()

// --- Async image loader: calls /api/generate-image backend proxy ---
// Client-side cache so we don't re-fetch the same query on every re-render.
// Also exported so the Snack/Expo export path (snackUrl.ts) can reuse the
// real Pexels/Unsplash URL the canvas already resolved — eliminates the
// loremflickr mismatch where Expo Go showed a cat statue for "margherita
// pizza" while the canvas showed a real pizza photo.
export const imageCache = new Map<string, string>()

/** Look up any cached real image URL for a given search query, ignoring the
 * width/height suffix. The canvas caches as `${q}:${w}x${h}` but the Snack
 * exporter doesn't care about exact dims — Pexels/Unsplash CDN URLs are
 * responsive and will render at whatever size the phone draws them at. */
export function getCachedImageUrl(searchQuery: string): string | undefined {
  const needle = searchQuery.toLowerCase().trim()
  for (const [key, url] of imageCache) {
    if (key.toLowerCase().startsWith(needle + ':')) return url
  }
  return undefined
}

function ProxyImage({ searchQuery, width, height, style }: {
  searchQuery: string; width: number; height: number; style: React.CSSProperties
}) {
  const cacheKey = `${searchQuery}:${width}x${height}`
  const [src, setSrc] = useState(() => imageCache.get(cacheKey) || '')
  const [loading, setLoading] = useState(!imageCache.has(cacheKey))

  const fetchImage = useCallback(async () => {
    if (imageCache.has(cacheKey)) {
      setSrc(imageCache.get(cacheKey)!)
      setLoading(false)
      return
    }
    try {
      const res = await fetch(
        `/api/generate?action=image&query=${encodeURIComponent(searchQuery)}&width=${width}&height=${height}`
      )
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          imageCache.set(cacheKey, data.url)
          setSrc(data.url)
        }
      }
    } catch {
      // Fallback to LoremFlickr if backend is unreachable (dev mode, etc.)
      const keywords = searchQuery.split(/\s+/).slice(0, 3).join(',')
      const hash = Math.abs(searchQuery.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
      const fallback = `https://loremflickr.com/${width}/${height}/${encodeURIComponent(keywords)}?lock=${hash}`
      imageCache.set(cacheKey, fallback)
      setSrc(fallback)
    } finally {
      setLoading(false)
    }
  }, [cacheKey, searchQuery, width, height])

  useEffect(() => {
    if (!imageCache.has(cacheKey)) fetchImage()
  }, [cacheKey, fetchImage])

  if (loading || !src) {
    // Shimmer placeholder while loading
    return (
      <div
        style={{
          ...style,
          backgroundColor: '#1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: style.borderRadius ?? 8,
        }}
      >
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.08)',
          borderTopColor: 'rgba(129,140,248,0.5)',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      style={{ objectFit: 'cover', backgroundColor: '#1E293B', color: 'transparent', fontSize: 0, ...style }}
      onError={() => {
        // If the proxy URL also fails to render, fall back to LoremFlickr
        const keywords = searchQuery.split(/\s+/).slice(0, 3).join(',')
        const hash = Math.abs(searchQuery.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
        setSrc(`https://loremflickr.com/${width}/${height}/${encodeURIComponent(keywords)}?lock=${hash}`)
      }}
    />
  )
}


// --- Raw URI image rendering ---
// Trees imported from HTML (import-html flow) carry source.uri pointing at
// hot-linked external URLs (commonly lh3.googleusercontent.com/aida-public/...).
// Those URLs expire or 403 at scale, leaving broken-image icons. RawUriImage
// validates the URI, shows a brief shimmer on first paint, and on load failure
// degrades to a styled placeholder that fills the original slot dimensions —
// so a missing 300x200 hero looks intentional, not broken.
const warnedFailedImageUrls = new Set<string>()

function isValidImageUri(uri: unknown): uri is string {
  if (typeof uri !== 'string') return false
  const trimmed = uri.trim()
  if (!trimmed) return false
  return /^(https?:\/\/|data:image\/)/i.test(trimmed)
}

function ImagePlaceholder({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{
      ...style,
      backgroundColor: 'rgba(255,255,255,0.05)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderRadius: style.borderRadius ?? 8,
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="rgba(255,255,255,0.2)" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    </div>
  )
}

function RawUriImage({ uri, style }: { uri: string; style: React.CSSProperties }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (failed) return <ImagePlaceholder style={style} />

  return (
    <img
      src={uri}
      alt=""
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (!warnedFailedImageUrls.has(uri)) {
          warnedFailedImageUrls.add(uri)
          console.warn('[image] load failed:', uri)
        }
        setFailed(true)
      }}
      style={{
        objectFit: 'cover',
        backgroundColor: loaded ? 'transparent' : 'rgba(255,255,255,0.05)',
        color: 'transparent',
        fontSize: 0,
        ...style,
      }}
    />
  )
}


// Map React Native style properties to CSS equivalents
function rnStyleToCSS(style?: Record<string, unknown>): React.CSSProperties {
  if (!style) return {}

  const css: Record<string, unknown> = {}

  // Expand shorthands first so longhands can override
  if (style.margin !== undefined) {
    css.marginTop = style.margin
    css.marginRight = style.margin
    css.marginBottom = style.margin
    css.marginLeft = style.margin
  }
  if (style.padding !== undefined) {
    css.paddingTop = style.padding
    css.paddingRight = style.padding
    css.paddingBottom = style.padding
    css.paddingLeft = style.padding
  }

  for (const [key, value] of Object.entries(style)) {
    switch (key) {
      case 'margin':
      case 'padding':
        // Already expanded above
        break
      case 'paddingHorizontal':
        css.paddingLeft = value
        css.paddingRight = value
        break
      case 'paddingVertical':
        css.paddingTop = value
        css.paddingBottom = value
        break
      case 'marginHorizontal':
        css.marginLeft = value
        css.marginRight = value
        break
      case 'marginVertical':
        css.marginTop = value
        css.marginBottom = value
        break
      case 'lineHeight':
        // React Native lineHeight is in px. CSS unitless lineHeight is a multiplier.
        // lineHeight: 20 in RN = 20px. In CSS, 20 = 20x font-size = 280px with 14px font.
        // THIS WAS THE ROOT CAUSE OF ALL STRETCHED CHAT BUBBLES.
        css.lineHeight = typeof value === 'number' ? `${value}px` : value
        break
      default:
        css[key] = value
    }
  }

  // Default to flexbox column layout for View-like elements
  if (css.display === undefined && css.flex !== undefined) {
    css.display = 'flex'
  }

  return css as React.CSSProperties
}

// Base styles that mimic React Native defaults.
// In React Native, Views are flex containers but children size to their content.
// In web CSS, flex children can stretch to fill their parent — we prevent this
// with alignItems: 'stretch' (horizontal fill, same as RN) and let vertical
// stacking happen naturally via justify-content: flex-start (CSS default).
const VIEW_BASE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  boxSizing: 'border-box',
  minHeight: 0, // Prevents flex items from overflowing their parent
  minWidth: 0,  // Same for width
}

const TEXT_BASE: React.CSSProperties = {
  padding: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
  wordBreak: 'break-word',
}

// React Native keyboardType → HTML inputMode
function rnKeyboardTypeToInputMode(kt?: string): React.HTMLAttributes<HTMLElement>['inputMode'] | undefined {
  switch (kt) {
    case 'email-address': return 'email'
    case 'numeric': return 'numeric'
    case 'decimal-pad': return 'decimal'
    case 'phone-pad': return 'tel'
    case 'number-pad': return 'numeric'
    case 'url': return 'url'
    default: return undefined
  }
}

// Uncontrolled TextInput / textarea wrapper. Runtime is a preview, so AI's
// `value` becomes `defaultValue` — user can type freely, state lives in the
// DOM. On a fresh tree posted from the parent, React unmounts and remounts
// these inputs (different positions in the new tree), so input contents
// reset naturally — desired behavior for a preview.
function InteractiveTextInput({
  inputKey,
  value,
  placeholder,
  placeholderColor,
  isSecure,
  inputMode,
  multiline,
  style,
}: {
  inputKey: number
  value: string | undefined
  placeholder: string | undefined
  placeholderColor: string | undefined
  isSecure: boolean | undefined
  inputMode: React.HTMLAttributes<HTMLElement>['inputMode']
  multiline: boolean | undefined
  style: React.CSSProperties
}) {
  const inputId = `mokkoi-input-${inputKey}-${(placeholder || '').slice(0, 8)}`
  const styleBlock = (
    <style key={`${inputId}-style`}>{`
      #${inputId}::placeholder { ${placeholderColor ? `color: ${placeholderColor}; opacity: 1;` : ''} }
      #${inputId}:focus { box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.6); }
    `}</style>
  )
  const sharedStyle: React.CSSProperties = {
    ...VIEW_BASE,
    border: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    appearance: 'none',
    WebkitAppearance: 'none',
    background: 'transparent',
    color: 'inherit',
    ...style,
    borderStyle: (style.borderWidth && style.borderColor) ? 'solid' : undefined,
    borderWidth: style.borderColor ? style.borderWidth : undefined,
    backgroundColor: style.backgroundColor || 'transparent',
  }
  return (
    <span style={{ display: 'contents' }}>
      {styleBlock}
      {multiline ? (
        <textarea
          id={inputId}
          placeholder={placeholder}
          defaultValue={value}
          style={{ ...sharedStyle, resize: 'none' }}
        />
      ) : (
        <input
          id={inputId}
          type={isSecure ? 'password' : 'text'}
          placeholder={placeholder}
          defaultValue={value}
          inputMode={inputMode}
          style={sharedStyle}
        />
      )}
    </span>
  )
}

// Uncontrolled Switch — local state, flips on click and on Space/Enter for
// keyboard users. Resets to AI's initial value when React remounts the
// component (e.g. after a fresh tree from postMessage).
function InteractiveSwitch({
  initialOn,
  trackOn,
  trackOff,
  thumbColor,
  style,
}: {
  initialOn: boolean
  trackOn: string
  trackOff: string
  thumbColor: string
  style: React.CSSProperties
}) {
  const [on, setOn] = useState(initialOn)
  const toggle = useCallback(() => setOn(v => !v), [])
  return (
    <div
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          toggle()
        }
      }}
      style={{
        width: 51,
        height: 31,
        borderRadius: 16,
        backgroundColor: on ? trackOn : trackOff,
        padding: 2,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          width: 27,
          height: 27,
          borderRadius: 14,
          backgroundColor: thumbColor,
          transform: on ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  )
}

// Filter out prop-like junk strings the AI sometimes puts as children
// (e.g. "_HORIZONTAL", "true", "false", prop names starting with _)
// First alternation must NOT be case-insensitive — with /i it matches single-word
// capitalized labels like "Home"/"Entries"/"Calendar"/"Profile", silently
// stripping BottomNav tab text and breaking the runtime click classifier
// (which then falls back to the Material Symbols glyph name, e.g. "menu_book").
const JUNK_CHILD_RE = /^[_A-Z][_A-Z0-9]+$|^(true|false|null|undefined|horizontal|vertical)$/

// Subtree size of a generated chip — text label + maybe one icon. Cards/list
// rows have 5+ descendants. Used by isChipRowView below to spot horizontal
// chip rows that the AI emits as plain View+TouchableOpacity (no ScrollView),
// which then word-break on labels like "Beginner" into "Begi nner" when the
// row overflows the screen.
function shallowNodeSize(node: ComponentNode): number {
  let n = 1
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      if (typeof c === 'string') n += 1
      else if (c && typeof c === 'object') n += shallowNodeSize(c)
    }
  }
  return n
}

// Detects chip rows: a horizontal View whose direct children are 3+ small
// TouchableOpacity (or Pressable/Button) chips. Distinguishes from full card
// rows (size > 6) and from regular toolbars.
function isChipRowView(node: ComponentNode, style: React.CSSProperties): boolean {
  if (style.flexDirection !== 'row') return false
  const children = Array.isArray(node.children) ? node.children : []
  if (children.length < 3) return false
  let touchables = 0
  let chipLike = 0
  for (const c of children) {
    if (typeof c !== 'object' || c == null) continue
    const t = c.type
    if (t === 'TouchableOpacity' || t === 'Pressable' || t === 'Button') {
      touchables++
      if (shallowNodeSize(c) <= 6) chipLike++
    }
  }
  return touchables >= 3 && chipLike >= 3
}

function renderNode(node: ComponentNode | string, key: number): React.ReactNode {
  if (typeof node === 'string') {
    // Filter junk strings at every level, not just direct children
    if (!node.trim() || JUNK_CHILD_RE.test(node.trim())) return null
    return node
  }

  if (!node || typeof node !== 'object') {
    return null
  }

  const style = rnStyleToCSS(node.style)
  const filteredChildren = node.children?.filter(c =>
    typeof c !== 'string' || (c.trim().length > 0 && !JUNK_CHILD_RE.test(c.trim()))
  )
  const hasElementSiblings = filteredChildren?.some(c => typeof c !== 'string') ?? false
  const children = filteredChildren?.map((child, i) => {
    if (typeof child === 'string' && hasElementSiblings) {
      return <span key={`t${i}`}>{child}</span>
    }
    return renderNode(child, i)
  })

  switch (node.type) {
    case 'View':
    case 'SafeAreaView': {
      // Root View (key=0): constrain to parent height to prevent unbounded flex growth in web CSS
      const isRoot = key === 0 && style.flex === 1
      const rootOverrides: React.CSSProperties = isRoot
        ? { flex: 1, minHeight: '100%', overflow: 'hidden' }
        : {}
      // Chip-row override: AI emits horizontal filter chips as plain
      // flexDirection:row Views with no scroll wrapper; long labels wrap mid-
      // word ("Begi nner") when the row overflows. Force nowrap + horizontal
      // overflow + className so the global CSS (.mokkoi-chip-row) can hide
      // the scrollbar and pin children to flex-shrink:0 / nowrap text.
      const isChipRow = node.type === 'View' && !isRoot && isChipRowView(node, style)
      const chipRowOverrides: React.CSSProperties = isChipRow
        ? { flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none' }
        : {}
      return (
        <div
          key={key}
          className={isChipRow ? 'mokkoi-chip-row' : undefined}
          style={{ ...VIEW_BASE, ...style, ...rootOverrides, ...chipRowOverrides }}
        >
          {children}
        </div>
      )
    }

    case 'ScrollView': {
      const containerStyle = rnStyleToCSS(
        node.props?.contentContainerStyle as Record<string, unknown> | undefined
      )
      const isHorizontal = !!node.props?.horizontal
      // CRITICAL FIX for the "stretchy children" bug that has plagued Mokkoi:
      //
      // The outer div is a flex item (flex:1) that fills remaining screen height.
      // It uses overflow:auto to scroll when content exceeds that height.
      // It must NOT use display:flex — that makes the inner container a flex child
      // which stretches to fill the outer's height, then distributes that height
      // among its children (bubbles, cards, list items), creating giant blocks.
      //
      // Solution: outer uses display:flex only for sizing (flex:1), but the inner
      // container uses display:block so it sizes to its children naturally.
      // When content < scroll area: children stay at natural size, empty space below.
      // When content > scroll area: outer scrolls, children still at natural size.
      return (
        <div key={key} className="mokkoi-screen-scroll" style={{
          ...style,
          display: 'flex',
          flexDirection: 'column',
          overflow: isHorizontal ? 'hidden' : 'auto',
          overflowX: isHorizontal ? 'auto' : 'hidden',
          overflowY: isHorizontal ? 'hidden' : 'auto',
          flex: style.flex ?? 1,
          minHeight: 0,
          position: 'relative',
          boxSizing: 'border-box',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          overscrollBehavior: 'contain',
        }}>
          <div style={{
            ...containerStyle,
            display: 'flex',
            flexDirection: isHorizontal ? 'row' : 'column',
            ...(isHorizontal ? { flexWrap: 'nowrap' } : {}),
            // KEY: These prevent the inner container from stretching to fill the
            // scroll area. It sizes to its children instead.
            flexGrow: 0,
            flexShrink: 0,
          }}>
            {children}
          </div>
        </div>
      )
    }

    case 'Text': {
      const numberOfLines = node.props?.numberOfLines as number | undefined
      const clampStyle: React.CSSProperties = numberOfLines && numberOfLines >= 1
        ? {
            display: '-webkit-box',
            WebkitLineClamp: numberOfLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }
        : {}
      return (
        <span key={key} style={{ ...TEXT_BASE, ...style, ...clampStyle }}>
          {children}
        </span>
      )
    }

    case 'TextInput': {
      const placeholder = node.props?.placeholder as string | undefined
      const placeholderColor = node.props?.placeholderTextColor as string | undefined
      const isSecure = node.props?.secureTextEntry as boolean | undefined
      const value = node.props?.value as string | undefined
      const keyboardType = node.props?.keyboardType as string | undefined
      const multiline = node.props?.multiline as boolean | undefined
      return (
        <InteractiveTextInput
          key={key}
          inputKey={key}
          value={value}
          placeholder={placeholder}
          placeholderColor={placeholderColor}
          isSecure={isSecure}
          inputMode={rnKeyboardTypeToInputMode(keyboardType)}
          multiline={multiline}
          style={style}
        />
      )
    }

    case 'TouchableOpacity': {
      const navIntent = node.navIntent
      // Workstream D: toggleState pills render with active/inactive visual
      // differentiation. The active pill keeps full opacity; inactive pills
      // dim. Defaults to first pill in group if pillState has no entry yet.
      // Path only fires when navIntent.kind === 'toggleState' AND a pillState
      // is in scope — old screens with no toggleState renders untouched.
      let pillStyle: React.CSSProperties = {}
      if (
        navIntent &&
        navIntent.kind === 'toggleState' &&
        currentPillState &&
        currentActiveScreenId
      ) {
        const fallback = currentGroupFirsts[navIntent.group]
        const active = getActivePillStateKey(
          currentPillState,
          currentActiveScreenId,
          navIntent.group,
          fallback,
        )
        const isActive = active === navIntent.stateKey
        if (!isActive) {
          pillStyle = { opacity: 0.45 }
        }
      }
      return (
        <div
          key={key}
          className="mokkoi-touchable"
          style={{ ...VIEW_BASE, ...style, ...pillStyle, cursor: 'pointer' }}
          role="button"
          data-mokkoi-nav={navIntent ? JSON.stringify(navIntent) : undefined}
        >
          {children}
        </div>
      )
    }

    case 'Image': {
      const searchQuery = node.props?.searchQuery as string | undefined
      const source = node.props?.source as { uri: string } | undefined
      const avatar = node.props?.avatar as string | undefined


      if (avatar) {
        // Clean initial-letter avatar — use style dimensions (should be small circles)
        const avatarSize = typeof style.width === 'number' ? style.width : typeof style.height === 'number' ? style.height : 40
        const avatarStyle = (node.props?.avatarStyle as string) ?? 'initials'
        const src = `https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${encodeURIComponent(avatar)}&size=${avatarSize}&fontWeight=600&fontSize=40`
        return (
          <img key={key} src={src} alt={avatar} loading="lazy"
            style={{ objectFit: 'cover', backgroundColor: '#2A2A3E', ...style }} />
        )
      }

      if (searchQuery) {
        // Use backend proxy: FLUX AI → Pexels → LoremFlickr fallback
        const w = typeof style.width === 'number' ? Math.min(style.width, 400) : 200
        const h = typeof style.height === 'number' ? Math.min(style.height, 200) : 140
        return (
          <ProxyImage
            key={key}
            searchQuery={searchQuery}
            width={w}
            height={h}
            style={style}
          />
        )
      }

      if (source?.uri !== undefined) {
        if (!isValidImageUri(source.uri)) {
          // Empty / malformed / non-http URI — never request, render placeholder
          // that fills the original slot dimensions (not the small 48px fallback).
          return <ImagePlaceholder key={key} style={style} />
        }
        return <RawUriImage key={key} uri={source.uri.trim()} style={style} />
      }

      // No content source at all — render minimal placeholder, NOT a giant dark block
      // Cap at 48px to prevent layout damage from empty AI-generated Images
      const placeholderH = typeof style.height === 'number' ? Math.min(style.height, 48) : 48
      const placeholderW = typeof style.width === 'number' ? Math.min(style.width, 48) : 48
      const isCircle = style.borderRadius === 9999 || style.borderRadius === '50%'
      return (
        <div key={key} style={{
          ...style,
          width: isCircle ? placeholderH : placeholderW,
          height: placeholderH,
          backgroundColor: '#2A2A3E',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: style.borderRadius ?? 8,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="rgba(255,255,255,0.15)" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
      )
    }

    case 'ActivityIndicator': {
      const color = (node.props?.color as string) || style.color || '#818CF8'
      const size = node.props?.size === 'large' ? 36 : 20
      return (
        <div
          key={key}
          style={{
            ...VIEW_BASE,
            width: size,
            height: size,
            border: `3px solid transparent`,
            borderTopColor: color as string,
            borderRightColor: color as string,
            borderRadius: '50%',
            animation: 'mokkoi-spin 0.8s linear infinite',
            ...style,
          }}
        >
          <style>{`@keyframes mokkoi-spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )
    }

    case 'Switch': {
      const isOn = !!node.props?.value
      const trackOn = (node.props?.trackColor as Record<string, string>)?.true || '#34D399'
      const trackOff = (node.props?.trackColor as Record<string, string>)?.false || '#3F3F46'
      const thumbColor = (node.props?.thumbColor as string) || '#FFFFFF'
      return (
        <InteractiveSwitch
          key={key}
          initialOn={isOn}
          trackOn={trackOn}
          trackOff={trackOff}
          thumbColor={thumbColor}
          style={style}
        />
      )
    }

    case 'FlatList': {
      const containerStyle = rnStyleToCSS(
        node.props?.contentContainerStyle as Record<string, unknown> | undefined
      )
      const isHorizontal = !!node.props?.horizontal
      return (
        <div key={key} className="mokkoi-screen-scroll" style={{
          ...style,
          display: 'flex',
          flexDirection: 'column',
          overflow: isHorizontal ? 'hidden' : 'auto',
          overflowX: isHorizontal ? 'auto' : 'hidden',
          overflowY: isHorizontal ? 'hidden' : 'auto',
          flex: style.flex ?? 1,
          minHeight: 0,
          position: 'relative',
          boxSizing: 'border-box',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          overscrollBehavior: 'contain',
        }}>
          <div style={{
            ...containerStyle,
            display: 'flex',
            flexDirection: isHorizontal ? 'row' : 'column',
            ...(isHorizontal ? { flexWrap: 'nowrap' } : {}),
            flexGrow: 0,
            flexShrink: 0,
          }}>
            {children}
          </div>
        </div>
      )
    }

    // --- SVG Data Visualization Components ---
    case 'Svg': {
      const viewBox = node.props?.viewBox as string | undefined
      return (
        <svg key={key} viewBox={viewBox} style={style}>
          {children}
        </svg>
      )
    }

    case 'Circle': {
      const { cx, cy, r, fill, stroke, strokeWidth, strokeDasharray, strokeDashoffset, strokeLinecap } = (node.props ?? {}) as Record<string, any>
      return <circle key={key} cx={cx} cy={cy} r={r} fill={fill ?? 'none'} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} strokeLinecap={strokeLinecap} style={style} />
    }

    case 'Path': {
      const { d, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, strokeDasharray } = (node.props ?? {}) as Record<string, any>
      return <path key={key} d={d} fill={fill ?? 'none'} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} strokeDasharray={strokeDasharray} style={style} />
    }

    case 'Rect': {
      const { x, y, width, height, rx, ry, fill, stroke, strokeWidth } = (node.props ?? {}) as Record<string, any>
      return <rect key={key} x={x} y={y} width={width} height={height} rx={rx} ry={ry} fill={fill ?? 'none'} stroke={stroke} strokeWidth={strokeWidth} style={style} />
    }

    case 'Line': {
      const { x1, y1, x2, y2, stroke, strokeWidth, strokeLinecap } = (node.props ?? {}) as Record<string, any>
      return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} style={style} />
    }

    case 'Defs':
      return <defs key={key}>{children}</defs>

    case 'SvgLinearGradient': {
      const { id, x1, y1, x2, y2 } = (node.props ?? {}) as Record<string, any>
      return <linearGradient key={key} id={id} x1={x1} y1={y1} x2={x2} y2={y2}>{children}</linearGradient>
    }

    case 'Stop': {
      const { offset, stopColor, stopOpacity } = (node.props ?? {}) as Record<string, any>
      return <stop key={key} offset={offset} stopColor={stopColor} stopOpacity={stopOpacity} />
    }

    // --- Icon Component (Google Material Symbols font — instant, no network per icon) ---
    case 'Icon': {
      const rawName = (node.props?.name as string) ?? 'circle'
      const iconSize = (node.props?.size as number) ?? 24
      const iconColor = (node.props?.color as string) ?? '#FFFFFF'
      const filled = (node.props?.filled as boolean) ?? false

      // Normalize any icon name (Lucide kebab or Material snake) → Material Symbols glyph
      const materialName = toMaterialSymbol(rawName)
      const isKnown = KNOWN_MATERIAL_SYMBOLS.has(materialName)
      // Fallback: render a neutral 'circle' glyph at reduced opacity so missing
      // icons are visually distinct during UAT instead of leaking raw text
      // through the Material Symbols font.
      const renderedName = isKnown ? materialName : 'circle'
      if (!isKnown && !warnedUnknownIcons.has(rawName)) {
        warnedUnknownIcons.add(rawName)
        console.warn(`[Mokkoi] Unknown icon name: '${rawName}' (rendering fallback)`)
      }

      return (
        <span
          key={key}
          className="material-symbols-outlined"
          style={{
            fontSize: iconSize,
            color: iconColor,
            fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${iconSize}`,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: iconSize,
            height: iconSize,
            userSelect: 'none' as const,
            flexShrink: 0,
            opacity: isKnown ? undefined : 0.4,
            ...style,
          }}
        >
          {renderedName}
        </span>
      )
    }

    // --- LinearGradient Component ---
    case 'LinearGradient': {
      const colors = (node.props?.colors as string[]) ?? ['#6366F1', '#8B5CF6']
      const start = (node.props?.start as { x: number; y: number }) ?? { x: 0, y: 0 }
      const end = (node.props?.end as { x: number; y: number }) ?? { x: 0, y: 1 }
      const angle = Math.atan2(end.x - start.x, end.y - start.y) * (180 / Math.PI) + 180
      const gradientCSS = `linear-gradient(${angle}deg, ${colors.join(', ')})`
      return (
        <div key={key} style={{ ...VIEW_BASE, ...style, background: gradientCSS }}>
          {children}
        </div>
      )
    }

    default:
      // Treat unknown component types as View wrappers — render children normally
      // This handles macro components (StatCard, BottomNav, etc.) that weren't expanded
      return (
        <div key={key} style={{ ...VIEW_BASE, ...style }}>
          {children}
        </div>
      )
  }
}

interface ScreenRendererProps {
  tree: ComponentNode
  /** Workstream D: parent-held toggleState for filter pills, keyed
   *  by screenId then group. Optional — old call sites unaffected. */
  pillState?: PillState
  /** Workstream D: id of the screen this tree belongs to, so pill
   *  lookups can scope to the correct screen. Optional. */
  activeScreenId?: string
}

export function ScreenRenderer({ tree, pillState, activeScreenId }: ScreenRendererProps) {
  // Reset module context BEFORE walking. Pre-pass collects the first pill in
  // each toggleState group so renderNode can use it as the active fallback.
  currentPillState = pillState
  currentActiveScreenId = activeScreenId
  currentGroupFirsts = {}
  if (tree && pillState && activeScreenId) {
    collectGroupFirsts(tree, currentGroupFirsts)
  }

  if (!tree) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
        No screen data
      </div>
    )
  }
  return (
    <div style={{ width: '100%', maxWidth: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {renderNode(tree, 0)}
    </div>
  )
}
