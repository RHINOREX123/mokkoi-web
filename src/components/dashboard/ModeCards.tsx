import type { CSSProperties, ReactNode } from 'react'
import { Zap, Diamond } from 'lucide-react'

export type DashboardMode = 'build' | 'import'

export interface ModeCardsProps {
  /** Called when the user picks a mode card. The dashboard wires this to:
   *   - 'build':  focus the prompt textarea (no submit; user types)
   *   - 'import': open the HTML import flow */
  onMode: (mode: DashboardMode) => void
}

/**
 * ModeCards — two cards under the prompt input.
 *
 *  ⚡ Build       — generate full app from your prompt
 *  ◇  Import HTML — bring in your code via MCP / paste
 *
 * The "From a screenshot" card was consolidated into the Camera button on
 * the PromptCard itself, which now supports up to 4 reference images. One
 * image-attach paradigm instead of two.
 *
 * Each card is keyboard-accessible (button), reports its mode by aria-label,
 * and uses a tinted badge color to read distinctly at a glance.
 *
 * Spec: docs/superpowers/specs/2026-05-06-dashboard-redesign.md (§6)
 */
export function ModeCards({ onMode }: ModeCardsProps) {
  return (
    <div
      role="group"
      aria-label="Build modes"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
        marginTop: 14,
      }}
    >
      <Card
        ariaLabel="Generate full app from prompt"
        onClick={() => onMode('build')}
        badge={
          <Badge tone="teal">
            <Zap size={12} /> Build
          </Badge>
        }
        title="Generate full app"
        desc="Multi-screen React Native app from your prompt."
      />
      <Card
        ariaLabel="Import HTML"
        onClick={() => onMode('import')}
        badge={
          <Badge tone="lavender">
            <Diamond size={12} /> Import HTML
          </Badge>
        }
        title="Bring your code over"
        desc="Paste HTML, React, or Tailwind — get a mobile screen."
      />
    </div>
  )
}

// ---- internals ------------------------------------------------------------

function Card({
  ariaLabel,
  onClick,
  badge,
  title,
  desc,
}: {
  ariaLabel: string
  onClick: () => void
  badge: ReactNode
  title: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: 14,
        padding: 14,
        background: 'var(--dash-surface)',
        border: '1px solid var(--dash-border)',
        color: 'var(--dash-text)',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(45,212,191,0.35)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--dash-border)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ marginBottom: 8 }}>{badge}</div>
      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{title}</div>
      <div style={{ color: 'var(--dash-text-3)', fontSize: 12, lineHeight: 1.45 }}>
        {desc}
      </div>
    </button>
  )
}

function Badge({
  tone,
  children,
}: {
  tone: 'teal' | 'amber' | 'lavender'
  children: ReactNode
}) {
  const palette: Record<typeof tone, { bg: string; fg: string; border: string }> = {
    teal: {
      bg: 'rgba(45,212,191,0.12)',
      fg: 'var(--dash-teal)',
      border: 'rgba(45,212,191,0.3)',
    },
    amber: {
      bg: 'rgba(251,191,36,0.10)',
      fg: 'var(--dash-accent-amber)',
      border: 'rgba(251,191,36,0.25)',
    },
    lavender: {
      bg: 'rgba(167,139,250,0.10)',
      fg: 'var(--dash-accent-lavender)',
      border: 'rgba(167,139,250,0.25)',
    },
  }
  const c = palette[tone]
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: c.bg,
    color: c.fg,
    border: `1px solid ${c.border}`,
  }
  return <span style={style}>{children}</span>
}
