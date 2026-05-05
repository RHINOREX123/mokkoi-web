import type { CSSProperties, ReactNode } from 'react'

/** Eight gradient pairs — deterministic per project name so the same project
 *  always gets the same fallback color. Drawn from the existing dashboard
 *  palette so cards still feel cohesive against the warm-graphite background. */
const GRADIENT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['#6366f1', '#818cf8'],
  ['#8b5cf6', '#a78bfa'],
  ['#ec4899', '#f472b6'],
  ['#f97316', '#fb923c'],
  ['#14b8a6', '#2dd4bf'],
  ['#3b82f6', '#60a5fa'],
  ['#e11d48', '#fb7185'],
  ['#84cc16', '#a3e635'],
]

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export type PhoneThumbnailState = 'ready' | 'generating' | 'empty'
export type PhoneThumbnailSize = 'sm' | 'md'

export interface PhoneThumbnailProps {
  /** Project name — drives the deterministic gradient fallback and the initial. */
  projectName: string
  /** Optional pre-rendered screen content. When omitted, the gradient + initial
   *  fallback is used. v1 ships without real screen-thumbnail generation; this
   *  prop is the seam where that pipeline will plug in later. */
  screenContent?: ReactNode
  /** ready (default): show screenContent or fallback gradient.
   *  generating: dashed outline + teal shimmer (project just created, no screens yet).
   *  empty: blank phone, dashed outline only (zero-state placeholder). */
  state?: PhoneThumbnailState
  /** sm = ~24px tall (sidebar list), md = card-sized (default). */
  size?: PhoneThumbnailSize
  /** Override outer container styles (e.g. width, aspect-ratio of parent). */
  style?: CSSProperties
}

const SIZE_MAP: Record<PhoneThumbnailSize, { height: number; radius: number }> = {
  sm: { height: 28, radius: 6 },
  md: { height: 220, radius: 14 },
}

/**
 * PhoneThumbnail — phone-frame preview for a project card.
 *
 * Three states:
 *  - ready: shows screenContent (real preview) or a deterministic gradient + initial
 *  - generating: dashed-outline shimmer (newly created project, screens being built)
 *  - empty: blank phone with dashed inner outline (no screens placeholder)
 *
 * Rendered at fixed iPhone-16 9:19.5 aspect ratio. Wraps gracefully in any
 * parent container; supply outer width/height via the parent or style prop.
 *
 * Real screen-thumbnail generation (rendering the project's component-tree
 * to an image) is a separate task. Until then, the gradient+initial fallback
 * keeps cards visually distinct without falling back to broken/empty states.
 */
export function PhoneThumbnail({
  projectName,
  screenContent,
  state = 'ready',
  size = 'md',
  style,
}: PhoneThumbnailProps) {
  const { height, radius } = SIZE_MAP[size]
  const gradientIdx = hashString(projectName) % GRADIENT_PAIRS.length
  const [g1, g2] = GRADIENT_PAIRS[gradientIdx]
  const initial = (projectName?.[0] ?? '?').toUpperCase()

  const phoneStyle: CSSProperties = {
    height,
    aspectRatio: '9 / 19.5',
    background: '#0a0d0e',
    borderRadius: radius,
    border: '1px solid rgba(255,255,255,0.10)',
    boxShadow: '0 8px 22px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.04)',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    ...style,
  }

  const islandStyle: CSSProperties = {
    position: 'absolute',
    top: size === 'sm' ? 2 : 4,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '28%',
    height: size === 'sm' ? 3 : 6,
    borderRadius: 99,
    background: '#000',
    zIndex: 2,
  }

  const statusBarStyle: CSSProperties = {
    height: size === 'sm' ? 8 : 14,
    padding: size === 'sm' ? '0 4px' : '0 6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: size === 'sm' ? 4 : 5,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: 600,
    flexShrink: 0,
  }

  const screenAreaStyle: CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  }

  const tabBarStyle: CSSProperties = {
    height: size === 'sm' ? 6 : 14,
    flexShrink: 0,
    background: 'rgba(255,255,255,0.04)',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  }

  // ----- state-specific inner content -----

  let inner: ReactNode = null

  if (state === 'generating') {
    inner = (
      <div
        data-dash-animated
        style={{
          position: 'absolute',
          inset: size === 'sm' ? '6px 4px' : '18px 12px 22px',
          border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: 6,
          background:
            'linear-gradient(90deg, transparent, rgba(45,212,191,0.06), transparent)',
          backgroundSize: '200% 100%',
          animation: 'dash-shimmer 2.4s linear infinite',
        }}
      />
    )
  } else if (state === 'empty') {
    inner = (
      <div
        style={{
          position: 'absolute',
          inset: size === 'sm' ? '6px 4px' : '18px 12px 22px',
          border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: 6,
        }}
      />
    )
  } else if (screenContent) {
    inner = screenContent
  } else {
    // Fallback: deterministic gradient + uppercase initial.
    inner = (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${g1}, ${g2})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.85)',
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: size === 'sm' ? 12 : Math.round(height * 0.24),
          letterSpacing: '-0.04em',
          textShadow: '0 1px 12px rgba(0,0,0,0.25)',
        }}
      >
        {initial}
      </div>
    )
  }

  return (
    <div
      style={phoneStyle}
      role="img"
      aria-label={
        state === 'generating'
          ? `${projectName} — generating preview`
          : state === 'empty'
            ? `${projectName} — no screens yet`
            : `${projectName} preview`
      }
    >
      <span style={islandStyle} />
      <div style={statusBarStyle} aria-hidden>
        <span>9:41</span>
        <span>●●●</span>
      </div>
      <div style={screenAreaStyle}>{inner}</div>
      <div style={tabBarStyle} aria-hidden />
    </div>
  )
}
