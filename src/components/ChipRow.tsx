import { useState } from 'react'

type ChipRowProps = {
  chips: string[]
  onTap: (chip: string) => void
  disabled?: boolean
  timedOut?: boolean
  onRetry?: () => void
}

const KEYFRAMES = `
@keyframes mokkoi-chiprow-fadeout {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-2px); }
}
@keyframes mokkoi-chiprow-fadein {
  from { opacity: 0; transform: translateY(2px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes mokkoi-chiprow-spin {
  to { transform: rotate(360deg); }
}
`

let stylesInjected = false
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return
  const tag = document.createElement('style')
  tag.setAttribute('data-mokkoi-chiprow', 'true')
  tag.textContent = KEYFRAMES
  document.head.appendChild(tag)
  stylesInjected = true
}

export default function ChipRow({
  chips,
  onTap,
  disabled = false,
  timedOut = false,
  onRetry,
}: ChipRowProps) {
  ensureStyles()
  const [tappedChip, setTappedChip] = useState<string | null>(null)
  const [hoverChip, setHoverChip] = useState<string | null>(null)

  if (timedOut) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 2px',
          fontFamily: "'DM Sans', sans-serif",
          animation: 'mokkoi-chiprow-fadein 200ms ease-out',
        }}
      >
        <span style={{ fontSize: 12, color: '#fca5a5' }}>
          Network slow — tap to retry
        </span>
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '5px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.35)',
            color: '#fca5a5',
            cursor: 'pointer',
            transition: 'background 0.15s',
            fontFamily: "'DM Sans', sans-serif",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.18)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '6px 2px 2px',
        position: 'relative',
        fontFamily: "'DM Sans', sans-serif",
        animation: tappedChip
          ? 'mokkoi-chiprow-fadeout 200ms ease-out forwards'
          : 'mokkoi-chiprow-fadein 220ms ease-out',
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        transition: 'opacity 180ms ease',
      }}
    >
      {chips.map(chip => {
        const isHover = hoverChip === chip
        return (
          <button
            key={chip}
            type="button"
            disabled={disabled}
            onClick={() => {
              setTappedChip(chip)
              onTap(chip)
            }}
            onMouseEnter={() => setHoverChip(chip)}
            onMouseLeave={() => setHoverChip(null)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              background: isHover
                ? 'rgba(45,212,191,0.08)'
                : 'rgba(255,255,255,0.04)',
              border: isHover
                ? '1px solid rgba(45,212,191,0.35)'
                : '1px solid rgba(255,255,255,0.1)',
              color: isHover ? '#5eead4' : '#e2e8f0',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {chip}
          </button>
        )
      })}

      {disabled && (
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.18)',
            borderTopColor: '#5eead4',
            animation: 'mokkoi-chiprow-spin 0.8s linear infinite',
            alignSelf: 'center',
            marginLeft: 4,
          }}
        />
      )}
    </div>
  )
}
