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
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes mokkoi-plancard-pulse {
  0%, 100% {
    border-color: rgba(45,212,191,0.45);
    box-shadow: 0 0 0 0 rgba(45,212,191,0.0), 0 12px 32px rgba(0,0,0,0.35);
  }
  50% {
    border-color: rgba(45,212,191,0.75);
    box-shadow: 0 0 0 4px rgba(45,212,191,0.12), 0 12px 32px rgba(0,0,0,0.35);
  }
}
@keyframes mokkoi-plancard-fadein {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
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

const CATEGORIES: Array<{ key: keyof Extracted; label: string }> = [
  { key: 'domain', label: 'Domain' },
  { key: 'primary_action', label: 'Main action' },
  { key: 'vibe', label: 'Visual vibe' },
  { key: 'screens', label: 'Screens' },
  { key: 'brand', label: 'Brand' },
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
        width: 360,
        padding: 20,
        borderRadius: 16,
        background: '#1A1A1A',
        border: readyToBuild
          ? '1px solid rgba(45,212,191,0.45)'
          : '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        color: '#e2e8f0',
        fontFamily: "'DM Sans', sans-serif",
        animation: readyToBuild
          ? 'mokkoi-plancard-pulse 2s ease-in-out infinite'
          : 'mokkoi-plancard-fadein 240ms ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: isEmpty ? 8 : 16,
          fontSize: 14,
          fontWeight: 600,
          color: '#e2e8f0',
        }}
      >
        <span style={{ fontSize: 16 }}>📋</span>
        {readyToBuild ? 'Plan ready' : 'Plan in progress'}
      </div>

      {isEmpty ? (
        <div
          style={{
            fontSize: 13,
            color: '#64748b',
            lineHeight: 1.5,
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          Talk through your idea with Mokkoi
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CATEGORIES.map(({ key, label }) => {
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
                  fontSize: 13,
                  lineHeight: 1.45,
                  animation: animKey
                    ? 'mokkoi-plancard-rowin 300ms ease-out'
                    : undefined,
                }}
              >
                <div
                  style={{
                    width: 96,
                    flexShrink: 0,
                    color: '#64748b',
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontWeight: 600,
                    paddingTop: 1,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    flex: 1,
                    color: filled ? '#e2e8f0' : '#475569',
                    fontWeight: filled ? 500 : 400,
                    wordBreak: 'break-word',
                  }}
                >
                  {formatValue(key, value)}
                </div>
                {filled && (
                  <span
                    aria-hidden
                    style={{
                      color: '#5eead4',
                      fontSize: 13,
                      paddingTop: 1,
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

      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: readyToBuild ? '#5eead4' : '#64748b',
          fontWeight: readyToBuild ? 600 : 500,
          letterSpacing: 0.3,
        }}
      >
        <span style={{ fontFamily: 'monospace', letterSpacing: 1 }}>
          {CATEGORIES.map((_, i) => (i < filledCount ? '●' : '○')).join('')}
        </span>
        <span>
          {readyToBuild
            ? 'Ready to build'
            : `${filledCount} of ${CATEGORIES.length} categories captured`}
        </span>
      </div>
    </div>
  )
}
