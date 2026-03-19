import { useState, useMemo, useEffect } from 'react'
import type { ComponentNode } from '../types/mokkoi'
import { trackEvent } from '../lib/analytics'

interface CodeExportModalProps {
  tree: ComponentNode
  onClose: () => void
}

function collectTypes(node: ComponentNode | string, types: Set<string>): void {
  if (typeof node === 'string' || !node) return
  types.add(node.type)
  node.children?.forEach(child => collectTypes(child, types))
}

function formatStyle(style: Record<string, unknown>, indent: string): string {
  const entries = Object.entries(style)
  if (entries.length === 0) return '{}'
  if (entries.length <= 2) {
    const inner = entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')
    return `{ ${inner} }`
  }
  const lines = entries.map(([k, v]) => `${indent}    ${k}: ${JSON.stringify(v)},`)
  return `{\n${lines.join('\n')}\n${indent}  }`
}

function nodeToJSX(node: ComponentNode | string, depth: number): string {
  const indent = '  '.repeat(depth)

  if (typeof node === 'string') {
    return `${indent}${node}`
  }

  if (!node || typeof node !== 'object') return ''

  const tag = node.type
  const attrs: string[] = []

  if (node.style && Object.keys(node.style).length > 0) {
    attrs.push(`style={${formatStyle(node.style, indent)}}`)
  }

  if (node.props) {
    for (const [key, value] of Object.entries(node.props)) {
      if (key === 'source' && typeof value === 'object' && value !== null) {
        attrs.push(`source={${JSON.stringify(value)}}`)
      } else if (key === 'contentContainerStyle') {
        attrs.push(`contentContainerStyle={${formatStyle(value as Record<string, unknown>, indent)}}`)
      } else if (typeof value === 'string') {
        attrs.push(`${key}="${value}"`)
      } else if (typeof value === 'boolean') {
        attrs.push(value ? key : `${key}={false}`)
      } else {
        attrs.push(`${key}={${JSON.stringify(value)}}`)
      }
    }
  }

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : ''

  if (!node.children || node.children.length === 0) {
    return `${indent}<${tag}${attrStr} />`
  }

  // Single text child — inline
  if (node.children.length === 1 && typeof node.children[0] === 'string') {
    return `${indent}<${tag}${attrStr}>${node.children[0]}</${tag}>`
  }

  const childrenJSX = node.children.map(child => nodeToJSX(child, depth + 1)).join('\n')
  return `${indent}<${tag}${attrStr}>\n${childrenJSX}\n${indent}</${tag}>`
}

export function convertTreeToJSX(tree: ComponentNode): string {
  const types = new Set<string>()
  collectTypes(tree, types)

  const rnTypes = ['View', 'Text', 'TextInput', 'TouchableOpacity', 'ScrollView', 'Image', 'SafeAreaView']
  const usedRNTypes = rnTypes.filter(t => types.has(t))

  const imports = [
    `import React from 'react';`,
    `import { ${usedRNTypes.join(', ')} } from 'react-native';`,
  ]

  const body = nodeToJSX(tree, 2)

  return `${imports.join('\n')}\n\nexport default function GeneratedScreen() {\n  return (\n${body}\n  );\n}\n`
}

// Simple syntax highlighting — returns spans
function highlightCode(code: string): React.ReactNode[] {
  const lines = code.split('\n')
  return lines.map((line, i) => {
    const parts: React.ReactNode[] = []
    let remaining = line

    // Process the line character by character with regex matches
    const regex = /(<\/?)([\w]+)|(\w+)=|("(?:[^"\\]|\\.)*")|(\{[^}]*\})|(\/\/>|>|<)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(line)) !== null) {
      // Add plain text before match
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index))
      }

      if (match[1] && match[2]) {
        // Tag: <Component or </Component
        parts.push(<span key={`${i}-${match.index}-br`} style={{ color: '#94A3B8' }}>{match[1]}</span>)
        parts.push(<span key={`${i}-${match.index}-tag`} style={{ color: '#818CF8' }}>{match[2]}</span>)
      } else if (match[3]) {
        // Prop name
        parts.push(<span key={`${i}-${match.index}-prop`} style={{ color: '#C084FC' }}>{match[3]}</span>)
        parts.push('=')
      } else if (match[4]) {
        // String value
        parts.push(<span key={`${i}-${match.index}-str`} style={{ color: '#34D399' }}>{match[4]}</span>)
      } else if (match[5]) {
        // Expression in braces
        parts.push(<span key={`${i}-${match.index}-expr`} style={{ color: '#F59E0B' }}>{match[5]}</span>)
      } else if (match[6]) {
        // Bracket/angle
        parts.push(<span key={`${i}-${match.index}-angle`} style={{ color: '#94A3B8' }}>{match[6]}</span>)
      }

      lastIndex = match.index + match[0].length
    }

    // Remaining text
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex))
    }

    // Highlight import/export/function/return keywords in the plain text parts
    if (parts.length === 0) {
      // No regex matches — handle keywords on the full line
      remaining = line
      const kwRegex = /\b(import|export|default|function|return|from|const)\b/g
      let kwLastIndex = 0
      let kwMatch: RegExpExecArray | null
      const kwParts: React.ReactNode[] = []
      while ((kwMatch = kwRegex.exec(remaining)) !== null) {
        if (kwMatch.index > kwLastIndex) {
          kwParts.push(remaining.slice(kwLastIndex, kwMatch.index))
        }
        kwParts.push(<span key={`${i}-kw-${kwMatch.index}`} style={{ color: '#F472B6' }}>{kwMatch[0]}</span>)
        kwLastIndex = kwMatch.index + kwMatch[0].length
      }
      if (kwLastIndex < remaining.length) {
        kwParts.push(remaining.slice(kwLastIndex))
      }
      return <div key={i} style={{ minHeight: '1.4em' }}>{kwParts.length > 0 ? kwParts : line || '\u00A0'}</div>
    }

    return <div key={i} style={{ minHeight: '1.4em' }}>{parts}</div>
  })
}

export function CodeExportModal({ tree, onClose }: CodeExportModalProps) {
  const [copied, setCopied] = useState(false)
  const code = useMemo(() => convertTreeToJSX(tree), [tree])
  const highlighted = useMemo(() => highlightCode(code), [code])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    trackEvent('screen_exported')
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0A0A0A',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          width: '100%', maxWidth: 700, maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9' }}>
            Export React Native Code
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCopy}
              style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                background: copied ? 'rgba(52,211,153,0.15)' : 'linear-gradient(135deg, #6366f1, #818cf8)',
                color: copied ? '#34D399' : '#fff',
                border: copied ? '1px solid rgba(52,211,153,0.3)' : '1px solid transparent',
              }}
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#94A3B8', fontSize: 16, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Code content */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '16px 20px',
          scrollbarWidth: 'thin',
        }}>
          <pre style={{
            margin: 0,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: '#CBD5E1',
            whiteSpace: 'pre',
            tabSize: 2,
          }}>
            {highlighted}
          </pre>
        </div>
      </div>
    </div>
  )
}
