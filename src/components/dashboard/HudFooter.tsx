import { useEffect, useState } from 'react'

export interface HudFooterProps {
  /** App version. v1 hardcodes here; later read from package.json/build-time env. */
  version?: string
  /** Model id displayed (status only — no picker). */
  model?: string
  /** Number of apps already built this billing cycle. */
  appCount?: number
  /** Plan limit for apps this cycle. Use Infinity for unlimited (Pro). */
  appLimit?: number
  /** Total project count to display. */
  projectCount?: number
}

/**
 * HudFooter — mono status line below the prompt area.
 *
 *   ◆ MOKKOI v2.4 · SONNET 4.6 · READY · 12/50 BUILDS · 54 PROJECTS
 *
 * Reads as system telemetry, not chrome. Color shifts to amber when the
 * user has hit their plan limit, surfacing the upgrade nudge inline rather
 * than relying on a separate plan banner.
 *
 * READY/OFFLINE flips based on navigator.onLine — no network requests.
 *
 * Spec: docs/superpowers/specs/2026-05-06-dashboard-redesign.md
 */
export function HudFooter({
  version = '2.4',
  model = 'SONNET 4.6',
  appCount = 0,
  appLimit = 50,
  projectCount = 0,
}: HudFooterProps) {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const atLimit = Number.isFinite(appLimit) && appCount >= appLimit
  const limitDisplay = Number.isFinite(appLimit) ? `${appCount}/${appLimit}` : `${appCount}/∞`
  const tone = atLimit
    ? 'var(--dash-accent-amber)'
    : 'var(--dash-text-3)'

  return (
    <footer
      role="status"
      aria-live="off"
      style={{
        marginTop: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        flexWrap: 'wrap',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: tone,
        opacity: 0.7,
      }}
    >
      <span>
        <span style={{ color: 'var(--dash-teal)', marginRight: 6 }}>◆</span>
        MOKKOI v{version}
      </span>
      <Sep />
      <span>{model}</span>
      <Sep />
      <span style={{ color: online ? tone : 'var(--dash-accent-amber)' }}>
        <span
          data-dash-animated
          style={{
            display: 'inline-block',
            marginRight: 6,
            color: online ? 'var(--dash-teal)' : 'var(--dash-accent-amber)',
            animation: 'dash-livepulse 1.6s ease-in-out infinite',
          }}
        >
          ●
        </span>
        {online ? 'READY' : 'OFFLINE'}
      </span>
      <Sep />
      <span style={{ color: atLimit ? 'var(--dash-accent-amber)' : tone }}>
        {limitDisplay} BUILDS
      </span>
      <Sep />
      <span>{projectCount} PROJECTS</span>
    </footer>
  )
}

function Sep() {
  return <span style={{ opacity: 0.35 }}>·</span>
}
