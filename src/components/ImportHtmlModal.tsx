import { useState, useRef, useEffect } from 'react'
import { X, Code2, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { ComponentNode } from '../types/mokkoi'

const SOURCES = ['Other', 'Stitch', 'v0', 'Bolt', 'Lovable'] as const
type Source = typeof SOURCES[number]

interface ImportResult {
  name: string
  tree: ComponentNode
  detectedColors: string[]
  detectedSource: string
  conversionNotes: string[]
}

interface ImportHtmlModalProps {
  onClose: () => void
  onImported: (screen: ImportResult, modelUsed?: string) => void
  projectId?: string
  isGenerating?: boolean
}

export function ImportHtmlModal({ onClose, onImported, projectId }: ImportHtmlModalProps) {
  const [code, setCode] = useState('')
  const [screenName, setScreenName] = useState('')
  const [source, setSource] = useState<Source>('Other')
  const [isConverting, setIsConverting] = useState(false)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [showSlowWarning, setShowSlowWarning] = useState(false)
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea on mount
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && code.trim().length >= 50) {
        handleConvert()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const handleConvert = async () => {
    setError('')
    setIsConverting(true)
    setShowSlowWarning(false)
    setStatusMessage('Analyzing layout...')

    // Show slow warning after 15 seconds (streaming takes longer to complete but doesn't timeout)
    slowTimerRef.current = setTimeout(() => setShowSlowWarning(true), 15000)

    try {
      if (!supabase) throw new Error('Not authenticated. Please sign in.')
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated. Please sign in.')

      const response = await fetch('/api/generate?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          mode: 'import-html',
          code: code.trim(),
          source: source.toLowerCase(),
          screenName: screenName.trim() || undefined,
          projectId,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        let errorMsg = `Server error: ${response.status}`
        try { errorMsg = JSON.parse(text).error || errorMsg } catch { if (text.length < 200) errorMsg = text || errorMsg }
        throw new Error(errorMsg)
      }

      // Read SSE stream
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Streaming not supported')

      const decoder = new TextDecoder()
      let buffer = ''

      let eventCount = 0
      const processLine = (line: string) => {
        if (!line.startsWith('data: ')) return
        const data = line.slice(6).trim()
        if (!data || data === '[DONE]') {
          console.log('[import-html-fe] SSE line: [DONE] or empty')
          return
        }

        const event = JSON.parse(data)
        eventCount++
        console.log(`[import-html-fe] Event #${eventCount}: type=${event.type} keys=${Object.keys(event).join(',')}${event.type === 'complete' ? ` success=${event.success} hasScreen=${!!event.screen} hasTree=${!!event.screen?.tree}` : ''}`)

        if (event.type === 'status') {
          setStatusMessage(event.message || 'Converting...')
        } else if (event.type === 'progress') {
          if (event.chars > 2000) setStatusMessage('Building component tree...')
          else if (event.chars > 500) setStatusMessage('Converting elements...')
        } else if (event.type === 'complete') {
          if (event.success && event.screen?.tree) {
            console.log(`[import-html-fe] SUCCESS: screen.name=${event.screen.name} modelUsed=${event.modelUsed}`)
            onImported(event.screen, event.modelUsed)
            return 'done'
          } else {
            console.log(`[import-html-fe] COMPLETE but invalid: success=${event.success} screen=${JSON.stringify(event.screen)?.substring(0, 200)}`)
            throw new Error(event.error || 'Conversion failed')
          }
        } else if (event.type === 'error') {
          console.log(`[import-html-fe] ERROR event: ${event.message}`)
          throw new Error(event.message || 'Conversion failed')
        }
      }

      let completed = false
      let chunkIndex = 0

      while (true) {
        const { done, value } = await reader.read()
        chunkIndex++

        // Append new data (or flush decoder on stream end)
        const decoded = done
          ? decoder.decode()
          : decoder.decode(value, { stream: true })

        if (chunkIndex <= 3 || done) {
          console.log(`[import-html-fe] Chunk #${chunkIndex}: done=${done} len=${decoded.length} preview=${JSON.stringify(decoded.substring(0, 150))}`)
        }

        buffer += decoded
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          try {
            if (processLine(line) === 'done') { completed = true; break }
          } catch (e) {
            console.log(`[import-html-fe] processLine error:`, e instanceof Error ? e.message : e)
            if (e instanceof Error && !e.message.startsWith('Unexpected token')) throw e
          }
        }

        if (completed || done) break
      }

      // Process any remaining buffered line
      if (!completed && buffer.trim()) {
        console.log(`[import-html-fe] Processing remaining buffer: len=${buffer.length} preview=${JSON.stringify(buffer.substring(0, 200))}`)
        try {
          if (processLine(buffer) === 'done') completed = true
        } catch (e) {
          console.log(`[import-html-fe] remaining buffer error:`, e instanceof Error ? e.message : e)
          if (e instanceof Error && !e.message.startsWith('Unexpected token')) throw e
        }
      }

      if (!completed) {
        console.log(`[import-html-fe] FAIL: Stream ended without result. eventCount=${eventCount} bufferLen=${buffer.length} buffer=${JSON.stringify(buffer.substring(0, 300))}`)
        throw new Error('Stream ended without result. Try with shorter code.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
    } finally {
      setIsConverting(false)
      setShowSlowWarning(false)
      setStatusMessage('')
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
    }
  }

  const charCount = code.trim().length
  const canConvert = charCount >= 50 && !isConverting

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1A1A1A',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 0,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          width: 560,
          maxWidth: '90vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(99,102,241,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Code2 size={16} color="#818CF8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>Import Web Code</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Paste HTML, React, or Tailwind — get a mobile screen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'transparent', border: 'none',
              color: '#64748b', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Source selector */}
          <div style={{ display: 'flex', gap: 6 }}>
            {SOURCES.map(s => (
              <button
                key={s}
                onClick={() => setSource(s)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: source === s ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                  border: source === s ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  color: source === s ? '#818CF8' : '#94a3b8',
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Screen name (optional) */}
          <input
            type="text"
            value={screenName}
            onChange={e => setScreenName(e.target.value)}
            placeholder="Screen name (auto-detected if empty)"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#e2e8f0',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {/* Code textarea */}
          <div style={{ position: 'relative', flex: 1, minHeight: 280 }}>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={e => { setCode(e.target.value); setError('') }}
              placeholder="Paste your HTML, React, or Tailwind code here..."
              spellCheck={false}
              style={{
                width: '100%',
                height: '100%',
                minHeight: 280,
                padding: 14,
                borderRadius: 10,
                background: '#111114',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#c9d1d9',
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                whiteSpace: 'pre',
                overflowWrap: 'normal',
                overflowX: 'auto',
              }}
            />
            {/* Character count */}
            <div style={{
              position: 'absolute', bottom: 8, right: 12,
              fontSize: 11, color: charCount < 50 ? '#64748b' : '#4ade80',
              fontFamily: 'monospace',
            }}>
              {charCount.toLocaleString()} chars
              {charCount > 0 && charCount < 50 && ' (min 50)'}
            </div>
          </div>

          {/* Slow conversion warning */}
          {showSlowWarning && isConverting && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.2)',
              color: '#fbbf24',
              fontSize: 12,
            }}>
              This is taking longer than usual. Large HTML files may need to be simplified.
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.2)',
              color: '#f87171',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: 11, color: '#475569' }}>
            Supports HTML, React JSX/TSX, Tailwind CSS
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#e2e8f0',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConvert}
              disabled={!canConvert}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                background: canConvert
                  ? 'linear-gradient(135deg, #6366f1, #818cf8)'
                  : 'rgba(255,255,255,0.06)',
                border: 'none',
                color: canConvert ? '#fff' : '#64748b',
                fontSize: 13,
                fontWeight: 600,
                cursor: canConvert ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
                opacity: isConverting ? 0.8 : 1,
              }}
            >
              {isConverting ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  {statusMessage || 'Converting...'}
                </>
              ) : (
                'Convert to Mobile'
              )}
            </button>
          </div>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  )
}
