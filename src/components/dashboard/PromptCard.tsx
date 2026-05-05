import { useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { ArrowUp, Camera, Plus, Diamond } from 'lucide-react'

export type SubmitMode = 'build' | 'plan'

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
  /** Optional handlers for the bottom-left action buttons. Each falls back to
   *  a no-op if not provided so the buttons never crash. */
  onScreenshot?: () => void
  onAttach?: () => void
  onFigma?: () => void
}

/**
 * PromptCard — the central input card on the V2 dashboard.
 *
 * - Glassmorphic surface over the hero atmosphere
 * - Animated holographic conic-gradient border (slow rotation)
 * - Multi-line textarea, Enter submits / Shift+Enter newlines
 * - Bottom-left: screenshot / attach / figma icon buttons
 * - Bottom-right: Plan / Build segmented toggle + Send button
 *
 * The auto-suggest Plan logic (when clarity < 50) is wired up in Step 10
 * (Wave 3); this component just routes the chosen mode to onSubmit.
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
  onScreenshot,
  onAttach,
  onFigma,
}: PromptCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSubmit(mode)
    }
  }

  const canSubmit = !disabled && value.trim().length > 0

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

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={3}
        placeholder="Let's build — describe your app, paste a screenshot, or import a Figma file…"
        aria-label="App prompt"
        style={{
          width: '100%',
          padding: '18px 18px 56px',
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
        <IconBtn label="Add screenshot" onClick={onScreenshot}>
          <Camera size={16} />
        </IconBtn>
        <IconBtn label="Attach file" onClick={onAttach}>
          <Plus size={16} />
        </IconBtn>
        <IconBtn label="Import from Figma" onClick={onFigma}>
          <Diamond size={16} />
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

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: React.ReactNode
}) {
  const baseStyle: CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '1px solid var(--dash-border)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--dash-text-2)',
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
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.color = 'var(--dash-text)'
      }}
      onMouseLeave={(e) => {
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
