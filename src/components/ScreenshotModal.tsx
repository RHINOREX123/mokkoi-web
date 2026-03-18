import { useState, useRef, useCallback } from 'react'
import { ImagePlus, X, Upload, Loader2 } from 'lucide-react'

interface ScreenshotModalProps {
  onClose: () => void
  onGenerate: (imageData: string, imageMimeType: string, prompt?: string) => void
  isGenerating: boolean
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function ScreenshotModal({ onClose, onGenerate, isGenerating }: ScreenshotModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('Recreate this screen design')
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    setError('')
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please use PNG, JPG, or WEBP images only.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be under 5MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPreviewUrl(reader.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }, [processFile])

  const handleGenerate = useCallback(() => {
    if (!previewUrl) return
    const match = previewUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return
    const [, mimeType, base64] = match
    onGenerate(base64, mimeType, prompt || undefined)
  }, [previewUrl, prompt, onGenerate])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0A0A0A',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          width: '100%', maxWidth: 500,
          padding: 24,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#F1F5F9' }}>
            Screenshot to Screen
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#64748B', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#F1F5F9' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748B' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Drop zone / Preview */}
        {!previewUrl ? (
          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragOver ? '#818CF8' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 12,
              minHeight: 200,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 12,
              cursor: 'pointer',
              background: isDragOver ? 'rgba(129,140,248,0.06)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s ease',
              transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
            }}
          >
            <ImagePlus size={40} style={{ color: isDragOver ? '#818CF8' : '#64748B', transition: 'color 0.2s' }} />
            <span style={{ color: isDragOver ? '#818CF8' : '#94A3B8', fontSize: 14, fontWeight: 500 }}>
              Drop screenshot here
            </span>
            <span style={{ color: '#64748B', fontSize: 13 }}>
              or click to browse
            </span>
            <span style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
              PNG, JPG, WEBP &middot; Max 5MB
            </span>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <img
              src={previewUrl}
              alt="Screenshot preview"
              style={{
                width: '100%', maxHeight: 300, objectFit: 'contain',
                borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
                background: '#111',
              }}
            />
            <button
              onClick={() => { setPreviewUrl(null); setError('') }}
              style={{
                position: 'absolute', top: 8, right: 8,
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(0,0,0,0.7)', border: 'none',
                color: '#94A3B8', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F1F5F9' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* Error message */}
        {error && (
          <div style={{ color: '#EF4444', fontSize: 13, marginTop: 10 }}>
            {error}
          </div>
        )}

        {/* Optional prompt */}
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>
            Additional instructions (optional)
          </label>
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe what you want to change or focus on"
            style={{
              width: '100%', padding: '10px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#F1F5F9', fontSize: 13,
              outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(129,140,248,0.4)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!previewUrl || isGenerating}
          style={{
            width: '100%', marginTop: 16, padding: '12px 0',
            background: !previewUrl || isGenerating ? '#333' : '#818CF8',
            color: !previewUrl || isGenerating ? '#666' : '#fff',
            border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: !previewUrl || isGenerating ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { if (previewUrl && !isGenerating) e.currentTarget.style.background = '#6366F1' }}
          onMouseLeave={e => { if (previewUrl && !isGenerating) e.currentTarget.style.background = '#818CF8' }}
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Analyzing screenshot...
            </>
          ) : (
            <>
              <Upload size={16} />
              Generate Screen
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
