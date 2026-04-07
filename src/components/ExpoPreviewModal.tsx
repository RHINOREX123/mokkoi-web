import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Smartphone, ExternalLink, RefreshCw, QrCode, Loader } from 'lucide-react'
import { buildSnackPayload } from '../utils/snackUrl'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import type { FlowConnection } from './FlowConnectors'
import { trackEvent } from '../lib/analytics'

interface ExpoPreviewModalProps {
  screens: GeneratedScreen[]
  connections: FlowConnection[]
  projectName: string
  onClose: () => void
}

const C = {
  bg: '#06080D',
  bgCard: '#0D1117',
  border: '#1C2333',
  text: '#E6EDF3',
  textMuted: '#7D8590',
  textDim: '#484F58',
  accent: '#2563EB',
  teal: '#14B8A6',
}

/**
 * Expo Snack live preview using the postMessage protocol:
 *
 * 1. Embed snack.expo.dev/embedded with waitForData=true
 * 2. Snack iframe sends ['expoFrameLoaded', {iframeId}] when ready
 * 3. We reply with ['expoDataEvent', {iframeId, files, dependencies}]
 * 4. Snack renders the code — live on web, scannable via Expo Go
 */
export function ExpoPreviewModal({ screens, connections, projectName, onClose }: ExpoPreviewModalProps) {
  const [showQR, setShowQR] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframeIdRef = useRef(`mokkoi-${Date.now()}`)
  const payloadSentRef = useRef(false)

  // Build the snack payload once
  const payload = useCallback(() => {
    try {
      return buildSnackPayload({ projectName, screens, connections })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build preview')
      return null
    }
  }, [projectName, screens, connections])

  // Listen for the iframe's "ready" message and send code
  useEffect(() => {
    const iframeId = iframeIdRef.current

    function handleMessage(event: MessageEvent) {
      // Snack sends: ['expoFrameLoaded', { iframeId }]
      if (!Array.isArray(event.data) || event.data.length < 2) return
      const [eventName, data] = event.data

      if (eventName === 'expoFrameLoaded' && data?.iframeId === iframeId) {
        const p = payload()
        if (!p) return

        // Convert dependencies from {pkg: {version: "x"}} to "pkg@x,pkg2@y" string
        const depsString = Object.entries(p.dependencies)
          .map(([name, val]) => {
            const v = (val as { version: string }).version
            return v && v !== '*' ? `${name}@${v}` : name
          })
          .join(',')

        // Send code to the Snack iframe
        // Protocol: ['expoDataEvent', { iframeId, files, dependencies, code }]
        iframeRef.current?.contentWindow?.postMessage(
          ['expoDataEvent', {
            iframeId,
            files: JSON.stringify(p.files),
            dependencies: depsString,
          }],
          '*'
        )

        payloadSentRef.current = true
        setLoading(false)
        trackEvent('expo_preview_created', { screen_count: screens.length })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [payload, screens.length])

  // Timeout — if iframe doesn't respond in 15s, show error
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!payloadSentRef.current) {
        setLoading(false)
        setError('Preview timed out. Expo Snack may be unavailable — try "Open in Snack" instead.')
      }
    }, 15000)
    return () => clearTimeout(timer)
  }, [])

  const handleRefresh = () => {
    payloadSentRef.current = false
    setLoading(true)
    setError(null)
    iframeIdRef.current = `mokkoi-${Date.now()}`
    trackEvent('expo_preview_refreshed')
    // Force iframe reload by updating key
    setRefreshKey(k => k + 1)
  }

  const [refreshKey, setRefreshKey] = useState(0)

  const iframeId = iframeIdRef.current
  const iframeSrc = `https://snack.expo.dev/embedded?iframeId=${iframeId}&preview=true&platform=web&supportedPlatforms=mydevice,ios,android&theme=dark&waitForData=true`

  // For QR / "Open in Snack" — build a URL with minimal code
  const snackUrlForQR = (() => {
    try {
      const p = payload()
      if (!p) return null
      // Use URL params for the "open in browser" link (may truncate for large apps)
      const params = new URLSearchParams()
      params.set('name', p.name)
      params.set('platform', 'mydevice')
      params.set('theme', 'dark')

      // Only include App.tsx in URL to keep it short
      const appCode = p.files['App.tsx']?.contents
      if (appCode && appCode.length < 4000) {
        params.set('code', appCode)
      }

      return `https://snack.expo.dev?${params.toString()}`
    } catch {
      return null
    }
  })()

  const qrUrl = iframeSrc
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(snackUrlForQR || 'https://snack.expo.dev')}`
    : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '90vw', maxWidth: 1000, height: '85vh', maxHeight: 700,
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Smartphone size={18} color={C.teal} />
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Preview on Phone</span>
            <span style={{ fontSize: 12, color: C.textDim, background: `${C.teal}15`, padding: '2px 8px', borderRadius: 4 }}>
              {screens.length} screen{screens.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setShowQR(!showQR)} style={{
              background: showQR ? `${C.accent}20` : 'transparent', border: `1px solid ${showQR ? C.accent : C.border}`,
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: showQR ? C.accent : C.textMuted, fontSize: 12, fontWeight: 500,
            }}>
              <QrCode size={14} /> QR Code
            </button>
            <button onClick={handleRefresh} disabled={loading} style={{
              background: 'transparent', border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '6px 12px', cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: C.textMuted, fontSize: 12, fontWeight: 500,
              opacity: loading ? 0.4 : 1,
            }}>
              <RefreshCw size={14} style={loading ? { animation: 'mokkoiSpin 1s linear infinite' } : undefined} /> Refresh
            </button>
            {snackUrlForQR && (
              <button onClick={() => window.open(snackUrlForQR, '_blank')} style={{
                background: C.accent, border: 'none',
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                color: 'white', fontSize: 12, fontWeight: 600,
              }}>
                <ExternalLink size={14} /> Open in Snack
              </button>
            )}
            <button onClick={onClose} style={{
              background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4, display: 'flex',
            }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Main preview area */}
          <div style={{ flex: 1, position: 'relative' }}>
            {/* Loading overlay */}
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 16, color: C.textMuted, zIndex: 10, background: C.bgCard,
              }}>
                <Loader size={32} color={C.teal} style={{ animation: 'mokkoiSpin 1.5s linear infinite' }} />
                <p style={{ fontSize: 14, fontWeight: 500 }}>Loading Expo Snack preview...</p>
                <p style={{ fontSize: 12, color: C.textDim }}>Sending {screens.length} screen{screens.length !== 1 ? 's' : ''} to Expo</p>
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 12, color: C.textMuted, padding: 40, zIndex: 10, background: C.bgCard,
              }}>
                <Smartphone size={48} color={C.textDim} />
                <p style={{ fontSize: 14, color: '#f87171', textAlign: 'center' }}>{error}</p>
                <button onClick={handleRefresh} style={{
                  padding: '8px 16px', borderRadius: 8, background: C.accent, color: 'white',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                }}>
                  Try Again
                </button>
              </div>
            )}

            {/* Snack iframe — always mounted, receives code via postMessage */}
            <iframe
              key={refreshKey}
              ref={iframeRef}
              src={iframeSrc}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Expo Snack Preview"
              allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; usb; xr-spatial-tracking"
              sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
            />
          </div>

          {/* QR panel */}
          {showQR && (
            <div style={{
              width: 280, flexShrink: 0, borderLeft: `1px solid ${C.border}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: 24, gap: 20, background: C.bg,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'center' }}>
                Scan with Expo Go
              </div>
              {qrUrl && (
                <div style={{
                  background: '#ffffff', borderRadius: 12, padding: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <img src={qrUrl} alt="QR Code" width={180} height={180} style={{ display: 'block' }} />
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, marginBottom: 12 }}>
                  1. Download <strong style={{ color: C.text }}>Expo Go</strong> from App Store or Play Store
                </p>
                <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, marginBottom: 12 }}>
                  2. Open Expo Go and tap <strong style={{ color: C.text }}>Scan QR Code</strong>
                </p>
                <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
                  3. Point your camera at this QR code
                </p>
              </div>
              <div style={{
                fontSize: 11, color: C.textDim, textAlign: 'center',
                padding: '8px 12px', borderRadius: 8, background: `${C.teal}10`,
                border: `1px solid ${C.teal}20`,
              }}>
                Your app runs natively on your phone!
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes mokkoiSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
