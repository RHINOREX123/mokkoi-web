import { useState } from 'react'
import { DashboardHero } from '../components/dashboard/DashboardHero'
import { HudFooter } from '../components/dashboard/HudFooter'
import { ModeCards, type DashboardMode } from '../components/dashboard/ModeCards'
import { PhoneThumbnail } from '../components/dashboard/PhoneThumbnail'
import { PromptCard, type SubmitMode } from '../components/dashboard/PromptCard'
import { SignalsHUD, type SignalsState } from '../components/dashboard/SignalsHUD'
import { usePromptScore } from '../components/dashboard/usePromptScore'

/**
 * /dash-preview — internal-only verification page for the Dashboard V2 redesign.
 *
 * Mounts each new dashboard component in isolation so they can be inspected
 * without touching the real Dashboard route. Will be removed (or repurposed
 * as a Storybook-equivalent) once the redesign ships.
 */
export default function DashPreview() {
  // ---- live demo state ----
  const [prompt, setPrompt] = useState(
    'A meal planning app with weekly calendar, recipe browser, and auto shopping list',
  )
  const [mode, setMode] = useState<SubmitMode>('build')
  const [forcedHudState, setForcedHudState] = useState<SignalsState | 'auto'>('auto')
  const score = usePromptScore(prompt)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--dash-bg)',
        color: 'var(--dash-text)',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        padding: '0 0 80px',
      }}
    >
      {/* Top control bar (verification page only) */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          padding: '12px 20px',
          background: 'rgba(7,9,10,0.85)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid var(--dash-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--dash-text-3)',
        }}
      >
        <span style={{ color: 'var(--dash-teal)', fontWeight: 700 }}>
          MOKKOI · DASHBOARD V2 · PHASE 2 PREVIEW
        </span>
        <span style={{ flex: 1 }} />
        <span>HUD STATE</span>
        <Seg
          options={['auto', 'idle', 'submitted']}
          value={forcedHudState}
          onChange={(v) => setForcedHudState(v as SignalsState | 'auto')}
        />
      </div>

      {/* Live hero with prompt input + signals + modes wired together. */}
      <DashboardHero firstName="Sahil" hasProjects userHandle="sahil@mokkoi.com">
        <PromptCard
          value={prompt}
          onChange={setPrompt}
          onSubmit={(m) => alert(`Submit: ${m}\n\n${prompt || '(empty prompt)'}`)}
          mode={mode}
          onModeChange={setMode}
          disabled={forcedHudState === 'submitted'}
        />
        <SignalsHUD
          score={score}
          state={forcedHudState === 'auto' ? undefined : forcedHudState}
          projectName="TastePlan"
          screenCount={4}
        />
        <ModeCards onMode={(m: DashboardMode) => alert(`Mode: ${m}`)} />
        <HudFooter
          version="2.4"
          model="SONNET 4.6"
          appCount={12}
          appLimit={50}
          projectCount={54}
        />
      </DashboardHero>

      {/* PhoneThumbnail gallery (Phase 1 verification — kept for reference) */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        <Section label="PhoneThumbnail · ready (gradient + initial fallback)">
          <Row>
            <Card>
              <PhoneThumbnail projectName="TastePlan" />
              <Caption>TastePlan</Caption>
            </Card>
            <Card>
              <PhoneThumbnail projectName="SoundWave" />
              <Caption>SoundWave</Caption>
            </Card>
            <Card>
              <PhoneThumbnail projectName="FitTrack" />
              <Caption>FitTrack</Caption>
            </Card>
            <Card>
              <PhoneThumbnail projectName="ShopKart" />
              <Caption>ShopKart</Caption>
            </Card>
          </Row>
        </Section>

        <Section label="PhoneThumbnail · generating / empty">
          <Row>
            <Card>
              <PhoneThumbnail projectName="Untitled project" state="generating" />
              <Caption muted>Generating preview…</Caption>
            </Card>
            <Card>
              <PhoneThumbnail projectName="Empty project" state="empty" />
              <Caption muted>No screens yet</Caption>
            </Card>
          </Row>
        </Section>
      </div>
    </div>
  )
}

// ---- internal helpers ----------------------------------------------------

function Seg({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<string>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--dash-surface)',
        border: '1px solid var(--dash-border)',
        borderRadius: 10,
        padding: 3,
      }}
    >
      {options.map((o) => {
        const active = o === value
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            style={{
              padding: '6px 12px',
              borderRadius: 7,
              border: 'none',
              background: active
                ? 'linear-gradient(135deg, var(--dash-teal), var(--dash-teal-2))'
                : 'transparent',
              color: active ? '#001a1f' : 'var(--dash-text-2)',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--dash-text-3)',
          marginBottom: 14,
        }}
      >
        {label}
      </div>
      {children}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 16,
      }}
    >
      {children}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0))',
        border: '1px solid var(--dash-border)',
        borderRadius: 14,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {children}
    </div>
  )
}

function Caption({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div
      style={{
        fontSize: 12.5,
        color: muted ? 'var(--dash-teal)' : 'var(--dash-text)',
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  )
}
