import { useState, useRef, useCallback, useEffect } from 'react'
import { ImagePlus, X, Upload, Loader2 } from 'lucide-react'

interface ScreenshotImage {
  dataUrl: string
  mimeType: string
  fileName: string
  size: number
}

interface ScreenshotModalProps {
  onClose: () => void
  onGenerate: (images: Array<{ data: string; mimeType: string }>, prompt?: string) => void
  isGenerating: boolean
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_IMAGES = 4
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function ScreenshotModal({ onClose, onGenerate, isGenerating }: ScreenshotModalProps) {
  const [images, setImages] = useState<ScreenshotImage[]>([])
  const [prompt, setPrompt] = useState('Recreate this screen design')
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const processFiles = useCallback((files: File[]) => {
    setError('')
    setImages(prev => {
      const remainingSlots = MAX_IMAGES - prev.length
      if (remainingSlots <= 0) {
        setError(`You can only attach up to ${MAX_IMAGES} images.`)
        return prev
      }

      const accepted: ScreenshotImage[] = []
      let blockedByCount = false
      let blockedByType = false
      let blockedBySize = false

      for (const file of files) {
        if (accepted.length >= remainingSlots) {
          blockedByCount = true
          break
        }
        if (!ACCEPTED_TYPES.includes(file.type)) {
          blockedByType = true
          continue
        }
        if (file.size > MAX_FILE_SIZE) {
          blockedBySize = true
          continue
        }
        accepted.push({
          dataUrl: '',
          mimeType: file.type,
          fileName: file.name,
          size: file.size,
        })
        // Read async — patch in dataUrl when ready
        const reader = new FileReader()
        const fileName = file.name
        const fileSize = file.size
        reader.onload = () => {
          const dataUrl = reader.result as string
          setImages(curr => curr.map(img =>
            img.fileName === fileName && img.size === fileSize && !img.dataUrl
              ? { ...img, dataUrl }
              : img
          ))
        }
        reader.readAsDataURL(file)
      }

      if (blockedBySize) setError('Some images were skipped — each must be under 5MB.')
      else if (blockedByType) setError('Only PNG, JPG, or WEBP images are accepted.')
      else if (blockedByCount) setError(`Only the first ${MAX_IMAGES} images were accepted.`)

      return [...prev, ...accepted]
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) processFiles(files)
  }, [processFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length) processFiles(files)
    e.target.value = ''
  }, [processFiles])

  const removeImage = useCallback((idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx))
    setError('')
  }, [])

  const handleGenerate = useCallback(() => {
    if (images.length === 0) return
    const ready = images.filter(img => img.dataUrl)
    const payload: Array<{ data: string; mimeType: string }> = []
    for (const img of ready) {
      const match = img.dataUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) continue
      payload.push({ data: match[2], mimeType: match[1] })
    }
    if (payload.length === 0) return
    onGenerate(payload, prompt || undefined)
  }, [images, prompt, onGenerate])

  const canAddMore = images.length < MAX_IMAGES

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

        {/* Drop zone (always shown when more images can be added) */}
        {canAddMore && (
          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragOver ? '#818CF8' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 12,
              minHeight: images.length === 0 ? 200 : 100,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: images.length === 0 ? 12 : 6,
              cursor: 'pointer',
              background: isDragOver ? 'rgba(129,140,248,0.06)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s ease',
              transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
            }}
          >
            <ImagePlus size={images.length === 0 ? 40 : 24} style={{ color: isDragOver ? '#818CF8' : '#64748B', transition: 'color 0.2s' }} />
            <span style={{ color: isDragOver ? '#818CF8' : '#94A3B8', fontSize: 13, fontWeight: 500 }}>
              {images.length === 0 ? 'Drop screenshots here' : 'Add another image'}
            </span>
            {images.length === 0 && (
              <>
                <span style={{ color: '#64748B', fontSize: 13 }}>or click to browse</span>
                <span style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
                  PNG, JPG, WEBP &middot; Max 5MB &middot; Up to {MAX_IMAGES} images
                </span>
              </>
            )}
          </div>
        )}

        {/* Thumbnail grid */}
        {images.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>
                {images.length}/{MAX_IMAGES} images
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {images.map((img, idx) => (
                <div
                  key={`${img.fileName}-${idx}`}
                  style={{
                    position: 'relative',
                    width: 80, height: 80,
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: '#111',
                    flexShrink: 0,
                  }}
                >
                  {img.dataUrl ? (
                    <img
                      src={img.dataUrl}
                      alt={img.fileName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#475569', fontSize: 11,
                    }}>
                      …
                    </div>
                  )}
                  <button
                    onClick={() => removeImage(idx)}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 20, height: 20, borderRadius: 6,
                      background: 'rgba(0,0,0,0.75)', border: 'none',
                      color: '#F1F5F9', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          multiple
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
          disabled={images.length === 0 || isGenerating}
          style={{
            width: '100%', marginTop: 16, padding: '12px 0',
            background: images.length === 0 || isGenerating ? '#333' : '#818CF8',
            color: images.length === 0 || isGenerating ? '#666' : '#fff',
            border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: images.length === 0 || isGenerating ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { if (images.length > 0 && !isGenerating) e.currentTarget.style.background = '#6366F1' }}
          onMouseLeave={e => { if (images.length > 0 && !isGenerating) e.currentTarget.style.background = '#818CF8' }}
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Analyzing screenshot{images.length > 1 ? 's' : ''}...
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
