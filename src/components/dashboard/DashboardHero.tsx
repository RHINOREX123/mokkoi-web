import type { ReactNode } from 'react'
import { HeroBackground } from './HeroBackground'

export interface DashboardHeroProps {
  /** First-name for the welcome greeting. Falls back to "there" if absent. */
  firstName?: string
  /** Whether the user has any projects. Drives the headline copy variant. */
  hasProjects: boolean
  /** Email or display name shown in the mono session label. Falls back to "guest". */
  userHandle?: string
  /** Hero content (prompt card, signals HUD, mode cards, etc.). Wave 3 wires
   *  the real children in; for now any caller may pass arbitrary children. */
  children?: ReactNode
}

function formatSessionDate(date = new Date()): string {
  // 06.05.26 — DD.MM.YY mono style for the session label.
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yy = String(date.getFullYear()).slice(-2)
  return `${dd}.${mm}.${yy}`
}

function formatSessionTime(date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mi}`
}

/**
 * DashboardHero — the centered hero section of the V2 dashboard.
 *
 * Renders (top to bottom):
 *   1. HeroBackground atmospheric layer (graphite + aurora bloom + dot grid)
 *   2. Mono session label   ● BUILD SESSION · DATE · TIME · USER@MOKKOI
 *   3. Welcome headline with teal-aqua gradient name + blinking cursor accent
 *   4. {children} — slot where Wave 3 plugs in PromptCard / SignalsHUD / ModeCards
 *
 * The session label and headline are layout-stable (server-rendering-safe);
 * only animation effects are applied via CSS keyframes scoped to dashboard.
 *
 * Spec: docs/superpowers/specs/2026-05-06-dashboard-redesign.md (§4 row "Welcome
 * headline" and "Session label")
 */
export function DashboardHero({
  firstName,
  hasProjects,
  userHandle,
  children,
}: DashboardHeroProps) {
  const safeName = firstName?.trim() || 'there'
  const safeHandle = (userHandle?.split('@')[0] || 'guest').toUpperCase()

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        padding: '64px 24px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
        // Hero is the surface that owns the atmosphere — children stack above.
      }}
    >
      <HeroBackground />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 720,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        {/* Mono session label */}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 'var(--dash-mono-label-size)',
            letterSpacing: 'var(--dash-mono-label-spacing)',
            textTransform: 'uppercase',
            color: 'var(--dash-text-3)',
            textAlign: 'center',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
          aria-hidden
        >
          <span
            data-dash-animated
            style={{
              color: 'var(--dash-teal)',
              animation: 'dash-livepulse 1.6s ease-in-out infinite',
            }}
          >
            ●
          </span>
          <span>BUILD SESSION</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>{formatSessionDate()}</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>{formatSessionTime()}</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>{safeHandle}@MOKKOI</span>
        </div>

        {/* Welcome headline — variant by hasProjects */}
        <h1
          style={{
            fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
            fontSize: hasProjects ? 44 : 52,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            color: 'var(--dash-text)',
            textAlign: 'center',
            margin: '0 0 12px',
          }}
        >
          {hasProjects ? (
            <>
              Welcome back,{' '}
              <span
                style={{
                  background:
                    'linear-gradient(135deg, var(--dash-teal), var(--dash-teal-2))',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {safeName}
              </span>
              <span
                data-dash-animated
                aria-hidden
                style={{
                  display: 'inline-block',
                  marginLeft: 4,
                  color: 'var(--dash-teal)',
                  animation: 'dash-blink 1s steps(1) infinite',
                }}
              >
                ▎
              </span>
            </>
          ) : (
            <>
              What will you{' '}
              <em
                style={{
                  fontStyle: 'italic',
                  background:
                    'linear-gradient(135deg, var(--dash-teal), var(--dash-teal-2))',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                build
              </em>{' '}
              today?
            </>
          )}
        </h1>

        {!hasProjects && (
          <p
            style={{
              fontSize: 16,
              color: 'var(--dash-text-2)',
              lineHeight: 1.5,
              textAlign: 'center',
              margin: '0 0 32px',
            }}
          >
            Create stunning mobile apps by chatting with AI.
          </p>
        )}

        {children}
      </div>
    </section>
  )
}
