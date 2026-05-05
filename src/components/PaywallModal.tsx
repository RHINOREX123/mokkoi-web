import { useEffect } from 'react'
import { trackEvent } from '../lib/analytics'

interface PaywallModalProps {
  open: boolean
  onClose: () => void
}

const CONTACT_EMAIL = 'contact@mokkoi.com'
const MAILTO_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Mokkoi Pro Early Access')}`

export function PaywallModal({ open, onClose }: PaywallModalProps) {
  useEffect(() => {
    if (open) trackEvent('paywall_shown')
  }, [open])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#111113', borderRadius: 20, padding: 32,
          border: '1px solid rgba(45,212,191,0.2)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 80px rgba(45,212,191,0.08)',
          maxWidth: 460, width: '100%',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px', fontSize: 28, fontWeight: 800, color: '#fff',
        }}>M</div>

        <h2 style={{
          fontSize: 22, fontWeight: 700, color: '#f1f5f9',
          margin: '0 0 10px', textAlign: 'center', letterSpacing: '-0.01em',
        }}>
          You've reached your free trial limit
        </h2>

        <p style={{
          fontSize: 14.5, color: '#94a3b8', margin: '0 0 18px',
          lineHeight: 1.55, textAlign: 'center',
        }}>
          Mokkoi free trial is 2 apps. Upgrade to Pro to keep building.
        </p>

        <div style={{
          fontSize: 12, color: '#5eead4',
          background: 'rgba(45,212,191,0.08)',
          border: '1px solid rgba(45,212,191,0.2)',
          borderRadius: 10, padding: '10px 14px',
          textAlign: 'center', marginBottom: 22,
          fontWeight: 500,
        }}>
          Pro — early access pricing coming soon
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href={MAILTO_HREF}
            onClick={() => trackEvent('paywall_early_access_clicked')}
            style={{
              display: 'block',
              padding: '12px 0', borderRadius: 10,
              fontSize: 14.5, fontWeight: 600,
              background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
              color: '#fff', textDecoration: 'none',
              textAlign: 'center', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(45,212,191,0.3)',
              transition: 'filter 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
          >
            Get Early Access
          </a>
          <button
            onClick={onClose}
            style={{
              padding: '11px 0', borderRadius: 10,
              fontSize: 13.5, fontWeight: 500,
              background: 'transparent', color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.color = '#e2e8f0'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#94a3b8'
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
