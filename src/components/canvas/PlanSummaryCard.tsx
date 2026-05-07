import { useEffect, useRef, useState } from 'react'

type Extracted = {
  domain: string | null
  primary_action: string | null
  vibe: string | null
  screens: string[] | null
  brand: string | null
}

type PlanSummaryCardProps = {
  extracted: Extracted
  readyToBuild: boolean
}

const KEYFRAMES = `
@keyframes mokkoi-plancard-rowin {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes mokkoi-plancard-tick-in {
  from { opacity: 0; transform: scale(0.4) rotate(-90deg); }
  to   { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes mokkoi-plancard-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(45,212,191,0.0), 0 16px 40px rgba(0,0,0,0.45); }
  50%      { box-shadow: 0 0 0 4px rgba(45,212,191,0.18), 0 16px 40px rgba(0,0,0,0.45); }
}
@keyframes mokkoi-plancard-fadein {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes mokkoi-plancard-shine {
  0%   { transform: translateX(-100%); }
  50%  { transform: translateX(100%); }
  100% { transform: translateX(100%); }
}
@keyframes mokkoi-plancard-header-shift {
  from { background-position: 0% 0%; }
  to   { background-position: 200% 0%; }
}
`

let stylesInjected = false
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return
  const tag = document.createElement('style')
  tag.setAttribute('data-mokkoi-plancard', 'true')
  tag.textContent = KEYFRAMES
  document.head.appendChild(tag)
  stylesInjected = true
}

const CATEGORIES: Array<{ key: keyof Extracted; label: string; icon: string }> = [
  { key: 'domain',         label: 'Domain',       icon: '🧭' },
  { key: 'primary_action', label: 'Main action',  icon: '🎯' },
  { key: 'vibe',           label: 'Visual vibe',  icon: '🎨' },
  { key: 'screens',        label: 'Screens',      icon: '📱' },
  { key: 'brand',          label: 'Brand',        icon: '✨' },
]

function isFilled(value: Extracted[keyof Extracted]): boolean {
  if (value === null || value === undefined) return false
  if (Array.isArray(value)) return value.length > 0
  return String(value).trim().length > 0
}

function formatValue(key: keyof Extracted, value: Extracted[keyof Extracted]): string {
  if (!isFilled(value)) return '—'
  if (key === 'screens' && Array.isArray(value)) {
    const list = value.join(', ')
    return `${list} (${value.length} screen${value.length === 1 ? '' : 's'})`
  }
  return String(value)
}

export default function PlanSummaryCard({ extracted, readyToBuild }: PlanSummaryCardProps) {
  ensureStyles()

  const filledCount = CATEGORIES.reduce(
    (n, { key }) => (isFilled(extracted[key]) ? n + 1 : n),
    0,
  )
  const isEmpty = filledCount === 0

  // Track which rows have transitioned null → filled to drive per-row animation
  const prevFilledRef = useRef<Record<string, boolean>>({})
  const [justFilled, setJustFilled] = useState<Record<string, number>>({})

  useEffect(() => {
    const next: Record<string, number> = {}
    let changed = false
    for (const { key } of CATEGORIES) {
      const filled = isFilled(extracted[key])
      const prev = prevFilledRef.current[key as string] ?? false
      if (filled && !prev) {
        next[key as string] = Date.now()
        changed = true
      }
      prevFilledRef.current[key as string] = filled
    }
    if (changed) {
      setJustFilled(prevState => ({ ...prevState, ...next }))
    }
  }, [extracted])

  return (
    <div
      style={{
        width: 380,
        padding: 22,
        borderRadius: 18,
        // Gradient border via padding-box / border-box trick
        background:
          'linear-gradient(rgba(20,20,20,1), rgba(14,14,14,1)) padding-box,' +
          (readyToBuild
            ? ' linear-gradient(135deg, rgba(45,212,191,0.85), rgba(167,139,250,0.85)) border-box'
            : ' linear-gradient(135deg, rgba(45,212,191,0.35), rgba(167,139,250,0.35)) border-box'),
        border: '1px solid transparent',
        color: '#e2e8f0',
        fontFamily: "'DM Sans', sans-serif",
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
        animation: readyToBuild
          ? 'mokkoi-plancard-pulse 2.4s ease-in-out infinite, mokkoi-plancard-fadein 320ms ease-out'
          : 'mokkoi-plancard-fadein 280ms ease-out',
      }}
    >
      {/* Subtle shine sweep across the card every ~8s — adds life without
          being distracting. Only shown while plan is in progress. */}
      {!readyToBuild && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)',
            animation: 'mokkoi-plancard-shine 8s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Header: "Building your app's DNA" with shifting gradient text. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isEmpty ? 10 : 18,
          position: 'relative',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            background: readyToBuild
              ? 'linear-gradient(90deg, #5eead4, #c4b5fd, #5eead4)'
              : 'linear-gradient(90deg, rgba(94,234,212,0.7), rgba(167,139,250,0.7), rgba(94,234,212,0.7))',
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            animation: 'mokkoi-plancard-header-shift 6s linear infinite',
          }}
        >
          {readyToBuild ? '✨ Plan ready · ready to build' : "✨ Building your app's DNA"}
        </div>
        <span style={{ fontSize: 18, opacity: 0.85 }}>📋</span>
      </div>

      {isEmpty ? (
        <div
          style={{
            fontSize: 13,
            color: '#64748b',
            lineHeight: 1.55,
            paddingTop: 4,
            paddingBottom: 8,
            position: 'relative',
          }}
        >
          Talk through your idea with Mokkoi.<br />
          As you chat, your app's plan fills in here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
          {CATEGORIES.map(({ key, label, icon }) => {
            const value = extracted[key]
            const filled = isFilled(value)
            const animKey = justFilled[key as string]
            return (
              <div
                key={key as string}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: filled
                    ? 'linear-gradient(90deg, rgba(45,212,191,0.06), rgba(167,139,250,0.04))'
                    : 'transparent',
                  border: filled
                    ? '1px solid rgba(45,212,191,0.14)'
                    : '1px solid transparent',
                  fontSize: 13,
                  lineHeight: 1.5,
                  animation: animKey
                    ? 'mokkoi-plancard-rowin 360ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                    : undefined,
                  transition: 'background 240ms ease, border-color 240ms ease',
                }}
              >
                <div
                  style={{
                    width: 24,
                    flexShrink: 0,
                    fontSize: 16,
                    lineHeight: 1.2,
                    textAlign: 'center',
                    filter: filled ? 'none' : 'grayscale(0.7)',
                    opacity: filled ? 1 : 0.45,
                    transition: 'filter 240ms, opacity 240ms',
                  }}
                  aria-hidden
                >
                  {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: filled ? '#5eead4' : '#475569',
                      marginBottom: 2,
                      transition: 'color 240ms',
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      color: filled ? '#e2e8f0' : '#475569',
                      fontWeight: filled ? 500 : 400,
                      wordBreak: 'break-word',
                    }}
                  >
                    {formatValue(key, value)}
                  </div>
                </div>
                {filled && (
                  <span
                    aria-hidden
                    style={{
                      color: '#5eead4',
                      fontSize: 14,
                      flexShrink: 0,
                      paddingTop: 12,
                      animation: animKey
                        ? 'mokkoi-plancard-tick-in 360ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                        : undefined,
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer: progress dots + status text */}
      <div
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: readyToBuild ? '#5eead4' : '#64748b',
          fontWeight: readyToBuild ? 600 : 500,
          letterSpacing: 0.3,
          position: 'relative',
        }}
      >
        <span style={{ fontFamily: 'monospace', letterSpacing: 2, fontSize: 14 }}>
          {CATEGORIES.map((_, i) => (i < filledCount ? '●' : '○')).join('')}
        </span>
        <span>
          {readyToBuild
            ? 'Ready to build'
            : `${filledCount} of ${CATEGORIES.length} captured`}
        </span>
      </div>
    </div>
  )
}
