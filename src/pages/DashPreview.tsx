import { HeroBackground } from '../components/dashboard/HeroBackground'
import { PhoneThumbnail } from '../components/dashboard/PhoneThumbnail'

/**
 * /dash-preview — internal-only verification page for the Dashboard V2 redesign.
 *
 * Mounts each new dashboard component in isolation so they can be inspected
 * without touching the real Dashboard route. Will be removed (or repurposed
 * as a Storybook-equivalent) once the redesign ships.
 */
export default function DashPreview() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--dash-bg)',
        color: 'var(--dash-text)',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        padding: '40px 24px 80px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <HeroBackground />

      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <header style={{ marginBottom: 40 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 'var(--dash-mono-label-size)',
              letterSpacing: 'var(--dash-mono-label-spacing)',
              textTransform: 'uppercase',
              color: 'var(--dash-text-3)',
              marginBottom: 12,
            }}
          >
            ● DASHBOARD V2 · PHASE 1 PREVIEW
          </div>
          <h1
            style={{
              fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Phone thumbnails &amp; hero atmosphere
          </h1>
          <p style={{ color: 'var(--dash-text-2)', marginTop: 8, fontSize: 14 }}>
            Internal verification of the foundational components from Phase 1 of the
            redesign plan.
          </p>
        </header>

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

        <Section label="PhoneThumbnail · generating (shimmer)">
          <Row>
            <Card>
              <PhoneThumbnail projectName="Untitled project" state="generating" />
              <Caption muted>Generating preview…</Caption>
            </Card>
            <Card>
              <PhoneThumbnail projectName="New project" state="generating" />
              <Caption muted>Generating preview…</Caption>
            </Card>
          </Row>
        </Section>

        <Section label="PhoneThumbnail · empty (no screens)">
          <Row>
            <Card>
              <PhoneThumbnail projectName="Empty project" state="empty" />
              <Caption muted>No screens yet</Caption>
            </Card>
          </Row>
        </Section>

        <Section label="PhoneThumbnail · sm (sidebar size)">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <PhoneThumbnail projectName="TastePlan" size="sm" />
            <PhoneThumbnail projectName="SoundWave" size="sm" />
            <PhoneThumbnail projectName="FitTrack" size="sm" />
            <PhoneThumbnail projectName="Empty" size="sm" state="empty" />
            <PhoneThumbnail projectName="Generating" size="sm" state="generating" />
          </div>
        </Section>
      </div>
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
