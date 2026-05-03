import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { trackEvent } from '../lib/analytics'
import { ChevronDown, ChevronUp, Check } from 'lucide-react'
import { PLANS, CREDIT_COSTS, FAQS, HERO, TRUST_BAND, type Plan } from '../lib/pricing'

/* ─── NoCreditsModal (kept for App.tsx import compatibility) ─── */
export function NoCreditsModal({
  onClose,
  onTopUp,
  onUpgrade,
}: {
  onClose: () => void
  onTopUp: () => void
  onUpgrade: () => void
}) {
  useEffect(() => { trackEvent('credits_exhausted') }, [])

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
          You've reached your monthly credit limit
        </h2>
        <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 24px', lineHeight: 1.5 }}>
          Top up for more credits or upgrade your plan to keep building.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onTopUp} style={{
            flex: 1, padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            background: 'rgba(99,102,241,0.1)', color: '#818cf8',
            border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer',
          }}>Top up</button>
          <button onClick={onUpgrade} style={{
            flex: 1, padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff',
            border: 'none', cursor: 'pointer',
          }}>Upgrade</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Waitlist email modal ─── */
function WaitlistModal({
  plan,
  onClose,
}: {
  plan: Plan
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    trackEvent('pricing_waitlist_join', { plan: plan.id, email })
    setSubmitted(true)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#111113', borderRadius: 20, padding: 32,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          maxWidth: 440, width: '100%',
        }}
      >
        {!submitted ? (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>
              {plan.name} — launching soon
            </h2>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              Drop your email and we'll let you know the moment {plan.name} opens. No spam.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px 14px', borderRadius: 10, fontSize: 15,
                  background: 'rgba(255,255,255,0.04)', color: '#f1f5f9',
                  border: '1px solid rgba(255,255,255,0.1)', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    background: 'transparent', color: '#94a3b8',
                    border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  Join waitlist
                </button>
              </div>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>
              You're on the list
            </h2>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 20px' }}>
              We'll email you the moment {plan.name} opens.
            </p>
            <button
              onClick={onClose}
              style={{
                padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff',
                border: 'none', cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── FAQ Item ─── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 0', background: 'transparent', border: 'none',
          cursor: 'pointer', color: '#e2e8f0', fontSize: 15, fontWeight: 500, textAlign: 'left',
        }}
      >
        {q}
        {open ? <ChevronUp size={16} style={{ color: '#64748b', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: '#64748b', flexShrink: 0 }} />}
      </button>
      {open && (
        <p style={{ margin: '0 0 18px', fontSize: 14, color: '#94a3b8', lineHeight: 1.6 }}>
          {a}
        </p>
      )}
    </div>
  )
}

/* ─── Pricing Page ─── */
export default function PricingPage() {
  const navigate = useNavigate()
  const [isAnnual, setIsAnnual] = useState(false)
  const [waitlistPlan, setWaitlistPlan] = useState<Plan | null>(null)

  useEffect(() => { trackEvent('pricing_page_viewed') }, [])

  const handleCTA = (plan: Plan) => {
    trackEvent('pricing_cta_clicked', { plan: plan.id, billing: isAnnual ? 'annual' : 'monthly', mode: plan.ctaMode })
    if (plan.ctaMode === 'signup') {
      navigate('/auth')
    } else if (plan.ctaMode === 'mailto') {
      window.location.href = `mailto:${plan.ctaTarget}?subject=Mokkoi%20Team%20plan%20—%20interest`
    } else {
      setWaitlistPlan(plan)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#09090b', color: '#f1f5f9',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <style>{`
        @keyframes glow-border { 0%,100% { box-shadow: 0 0 20px rgba(99,102,241,0.15), 0 0 60px rgba(99,102,241,0.05); } 50% { box-shadow: 0 0 30px rgba(99,102,241,0.25), 0 0 80px rgba(99,102,241,0.1); } }
        .pricing-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; align-items: stretch; }
        @media (max-width: 1100px) { .pricing-cards { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .pricing-cards { grid-template-columns: 1fr; } }
        .tier-cta[disabled] { cursor: not-allowed; opacity: 0.85; }
        .tier-cta-wrap:hover .tooltip { opacity: 1; transform: translateY(-4px); }
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
        <button onClick={() => navigate('/')} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '6px 16px', color: '#94a3b8', fontSize: 13,
          cursor: 'pointer',
        }}>
          Back
        </button>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '60px 24px 40px' }}>
        <h1 style={{ fontSize: 44, fontWeight: 800, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
          {HERO.headline}
        </h1>
        <p style={{ fontSize: 17, color: '#94a3b8', margin: '0 0 32px', maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
          {HERO.subhead}
        </p>

        {/* Billing toggle */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '4px 6px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <button onClick={() => setIsAnnual(false)} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500,
            border: 'none', cursor: 'pointer',
            background: !isAnnual ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: !isAnnual ? '#818cf8' : '#64748b',
          }}>Monthly</button>
          <button onClick={() => setIsAnnual(true)} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500,
            border: 'none', cursor: 'pointer',
            background: isAnnual ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: isAnnual ? '#818cf8' : '#64748b',
          }}>
            Annual
            <span style={{
              marginLeft: 6, fontSize: 11, fontWeight: 700,
              background: 'rgba(52,211,153,0.15)', color: '#34d399',
              padding: '2px 6px', borderRadius: 4,
            }}>Save 20%</span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px 40px' }}>
        <div className="pricing-cards">
          {PLANS.map(plan => {
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice
            const isPro = plan.badge === 'most-popular'
            const isWaitlist = plan.ctaMode === 'waitlist'

            return (
              <div key={plan.id} style={{
                borderRadius: 20, padding: 1,
                background: isPro
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.6), rgba(129,140,248,0.3))'
                  : 'rgba(255,255,255,0.06)',
                animation: isPro ? 'glow-border 3s ease-in-out infinite' : undefined,
                transform: isPro ? 'scale(1.02)' : undefined,
                zIndex: isPro ? 1 : 0,
              }}>
                <div style={{
                  background: '#111113', borderRadius: 19, padding: 24,
                  height: '100%', display: 'flex', flexDirection: 'column',
                }}>
                  {/* Badge */}
                  {isPro && (
                    <div style={{
                      alignSelf: 'flex-start', marginBottom: 12,
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: 1, color: '#818cf8',
                      background: 'rgba(99,102,241,0.1)', padding: '4px 10px', borderRadius: 6,
                    }}>⭐ Most Popular</div>
                  )}

                  <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 2px', color: '#f1f5f9' }}>
                    {plan.name}
                  </h3>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.4 }}>
                    {plan.tagline}
                  </div>

                  {/* Price */}
                  <div style={{ marginBottom: 18 }}>
                    <span style={{ fontSize: 38, fontWeight: 800, color: '#f1f5f9' }}>
                      ${price === 0 ? '0' : price}
                    </span>
                    <span style={{ fontSize: 14, color: '#64748b' }}>
                      {price === 0
                        ? '/month'
                        : plan.perSeat
                          ? `/seat${isAnnual ? '/year' : '/month'}`
                          : isAnnual ? '/year' : '/month'}
                    </span>
                    {plan.perSeat && plan.minSeats && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        {plan.minSeats}-seat minimum
                      </div>
                    )}
                    {isAnnual && plan.monthlyPrice > 0 && !plan.perSeat && (
                      <div style={{ fontSize: 12, color: '#34d399', marginTop: 4 }}>
                        Save 20% vs monthly
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="tier-cta-wrap" style={{ position: 'relative', marginBottom: 22 }}>
                    <button
                      className="tier-cta"
                      onClick={() => handleCTA(plan)}
                      disabled={isWaitlist}
                      title={isWaitlist ? 'Launching in beta — join the waitlist' : undefined}
                      style={{
                        width: '100%', padding: '12px 0', borderRadius: 10,
                        fontSize: 15, fontWeight: 600,
                        cursor: isWaitlist ? 'not-allowed' : 'pointer',
                        border: 'none',
                        background: isPro
                          ? 'linear-gradient(135deg, #6366f1, #818cf8)'
                          : plan.id === 'team'
                            ? 'rgba(245,158,11,0.12)'
                            : 'rgba(255,255,255,0.06)',
                        color: isPro ? '#fff' : plan.id === 'team' ? '#fbbf24' : '#e2e8f0',
                        opacity: isWaitlist ? 0.85 : 1,
                      }}
                    >
                      {isWaitlist ? 'Coming soon' : plan.cta}
                    </button>
                    {isWaitlist && (
                      <div className="tooltip" style={{
                        position: 'absolute', bottom: '100%', left: '50%',
                        transform: 'translateX(-50%)',
                        marginBottom: 4, padding: '6px 10px', borderRadius: 6,
                        background: '#1f2937', color: '#e2e8f0',
                        fontSize: 12, whiteSpace: 'nowrap',
                        opacity: 0, transition: 'opacity 0.15s, transform 0.15s',
                        pointerEvents: 'none',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}>
                        Launching in beta — join the waitlist
                      </div>
                    )}
                    {isWaitlist && (
                      <button
                        onClick={() => handleCTA(plan)}
                        style={{
                          marginTop: 8, width: '100%',
                          background: 'transparent', border: 'none',
                          color: '#818cf8', fontSize: 12, fontWeight: 500,
                          cursor: 'pointer', padding: 0,
                        }}
                      >
                        Join waitlist →
                      </button>
                    )}
                  </div>

                  {/* Features */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {plan.features.map((f, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        fontSize: 13.5, lineHeight: 1.5,
                      }}>
                        <Check size={15} style={{ color: '#34d399', flexShrink: 0, marginTop: 3 }} />
                        <span style={{ color: '#cbd5e1' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Credit cost schedule */}
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '20px 24px 0' }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, padding: '24px 28px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            What a credit gets you
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
          }}>
            {CREDIT_COSTS.map(c => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 14, fontWeight: 700, color: '#f1f5f9',
                  background: 'rgba(99,102,241,0.15)',
                  padding: '4px 10px', borderRadius: 8,
                  minWidth: 56, textAlign: 'center',
                }}>
                  {c.credits} cr
                </span>
                <span style={{ fontSize: 13.5, color: '#cbd5e1' }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trust band */}
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 24px 0' }}>
        <div style={{
          fontSize: 14, color: '#94a3b8', lineHeight: 1.6, textAlign: 'center',
        }}>
          {TRUST_BAND}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px 80px' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, textAlign: 'center', marginBottom: 28, color: '#f1f5f9' }}>
          Frequently asked questions
        </h2>
        {FAQS.map((faq, i) => (
          <FAQItem key={i} q={faq.q} a={faq.a} />
        ))}
      </div>

      {waitlistPlan && (
        <WaitlistModal plan={waitlistPlan} onClose={() => setWaitlistPlan(null)} />
      )}
    </div>
  )
}
