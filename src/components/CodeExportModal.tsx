import { useState, useMemo, useEffect } from 'react'
import type { ComponentNode } from '../types/mokkoi'
import { trackEvent } from '../lib/analytics'
import { convertTreeToTSX } from '../utils/exportTsx'
import { useUserPlan } from '../hooks/useUserPlan'

interface CodeExportModalProps {
  tree: ComponentNode
  screenName?: string
  onClose: () => void
}

// Keep legacy export for any other importers
export function convertTreeToJSX(tree: ComponentNode): string {
  return convertTreeToTSX(tree)
}

// Simple syntax highlighting — returns spans
function highlightCode(code: string): React.ReactNode[] {
  const lines = code.split('\n')
  return lines.map((line, i) => {
    const parts: React.ReactNode[] = []
    const regex = /(<\/?)([\w]+)|(\w+)=|("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(\{[^}]*\})|(\/\/>|>|<)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index))
      if (match[1] && match[2]) {
        parts.push(<span key={`${i}-${match.index}-br`} style={{ color: '#94A3B8' }}>{match[1]}</span>)
        parts.push(<span key={`${i}-${match.index}-tag`} style={{ color: '#818CF8' }}>{match[2]}</span>)
      } else if (match[3]) {
        parts.push(<span key={`${i}-${match.index}-prop`} style={{ color: '#C084FC' }}>{match[3]}</span>)
        parts.push('=')
      } else if (match[4]) {
        parts.push(<span key={`${i}-${match.index}-str`} style={{ color: '#34D399' }}>{match[4]}</span>)
      } else if (match[5]) {
        parts.push(<span key={`${i}-${match.index}-str2`} style={{ color: '#34D399' }}>{match[5]}</span>)
      } else if (match[6]) {
        parts.push(<span key={`${i}-${match.index}-expr`} style={{ color: '#F59E0B' }}>{match[6]}</span>)
      } else if (match[7]) {
        parts.push(<span key={`${i}-${match.index}-angle`} style={{ color: '#94A3B8' }}>{match[7]}</span>)
      }
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < line.length) parts.push(line.slice(lastIndex))

    if (parts.length === 0) {
      const kwRegex = /\b(import|export|default|function|return|from|const)\b/g
      let kwLastIndex = 0
      let kwMatch: RegExpExecArray | null
      const kwParts: React.ReactNode[] = []
      while ((kwMatch = kwRegex.exec(line)) !== null) {
        if (kwMatch.index > kwLastIndex) kwParts.push(line.slice(kwLastIndex, kwMatch.index))
        kwParts.push(<span key={`${i}-kw-${kwMatch.index}`} style={{ color: '#F472B6' }}>{kwMatch[0]}</span>)
        kwLastIndex = kwMatch.index + kwMatch[0].length
      }
      if (kwLastIndex < line.length) kwParts.push(line.slice(kwLastIndex))
      return <div key={i} style={{ minHeight: '1.4em' }}>{kwParts.length > 0 ? kwParts : line || '\u00A0'}</div>
    }

    return <div key={i} style={{ minHeight: '1.4em' }}>{parts}</div>
  })
}

export function CodeExportModal({ tree, screenName, onClose }: CodeExportModalProps) {
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'tsx' | 'json'>('tsx')
  const { plan } = useUserPlan()
  const addWatermark = plan === 'free'

  const tsxCode = useMemo(
    () => convertTreeToTSX(tree, screenName, { addWatermark }),
    [tree, screenName, addWatermark],
  )
  const jsonCode = useMemo(() => JSON.stringify(tree, null, 2), [tree])
  const code = tab === 'tsx' ? tsxCode : jsonCode
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
    trackEvent('screen_exported', { format: tab })
  }

  const handleDownload = () => {
    const filename = tab === 'tsx'
      ? `${(screenName || 'Screen').replace(/[^a-zA-Z0-9]/g, '')}.tsx`
      : `${(screenName || 'Screen').replace(/[^a-zA-Z0-9]/g, '')}.json`
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    trackEvent('screen_downloaded', { format: tab })
  }

  const handleOpenSnack = () => {
    // Expo Snack supports code via URL parameters
    const snackCode = encodeURIComponent(tsxCode)
    const url = `https://snack.expo.dev/?code=${snackCode}&name=${encodeURIComponent(screenName || 'MokkoiScreen')}&platform=ios`
    window.open(url, '_blank')
    trackEvent('screen_opened_snack')
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? 'rgba(129,140,248,0.15)' : 'transparent',
    color: active ? '#818CF8' : '#64748B',
    border: active ? '1px solid rgba(129,140,248,0.3)' : '1px solid transparent',
    transition: 'all 0.15s',
  })

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9' }}>
              Export Code
            </span>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setTab('tsx')} style={tabStyle(tab === 'tsx')}>TSX</button>
              <button onClick={() => setTab('json')} style={tabStyle(tab === 'json')}>JSON</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleOpenSnack}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                background: 'rgba(52,211,153,0.1)',
                color: '#34D399',
                border: '1px solid rgba(52,211,153,0.2)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.1)' }}
              title="Open in Expo Snack"
            >
              Open in Snack
            </button>
            <button
              onClick={handleDownload}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                background: 'rgba(255,255,255,0.06)',
                color: '#94A3B8',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            >
              Download
            </button>
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
