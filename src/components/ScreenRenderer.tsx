import { useState, useEffect, useCallback } from 'react'
import type { ComponentNode } from '../types/mokkoi'

// --- Async image loader: calls /api/generate-image backend proxy ---
// Client-side cache so we don't re-fetch the same query on every re-render
const imageCache = new Map<string, string>()

function ProxyImage({ searchQuery, width, height, alt, style }: {
  searchQuery: string; width: number; height: number; alt: string; style: React.CSSProperties
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
      alt={alt}
      loading="lazy"
      style={{ objectFit: 'cover', backgroundColor: '#1E293B', ...style }}
      onError={() => {
        // If the proxy URL also fails to render, fall back to LoremFlickr
        const keywords = searchQuery.split(/\s+/).slice(0, 3).join(',')
        const hash = Math.abs(searchQuery.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
        setSrc(`https://loremflickr.com/${width}/${height}/${encodeURIComponent(keywords)}?lock=${hash}`)
      }}
    />
  )
}

// Map Lucide-style icon names → Google Material Symbols names.
// If the AI outputs a Material Symbols name directly, it passes through (via ?? iconName fallback).
// This map ensures backward compatibility with our Lucide-based examples.
const MATERIAL_SYMBOL_MAP: Record<string, string> = {
  // Lucide name → Material Symbols name
  'heart': 'favorite',
  'home': 'home',
  'search': 'search',
  'settings': 'settings',
  'bell': 'notifications',
  'user': 'person',
  'mail': 'mail',
  'star': 'star',
  'check': 'check',
  'x': 'close',
  'plus': 'add',
  'minus': 'remove',
  'chevron-right': 'chevron_right',
  'chevron-left': 'chevron_left',
  'chevron-down': 'expand_more',
  'chevron-up': 'expand_less',
  'arrow-left': 'arrow_back',
  'arrow-right': 'arrow_forward',
  'arrow-up': 'arrow_upward',
  'arrow-down': 'arrow_downward',
  'menu': 'menu',
  'clock': 'schedule',
  'calendar': 'calendar_today',
  'camera': 'photo_camera',
  'phone': 'phone',
  'map-pin': 'location_on',
  'eye': 'visibility',
  'lock': 'lock',
  'unlock': 'lock_open',
  'share': 'share',
  'download': 'download',
  'upload': 'upload',
  'trash': 'delete',
  'edit': 'edit',
  'copy': 'content_copy',
  'play': 'play_arrow',
  'pause': 'pause',
  'skip-forward': 'skip_next',
  'skip-back': 'skip_previous',
  'volume-2': 'volume_up',
  'wifi': 'wifi',
  'battery': 'battery_full',
  'send': 'send',
  'image': 'image',
  'shopping-cart': 'shopping_cart',
  'filter': 'filter_list',
  'bookmark': 'bookmark',
  'globe': 'language',
  'trending-up': 'trending_up',
  'trending-down': 'trending_down',
  'zap': 'bolt',
  'activity': 'monitoring',
  'music': 'music_note',
  'video': 'videocam',
  'mic': 'mic',
  'sun': 'light_mode',
  'moon': 'dark_mode',
  'cloud': 'cloud',
  'droplet': 'water_drop',
  'wind': 'air',
  'thermometer': 'thermostat',
  'navigation': 'navigation',
  'refresh': 'refresh',
  'info': 'info',
  'help': 'help',
  'alert': 'warning',
  'shield': 'shield',
  'credit-card': 'credit_card',
  'wallet': 'wallet',
  'receipt': 'receipt',
  'bar-chart': 'bar_chart',
  'pie-chart': 'pie_chart',
  'layers': 'layers',
  'grid': 'grid_view',
  'list': 'list',
  'folder': 'folder',
  'file': 'description',
  'link': 'link',
  'qr-code': 'qr_code',
  'fingerprint': 'fingerprint',
  'flash': 'flash_on',
  'gift': 'redeem',
  'tag': 'label',
  'flag': 'flag',
  'pin': 'push_pin',
  'compass': 'explore',
  'target': 'track_changes',
  'award': 'emoji_events',
  'trophy': 'emoji_events',
  'fire': 'local_fire_department',
  'restaurant': 'restaurant',
  'coffee': 'coffee',
  'cart': 'shopping_cart',
  'bag': 'shopping_bag',
  'truck': 'local_shipping',
  'airplane': 'flight',
  'hotel': 'hotel',
  'car': 'directions_car',
  'bike': 'directions_bike',
  'walk': 'directions_walk',
  'run': 'directions_run',
  'fitness': 'fitness_center',
  'spa': 'spa',
  'medical': 'medical_services',
  'pill': 'medication',
  'school': 'school',
  'book': 'menu_book',
  'graduation': 'school',
  'work': 'work',
  'briefcase': 'work',
  'building': 'apartment',
  'house': 'house',
  'key': 'key',
  'scan': 'qr_code_scanner',
  'chat': 'chat',
  'message': 'message',
  'group': 'group',
  'add-user': 'person_add',
  'thumb-up': 'thumb_up',
  'thumb-down': 'thumb_down',
  'more-horizontal': 'more_horiz',
  'more-vertical': 'more_vert',
  'external-link': 'open_in_new',
  'log-out': 'logout',
  'log-in': 'login',
  'power': 'power_settings_new',
  'palette': 'palette',
  'brush': 'brush',
  'crop': 'crop',
  'tune': 'tune',
  'equalizer': 'equalizer',
  'headphones': 'headphones',
  'speaker': 'speaker',
  'radio': 'radio',
  'podcast': 'podcasts',
  'gamepad': 'sports_esports',
  'savings': 'savings',
  'analytics': 'analytics',
  'dashboard': 'dashboard',
  'timeline': 'timeline',
  'timer': 'timer',
  'stopwatch': 'timer',
  'alarm': 'alarm',
  'code': 'code',
  'terminal': 'terminal',
  'database': 'storage',
  'server': 'dns',
  'percent': 'percent',
  'attach': 'attach_file',
  'paperclip': 'attach_file',
  // Extra Lucide names the AI commonly generates
  'utensils': 'restaurant',
  'droplets': 'water_drop',
  'flame': 'local_fire_department',
  'dumbbell': 'fitness_center',
  'footprints': 'directions_walk',
  'glass-water': 'local_drink',
  'cloud-rain': 'rainy',
  'cloud-sun': 'partly_cloudy_day',
  'snowflake': 'ac_unit',
  'mountain': 'terrain',
  'leaf': 'eco',
  'sprout': 'yard',
  'circle-check': 'check_circle',
  'circle-x': 'cancel',
  'circle-alert': 'error',
  'circle-help': 'help',
  'circle-user': 'account_circle',
  'circle-plus': 'add_circle',
  'layout-dashboard': 'dashboard',
  'bar-chart-2': 'bar_chart',
  'trash-2': 'delete',
  'user-plus': 'person_add',
  'users': 'group',
  'message-circle': 'chat_bubble',
  'message-square': 'chat',
  'thumbs-up': 'thumb_up',
  'thumbs-down': 'thumb_down',
  'building-2': 'apartment',
  'plane': 'flight',
  'graduation-cap': 'school',
  'piggy-bank': 'savings',
  'banknote': 'payments',
  'coins': 'toll',
  'package': 'inventory_2',
  'box': 'inventory_2',
  'map': 'map',
  'navigation-2': 'navigation',
  'locate': 'my_location',
  'crosshair': 'gps_fixed',
  'baby': 'child_care',
  'smile': 'sentiment_satisfied',
  'frown': 'sentiment_dissatisfied',
  'repeat': 'repeat',
  'shuffle': 'shuffle',
  'volume': 'volume_up',
  'volume-1': 'volume_down',
  'volume-x': 'volume_off',
  'maximize': 'fullscreen',
  'minimize': 'fullscreen_exit',
  'external': 'open_in_new',
  'flower-2': 'spa',
  'heart-pulse': 'monitor_heart',
  'stethoscope': 'stethoscope',
  'syringe': 'vaccines',
  'apple': 'nutrition',
  'salad': 'restaurant',
  'pizza': 'local_pizza',
  'soup': 'soup_kitchen',
  'beer': 'sports_bar',
  'wine': 'wine_bar',
  'candy': 'cake',
  'cookie': 'cookie',
  'shirt': 'checkroom',
  'watch': 'watch',
  'glasses': 'visibility',
  'lamp': 'light',
  'bed': 'bed',
  'bath': 'bathtub',
  'shower': 'shower',
  'wifi-off': 'wifi_off',
  'bluetooth': 'bluetooth',
  'battery-charging': 'battery_charging_full',
  'battery-low': 'battery_alert',
  'signal': 'signal_cellular_alt',
  'rocket': 'rocket_launch',
  'sparkles': 'auto_awesome',
  'wand': 'auto_fix_high',
  'brain': 'psychology',
  'lightbulb': 'lightbulb',
  'gem': 'diamond',
  'crown': 'workspace_premium',
}

// Reverse map: Material Symbols name → Lucide name (auto-generated from above)
const LUCIDE_NAME_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(MATERIAL_SYMBOL_MAP).map(([lucide, material]) => [material, lucide])
)
// Add extra Material Symbols → Lucide mappings that don't have a 1:1 reverse
Object.assign(LUCIDE_NAME_MAP, {
  'local_fire_department': 'flame',
  'directions_run': 'activity',
  'directions_walk': 'activity',
  'directions_bike': 'bike',
  'directions_car': 'car',
  'monitoring': 'activity',
  'fitness_center': 'dumbbell',
  'water_drop': 'droplets',
  'bolt': 'zap',
  'notifications': 'bell',
  'person': 'user',
  'favorite': 'heart',
  'play_arrow': 'play',
  'skip_next': 'skip-forward',
  'skip_previous': 'skip-back',
  'volume_up': 'volume-2',
  'shopping_cart': 'shopping-cart',
  'trending_up': 'trending-up',
  'trending_down': 'trending-down',
  'arrow_back': 'arrow-left',
  'arrow_forward': 'arrow-right',
  'arrow_upward': 'arrow-up',
  'arrow_downward': 'arrow-down',
  'chevron_right': 'chevron-right',
  'chevron_left': 'chevron-left',
  'expand_more': 'chevron-down',
  'expand_less': 'chevron-up',
  'schedule': 'clock',
  'calendar_today': 'calendar',
  'photo_camera': 'camera',
  'location_on': 'map-pin',
  'visibility': 'eye',
  'lock_open': 'unlock',
  'content_copy': 'copy',
  'delete': 'trash-2',
  'filter_list': 'filter',
  'language': 'globe',
  'more_horiz': 'more-horizontal',
  'more_vert': 'more-vertical',
  'open_in_new': 'external-link',
  'credit_card': 'credit-card',
  'attach_file': 'paperclip',
  'music_note': 'music',
  'light_mode': 'sun',
  'dark_mode': 'moon',
  'local_shipping': 'truck',
  'bar_chart': 'bar-chart-2',
  'pie_chart': 'pie-chart',
  'emoji_events': 'trophy',
  'menu_book': 'book',
  'medical_services': 'pill',
  'sports_esports': 'gamepad',
  'spa': 'flower-2',
  'apartment': 'building-2',
  'qr_code': 'qr-code',
  'qr_code_scanner': 'scan',
  'power_settings_new': 'power',
  'message': 'message-circle',
  'thumb_up': 'thumbs-up',
  'thumb_down': 'thumbs-down',
  'person_add': 'user-plus',
})

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

// Base styles that mimic React Native defaults
const VIEW_BASE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  boxSizing: 'border-box',
}

const TEXT_BASE: React.CSSProperties = {
  padding: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
  wordBreak: 'break-word',
}

// Filter out prop-like junk strings the AI sometimes puts as children
// (e.g. "_HORIZONTAL", "true", "false", prop names starting with _)
const JUNK_CHILD_RE = /^[_A-Z][_A-Z0-9]+$|^(true|false|null|undefined|horizontal|vertical)$/i

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
        ? { flex: 1, minHeight: 0, overflow: 'hidden' }
        : {}
      return (
        <div key={key} style={{ ...VIEW_BASE, ...style, ...rootOverrides }}>
          {children}
        </div>
      )
    }

    case 'ScrollView': {
      const containerStyle = rnStyleToCSS(
        node.props?.contentContainerStyle as Record<string, unknown> | undefined
      )
      const isHorizontal = !!node.props?.horizontal
      return (
        <div key={key} style={{
          ...VIEW_BASE, ...style,
          overflow: 'auto',
          flex: style.flex ?? 1,
          minHeight: 0, // Prevent flex item from growing beyond parent in web CSS
          ...(isHorizontal ? { overflowX: 'auto', overflowY: 'hidden' } : {}),
        }}>
          <div style={{
            ...VIEW_BASE, ...containerStyle,
            ...(isHorizontal ? { flexDirection: 'row', flexWrap: 'nowrap' } : {}),
          }}>
            {children}
          </div>
        </div>
      )
    }

    case 'Text':
      return (
        <span key={key} style={{ ...TEXT_BASE, ...style }}>
          {children}
        </span>
      )

    case 'TextInput': {
      const placeholder = node.props?.placeholder as string | undefined
      const placeholderColor = node.props?.placeholderTextColor as string | undefined
      const isSecure = node.props?.secureTextEntry as boolean | undefined
      const inputId = `input-${key}-${placeholder?.slice(0, 8) ?? ''}`
      return (
        <span key={key} style={{ display: 'contents' }}>
          {placeholderColor && (
            <style key={`${inputId}-style`}>{`#${inputId}::placeholder { color: ${placeholderColor}; opacity: 1; }`}</style>
          )}
          <input
            id={inputId}
            type={isSecure ? 'password' : 'text'}
            placeholder={placeholder}
            readOnly
            style={{
              ...VIEW_BASE,
              border: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              appearance: 'none',
              WebkitAppearance: 'none',
              background: 'transparent',
              color: 'inherit',
              ...style,
              // Only show border if AI explicitly set both width and color
              borderStyle: (style.borderWidth && style.borderColor) ? 'solid' : undefined,
              // Prevent white rectangle: if AI set borderWidth without color, suppress it
              borderWidth: style.borderColor ? style.borderWidth : undefined,
              // Never let backgroundColor default to white
              backgroundColor: style.backgroundColor || 'transparent',
            }}
          />
        </span>
      )
    }

    case 'TouchableOpacity':
      return (
        <div
          key={key}
          style={{ ...VIEW_BASE, ...style, cursor: 'pointer' }}
          role="button"
        >
          {children}
        </div>
      )

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
        const h = typeof style.height === 'number' ? Math.min(style.height, 280) : 160
        return (
          <ProxyImage
            key={key}
            searchQuery={searchQuery}
            width={w}
            height={h}
            alt={searchQuery}
            style={style}
          />
        )
      }

      if (source?.uri) {
        return (
          <img key={key} src={source.uri} alt="" loading="lazy"
            style={{ objectFit: 'cover', backgroundColor: '#2A2A3E', ...style }} />
        )
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
      const isOn = node.props?.value as boolean | undefined
      const trackOn = (node.props?.trackColor as Record<string, string>)?.true || '#34D399'
      const trackOff = (node.props?.trackColor as Record<string, string>)?.false || '#3F3F46'
      const thumbColor = (node.props?.thumbColor as string) || '#FFFFFF'
      return (
        <div
          key={key}
          role="switch"
          aria-checked={!!isOn}
          style={{
            width: 51,
            height: 31,
            borderRadius: 16,
            backgroundColor: isOn ? trackOn : trackOff,
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
              transform: isOn ? 'translateX(20px)' : 'translateX(0)',
              transition: 'transform 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      )
    }

    case 'FlatList': {
      const containerStyle = rnStyleToCSS(
        node.props?.contentContainerStyle as Record<string, unknown> | undefined
      )
      return (
        <div key={key} style={{ ...VIEW_BASE, ...style, overflow: 'auto', flex: style.flex ?? 1, minHeight: 0 }}>
          <div style={{ ...VIEW_BASE, ...containerStyle }}>
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

      // Normalize: lowercase, check Lucide→Material map, then convert hyphens to underscores
      const normalized = rawName.toLowerCase().trim()
      const materialName = MATERIAL_SYMBOL_MAP[normalized] ?? normalized.replace(/-/g, '_')

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
            ...style,
          }}
        >
          {materialName}
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
      return (
        <div key={key} style={{ padding: 4 }}>
          <span style={{ color: '#F87171', fontSize: 10 }}>Unknown: {node.type}</span>
        </div>
      )
  }
}

interface ScreenRendererProps {
  tree: ComponentNode
}

export function ScreenRenderer({ tree }: ScreenRendererProps) {
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
