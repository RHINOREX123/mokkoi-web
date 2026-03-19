import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const plans = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    credits: 50,
    highlighted: false,
    cta: 'Get Started',
    features: [
      { label: 'New screen', value: '5 credits' },
      { label: 'Edit screen', value: '1 credit' },
      { label: 'Model', value: 'Haiku for everything' },
      { label: 'Projects', value: '1 project' },
      { label: 'Templates', value: 'Basic templates' },
      { label: 'Exports', value: 'Watermark on exports' },
      { label: 'MCP sync', value: 'Not included' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 19,
    annualPrice: 169,
    credits: 350,
    highlighted: true,
    cta: 'Start Pro',
    features: [
      { label: 'New screen', value: '5 credits' },
      { label: 'Edit screen', value: '1 credit' },
      { label: 'Flow generation', value: '15 credits' },
      { label: 'Screenshot-to-screen', value: '8 credits' },
      { label: 'Models', value: 'Sonnet for new, Haiku for edits' },
      { label: 'MCP canvas sync', value: 'Included' },
      { label: 'Projects', value: '5 projects' },
      { label: 'Templates', value: 'All 28 templates' },
      { label: 'Exports', value: 'Clean exports' },
      { label: 'Top-up', value: '$5 per 100 credits' },
    ],
  },
  {
    id: 'max',
    name: 'Max',
    monthlyPrice: 39,
    annualPrice: 349,
    credits: 1000,
    highlighted: false,
    cta: 'Go Max',
    features: [
      { label: 'New screen', value: '3 credits' },
      { label: 'Edit screen', value: '1 credit' },
      { label: 'Flow generation', value: '10 credits' },
      { label: 'Screenshot-to-screen', value: '5 credits' },
      { label: 'Models', value: 'Sonnet for new, Haiku for edits' },
      { label: 'MCP canvas sync', value: 'Included' },
      { label: 'Projects', value: 'Unlimited projects' },
      { label: 'Templates', value: 'All templates + early access' },
      { label: 'Exports', value: 'Clean exports' },
      { label: 'Top-up', value: '$5 per 100 credits' },
    ],
  },
]

export function NoCreditsModal({
  onClose,
  onTopUp,
  onUpgrade,
}: {
  onClose: () => void
  onTopUp: () => void
  onUpgrade: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1A1A1A', borderRadius: 20, padding: 32,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        maxWidth: 420, width: '90%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>
          You've used all your credits this month
        </h2>
        <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 24px', lineHeight: 1.5 }}>
          Top up or upgrade your plan to keep building.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onTopUp} style={{
            flex: 1, padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            background: 'rgba(99,102,241,0.1)', color: '#818cf8',
            border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer',
            transition: 'all 0.2s',
          }}>
            Top up 100 credits ($5)
          </button>
          <button onClick={onUpgrade} style={{
            flex: 1, padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
          }}>
            Upgrade plan
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  const navigate = useNavigate()
  const [isAnnual, setIsAnnual] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const handleCTA = async (planId: string) => {
    if (planId === 'free') {
      navigate('/auth')
      return
    }

    setLoading(planId)
    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null
      if (!session) {
        navigate('/auth')
        return
      }

      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plan: planId,
          billingCycle: isAnnual ? 'annual' : 'monthly',
          userId: session.user.id,
          email: session.user.email,
        }),
      })

      const data = await res.json()
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        alert(data.error || 'Checkout not available yet')
      }
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#09090b', color: '#f1f5f9',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <style>{`
        @keyframes glow-border { 0%,100% { box-shadow: 0 0 20px rgba(99,102,241,0.15), 0 0 60px rgba(99,102,241,0.05); } 50% { box-shadow: 0 0 30px rgba(99,102,241,0.25), 0 0 80px rgba(99,102,241,0.1); } }
        .pricing-cards { display: flex; gap: 24px; justify-content: center; align-items: stretch; }
        @media (max-width: 900px) { .pricing-cards { flex-direction: column; align-items: center; } .pricing-cards > div { max-width: 400px; width: 100% !important; } }
      `}</style>

      {/* Nav */}
      <nav style={{
        height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', maxWidth: 1200, margin: '0 auto',
      }}>
        <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 14,
          }}>M</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Mokkoi</span>
        </div>
        <button onClick={() => navigate(-1)} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '6px 16px', color: '#94a3b8', fontSize: 13,
          cursor: 'pointer', transition: 'all 0.2s',
        }}>
          Back
        </button>
      </nav>

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '60px 24px 40px' }}>
        <h1 style={{ fontSize: 40, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          Simple, credit-based pricing
        </h1>
        <p style={{ fontSize: 16, color: '#94a3b8', margin: '0 0 32px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
          Pay for what you use. Every generation costs credits. Upgrade anytime.
        </p>

        {/* Billing toggle */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '4px 6px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <button onClick={() => setIsAnnual(false)} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500,
            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            background: !isAnnual ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: !isAnnual ? '#818cf8' : '#64748b',
          }}>Monthly</button>
          <button onClick={() => setIsAnnual(true)} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500,
            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            background: isAnnual ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: isAnnual ? '#818cf8' : '#64748b',
          }}>
            Annual
            <span style={{
              marginLeft: 6, fontSize: 11, fontWeight: 700,
              background: 'rgba(52,211,153,0.15)', color: '#34d399',
              padding: '2px 6px', borderRadius: 4,
            }}>Save 25%+</span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
        <div className="pricing-cards">
          {plans.map(plan => {
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice
            const isHighlighted = plan.highlighted
            const savePct = plan.id === 'pro' ? 26 : plan.id === 'max' ? 25 : 0

            return (
              <div key={plan.id} style={{
                flex: '1 1 0', maxWidth: 360, minWidth: 280, borderRadius: 20, padding: 1,
                background: isHighlighted
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(129,140,248,0.3))'
                  : 'rgba(255,255,255,0.06)',
                animation: isHighlighted ? 'glow-border 3s ease-in-out infinite' : undefined,
              }}>
                <div style={{
                  background: '#111113', borderRadius: 19, padding: 28,
                  height: '100%', display: 'flex', flexDirection: 'column',
                }}>
                  {/* Badge */}
                  {isHighlighted && (
                    <div style={{
                      alignSelf: 'flex-start', marginBottom: 12,
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: 1, color: '#818cf8',
                      background: 'rgba(99,102,241,0.1)', padding: '4px 10px', borderRadius: 6,
                    }}>Recommended</div>
                  )}

                  <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: '#f1f5f9' }}>
                    {plan.name}
                  </h3>
                  <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
                    {plan.credits} credits/month
                  </div>

                  {/* Price */}
                  <div style={{ marginBottom: 20 }}>
                    <span style={{ fontSize: 40, fontWeight: 800, color: '#f1f5f9' }}>
                      ${price === 0 ? '0' : price}
                    </span>
                    {price > 0 && (
                      <span style={{ fontSize: 14, color: '#64748b' }}>
                        /{isAnnual ? 'year' : 'month'}
                      </span>
                    )}
                    {isAnnual && savePct > 0 && (
                      <div style={{ fontSize: 12, color: '#34d399', marginTop: 4 }}>
                        Save {savePct}% vs monthly
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleCTA(plan.id)}
                    disabled={loading === plan.id}
                    style={{
                      width: '100%', padding: '12px 0', borderRadius: 10,
                      fontSize: 15, fontWeight: 600, cursor: 'pointer',
                      border: 'none', transition: 'all 0.2s', marginBottom: 24,
                      background: isHighlighted
                        ? 'linear-gradient(135deg, #6366f1, #818cf8)'
                        : 'rgba(255,255,255,0.06)',
                      color: isHighlighted ? '#fff' : '#e2e8f0',
                      opacity: loading === plan.id ? 0.7 : 1,
                    }}
                  >
                    {loading === plan.id ? 'Loading...' : plan.cta}
                  </button>

                  {/* Features */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {plan.features.map((f, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: 13, padding: '0 0',
                      }}>
                        <span style={{ color: '#94a3b8' }}>{f.label}</span>
                        <span style={{
                          color: f.value === 'Not included' || f.value === 'Watermark on exports'
                            ? '#475569' : '#e2e8f0',
                          fontWeight: 500, textAlign: 'right', fontSize: 12,
                        }}>
                          {f.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
