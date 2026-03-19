import type { ComponentNode } from '../types/mokkoi'

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
      const source = node.props?.source as { uri: string } | undefined
      return (
        <img
          key={key}
          src={source?.uri ?? ''}
          alt=""
          style={{ objectFit: 'cover', ...style }}
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
    <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      {renderNode(tree, 0)}
    </div>
  )
}
