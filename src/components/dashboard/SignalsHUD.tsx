import { useEffect, useState, type CSSProperties } from 'react'
import type { PromptScore } from './usePromptScore'

const IDLE_TIPS: ReadonlyArray<string> = [
  'TIP: BE SPECIFIC ABOUT THE USER’S MAIN GOAL',
  'TIP: NAME 2-3 KEY SCREENS',
  'TIP: DESCRIBE THE VISUAL VIBE',
  'TIP: MENTION THE PRIMARY USER ACTION',
]

const IDLE_TIPS_PLAN: ReadonlyArray<string> = [
  'PLAN MODE — SHARE YOUR IDEA, I’LL ASK QUESTIONS',
  'PLAN MODE — UNCERTAINTY IS WELCOME HERE',
  'PLAN MODE — WE SHAPE THE BRIEF TOGETHER',
]

export type SignalsState = 'idle' | 'submitted'

export interface SignalsHUDProps {
  /** Live prompt score, or null when the prompt is empty. */
  score: PromptScore | null
  /** Forced state override:
   *   - 'idle' renders the coaching tips even if a score exists (rare;
   *     mostly used in tests / Storybook-equivalent verification)
   *   - 'submitted' renders the locked-in confirmation variant
   *   - undefined infers from score: null → idle, present → typing */
  state?: SignalsState
  /** Project name to interpolate into the SUBMITTED state's BUILDING line. */
  projectName?: string
  /** Screen count to interpolate into the SUBMITTED state's BUILDING line. */
  screenCount?: number
  /** Submit mode driving idle-tip rotation. Plan mode shows a different
   *  tip pool (uncertainty-friendly, "we'll plan together"). */
  mode?: 'build' | 'plan'
}

/**
 * SignalsHUD — the live AI clarity readout below the prompt input.
 *
 * Three visual states:
 *   1. IDLE      → no prompt yet. Shows "MOKKOI READY" + a rotating coaching
 *                  tip every 6s. Always teaching, never empty.
 *   2. TYPING    → live signals: clarity bar, specificity number, scope tag,
 *                  trailing improvement hint. Scanline pulse animates.
 *   3. SUBMITTED → score values frozen with green checkmarks; a
 *                  "BUILDING ... · N SCREENS" status replaces the hint.
 *
 * The HUD never blocks submission — even at very low clarity. Auto-suggesting
 * Plan mode (when clarity < 50) is wired up in Step 10 (Wave 3); SignalsHUD
 * itself is purely informational.
 *
 * Spec: docs/superpowers/specs/2026-05-06-dashboard-redesign.md (§5)
 */
export function SignalsHUD({
  score,
  state,
  projectName = 'TASTEPLAN',
  screenCount = 4,
  mode = 'build',
}: SignalsHUDProps) {
  const resolvedState: SignalsState | 'typing' =
    state === 'submitted' ? 'submitted' : score == null || state === 'idle' ? 'idle' : 'typing'

  const tips = mode === 'plan' ? IDLE_TIPS_PLAN : IDLE_TIPS

  // Rotate idle tips every 6s for ambient teaching. Reset index when the
  // mode changes so we don't index past the shorter Plan-mode array.
  const [tipIdx, setTipIdx] = useState(0)
  useEffect(() => {
    setTipIdx(0)
  }, [mode])
  useEffect(() => {
    if (resolvedState !== 'idle') return
    const id = setInterval(() => setTipIdx((i) => (i + 1) % tips.length), 6000)
    return () => clearInterval(id)
  }, [resolvedState, tips])

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginTop: 14,
        padding: '10px 14px',
        background: 'rgba(8, 12, 14, 0.6)',
        border: '1px solid var(--dash-border)',
        borderRadius: 12,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10.5,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--dash-text-3)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        overflow: 'hidden',
        flexWrap: 'wrap',
      }}
    >
      {/* Scanline pulse on top edge. */}
      <span
        data-dash-animated
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 1,
          background:
            'linear-gradient(90deg, transparent, rgba(45,212,191,0.5), transparent)',
          backgroundSize: '50% 100%',
          backgroundRepeat: 'no-repeat',
          animation: 'dash-scanline 3.2s linear infinite',
        }}
      />

      {resolvedState === 'idle' && (
        <>
          <Sig>
            <span style={{ color: 'var(--dash-teal)' }}>●</span>
            <Lbl>MOKKOI READY</Lbl>
          </Sig>
          <Spacer />
          <span style={{ color: 'var(--dash-text-2)', fontWeight: 500 }}>
            <span style={{ color: 'var(--dash-teal)', marginRight: 8 }}>↳</span>
            {tips[tipIdx]}
          </span>
          <span style={{ opacity: 0.7 }}>EXAMPLES ↗</span>
        </>
      )}

      {resolvedState === 'typing' && score && (
        <>
          <Sig>
            <Lbl>
              <span style={{ color: 'var(--dash-teal)' }}>●</span> CLARITY
            </Lbl>
            <MicroBar value={score.clarity} />
            <Val tone="t">{score.clarity}</Val>
          </Sig>
          <Sig>
            <Lbl>SPECIFICITY</Lbl>
            <Val>{score.specificity}</Val>
          </Sig>
          <Sig>
            <Lbl>SCOPE</Lbl>
            <Val>{score.scope.toUpperCase()}</Val>
          </Sig>
          <Spacer />
          <span style={{ opacity: 0.7 }}>↳ {score.topImprovement}</span>
        </>
      )}

      {resolvedState === 'submitted' && (
        <>
          <Sig>
            <Lbl>
              <span style={{ color: 'var(--dash-teal)' }}>✓</span> CLARITY
            </Lbl>
            <Val tone="t">{score?.clarity ?? '—'}</Val>
          </Sig>
          <Sig>
            <Lbl>
              <span style={{ color: 'var(--dash-teal)' }}>✓</span> SPECIFICITY
            </Lbl>
            <Val tone="t">{score?.specificity ?? '—'}</Val>
          </Sig>
          <Sig>
            <Lbl>
              <span style={{ color: 'var(--dash-teal)' }}>✓</span> SCOPE
            </Lbl>
            <Val tone="t">{score?.scope?.toUpperCase() ?? '—'}</Val>
          </Sig>
          <Spacer />
          <span style={{ color: 'var(--dash-text-2)', fontWeight: 500 }}>
            <span style={{ color: 'var(--dash-teal)', marginRight: 4 }}>↳</span>
            BUILDING {projectName.toUpperCase()} · {screenCount} SCREENS…
          </span>
        </>
      )}
    </div>
  )
}

// ---- internals ------------------------------------------------------------

function Sig({ children }: { children: React.ReactNode }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{children}</span>
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--dash-text-3)' }}>{children}</span>
}

function Val({ children, tone }: { children: React.ReactNode; tone?: 't' }) {
  const style: CSSProperties = {
    color: tone === 't' ? 'var(--dash-teal)' : 'var(--dash-text)',
    fontWeight: 600,
  }
  return <span style={style}>{children}</span>
}

function Spacer() {
  return <span style={{ flex: 1 }} />
}

/** 10-segment micro-bar visualizing a 0–100 value. Segments above value are
 *  dim teal; segments at and below are full teal. */
function MicroBar({ value }: { value: number }) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * 10)
  return (
    <span
      aria-hidden
      style={{ display: 'inline-flex', gap: 1.5, alignItems: 'center' }}
    >
      {Array.from({ length: 10 }).map((_, i) => {
        const on = i < filled
        const dim = on && i >= filled - 2 // last 2 lit segments dim for taper
        return (
          <span
            key={i}
            style={{
              width: 4,
              height: 8,
              borderRadius: 1,
              background: on
                ? dim
                  ? 'rgba(45,212,191,0.5)'
                  : 'var(--dash-teal)'
                : 'rgba(255,255,255,0.10)',
              boxShadow: on && !dim ? '0 0 4px var(--dash-teal)' : 'none',
            }}
          />
        )
      })}
    </span>
  )
}
