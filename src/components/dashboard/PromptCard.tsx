import { useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { ArrowUp, Camera, X } from 'lucide-react'

export type SubmitMode = 'build' | 'plan'

export interface AttachedImage {
  /** Data URL ("data:image/png;base64,...") for inline preview + send. */
  dataUrl: string
  mimeType: string
  fileName: string
}

export interface PromptCardProps {
  value: string
  onChange: (next: string) => void
  /** Called when the user submits — Enter (without shift) or clicks Send. */
  onSubmit: (mode: SubmitMode) => void
  /** Disable input + send (used during the brief 'submitted' state). */
  disabled?: boolean
  /** Currently selected mode for the Plan/Build toggle. Defaults to 'build'. */
  mode?: SubmitMode
  /** Setter for the toggle. */
  onModeChange?: (mode: SubmitMode) => void
  /** Currently attached reference image (selected via the Camera icon).
   *  Optional — when null/undefined the image chip is not rendered. */
  attachedImage?: AttachedImage | null
  /** Setter for the attached image. Pass `null` to clear. */
  onAttachImage?: (img: AttachedImage | null) => void
}

/**
 * PromptCard — the central input card on the V2 dashboard.
 *
 * - Glassmorphic surface over the hero atmosphere
 * - Animated holographic conic-gradient border (slow rotation)
 * - Multi-line textarea, Enter submits / Shift+Enter newlines
 * - Bottom-left: Camera icon → opens native file picker, attaches image
 *   inline as a thumbnail chip above the textarea (X to remove)
 * - Bottom-right: Plan / Build segmented toggle + Send button
 *
 * The Camera intentionally bypasses the ScreenshotModal — it's for "attach a
 * reference image to my prompt", not "build an app from this screenshot".
 * The Screenshot mode card on the dashboard handles the latter.
 *
 * Spec: docs/superpowers/specs/2026-05-06-dashboard-redesign.md (§4, §8)
 */
export function PromptCard({
  value,
  onChange,
  onSubmit,
  disabled = false,
  mode = 'build',
  onModeChange,
  attachedImage,
  onAttachImage,
}: PromptCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSubmit) onSubmit(mode)
    }
  }

  // The Camera icon opens the native file picker directly. No modal in the
  // way — that's the differentiator from the Screenshot mode card.
  const handleCameraClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset the input so picking the same file twice still fires onChange.
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) {
      // Soft fail — caller should surface a toast. We don't have toast access
      // from inside this component, so just bail silently. The accept attr
      // already filters non-images at the OS level.
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      onAttachImage?.({
        dataUrl: reader.result,
        mimeType: file.type,
        fileName: file.name,
      })
    }
    reader.readAsDataURL(file)
  }

  // Allow Send when there's text OR an attached image. Image-only submissions
  // are valid for "build me an app like this" intents.
  const canSubmit = !disabled && (value.trim().length > 0 || !!attachedImage)

  return (
    <div
      style={{
        position: 'relative',
        background: 'rgba(15, 22, 24, 0.55)',
        border: '1px solid rgba(45, 212, 191, 0.22)',
        borderRadius: 16,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow:
          '0 12px 40px var(--dash-teal-glow), inset 0 1px 0 rgba(255,255,255,0.04)',
        opacity: disabled ? 0.65 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Holographic animated border (mask-composited so only the ring shows). */}
      <div
        data-dash-animated
        aria-hidden
        style={{
          position: 'absolute',
          inset: -1,
          borderRadius: 17,
          padding: 1,
          background:
            'conic-gradient(from 0deg, rgba(45,212,191,0) 0deg, rgba(45,212,191,0.6) 45deg, rgba(6,182,212,0.5) 90deg, rgba(45,212,191,0) 180deg, rgba(94,234,212,0.4) 270deg, rgba(45,212,191,0) 360deg)',
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          opacity: 0.45,
          pointerEvents: 'none',
          animation: 'dash-holospin 8s linear infinite',
        }}
      />

      {/* Hidden file input — clicked programmatically by the Camera icon. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Attached image chip (inline above the textarea). Only rendered when
          an image is attached. X removes it. */}
      {attachedImage && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '14px 14px 0',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <ImageChip
            image={attachedImage}
            onRemove={() => onAttachImage?.(null)}
          />
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={3}
        placeholder={
          attachedImage
            ? "Describe what to build with this image…"
            : "Let's build — describe your app, paste a screenshot, or import a Figma file…"
        }
        aria-label="App prompt"
        style={{
          width: '100%',
          padding: attachedImage ? '12px 18px 56px' : '18px 18px 56px',
          borderRadius: 16,
          background: 'transparent',
          border: 'none',
          color: 'var(--dash-text)',
          fontSize: 15,
          outline: 'none',
          resize: 'none',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
      />

      {/* Bottom-left action icons */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          bottom: 12,
          display: 'flex',
          gap: 6,
        }}
      >
        <IconBtn
          label="Attach a reference image"
          onClick={handleCameraClick}
          active={!!attachedImage}
        >
          <Camera size={16} />
        </IconBtn>
      </div>

      {/* Bottom-right: Plan/Build toggle + send */}
      <div
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <PlanBuildToggle mode={mode} onChange={onModeChange} />
        <button
          type="button"
          onClick={() => canSubmit && onSubmit(mode)}
          disabled={!canSubmit}
          aria-label={`Submit prompt — ${mode} mode`}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            cursor: canSubmit ? 'pointer' : 'default',
            background: canSubmit
              ? 'linear-gradient(135deg, var(--dash-teal), var(--dash-teal-2))'
              : 'rgba(255,255,255,0.06)',
            color: canSubmit ? '#001a1f' : 'var(--dash-text-3)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: canSubmit ? '0 4px 12px var(--dash-teal-glow)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </div>
  )
}

// ---- internals ------------------------------------------------------------

function ImageChip({
  image,
  onRemove,
}: {
  image: AttachedImage
  onRemove: () => void
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: 64,
        height: 64,
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid rgba(45,212,191,0.30)',
        background: '#0a0d0e',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        flexShrink: 0,
      }}
    >
      <img
        src={image.dataUrl}
        alt={image.fileName}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attached image"
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <X size={11} />
      </button>
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  active = false,
  children,
}: {
  label: string
  onClick?: () => void
  active?: boolean
  children: React.ReactNode
}) {
  const baseStyle: CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: active ? '1px solid rgba(45,212,191,0.40)' : '1px solid var(--dash-border)',
    background: active ? 'rgba(45,212,191,0.12)' : 'rgba(255,255,255,0.04)',
    color: active ? 'var(--dash-teal)' : 'var(--dash-text-2)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (active) return
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.color = 'var(--dash-text)'
      }}
      onMouseLeave={(e) => {
        if (active) return
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        e.currentTarget.style.color = 'var(--dash-text-2)'
      }}
    >
      {children}
    </button>
  )
}

function PlanBuildToggle({
  mode,
  onChange,
}: {
  mode: SubmitMode
  onChange?: (mode: SubmitMode) => void
}) {
  const options: SubmitMode[] = ['build', 'plan']
  return (
    <div
      role="radiogroup"
      aria-label="Submit mode"
      style={{
        display: 'inline-flex',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--dash-border)',
        borderRadius: 8,
        padding: 2,
        gap: 1,
      }}
    >
      {options.map((opt) => {
        const active = mode === opt
        return (
          <button
            key={opt}
            role="radio"
            aria-checked={active}
            type="button"
            onClick={() => onChange?.(opt)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              textTransform: 'capitalize',
              cursor: 'pointer',
              color: active ? '#001a1f' : 'var(--dash-text-2)',
              background: active
                ? 'linear-gradient(135deg, var(--dash-teal), var(--dash-teal-2))'
                : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
