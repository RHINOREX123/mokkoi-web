import { useState, useEffect, useCallback } from 'react'
import { X, Smartphone, ExternalLink, RefreshCw, QrCode, Loader } from 'lucide-react'
import { buildSnackPayload } from '../utils/snackUrl'
import { supabase } from '../lib/supabase'
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

export function ExpoPreviewModal({ screens, connections, projectName, onClose }: ExpoPreviewModalProps) {
  const [showQR, setShowQR] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snackId, setSnackId] = useState<string | null>(null)

  const saveSnack = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = buildSnackPayload({ projectName, screens, connections })

      // Get auth token
      let headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
      }

      const res = await fetch('/api/export', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: 'save-snack',
          files: payload.files,
          name: payload.name,
          dependencies: payload.dependencies,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Failed to save snack (${res.status})`)
      }

      const data = await res.json()
      if (!data.id) throw new Error('No snack ID returned')

      setSnackId(data.id)
      trackEvent('expo_preview_created', { screen_count: screens.length })
    } catch (err) {
      console.error('Save snack error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create preview')
    } finally {
      setLoading(false)
    }
  }, [projectName, screens, connections])

  useEffect(() => {
    saveSnack()
  }, [saveSnack])

  const embedUrl = snackId ? `https://snack.expo.dev/embedded/@snack/${snackId}` : null
  const fullUrl = snackId ? `https://snack.expo.dev/@snack/${snackId}` : null
  const qrUrl = fullUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullUrl)}`
    : null

  const handleRefresh = () => {
    trackEvent('expo_preview_refreshed')
    saveSnack()
  }

  const handleOpenSnack = () => {
    if (fullUrl) {
      window.open(fullUrl, '_blank')
      trackEvent('expo_preview_opened_snack')
    }
  }

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
            <button onClick={() => setShowQR(!showQR)} disabled={!snackId} style={{
              background: showQR ? `${C.accent}20` : 'transparent', border: `1px solid ${showQR ? C.accent : C.border}`,
              borderRadius: 8, padding: '6px 12px', cursor: snackId ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', gap: 6,
              color: showQR ? C.accent : C.textMuted, fontSize: 12, fontWeight: 500,
              opacity: snackId ? 1 : 0.4,
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
              <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} /> Refresh
            </button>
            <button onClick={handleOpenSnack} disabled={!snackId} style={{
              background: snackId ? C.accent : '#333', border: 'none',
              borderRadius: 8, padding: '6px 12px', cursor: snackId ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'white', fontSize: 12, fontWeight: 600,
              opacity: snackId ? 1 : 0.4,
            }}>
              <ExternalLink size={14} /> Open in Snack
            </button>
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
            {loading ? (
              <div style={{
                width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 16, color: C.textMuted,
              }}>
                <Loader size={32} color={C.teal} style={{ animation: 'spin 1.5s linear infinite' }} />
                <p style={{ fontSize: 14, fontWeight: 500 }}>Creating Expo Snack preview...</p>
                <p style={{ fontSize: 12, color: C.textDim }}>Uploading {screens.length} screen{screens.length !== 1 ? 's' : ''} to Expo</p>
              </div>
            ) : error ? (
              <div style={{
                width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 12, color: C.textMuted, padding: 40,
              }}>
                <Smartphone size={48} color={C.textDim} />
                <p style={{ fontSize: 14, color: '#f87171' }}>{error}</p>
                <button onClick={handleRefresh} style={{
                  padding: '8px 16px', borderRadius: 8, background: C.accent, color: 'white',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                }}>
                  Try Again
                </button>
              </div>
            ) : embedUrl ? (
              <iframe
                src={embedUrl}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Expo Snack Preview"
                allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; usb; xr-spatial-tracking"
                sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
              />
            ) : null}
          </div>

          {/* QR panel */}
          {showQR && snackId && (
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

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
