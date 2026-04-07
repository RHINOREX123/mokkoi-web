import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { trackEvent } from '../../lib/analytics'

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
  purple: '#A855F7',
  orange: '#F97316',
} as const

interface Tier {
  name: string
  price: string
  period: string
  features: string[]
  cta: string
  highlighted: boolean
}

const tiers: Tier[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    features: [
      '50 generations/month',
      'Single screen generation',
      'PNG + TSX + ZIP export',
      'Community support',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/month',
    features: [
      'Unlimited generations',
      'Generate App (multi-screen)',
      'Expo project export',
      'Priority AI (Sonnet)',
    ],
    cta: 'Start Building',
    highlighted: true,
  },
  {
    name: 'Max',
    price: '$39',
    period: '/month',
    features: [
      'Everything in Pro',
      'MCP server access',
      'API access',
      'Priority support',
    ],
    cta: 'Go Max',
    highlighted: false,
  },
]

const sectionStyle: CSSProperties = {
  padding: '80px 24px',
  maxWidth: 1100,
  margin: '0 auto',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 24,
  alignItems: 'stretch',
}

function getCardStyle(highlighted: boolean): CSSProperties {
  return {
    background: COLORS.bgCard,
    border: `1px solid ${highlighted ? COLORS.accent : COLORS.border}`,
    borderRadius: 16,
    padding: 32,
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
  marginBottom: 8,
}

const priceStyle: CSSProperties = {
  fontSize: 40,
  fontWeight: 700,
  color: COLORS.text,
  fontFamily: "'DM Sans', sans-serif",
  lineHeight: 1,
}

const periodStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 400,
  color: COLORS.textMuted,
  fontFamily: "'DM Sans', sans-serif",
}

const featureListStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '24px 0 32px',
  flex: 1,
}

const featureItemStyle: CSSProperties = {
  fontSize: 14,
  color: COLORS.textMuted,
  fontFamily: "'DM Sans', sans-serif",
  padding: '6px 0',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const dotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: COLORS.teal,
  flexShrink: 0,
}

function getButtonStyle(highlighted: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '12px 0',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    border: highlighted ? 'none' : `1px solid ${COLORS.border}`,
    borderRadius: 10,
    cursor: 'pointer',
    background: highlighted ? COLORS.accent : 'transparent',
    color: highlighted ? '#fff' : COLORS.text,
    transition: 'background 0.2s, border-color 0.2s',
  }
}

export function PricingSection() {
  const navigate = useNavigate()

  const handleCta = (tierName: string) => {
    trackEvent('pricing_cta_clicked', { tier: tierName.toLowerCase() })
    navigate('/auth')
  }

  return (
    <section style={sectionStyle} id="pricing">
      <h2
        style={{
          textAlign: 'center',
          fontSize: 32,
          fontWeight: 700,
          color: COLORS.text,
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: 12,
        }}
      >
        Simple pricing
      </h2>
      <p
        style={{
          textAlign: 'center',
          fontSize: 16,
          color: COLORS.textMuted,
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: 48,
          maxWidth: 480,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        Start free, upgrade when you need more power.
      </p>

      <div style={gridStyle}>
        {tiers.map((tier) => (
          <div
            key={tier.name}
            style={getCardStyle(tier.highlighted)}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor =
                tier.highlighted ? COLORS.accent : COLORS.textDim
              ;(e.currentTarget as HTMLElement).style.transform =
                'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor =
                tier.highlighted ? COLORS.accent : COLORS.border
              ;(e.currentTarget as HTMLElement).style.transform =
                'translateY(0)'
            }}
          >
            {tier.highlighted && (
              <span style={badgeStyle}>Most Popular</span>
            )}

            <div style={tierNameStyle}>{tier.name}</div>
            <div style={{ marginBottom: 4 }}>
              <span style={priceStyle}>{tier.price}</span>
              <span style={periodStyle}>{tier.period}</span>
            </div>

            <ul style={featureListStyle}>
              {tier.features.map((feature) => (
                <li key={feature} style={featureItemStyle}>
                  <span style={dotStyle} />
                  {feature}
                </li>
              ))}
            </ul>

            <button
              type="button"
              style={getButtonStyle(tier.highlighted)}
              onClick={() => handleCta(tier.name)}
              onMouseEnter={(e) => {
                if (!tier.highlighted) {
                  ;(e.currentTarget as HTMLElement).style.background =
                    COLORS.bgCardHover
                } else {
                  ;(e.currentTarget as HTMLElement).style.background =
                    '#2563EB'
                }
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background =
                  tier.highlighted ? COLORS.accent : 'transparent'
              }}
            >
              {tier.cta} &rarr;
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
