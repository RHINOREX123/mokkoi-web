import { useState, useMemo } from 'react'
import { X, Smartphone, ExternalLink, RefreshCw, QrCode } from 'lucide-react'
import { buildSnackUrl, buildSnackEmbedUrl } from '../utils/snackUrl'
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
  const [refreshKey, setRefreshKey] = useState(0)

  const snackUrl = useMemo(() => {
    try {
      return buildSnackUrl({ projectName, screens, connections })
    } catch {
      return null
    }
  }, [projectName, screens, connections, refreshKey])

  const embedUrl = useMemo(() => {
    try {
      return buildSnackEmbedUrl({ projectName, screens, connections })
    } catch {
      return null
    }
  }, [projectName, screens, connections, refreshKey])

  // QR code via Google Charts API (free, no dependency needed)
  const qrUrl = snackUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(snackUrl)}`
    : null

  const handleRefresh = () => {
    setRefreshKey(k => k + 1)
    trackEvent('expo_preview_refreshed')
  }

  const handleOpenSnack = () => {
    if (snackUrl) {
      window.open(snackUrl, '_blank')
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
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
              Preview on Phone
            </span>
            <span style={{ fontSize: 12, color: C.textDim, background: `${C.teal}15`, padding: '2px 8px', borderRadius: 4 }}>
              {screens.length} screen{screens.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setShowQR(!showQR)} title="Show QR Code" style={{
              background: showQR ? `${C.accent}20` : 'transparent', border: `1px solid ${showQR ? C.accent : C.border}`,
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: showQR ? C.accent : C.textMuted, fontSize: 12, fontWeight: 500,
              transition: 'all 0.2s',
            }}>
              <QrCode size={14} /> QR Code
            </button>
            <button onClick={handleRefresh} title="Refresh preview" style={{
              background: 'transparent', border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: C.textMuted, fontSize: 12, fontWeight: 500,
            }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={handleOpenSnack} title="Open in Expo Snack" style={{
              background: C.accent, border: 'none',
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'white', fontSize: 12, fontWeight: 600,
            }}>
              <ExternalLink size={14} /> Open in Snack
            </button>
            <button onClick={onClose} style={{
              background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted,
              padding: 4, display: 'flex',
            }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Snack embed iframe */}
          <div style={{ flex: 1, position: 'relative' }}>
            {embedUrl ? (
              <iframe
                key={refreshKey}
                src={embedUrl}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Expo Snack Preview"
                allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; usb; xr-spatial-tracking"
                sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 12, color: C.textMuted,
              }}>
                <Smartphone size={48} color={C.textDim} />
                <p style={{ fontSize: 14 }}>Could not generate preview URL</p>
                <p style={{ fontSize: 12, color: C.textDim }}>Try generating screens first</p>
              </div>
            )}
          </div>

          {/* QR panel (slides in from right) */}
          {showQR && (
            <div style={{
              width: 280, flexShrink: 0, borderLeft: `1px solid ${C.border}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: 24, gap: 20,
              background: C.bg,
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
                Your app runs natively on your phone — not a screenshot!
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
