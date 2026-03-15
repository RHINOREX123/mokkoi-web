import { useState, useEffect, useRef } from 'react'
import { PhoneFrame } from '../components/PhoneFrame'
import { homeScreenTree, loginScreenTree, profileScreenTree, chatScreenTree, dashboardScreenTree } from '../data/mockScreens'
import type { Screen } from '../types/mokkoi'

const DEMO_SCREENS: Screen[] = [
  { id: 'home', name: 'HomeScreen', component: 'HomeScreen', updatedAt: Date.now(), componentTree: homeScreenTree },
  { id: 'login', name: 'LoginScreen', component: 'LoginScreen', updatedAt: Date.now(), componentTree: loginScreenTree },
  { id: 'profile', name: 'ProfileScreen', component: 'ProfileScreen', updatedAt: Date.now(), componentTree: profileScreenTree },
  { id: 'chat', name: 'ChatScreen', component: 'ChatScreen', updatedAt: Date.now(), componentTree: chatScreenTree },
  { id: 'dashboard', name: 'DashboardScreen', component: 'DashboardScreen', updatedAt: Date.now(), componentTree: dashboardScreenTree },
]

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
      style={{
        background: copied ? '#34D399' : 'rgba(129,140,248,0.12)',
        color: copied ? '#0F172A' : '#818CF8',
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// Animated gradient orb background
function GradientOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute rounded-full blur-[120px] opacity-20"
        style={{
          width: 600, height: 600,
          top: '-10%', left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, #818CF8 0%, transparent 70%)',
          animation: 'float 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute rounded-full blur-[100px] opacity-10"
        style={{
          width: 400, height: 400,
          bottom: '20%', right: '-5%',
          background: 'radial-gradient(circle, #34D399 0%, transparent 70%)',
          animation: 'float 10s ease-in-out 2s infinite reverse',
        }}
      />
    </div>
  )
}

const FEATURES = [
  {
    count: '50',
    label: 'Screen Templates',
    desc: 'Login, dashboard, chat, e-commerce, fitness, and more. Production-ready layouts your AI agent can generate instantly.',
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" opacity="0.4" />
      </svg>
    ),
  },
  {
    count: '15',
    label: 'Design Rules',
    desc: 'WCAG contrast, touch targets, spacing grid, auto-validated. Every generated screen meets accessibility standards.',
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    count: '',
    label: 'Design System Aware',
    desc: 'Scans your codebase, matches your existing design tokens. Generated code fits seamlessly into your project.',
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m11.14 0l-2.83-2.83M9.76 9.76L6.93 6.93" />
      </svg>
    ),
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Connect',
    code: 'claude mcp add mokkoi -- npx mokkoi-mcp-server',
    desc: 'One command. Works with Claude Code, Cursor, Windsurf, or any MCP-compatible AI agent.',
  },
  {
    num: '02',
    title: 'Describe',
    code: '"Build me a login screen with social auth"',
    desc: 'Tell your AI agent what you need in plain English. No design files required.',
  },
  {
    num: '03',
    title: 'Generate',
    code: 'export function LoginScreen() { ... }',
    desc: 'Production-ready React Native code with proper styling, accessibility, and design tokens.',
  },
]

function PhoneCarousel({ visible, sectionRef }: { visible: boolean; sectionRef: React.RefObject<HTMLDivElement | null> }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const [displayIndex, setDisplayIndex] = useState(0)

  useEffect(() => {
    if (!visible) return
    const interval = setInterval(() => {
      setPhase('out')
      setTimeout(() => {
        setDisplayIndex(prev => (prev + 1) % DEMO_SCREENS.length)
        setActiveIndex(prev => (prev + 1) % DEMO_SCREENS.length)
        setPhase('in')
      }, 600)
    }, 4000)
    return () => clearInterval(interval)
  }, [visible])

  return (
    <section ref={sectionRef} className="relative py-24 flex flex-col items-center px-6">
      <div className="relative z-10">
        {visible && (
          <div className="fade-up delay-2">
            <div className="relative">
              <div className="absolute -inset-16 rounded-[60px] opacity-30 blur-3xl"
                   style={{ background: 'radial-gradient(ellipse, rgba(129,140,248,0.15), transparent 70%)' }} />
              <div className={phase === 'in' ? 'screen-enter' : 'screen-exit'}>
                <PhoneFrame screen={DEMO_SCREENS[displayIndex]} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Carousel dots */}
      {visible && (
        <div className="relative z-10 flex items-center gap-2 mt-6">
          {DEMO_SCREENS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                if (i === activeIndex) return
                setPhase('out')
                setTimeout(() => {
                  setDisplayIndex(i)
                  setActiveIndex(i)
                  setPhase('in')
                }, 600)
              }}
              className="transition-all duration-300 rounded-full"
              style={{
                width: i === activeIndex ? 24 : 8,
                height: 8,
                background: i === activeIndex ? '#818CF8' : 'rgba(129,140,248,0.25)',
              }}
              aria-label={`Show ${s.name}`}
            />
          ))}
        </div>
      )}

      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#08090E] to-transparent" />
    </section>
  )
}

export function LandingPage() {
  const hero = useInView(0.1)
  const phone = useInView(0.1)
  const features = useInView(0.1)
  const steps = useInView(0.1)
  const install = useInView(0.1)

  return (
    <div className="min-h-screen bg-[#08090E] text-white overflow-x-hidden" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-30px); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fade-up { animation: fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        .fade-in { animation: fadeIn 0.6s ease forwards; opacity: 0; }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        .delay-4 { animation-delay: 0.4s; }
        .delay-5 { animation-delay: 0.5s; }
        .delay-6 { animation-delay: 0.6s; }
        .screen-enter { animation: screenFadeIn 0.6s ease forwards; }
        .screen-exit { animation: screenFadeOut 0.6s ease forwards; }
        @keyframes screenFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes screenFadeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.97); }
        }
      `}</style>

      {/* ─── NAV ─── */}
      <nav className="fixed top-0 inset-x-0 z-50"
           style={{ backdropFilter: 'blur(16px)', background: 'rgba(8,9,14,0.7)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <rect x="3" y="4" width="8" height="14" rx="2"/>
                <rect x="13" y="4" width="8" height="14" rx="2" opacity="0.5"/>
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Mokkoi</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://github.com/nicepkg/mokkoi" target="_blank" rel="noopener noreferrer"
               className="text-[13px] text-[#94A3B8] hover:text-white transition-colors">GitHub</a>
            <a href="https://www.npmjs.com/package/mokkoi-mcp-server" target="_blank" rel="noopener noreferrer"
               className="text-[13px] text-[#94A3B8] hover:text-white transition-colors">npm</a>
            <a href="/app"
               className="text-[13px] font-medium px-3.5 py-1.5 rounded-lg transition-all duration-200"
               style={{ background: 'rgba(129,140,248,0.1)', color: '#818CF8', border: '1px solid rgba(129,140,248,0.15)' }}>
              Open App
            </a>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section ref={hero.ref} className="relative pt-40 pb-24 flex flex-col items-center text-center">
        <GradientOrbs />
        <div className="relative z-10 max-w-3xl mx-auto px-6">
          {hero.visible && (
            <>
              {/* Badge */}
              <div className="fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-medium mb-8"
                   style={{ background: 'rgba(129,140,248,0.08)', color: '#818CF8', border: '1px solid rgba(129,140,248,0.12)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                Now available as MCP server
              </div>

              {/* Headline */}
              <h1 className="fade-up delay-1 text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.05] font-extrabold tracking-tight mb-6"
                  style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
                AI agents design your{' '}
                <span style={{
                  background: 'linear-gradient(135deg, #818CF8 0%, #6366F1 50%, #34D399 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  mobile screens
                </span>
              </h1>

              {/* Sub */}
              <p className="fade-up delay-2 text-[clamp(1rem,2vw,1.15rem)] leading-relaxed text-[#8892B0] max-w-xl mx-auto mb-10">
                The first MCP server where Claude Code, Cursor, and AI agents generate production-ready React Native screens visually.
              </p>

              {/* CTAs */}
              <div className="fade-up delay-3 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="https://github.com/nicepkg/mokkoi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-[14px] font-semibold text-white transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(135deg, #818CF8, #6366F1)',
                    boxShadow: '0 0 32px rgba(129,140,248,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                  }}
                >
                  Get Started — it's free
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5">
                    <path d="M5 12h14m-6-6l6 6-6 6" />
                  </svg>
                </a>
                <a
                  href="https://www.npmjs.com/package/mokkoi-mcp-server"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-medium text-[#C8CEDE] transition-all duration-200 hover:text-white hover:bg-white/[0.04]"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.998v4H1.334V8.666h5.332v5.332zm4 0H8V8.666h2.666v5.332zm12 0h-2.666v-4h-1.334v4h-1.332v-4h-1.334v4h-2.666V8.666h9.332v5.332zM10.666 10h-1.334v2.666h1.334V10z"/>
                  </svg>
                  View on npm
                </a>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ─── PHONE DEMO ─── */}
      <PhoneCarousel visible={phone.visible} sectionRef={phone.ref} />

      {/* ─── FEATURES ─── */}
      <section ref={features.ref} className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          {features.visible && (
            <>
              <div className="text-center mb-16">
                <p className="fade-up text-[12px] font-semibold uppercase tracking-[0.2em] text-[#818CF8] mb-4">Capabilities</p>
                <h2 className="fade-up delay-1 text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight"
                    style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
                  Everything your AI agent needs
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {FEATURES.map((f, i) => (
                  <div
                    key={f.label}
                    className={`fade-up delay-${i + 2} group relative rounded-2xl p-7 transition-all duration-300 hover:translate-y-[-2px]`}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 text-[#818CF8] transition-colors group-hover:text-[#A5B4FC]"
                         style={{ background: 'rgba(129,140,248,0.08)' }}>
                      {f.icon}
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      {f.count && (
                        <span className="text-[28px] font-bold tracking-tight"
                              style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", color: '#818CF8' }}>
                          {f.count}
                        </span>
                      )}
                      <span className="text-[15px] font-semibold text-white">{f.label}</span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-[#64748B]">{f.desc}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section ref={steps.ref} className="relative py-28 px-6">
        <div className="max-w-4xl mx-auto">
          {steps.visible && (
            <>
              <div className="text-center mb-16">
                <p className="fade-up text-[12px] font-semibold uppercase tracking-[0.2em] text-[#34D399] mb-4">How it works</p>
                <h2 className="fade-up delay-1 text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight"
                    style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
                  Three steps to generated screens
                </h2>
              </div>

              <div className="space-y-5">
                {STEPS.map((step, i) => (
                  <div
                    key={step.num}
                    className={`fade-up delay-${i + 2} relative rounded-2xl p-7 sm:p-8 overflow-hidden`}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div className="flex items-start gap-5">
                      <span className="shrink-0 text-[32px] font-extrabold text-[#1E293B]"
                            style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
                        {step.num}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[16px] font-bold mb-1.5">{step.title}</h3>
                        <p className="text-[13px] text-[#64748B] mb-3">{step.desc}</p>
                        <div className="flex items-center gap-3 rounded-lg px-4 py-2.5"
                             style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <code className="flex-1 text-[13px] text-[#8892B0] overflow-x-auto whitespace-nowrap"
                                style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {step.code}
                          </code>
                          {i === 0 && <CopyButton text={step.code} />}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ─── QUICK INSTALL ─── */}
      <section ref={install.ref} className="relative py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          {install.visible && (
            <>
              <h2 className="fade-up text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold tracking-tight mb-5"
                  style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
                Start generating screens now
              </h2>
              <p className="fade-up delay-1 text-[15px] text-[#64748B] mb-10 max-w-md mx-auto">
                One command to connect Mokkoi to your AI agent.
              </p>

              <div className="fade-up delay-2 flex items-center gap-3 rounded-xl px-5 py-4 mx-auto max-w-lg"
                   style={{
                     background: 'rgba(255,255,255,0.03)',
                     border: '1px solid rgba(255,255,255,0.06)',
                     boxShadow: '0 0 48px rgba(129,140,248,0.06)',
                   }}>
                <span className="text-[#4B5563] select-none">$</span>
                <code className="flex-1 text-left text-[14px] text-[#C8CEDE] overflow-x-auto whitespace-nowrap"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  claude mcp add mokkoi -- npx mokkoi-mcp-server
                </code>
                <CopyButton text="claude mcp add mokkoi -- npx mokkoi-mcp-server" />
              </div>
            </>
          )}
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-14 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <rect x="3" y="4" width="8" height="14" rx="2"/>
                <rect x="13" y="4" width="8" height="14" rx="2" opacity="0.5"/>
              </svg>
            </div>
            <span className="text-[13px] text-[#4B5563]">
              Built with love
            </span>
          </div>

          <div className="flex items-center gap-8">
            <a href="https://github.com/nicepkg/mokkoi" target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#4B5563] hover:text-[#94A3B8] transition-colors">
              GitHub
            </a>
            <a href="https://www.npmjs.com/package/mokkoi-mcp-server" target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#4B5563] hover:text-[#94A3B8] transition-colors">
              npm
            </a>
            <a href="https://twitter.com/Mokkoi_dev" target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#4B5563] hover:text-[#94A3B8] transition-colors">
              @Mokkoi_dev
            </a>
            <span className="text-[13px] text-[#2D3348]">MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
