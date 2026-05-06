import { useState } from 'react'
import ChipRow from '../components/ChipRow'
import PlanSummaryCard from '../components/canvas/PlanSummaryCard'

type Extracted = {
  domain: string | null
  primary_action: string | null
  vibe: string | null
  screens: string[] | null
  brand: string | null
}

const EMPTY: Extracted = {
  domain: null,
  primary_action: null,
  vibe: null,
  screens: null,
  brand: null,
}

const STAGES: Extracted[] = [
  EMPTY,
  { ...EMPTY, domain: 'fitness' },
  { ...EMPTY, domain: 'fitness', primary_action: 'track workouts' },
  {
    ...EMPTY,
    domain: 'fitness',
    primary_action: 'track workouts',
    vibe: 'dark, energetic',
  },
  {
    ...EMPTY,
    domain: 'fitness',
    primary_action: 'track workouts',
    vibe: 'dark, energetic',
    screens: ['Home', 'Workouts', 'Workout Detail', 'Progress', 'Profile'],
  },
  {
    domain: 'fitness',
    primary_action: 'track workouts',
    vibe: 'dark, energetic',
    screens: ['Home', 'Workouts', 'Workout Detail', 'Progress', 'Profile'],
    brand: 'FitPulse',
  },
]

/**
 * Internal preview/storybook for Plan Mode UI components.
 * Routed at /__plan-mode-preview for dev-only visual verification.
 * Not advertised in nav. Safe to leave in prod build (no secrets, no
 * data fetches).
 */
export default function PlanModePreview() {
  const [stage, setStage] = useState(0)
  const [readyToBuild, setReadyToBuild] = useState(false)
  const [chipsDisabled, setChipsDisabled] = useState(false)
  const [chipsTimedOut, setChipsTimedOut] = useState(false)
  const [log, setLog] = useState<string[]>([])

  const extracted = STAGES[stage]

  const pushLog = (s: string) =>
    setLog(prev => [`${new Date().toLocaleTimeString()} — ${s}`, ...prev].slice(0, 10))

  const btn: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0A0A0A',
        color: '#e2e8f0',
        fontFamily: "'DM Sans', sans-serif",
        padding: 32,
        display: 'grid',
        gridTemplateColumns: '1fr 420px',
        gap: 32,
      }}
    >
      <div>
        <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 16 }}>
          PlanSummaryCard
        </h2>
        <PlanSummaryCard extracted={extracted} readyToBuild={readyToBuild} />

        <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 8 }}>
          ChipRow
        </h2>
        <div
          style={{
            background: '#1A1A1A',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: 16,
            maxWidth: 520,
          }}
        >
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
            Mokkoi: What's the visual mood you're going for?
          </div>
          <ChipRow
            chips={['Dark and energetic', 'Light and minimal', 'Bold and playful']}
            disabled={chipsDisabled}
            timedOut={chipsTimedOut}
            onTap={chip => pushLog(`tapped: ${chip}`)}
            onRetry={() => {
              setChipsTimedOut(false)
              pushLog('retry tapped')
            }}
          />
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, marginTop: 0, marginBottom: 12, color: '#94a3b8' }}>
          Controls
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
              Extraction stage: {stage} / {STAGES.length - 1}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStage(i)}
                  style={{
                    ...btn,
                    background:
                      stage === i ? 'rgba(45,212,191,0.15)' : btn.background,
                    borderColor:
                      stage === i ? 'rgba(45,212,191,0.45)' : 'rgba(255,255,255,0.1)',
                    color: stage === i ? '#5eead4' : '#e2e8f0',
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={readyToBuild}
              onChange={e => setReadyToBuild(e.target.checked)}
            />
            readyToBuild (pulse)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={chipsDisabled}
              onChange={e => setChipsDisabled(e.target.checked)}
            />
            chips disabled (in-flight)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={chipsTimedOut}
              onChange={e => setChipsTimedOut(e.target.checked)}
            />
            chips timedOut
          </label>
        </div>

        <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 8, color: '#94a3b8' }}>
          Event log
        </h3>
        <div
          style={{
            background: '#1A1A1A',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            color: '#94a3b8',
            fontFamily: 'monospace',
            minHeight: 120,
          }}
        >
          {log.length === 0 ? (
            <span style={{ color: '#475569' }}>(no events yet)</span>
          ) : (
            log.map((l, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                {l}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
