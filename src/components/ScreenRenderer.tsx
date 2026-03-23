import type { ComponentNode } from '../types/mokkoi'

// Lucide-style icon paths — each icon is an array of SVG path `d` strings (viewBox 0 0 24 24)
const ICON_PATHS: Record<string, string[]> = {
  'heart': ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'],
  'home': ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  'search': ['M11 17.25a6.25 6.25 0 1 1 0-12.5 6.25 6.25 0 0 1 0 12.5z', 'M16.5 16.5l4 4'],
  'settings': ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
  'bell': ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
  'user': ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
  'mail': ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6'],
  'star': ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
  'check': ['M20 6L9 17l-5-5'],
  'x': ['M18 6L6 18', 'M6 6l12 12'],
  'plus': ['M12 5v14', 'M5 12h14'],
  'minus': ['M5 12h14'],
  'chevron-right': ['M9 18l6-6-6-6'],
  'chevron-left': ['M15 18l-6-6 6-6'],
  'chevron-down': ['M6 9l6 6 6-6'],
  'chevron-up': ['M18 15l-6-6-6 6'],
  'arrow-left': ['M19 12H5', 'M12 19l-7-7 7-7'],
  'arrow-right': ['M5 12h14', 'M12 5l7 7-7 7'],
  'menu': ['M3 12h18', 'M3 6h18', 'M3 18h18'],
  'clock': ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 6v6l4 2'],
  'calendar': ['M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  'camera': ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  'phone': ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z'],
  'map-pin': ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'eye': ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'lock': ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  'share': ['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M16 6l-4-4-4 4', 'M12 2v13'],
  'download': ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  'upload': ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  'trash': ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  'edit': ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'],
  'copy': ['M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  'play': ['M5 3l14 9-14 9V3z'],
  'pause': ['M6 4h4v16H6z', 'M14 4h4v16h-4z'],
  'skip-forward': ['M5 4l10 8-10 8V4z', 'M19 5v14'],
  'skip-back': ['M19 20L9 12l10-8v16z', 'M5 19V5'],
  'volume-2': ['M11 5L6 9H2v6h4l5 4V5z', 'M19.07 4.93a10 10 0 0 1 0 14.14', 'M15.54 8.46a5 5 0 0 1 0 7.07'],
  'wifi': ['M5 12.55a11 11 0 0 1 14.08 0', 'M1.42 9a16 16 0 0 1 21.16 0', 'M8.53 16.11a6 6 0 0 1 6.95 0', 'M12 20h.01'],
  'battery': ['M17 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z', 'M23 13v-2'],
  'send': ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
  'image': ['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z', 'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M21 15l-5-5L5 21'],
  'shopping-cart': ['M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6', 'M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
  'filter': ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z'],
  'bookmark': ['M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'],
  'globe': ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
  'trending-up': ['M23 6l-9.5 9.5-5-5L1 18'],
  'zap': ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
  'activity': ['M22 12h-4l-3 9L9 3l-3 9H2'],
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
}

function renderNode(node: ComponentNode | string, key: number): React.ReactNode {
  if (typeof node === 'string') {
    return node
  }

  if (!node || typeof node !== 'object') {
    return null
  }

  const style = rnStyleToCSS(node.style)
  const hasElementSiblings = node.children?.some(c => typeof c !== 'string') ?? false
  const children = node.children?.map((child, i) => {
    if (typeof child === 'string' && hasElementSiblings) {
      return <span key={`t${i}`}>{child}</span>
    }
    return renderNode(child, i)
  })

  switch (node.type) {
    case 'View':
    case 'SafeAreaView':
      return (
        <div key={key} style={{ ...VIEW_BASE, ...style }}>
          {children}
        </div>
      )

    case 'ScrollView': {
      const containerStyle = rnStyleToCSS(
        node.props?.contentContainerStyle as Record<string, unknown> | undefined
      )
      return (
        <div key={key} style={{ ...VIEW_BASE, ...style, overflow: 'auto', flex: style.flex ?? 1 }}>
          <div style={{ ...VIEW_BASE, ...containerStyle }}>
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
              ...style,
              borderStyle: style.borderWidth ? 'solid' : undefined,
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
      const w = typeof style.width === 'number' ? Math.min(style.width, 800) : 400
      const h = typeof style.height === 'number' ? Math.min(style.height, 800) : 300
      const src = searchQuery
        ? `https://source.unsplash.com/${w}x${h}/?${encodeURIComponent(searchQuery)}`
        : (source?.uri ?? '')
      return (
        <img
          key={key}
          src={src}
          alt={searchQuery ?? ''}
          loading="lazy"
          style={{ objectFit: 'cover', backgroundColor: '#1A1A2E', ...style }}
        />
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
        <div key={key} style={{ ...VIEW_BASE, ...style, overflow: 'auto', flex: style.flex ?? 1 }}>
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

    // --- Icon Component (Lucide-style SVG icons) ---
    case 'Icon': {
      const iconName = (node.props?.name as string) ?? 'circle'
      const iconSize = (node.props?.size as number) ?? 24
      const iconColor = (node.props?.color as string) ?? '#FFFFFF'
      const pathData = ICON_PATHS[iconName]
      if (!pathData) {
        return (
          <span key={key} style={{ fontSize: iconSize * 0.8, lineHeight: 1, color: iconColor, ...style }}>
            {iconName[0]?.toUpperCase() ?? '?'}
          </span>
        )
      }
      return (
        <svg key={key} width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
          {pathData.map((d, i) => <path key={i} d={d} />)}
        </svg>
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
    <div style={{ width: '100%', maxWidth: '100%', minHeight: '100%' }}>
      {renderNode(tree, 0)}
    </div>
  )
}
