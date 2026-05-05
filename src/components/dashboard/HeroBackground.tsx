import type { CSSProperties } from 'react'

export interface HeroBackgroundProps {
  /** Override outer container styles. Renders absolute by default and fills
   *  the nearest positioned ancestor. */
  style?: CSSProperties
  /** Tone the bloom intensity. 1 = mockup default; 0.6 dimmer; 1.4 punchier. */
  intensity?: number
}

/**
 * HeroBackground — atmospheric layer for the Dashboard V2 hero.
 *
 * Three stacked passes (back → front):
 *  1. Solid graphite base (--dash-bg)
 *  2. Teal+aqua aurora bloom (radial-gradient at bottom-center)
 *  3. Faint dot-grid texture (subtle depth)
 *
 * A vignette mask darkens the edges so content reads center-bright.
 * Pure presentational — no interactivity, pointer-events disabled.
 *
 * Mount inside a position:relative parent and let it fill via inset:0.
 */
export function HeroBackground({ style, intensity = 1 }: HeroBackgroundProps) {
  // The bloom strength scales with intensity. Keep the dot-grid constant —
  // dimming the texture too much makes the surface look flat.
  const bloomAlpha = Math.min(0.32, 0.28 * intensity)
  const sideAlpha = Math.min(0.22, 0.18 * intensity)

  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          background: `
            radial-gradient(ellipse 1300px 520px at 50% 110%, rgba(45,212,191,${bloomAlpha}) 0%, transparent 60%),
            radial-gradient(ellipse 700px 360px at 30% 95%, rgba(6,182,212,${sideAlpha}) 0%, transparent 65%),
            radial-gradient(ellipse 700px 360px at 72% 95%, rgba(45,212,191,${sideAlpha * 0.8}) 0%, transparent 65%),
            var(--dash-bg)
          `,
          ...style,
        }}
      />
      {/* Dot-grid texture, vignette-masked so it fades at edges. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
          backgroundSize: '32px 32px',
          maskImage:
            'radial-gradient(ellipse 80% 60% at 50% 50%, #000 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 50%, #000 40%, transparent 100%)',
        }}
      />
    </>
  )
}
