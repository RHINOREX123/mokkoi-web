import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { trackEvent } from '../../lib/analytics'
import { PLANS, type Plan } from '../../lib/pricing'

const COLORS = {
  bg: '#06080D',
  bgCard: '#0D1117',
  bgCardHover: '#151B25',
  border: '#1C2333',
  text: '#E6EDF3',
  textMuted: '#7D8590',
  textDim: '#484F58',
  accent: '#2563EB',
  teal: '#14B8A6',
  gold: '#F59E0B',
} as const

const sectionStyle: CSSProperties = {
  padding: '80px 24px',
  maxWidth: 1240,
  margin: '0 auto',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 20,
  alignItems: 'stretch',
}

function getCardStyle(highlighted: boolean): CSSProperties {
  return {
    background: COLORS.bgCard,
    border: `1px solid ${highlighted ? COLORS.accent : COLORS.border}`,
    borderRadius: 16,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    transition: 'border-color 0.2s, transform 0.2s',
  }
}

const badgeStyle: CSSProperties = {
  position: 'absolute',
  top: -12,
  left: '50%',
  transform: 'translateX(-50%)',
  background: COLORS.accent,
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "'DM Sans', sans-serif",
  padding: '4px 14px',
  borderRadius: 20,
  whiteSpace: 'nowrap',
}

const tierNameStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: COLORS.text,
  fontFamily: "'DM Sans', sans-serif",
  marginBottom: 4,
}

const taglineStyle: CSSProperties = {
  fontSize: 13,
  color: COLORS.textMuted,
  fontFamily: "'DM Sans', sans-serif",
  marginBottom: 12,
}

const priceStyle: CSSProperties = {
  fontSize: 36,
  fontWeight: 700,
  color: COLORS.text,
  fontFamily: "'DM Sans', sans-serif",
  lineHeight: 1,
}

const periodStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 400,
  color: COLORS.textMuted,
  fontFamily: "'DM Sans', sans-serif",
}

const featureListStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '20px 0 24px',
  flex: 1,
}

const featureItemStyle: CSSProperties = {
  fontSize: 13,
  color: COLORS.textMuted,
  fontFamily: "'DM Sans', sans-serif",
  padding: '5px 0',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  lineHeight: 1.5,
}

const dotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: COLORS.teal,
  flexShrink: 0,
  marginTop: 7,
}

function getButtonStyle(plan: Plan, isWaitlist: boolean): CSSProperties {
  const isPopular = plan.badge === 'most-popular'
  const isTeam = plan.id === 'team'
  return {
    width: '100%',
    padding: '11px 0',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    border: isPopular ? 'none' : `1px solid ${COLORS.border}`,
    borderRadius: 10,
    cursor: isWaitlist ? 'not-allowed' : 'pointer',
    background: isPopular ? COLORS.accent : isTeam ? 'rgba(245,158,11,0.1)' : 'transparent',
    color: isPopular ? '#fff' : isTeam ? COLORS.gold : COLORS.text,
    opacity: isWaitlist ? 0.85 : 1,
    transition: 'background 0.2s, border-color 0.2s',
  }
}

export function PricingSection() {
  const navigate = useNavigate()
  const [isAnnual, setIsAnnual] = useState(false)

  const handleCta = (plan: Plan) => {
    trackEvent('pricing_cta_clicked', { tier: plan.id, mode: plan.ctaMode, surface: 'landing' })
    if (plan.ctaMode === 'signup') {
      navigate('/auth')
    } else if (plan.ctaMode === 'mailto') {
      window.location.href = `mailto:${plan.ctaTarget}?subject=Mokkoi%20Team%20plan%20—%20interest`
    } else {
      navigate('/pricing')
    }
  }

  return (
    <section style={sectionStyle}>
      <p
        style={{
          textAlign: 'center',
          fontSize: 16,
          color: COLORS.textMuted,
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: 32,
          maxWidth: 560,
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.5,
        }}
      >
        Build native mobile apps from one prompt. Pay for what you generate — nothing else.
      </p>

      {/* Billing toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '4px 6px',
          border: `1px solid ${COLORS.border}`,
        }}>
          <button onClick={() => setIsAnnual(false)} style={{
            padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            border: 'none', cursor: 'pointer',
            background: !isAnnual ? 'rgba(37,99,235,0.18)' : 'transparent',
            color: !isAnnual ? '#7eaaff' : COLORS.textMuted,
            fontFamily: "'DM Sans', sans-serif",
          }}>Monthly</button>
          <button onClick={() => setIsAnnual(true)} style={{
            padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            border: 'none', cursor: 'pointer',
            background: isAnnual ? 'rgba(37,99,235,0.18)' : 'transparent',
            color: isAnnual ? '#7eaaff' : COLORS.textMuted,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Annual
            <span style={{
              marginLeft: 6, fontSize: 11, fontWeight: 700,
              background: 'rgba(20,184,166,0.18)', color: COLORS.teal,
              padding: '2px 6px', borderRadius: 4,
            }}>Save 15%</span>
          </button>
        </div>
      </div>

      <div style={gridStyle} className="pricing-grid">
        <style>{`
          @media (max-width: 1024px) { .pricing-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (max-width: 600px) { .pricing-grid { grid-template-columns: 1fr !important; } }
        `}</style>
        {PLANS.map((plan) => {
          const highlighted = plan.badge === 'most-popular'
          const price = isAnnual ? plan.annualPrice : plan.monthlyPrice
          const isWaitlist = plan.ctaMode === 'waitlist'
          const buttonLabel = isWaitlist ? 'Coming soon' : plan.cta

          return (
            <div
              key={plan.id}
              style={getCardStyle(highlighted)}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor =
                  highlighted ? COLORS.accent : COLORS.textDim
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor =
                  highlighted ? COLORS.accent : COLORS.border
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
              }}
            >
              {highlighted && <span style={badgeStyle}>Most Popular</span>}

              <div style={tierNameStyle}>{plan.name}</div>
              <div style={taglineStyle}>{plan.tagline}</div>

              <div style={{ marginBottom: 4 }}>
                <span style={priceStyle}>${price}</span>
                <span style={periodStyle}>
                  {price === 0
                    ? '/mo'
                    : plan.perSeat
                      ? `/seat${isAnnual ? '/yr' : '/mo'}`
                      : isAnnual ? '/yr' : '/mo'}
                </span>
              </div>
              {plan.perSeat && plan.minSeats && (
                <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
                  {plan.minSeats}-seat minimum
                </div>
              )}

              <ul style={featureListStyle}>
                {plan.features.map((feature) => (
                  <li key={feature} style={featureItemStyle}>
                    <span style={dotStyle} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={isWaitlist}
                title={isWaitlist ? 'Launching in beta — join the waitlist' : undefined}
                style={getButtonStyle(plan, isWaitlist)}
                onClick={() => handleCta(plan)}
              >
                {buttonLabel} {!isWaitlist && '→'}
              </button>
            </div>
          )
        })}
      </div>

      <div style={{
        textAlign: 'center', marginTop: 28,
        fontSize: 13, color: COLORS.textMuted, fontFamily: "'DM Sans', sans-serif",
      }}>
        See full credit schedule &middot;{' '}
        <a
          href="/pricing"
          style={{ color: '#7eaaff', textDecoration: 'none' }}
          onClick={(e) => { e.preventDefault(); navigate('/pricing') }}
        >
          Compare plans →
        </a>
      </div>
    </section>
  )
}
