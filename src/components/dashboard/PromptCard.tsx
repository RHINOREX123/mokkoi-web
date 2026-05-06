import { useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { ArrowUp, Camera, X } from 'lucide-react'

export type SubmitMode = 'build' | 'plan'

/** Hard cap on how many reference images a single prompt can attach.
 *  4 is the product call — pairs with the Anthropic multimodal limit we
 *  set on the API side and stays cheap to render as inline chips. */
export const MAX_ATTACHED_IMAGES = 4
const MAX_FILE_BYTES = 5 * 1024 * 1024

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
  /** Reference images attached via the Camera icon. Up to MAX_ATTACHED_IMAGES.
   *  Owned by the parent (Dashboard) so the same array can be handed off to
   *  the project page via sessionStorage on submit. */
  attachedImages?: AttachedImage[]
  /** Setter for the attached images list. Receives the next array — the
   *  parent decides whether to enforce the cap (we also enforce it in the
   *  file picker for safety). Pass [] to clear. */
  onAttachImagesChange?: (next: AttachedImage[]) => void
}

/**
 * PromptCard — the central input card on the V2 dashboard.
 *
 * - Glassmorphic surface over the hero atmosphere
 * - Animated holographic conic-gradient border (slow rotation)
 * - Multi-line textarea, Enter submits / Shift+Enter newlines
 * - Bottom-left: Camera icon → opens native file picker, attaches up to 4
 *   reference images inline as a thumbnail strip above the textarea
 *   (X to remove individual)
 * - Bottom-right: Plan / Build segmented toggle + Send button
 *
 * The Camera is the only image-attach path on the dashboard. The
 * "From a screenshot" mode card was removed in favor of consolidating into
 * one paradigm: "your prompt + reference images".
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
  attachedImages = [],
  onAttachImagesChange,
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
  // way — that's the differentiator from the in-chat ScreenshotModal.
  const handleCameraClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Snapshot the picks into a plain array BEFORE we clear the input.
    // In some browsers, clearing input.value mutates the live FileList,
    // so a `const files = e.target.files` reference can become empty by
    // the time we try to iterate it. Array.from copies the File refs,
    // and individual File objects survive the input being cleared.
    const filesArr = e.target.files ? Array.from(e.target.files) : []
    // Reset the input so picking the same file twice still fires onChange.
    e.target.value = ''
    if (filesArr.length === 0) return

    // How many slots remain. If full, we silently drop the picks; the UI
    // will already have the chip count visible so the user understands.
    const remaining = MAX_ATTACHED_IMAGES - attachedImages.length
    if (remaining <= 0) return

    // Validate + read each candidate file, capping at the remaining slots.
    const accepted = filesArr
      .filter((f) => f.type.startsWith('image/') && f.size <= MAX_FILE_BYTES)
      .slice(0, remaining)

    const reads = accepted.map(
      (f) =>
        new Promise<AttachedImage | null>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => {
            if (typeof reader.result !== 'string') return resolve(null)
            resolve({ dataUrl: reader.result, mimeType: f.type, fileName: f.name })
          }
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(f)
        }),
    )
    const results = (await Promise.all(reads)).filter(
      (x): x is AttachedImage => x !== null,
    )
    if (results.length === 0) return
    onAttachImagesChange?.([...attachedImages, ...results])
  }

  const removeImageAt = (idx: number) => {
    const next = attachedImages.filter((_, i) => i !== idx)
    onAttachImagesChange?.(next)
  }

  // Allow Send when there's text OR at least one attached image. Image-only
  // submissions are valid for "build me an app like this" intents.
  const hasImages = attachedImages.length > 0
  const canSubmit = !disabled && (value.trim().length > 0 || hasImages)
  const cameraFull = attachedImages.length >= MAX_ATTACHED_IMAGES

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

      {/* Hidden file input — clicked programmatically by the Camera icon.
          `multiple` lets the user pick several at once; we still cap on
          intake so the cap is enforced regardless of how the OS picker
          behaves. */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Attached image chips (inline above the textarea). Up to 4. */}
      {hasImages && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            padding: '14px 14px 0',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {attachedImages.map((img, i) => (
            <ImageChip
              key={`${img.fileName}-${i}`}
              image={img}
              onRemove={() => removeImageAt(i)}
            />
          ))}
          <span
            style={{
              alignSelf: 'center',
              marginLeft: 4,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--dash-text-3)',
            }}
          >
            {attachedImages.length}/{MAX_ATTACHED_IMAGES}
          </span>
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
          hasImages
            ? "Describe what to build with these images…"
            : "Let's build — describe your app, paste a screenshot, or import a Figma file…"
        }
        aria-label="App prompt"
        style={{
          width: '100%',
          padding: hasImages ? '12px 18px 56px' : '18px 18px 56px',
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
          label={
            cameraFull
              ? `Maximum ${MAX_ATTACHED_IMAGES} images attached`
              : 'Attach reference images'
          }
          onClick={handleCameraClick}
          active={hasImages}
          disabled={cameraFull}
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
        aria-label={`Remove ${image.fileName}`}
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
  disabled = false,
  children,
}: {
  label: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
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
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
    opacity: disabled ? 0.45 : 1,
  }
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (active || disabled) return
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.color = 'var(--dash-text)'
      }}
      onMouseLeave={(e) => {
        if (active || disabled) return
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
