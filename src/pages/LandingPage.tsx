import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { trackEvent } from '../lib/analytics'
import { Target, RefreshCw, Smartphone, ImageIcon, Palette, MessageSquare } from 'lucide-react'
import { ComparisonTable } from './landing/ComparisonTable'
import { PricingSection } from './landing/PricingSection'
import { MCPSection } from './landing/MCPSection'

/* ─── Colors ─── */
const C = {
  bg: '#06080D',
  bgCard: '#0D1117',
  bgCardHover: '#151B25',
  border: '#1C2333',
  borderGlow: '#2563EB20',
  text: '#E6EDF3',
  textMuted: '#7D8590',
  textDim: '#484F58',
  accent: '#2563EB',
  accentGlow: '#2563EB30',
  teal: '#14B8A6',
  tealGlow: '#14B8A630',
  purple: '#A855F7',
  orange: '#F97316',
  gradient1: 'linear-gradient(135deg, #2563EB, #14B8A6)',
  gradient2: 'linear-gradient(135deg, #A855F7, #2563EB)',
}

/* ─── FadeIn helper ─── */
function FadeIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) { setVisible(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { threshold: 0.1 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: `opacity 0.6s ease-out ${delay}s, transform 0.6s ease-out ${delay}s`,
    }}>
      {children}
    </div>
  )
}

/* ─── Features data ─── */
const FEATURES = [
  { icon: Target, color: C.accent, title: 'Generate App — One Prompt, Full App', desc: 'Describe your idea and get 4-8 connected screens with navigation, tab bars, and consistent styling. AI plans the architecture, then builds every screen.' },
  { icon: RefreshCw, color: C.teal, title: 'Web-to-Mobile Bridge', desc: 'Built something in Lovable, Bolt, or v0? Paste the HTML and Mokkoi converts it to native React Native components. Your web prototype becomes a mobile app.' },
  { icon: Smartphone, color: C.purple, title: 'Real React Native Output', desc: 'Not wireframes. Not mockups. Production-ready React Native + Expo code with StyleSheet.create, proper imports, and 26+ macro components.' },
  { icon: ImageIcon, color: C.orange, title: 'Screenshot to Code', desc: 'Upload a screenshot of any app screen and Mokkoi recreates it in React Native. Reverse-engineer any design you like.' },
  { icon: Palette, color: C.accent, title: '50+ Color Palettes & Themes', desc: 'Dark mode, light mode, and 50+ curated palettes across 10 categories. Design tokens enforce consistency — spacing, fonts, radius all snapped to scale.' },
  { icon: MessageSquare, color: C.teal, title: 'Edit via Chat', desc: '"Make the header teal" or "add a search bar at the top." Mokkoi understands edit intent and modifies your screens without regenerating from scratch.' },
]

/* ─── Steps data ─── */
const STEPS = [
  { num: '01', title: 'Describe your app', desc: 'Tell Mokkoi what you want — "a fitness tracker with workout stats" or "an e-commerce app with product cards and checkout." One sentence or a paragraph.', tag: 'Natural language', color: C.accent },
  { num: '02', title: 'AI builds it', desc: 'Claude AI plans your app architecture, then generates every screen with real React Native components, proper navigation, and consistent design tokens.', tag: '~30 seconds', color: C.teal },
  { num: '03', title: 'Export & run', desc: 'Download a complete Expo project with React Navigation, tab bars, and working screen transitions. npm install, expo start — runs on any phone.', tag: 'Production-ready', color: C.purple },
]

/* ─── Main Component ─── */
export default function LandingPage() {
  const navigate = useNavigate()
  const [screenCount, setScreenCount] = useState<number | null>(null)

  useEffect(() => {
    trackEvent('landing_page_viewed')
    // Fetch total screens generated
    if (supabase) {
      supabase.from('usage_logs').select('id', { count: 'exact', head: true })
        .eq('success', true)
        .then(({ count }) => { if (count && count > 0) setScreenCount(count) })
    }
  }, [])

  const handleCTA = () => {
    trackEvent('landing_cta_clicked')
    navigate('/auth')
  }

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif", minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Grid background */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `linear-gradient(${C.border} 1px, transparent 1px), linear-gradient(90deg, ${C.border} 1px, transparent 1px)`, backgroundSize: '60px 60px', opacity: 0.15, pointerEvents: 'none' }} />

      {/* Glow orbs */}
      <div style={{ position: 'fixed', width: 600, height: 600, borderRadius: '50%', background: C.accent, filter: 'blur(120px)', opacity: 0.12, top: -200, right: -100, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: C.teal, filter: 'blur(120px)', opacity: 0.12, bottom: '20%', left: -150, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: C.purple, filter: 'blur(120px)', opacity: 0.12, top: '50%', right: '10%', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>

        {/* ─── NAV ─── */}
        <nav style={{ padding: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, letterSpacing: -0.5, background: C.gradient1, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            mokkoi
          </div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            <a href="#how" style={{ color: C.textMuted, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>How It Works</a>
            <a href="#features" style={{ color: C.textMuted, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Features</a>
            <a href="#pricing" style={{ color: C.textMuted, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Pricing</a>
            <a href="#mcp" style={{ color: C.textMuted, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>MCP</a>
            <button onClick={handleCTA} style={{ background: C.accent, color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: `0 0 20px ${C.accentGlow}`, fontFamily: "'DM Sans', sans-serif" }}>
              Start Building →
            </button>
          </div>
        </nav>

        {/* ─── HERO ─── */}
        <section style={{ padding: '100px 0 80px', textAlign: 'center' }}>
          <FadeIn>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 100, border: `1px solid ${C.border}`, background: C.bgCard, fontSize: 13, color: C.textMuted, fontWeight: 500, marginBottom: 32 }}>
              <span style={{ width: 6, height: 6, background: C.teal, borderRadius: '50%', boxShadow: `0 0 8px ${C.teal}`, animation: 'mokkoiPulse 2s infinite' }} />
              {screenCount ? `${screenCount.toLocaleString()}+ screens generated` : 'Now with Generate App — one prompt, full app'}
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 style={{ fontSize: 'clamp(48px, 7vw, 80px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, marginBottom: 24 }}>
              Describe your app.<br />
              <span style={{ background: C.gradient1, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Get production code.</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p style={{ fontSize: 18, color: C.textMuted, maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.6 }}>
              Mokkoi is the AI mobile app builder. Type what you want, get real React Native + Expo code — screens, navigation, tab bars, everything. Ready to run on any phone.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleCTA} style={{ background: C.accent, color: 'white', border: 'none', borderRadius: 10, padding: '14px 28px', fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: `0 0 20px ${C.accentGlow}`, fontFamily: "'DM Sans', sans-serif" }}>
                Build Your App Free →
              </button>
              <a href="#how" style={{ background: 'transparent', color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 28px', fontSize: 16, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                See How It Works
              </a>
            </div>
          </FadeIn>
        </section>

        {/* ─── DEMO WINDOW ─── */}
        <FadeIn delay={0.4}>
          <section style={{ padding: '40px 0 80px' }}>
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
              {/* Title bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
                <span style={{ marginLeft: 12, fontSize: 13, color: C.textDim, fontFamily: "'Space Mono', monospace" }}>mokkoi.com/app</span>
              </div>
              {/* Content */}
              <div style={{ padding: 40, display: 'flex', gap: 32, alignItems: 'flex-start', minHeight: 480, flexWrap: 'wrap' }}>
                {/* Prompt side */}
                <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: C.teal, textTransform: 'uppercase', letterSpacing: 2 }}>Your Prompt</div>
                  <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, fontSize: 15, lineHeight: 1.6 }}>
                    "Build me a fitness tracking app with a dashboard showing today's workout stats, an exercise library with categories, and a profile page with progress charts"
                    <span style={{ borderRight: `2px solid ${C.accent}`, animation: 'mokkoiBlink 1s infinite', paddingRight: 2 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: C.textDim, fontSize: 13, fontFamily: "'Space Mono', monospace" }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v12m0 0l4-4m-4 4l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    AI generates 4 screens + navigation in ~30 seconds
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: C.textDim, fontSize: 13, fontFamily: "'Space Mono', monospace" }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v12m0 0l4-4m-4 4l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Export as full Expo project → npm install → run
                  </div>
                </div>
                {/* Phone mocks */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  {/* Dashboard phone */}
                  <div style={{ width: 200, background: C.bg, border: `2px solid ${C.accent}`, borderRadius: 24, overflow: 'hidden', boxShadow: `0 0 30px ${C.accentGlow}` }}>
                    <div style={{ width: 80, height: 20, background: C.bgCard, borderRadius: '0 0 12px 12px', margin: '0 auto' }} />
                    <div style={{ padding: 12, minHeight: 320 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Today's Workout</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <div style={{ flex: 1, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.teal }}>847</div>
                          <div style={{ fontSize: 8, color: C.textMuted, marginTop: 2 }}>Calories</div>
                        </div>
                        <div style={{ flex: 1, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.teal }}>45</div>
                          <div style={{ fontSize: 8, color: C.textMuted, marginTop: 2 }}>Minutes</div>
                        </div>
                      </div>
                      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>Morning Run</div>
                        <div style={{ fontSize: 10, color: C.textMuted }}>5.2km · 28 min · 320 cal</div>
                      </div>
                      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>Upper Body</div>
                        <div style={{ fontSize: 10, color: C.textMuted }}>12 exercises · 17 min</div>
                      </div>
                      <div style={{ background: C.accent, color: 'white', fontSize: 11, fontWeight: 600, padding: 8, borderRadius: 8, textAlign: 'center', marginTop: 12 }}>Start Workout</div>
                      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0', borderTop: `1px solid ${C.border}`, marginTop: 12 }}>
                        {[true, false, false, false].map((active, i) => (
                          <div key={i} style={{ width: 20, height: 20, borderRadius: 4, background: active ? C.accent : C.border }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Profile phone */}
                  <div style={{ width: 180, background: C.bg, border: `2px solid ${C.border}`, borderRadius: 24, overflow: 'hidden' }}>
                    <div style={{ width: 80, height: 20, background: C.bgCard, borderRadius: '0 0 12px 12px', margin: '0 auto' }} />
                    <div style={{ padding: 12, minHeight: 320 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.gradient2, marginBottom: 8 }} />
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Your Progress</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <div style={{ flex: 1, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.teal }}>23</div>
                          <div style={{ fontSize: 8, color: C.textMuted, marginTop: 2 }}>Workouts</div>
                        </div>
                        <div style={{ flex: 1, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.teal }}>12</div>
                          <div style={{ fontSize: 8, color: C.textMuted, marginTop: 2 }}>Streak</div>
                        </div>
                      </div>
                      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 10, color: C.textDim, marginBottom: 8 }}>Search exercises...</div>
                      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>This Week</div>
                        <div style={{ fontSize: 10, color: C.textMuted }}>4 of 5 goals completed</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0', borderTop: `1px solid ${C.border}`, marginTop: 12 }}>
                        {[false, false, false, true].map((active, i) => (
                          <div key={i} style={{ width: 20, height: 20, borderRadius: 4, background: active ? C.accent : C.border }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </FadeIn>

        {/* ─── HOW IT WORKS ─── */}
        <section id="how" style={{ padding: '80px 0' }}>
          <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: C.teal, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, textAlign: 'center' }}>How It Works</div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 700, letterSpacing: -1, textAlign: 'center', marginBottom: 64 }}>Prompt to phone in 3 steps</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {STEPS.map((step, i) => (
              <FadeIn key={step.num} delay={i * 0.1}>
                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, transition: 'all 0.3s', cursor: 'default' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 48, fontWeight: 700, color: C.border, marginBottom: 16, lineHeight: 1 }}>{step.num}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{step.title}</h3>
                  <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>{step.desc}</p>
                  <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: "'Space Mono', monospace", marginTop: 16, background: `${step.color}20`, color: step.color }}>{step.tag}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* ─── APP TEMPLATES ─── */}
        <section style={{ padding: '80px 0' }}>
          <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: C.teal, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, textAlign: 'center' }}>Templates</div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 700, letterSpacing: -1, textAlign: 'center', marginBottom: 16 }}>
            One click to a full app
          </h2>
          <p style={{ fontSize: 16, color: C.textMuted, textAlign: 'center', maxWidth: 500, margin: '0 auto 48px' }}>
            Start with a template — Mokkoi generates 4-5 connected screens with navigation, consistent design, and real code.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
            {[
              { icon: '💪', name: 'Fitness Tracker', screens: 5, color: '#22C55E' },
              { icon: '🍔', name: 'Food Delivery', screens: 5, color: '#F97316' },
              { icon: '📱', name: 'Social Media', screens: 5, color: '#8B5CF6' },
              { icon: '🛍️', name: 'E-Commerce', screens: 5, color: '#EC4899' },
              { icon: '🏦', name: 'Banking', screens: 5, color: '#3B82F6' },
              { icon: '🎵', name: 'Music Streaming', screens: 5, color: '#A855F7' },
            ].map(t => (
              <FadeIn key={t.name}>
                <div style={{
                  background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20,
                  textAlign: 'center', transition: 'all 0.3s', cursor: 'default',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${t.color}40`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'none' }}
                >
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{t.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>{t.name}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.color, background: `${t.color}15`, padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>
                    {t.screens} screens
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section id="features" style={{ padding: '80px 0' }}>
          <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: C.teal, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, textAlign: 'center' }}>Built Different</div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 700, letterSpacing: -1, textAlign: 'center', marginBottom: 64 }}>
            Everything you need to go<br />from idea to app
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <FadeIn key={f.title}>
                  <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, transition: 'all 0.3s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.bgCardHover }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bgCard }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, background: `${f.color}20` }}>
                      <Icon size={20} color={f.color} />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
                    <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>{f.desc}</p>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </section>

        {/* ─── COMPARISON ─── */}
        <section style={{ padding: '80px 0' }}>
          <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: C.teal, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, textAlign: 'center' }}>Why Mokkoi</div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 700, letterSpacing: -1, textAlign: 'center', marginBottom: 64 }}>The only AI builder for mobile</h2>
          <ComparisonTable />
        </section>

        {/* ─── PRICING ─── */}
        <section id="pricing" style={{ padding: '80px 0' }}>
          <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: C.teal, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, textAlign: 'center' }}>Pricing</div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 700, letterSpacing: -1, textAlign: 'center', marginBottom: 64 }}>
            Start free. Scale when ready.
          </h2>
          <PricingSection />
        </section>

        {/* ─── MCP ─── */}
        <section id="mcp" style={{ padding: '80px 0' }}>
          <MCPSection />
        </section>

        {/* ─── CTA ─── */}
        <section style={{ padding: '100px 0', textAlign: 'center' }}>
          <FadeIn>
            <h2 style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700, letterSpacing: -1.5, marginBottom: 16 }}>
              Stop designing screens.<br />
              <span style={{ background: C.gradient1, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Start building apps.</span>
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p style={{ color: C.textMuted, fontSize: 18, marginBottom: 32 }}>50 free generations per month. No credit card required.</p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <button onClick={handleCTA} style={{ background: C.accent, color: 'white', border: 'none', borderRadius: 10, padding: '14px 28px', fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: `0 0 20px ${C.accentGlow}`, fontFamily: "'DM Sans', sans-serif" }}>
              Build Your First App →
            </button>
          </FadeIn>
        </section>

        {/* ─── FOOTER ─── */}
        <footer style={{ padding: '32px 0', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontSize: 13, color: C.textDim }}>© 2026 Mokkoi. Built for builders.</span>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="https://x.com/Mokkoi_dev" target="_blank" rel="noopener" style={{ fontSize: 13, color: C.textMuted, textDecoration: 'none' }}>@Mokkoi_dev</a>
            <a href="https://www.npmjs.com/package/mokkoi-mcp" target="_blank" rel="noopener" style={{ fontSize: 13, color: C.textMuted, textDecoration: 'none' }}>npm</a>
          </div>
        </footer>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes mokkoiPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes mokkoiBlink { 0%, 100% { border-color: ${C.accent}; } 50% { border-color: transparent; } }
      `}</style>
    </div>
  )
}
