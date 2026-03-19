import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react'

/* ─── plan data ─── */
interface Feature {
  text: string
  included: boolean
}

const freePlan = {
  id: 'free',
  tier: 'Try Mokkoi',
  monthlyPrice: 0,
  annualPrice: 0,
  subtitle: '',
  cta: 'Get Started Free',
  accent: '#94a3b8',
  features: [
    { text: '10 screens/month', included: true },
    { text: 'AI screen generation', included: true },
    { text: 'Phone frame preview', included: true },
    { text: 'Code export', included: true },
    { text: '1 project', included: true },
    { text: 'Premium AI quality', included: false },
    { text: 'Screenshot to React Native', included: false },
    { text: 'Multi-screen flows', included: false },
    { text: 'MCP developer tools', included: false },
    { text: 'Canvas sync', included: false },
  ] as Feature[],
}

const proPlan = {
  id: 'pro',
  tier: 'Build Faster',
  monthlyPrice: 19,
  annualPrice: 169,
  subtitle: 'Everything you need to design mobile apps faster',
  cta: 'Start Pro',
  accent: '#818cf8',
  features: [
    { text: '70 screens/month', included: true },
    { text: 'Premium AI quality', included: true },
    { text: 'Screenshot \u2192 React Native', included: true },
    { text: 'Multi-screen flows with navigation', included: true },
    { text: 'Conversation memory \u2014 AI remembers context', included: true },
    { text: 'Live streaming generation', included: true },
    { text: 'MCP tools for Claude Code & Cursor', included: true },
    { text: 'Canvas sync (IDE \u2194 Web realtime)', included: true },
    { text: 'Direct edit mode', included: true },
    { text: 'All 28 templates', included: true },
    { text: '5 projects', included: true },
    { text: 'Clean code exports', included: true },
    { text: 'Need more? Top-up anytime', included: true },
  ] as Feature[],
}

const maxPlan = {
  id: 'max',
  tier: 'Ship Products',
  monthlyPrice: 39,
  annualPrice: 349,
  subtitle: 'For power users and teams shipping real apps',
  cta: 'Go Max',
  accent: '#f59e0b',
  features: [
    { text: '330+ screens/month', included: true },
    { text: 'Everything in Pro', included: true },
    { text: 'Unlimited projects', included: true },
    { text: 'Unlimited screen flows', included: true },
    { text: 'Lower per-screen cost', included: true },
    { text: 'Early access to new features', included: true },
    { text: 'Priority support', included: true },
    { text: 'Top-up anytime', included: true },
  ] as Feature[],
}

const plans = [freePlan, proPlan, maxPlan]

/* ─── FAQ ─── */
const faqs = [
  { q: 'Can I upgrade or downgrade anytime?', a: 'Yes, changes take effect immediately.' },
  { q: 'What happens when I run out of screens?', a: 'You can top-up instantly or upgrade your plan.' },
  { q: 'Do I need a credit card for Free?', a: 'No, just sign up and start designing.' },
  { q: 'What is MCP?', a: 'Model Context Protocol lets you generate screens directly from Claude Code or Cursor \u2014 your AI coding tools.' },
  { q: 'Can I export real React Native code?', a: 'Yes, every screen exports as a production-ready .tsx file you can drop into your Expo project.' },
]

/* ─── NoCreditsModal ─── */
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
          You've reached your monthly screen limit
        </h2>
        <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 24px', lineHeight: 1.5 }}>
          Top up for more screens or upgrade your plan to keep building.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onTopUp} style={{
            flex: 1, padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            background: 'rgba(99,102,241,0.1)', color: '#818cf8',
            border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer',
            transition: 'all 0.2s',
          }}>
            Top up for more screens
          </button>
          <button onClick={onUpgrade} style={{
            flex: 1, padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
          }}>
            Upgrade your plan
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── FAQ Item ─── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
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
        @keyframes gold-glow { 0%,100% { box-shadow: 0 0 15px rgba(245,158,11,0.08), 0 0 40px rgba(245,158,11,0.03); } 50% { box-shadow: 0 0 20px rgba(245,158,11,0.12), 0 0 50px rgba(245,158,11,0.05); } }
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
          Design mobile apps faster
        </h1>
        <p style={{ fontSize: 16, color: '#94a3b8', margin: '0 0 32px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
          Pick a plan that fits your workflow. Upgrade or top-up anytime.
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
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 40px' }}>
        <div className="pricing-cards">
          {plans.map(plan => {
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice
            const isPro = plan.id === 'pro'
            const isMax = plan.id === 'max'
            const savePct = isPro ? 26 : isMax ? 25 : 0

            return (
              <div key={plan.id} style={{
                flex: '1 1 0', maxWidth: 360, minWidth: 280, borderRadius: 20, padding: 1,
                background: isPro
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(129,140,248,0.3))'
                  : isMax
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(245,158,11,0.1))'
                    : 'rgba(255,255,255,0.06)',
                animation: isPro ? 'glow-border 3s ease-in-out infinite'
                  : isMax ? 'gold-glow 3s ease-in-out infinite' : undefined,
                transform: isPro ? 'scale(1.02)' : undefined,
                zIndex: isPro ? 1 : 0,
              }}>
                <div style={{
                  background: '#111113', borderRadius: 19, padding: 28,
                  height: '100%', display: 'flex', flexDirection: 'column',
                }}>
                  {/* Badge */}
                  {isPro && (
                    <div style={{
                      alignSelf: 'flex-start', marginBottom: 12,
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: 1, color: '#818cf8',
                      background: 'rgba(99,102,241,0.1)', padding: '4px 10px', borderRadius: 6,
                    }}>Most Popular</div>
                  )}

                  <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 2px', color: '#f1f5f9' }}>
                    {plan.tier}
                  </h3>
                  {plan.subtitle && (
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.4 }}>
                      {plan.subtitle}
                    </div>
                  )}
                  {!plan.subtitle && <div style={{ marginBottom: 16 }} />}

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
                    {price === 0 && (
                      <span style={{ fontSize: 14, color: '#64748b' }}>/month</span>
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
                      background: isPro
                        ? 'linear-gradient(135deg, #6366f1, #818cf8)'
                        : isMax
                          ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
                          : 'rgba(255,255,255,0.06)',
                      color: isPro || isMax ? '#fff' : '#e2e8f0',
                      opacity: loading === plan.id ? 0.7 : 1,
                    }}
                  >
                    {loading === plan.id ? 'Loading...' : plan.cta}
                  </button>

                  {/* Features */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {plan.features.map((f, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        fontSize: 14, lineHeight: 1.8,
                      }}>
                        {f.included ? (
                          <Check size={16} style={{ color: '#34d399', flexShrink: 0, marginTop: 4 }} />
                        ) : (
                          <X size={16} style={{ color: '#475569', flexShrink: 0, marginTop: 4 }} />
                        )}
                        <span style={{
                          color: f.included ? '#cbd5e1' : '#475569',
                          textDecoration: f.included ? 'none' : 'line-through',
                        }}>
                          {f.text}
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

      {/* All plans include */}
      <div style={{
        textAlign: 'center', padding: '0 24px 60px',
        fontSize: 13, color: '#64748b',
      }}>
        All plans include: Dark & light themes &bull; 28+ screen types &bull; React Native code output &bull; Keyboard shortcuts
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px 80px' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 32, color: '#f1f5f9' }}>
          Frequently asked questions
        </h2>
        {faqs.map((faq, i) => (
          <FAQItem key={i} q={faq.q} a={faq.a} />
        ))}
      </div>
    </div>
  )
}
