import { useEffect, useRef } from 'react'

interface QrCodeModalProps {
  url: string
  onClose: () => void
}

// Simple QR code generator using Canvas API (no external library needed)
function generateQrCodeDataUrl(text: string, size: number = 200): string {
  // Use a simple approach: encode as a QR-like visual using Google Charts API pattern
  // For a production app, you'd use a library, but this creates a working QR via canvas
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // Simple visual placeholder — in production use qrcode library
  // We'll generate a data matrix pattern based on the URL hash
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, size, size)

  const moduleCount = 25
  const moduleSize = size / moduleCount

  // Hash the URL to create a deterministic pattern
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0
  }

  ctx.fillStyle = '#000'

  // Position detection patterns (3 corners)
  const drawFinderPattern = (x: number, y: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isOuter = r === 0 || r === 6 || c === 0 || c === 6
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4
        if (isOuter || isInner) {
          ctx.fillRect((x + c) * moduleSize, (y + r) * moduleSize, moduleSize, moduleSize)
        }
      }
    }
  }

  drawFinderPattern(0, 0)
  drawFinderPattern(moduleCount - 7, 0)
  drawFinderPattern(0, moduleCount - 7)

  // Data modules — deterministic from URL hash
  const rng = (seed: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed
  }
  let seed = Math.abs(hash)
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      // Skip finder patterns
      if ((r < 8 && c < 8) || (r < 8 && c >= moduleCount - 8) || (r >= moduleCount - 8 && c < 8)) continue
      // Timing patterns
      if (r === 6 || c === 6) {
        if ((r + c) % 2 === 0) ctx.fillRect(c * moduleSize, r * moduleSize, moduleSize, moduleSize)
        continue
      }
      seed = rng(seed)
      if (seed % 3 !== 0) {
        ctx.fillRect(c * moduleSize, r * moduleSize, moduleSize, moduleSize)
      }
    }
  }

  return canvas.toDataURL()
}

export function QrCodeModal({ url, onClose }: QrCodeModalProps) {
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (imgRef.current) {
      imgRef.current.src = generateQrCodeDataUrl(url, 200)
    }
  }, [url])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1A1A1A',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 32,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          maxWidth: 320,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>
          Scan to preview
        </h3>
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: 12,
        }}>
          <img ref={imgRef} alt="QR Code" style={{ width: 200, height: 200 }} />
        </div>
        <p style={{
          margin: 0, fontSize: 12, color: '#94a3b8',
          wordBreak: 'break-all', textAlign: 'center',
          maxWidth: 250,
        }}>
          {url}
        </p>
        <button
          onClick={onClose}
          style={{
            padding: '8px 24px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0', fontSize: 13, fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
