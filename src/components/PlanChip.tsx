import { useState, useRef, useEffect } from 'react'
import { Zap, Sparkles, ChevronDown } from 'lucide-react'
import { FREE_APP_LIMIT, type UserPlan } from '../hooks/useUserPlan'

interface PlanChipProps {
  plan: UserPlan
  freeAppCount: number
  onOpenPaywall: () => void
}

/**
 * Plan / free-trial chip used in TopNavbar (project view) and Dashboard.
 *
 * Three visual states:
 *   - paid (pro|max) → solid teal badge, no dropdown
 *   - free under limit → "Free Trial" pill that opens a dropdown with
 *     the X / 2 progress + Upgrade CTA. The count is hidden by default
 *     so the chip stays clean.
 *   - free at limit → inline "Trial used" + Upgrade button. No
 *     dropdown — the upgrade CTA is the entire point at this state.
 */
export function PlanChip({ plan, freeAppCount, onOpenPaywall }: PlanChipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (plan !== 'free') {
    return (
      <div
        data-testid="plan-chip-pro"
        title={`${plan === 'max' ? 'Max' : 'Pro'} plan — unlimited app generations`}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
          letterSpacing: 0.4, textTransform: 'uppercase',
          background: 'linear-gradient(135deg, rgba(45,212,191,0.18), rgba(6,182,212,0.18))',
          border: '1px solid rgba(45,212,191,0.4)',
          color: '#5eead4',
        }}
      >
        <Sparkles size={12} />
        {plan === 'max' ? 'Max' : 'Pro'}
      </div>
    )
  }

  if (freeAppCount >= FREE_APP_LIMIT) {
    return (
      <div
        data-testid="plan-chip-used"
        style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
      >
        <span style={{
          padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          color: '#fca5a5',
        }}>
          Trial used
        </span>
        <button
          onClick={onOpenPaywall}
          style={{
            padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
            border: 'none', color: '#fff', cursor: 'pointer',
            transition: 'filter 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
          onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
        >
          Upgrade
        </button>
      </div>
    )
  }

  // Free, under limit → "Free Trial" with click-to-expand dropdown
  const progress = Math.min(100, (freeAppCount / FREE_APP_LIMIT) * 100)

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        data-testid="plan-chip-free"
        onClick={() => setOpen(o => !o)}
        title={`${freeAppCount} of ${FREE_APP_LIMIT} free app generations used`}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#94a3b8',
          cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      >
        <Zap size={12} />
        Free Trial
        <ChevronDown size={12} style={{
          opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
        }} />
      </button>

      {open && (
        <div
          data-testid="plan-chip-dropdown"
          style={{
            position: 'absolute', top: 36, right: 0,
            background: '#1A1A1A',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            zIndex: 200, padding: 16, minWidth: 240,
          }}
        >
          <div style={{
            fontSize: 11, color: '#64748b', marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600,
          }}>
            Free Trial
          </div>
          <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 10 }}>
            {freeAppCount} of {FREE_APP_LIMIT} free apps used
          </div>
          <div style={{
            height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)',
            marginBottom: 14, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 3, transition: 'width 0.3s',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #2dd4bf, #06b6d4)',
            }} />
          </div>
          <button
            onClick={() => { setOpen(false); onOpenPaywall() }}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)', color: '#fff',
              border: 'none', cursor: 'pointer', transition: 'filter 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
          >
            Upgrade to Pro
          </button>
        </div>
      )}
    </div>
  )
}
