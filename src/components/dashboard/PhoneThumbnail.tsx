import type { CSSProperties, ReactNode } from 'react'

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
 *  - ready: shows screenContent (real preview from ScreenRenderer/PhoneFrame).
 *           When no screenContent is supplied, falls back to a calm dark
 *           phone with a subtle teal pulse — reads "preview pending" rather
 *           than placeholder. Same look across projects keeps the dashboard
 *           visually quiet so the user's eye stays on the prompt input.
 *  - generating: dashed-outline shimmer (newly created project, screens being
 *                actively built — distinct from the calm pulse fallback).
 *  - empty: blank phone with dashed inner outline (no screens placeholder).
 *
 * Rendered at fixed iPhone-16 9:19.5 aspect ratio. Wraps gracefully in any
 * parent container; supply outer width/height via the parent or style prop.
 */
export function PhoneThumbnail({
  projectName,
  screenContent,
  state = 'ready',
  size = 'md',
  style,
}: PhoneThumbnailProps) {
  const { height, radius } = SIZE_MAP[size]

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
    // Fallback for "ready" projects with no screen preview yet — a calm dark
    // phone interior with a single soft teal pulse. Reads as intentional
    // "preview pending" rather than a colorful placeholder. Identical across
    // projects on purpose — keeps the dashboard visually quiet so the eye
    // stays on the prompt input.
    inner = (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(45,212,191,0.08) 0%, transparent 70%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          aria-hidden
          data-dash-animated
          style={{
            width: size === 'sm' ? 4 : 8,
            height: size === 'sm' ? 4 : 8,
            borderRadius: '50%',
            background: 'var(--dash-teal)',
            boxShadow:
              '0 0 12px rgba(45,212,191,0.6), 0 0 24px rgba(45,212,191,0.3)',
            opacity: 0.55,
            animation: 'dash-livepulse 2.4s ease-in-out infinite',
          }}
        />
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
