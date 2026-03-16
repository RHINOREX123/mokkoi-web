import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_SCREEN_TREES } from '../data/mockScreens';
import { ScreenRenderer } from '../components/ScreenRenderer';

/* ───────── helpers ───────── */
const useInView = (opts = {}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1, ...opts }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
};

const SCREEN_KEYS = Object.keys(MOCK_SCREEN_TREES);
const SCREEN_LABELS: Record<string, string> = {
  HomeScreen: 'Dashboard',
  LoginScreen: 'Login',
  ProfileScreen: 'Profile',
  ChatScreen: 'Chat',
  DashboardScreen: 'Finance',
};

/* ───────── component ───────── */
export default function LandingPage() {
  const navigate = useNavigate();
  const [activeScreen, setActiveScreen] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hero = useInView();
  const features = useInView();
  const howItWorks = useInView();
  const showcase = useInView();
  const stats = useInView();
  const cta = useInView();

  useEffect(() => {
    const id = setInterval(() => {
      setPhase('out');
      setTimeout(() => {
        setActiveScreen(i => (i + 1) % SCREEN_KEYS.length);
        setPhase('in');
      }, 400);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  const copy = () => {
    navigator.clipboard.writeText('claude mcp add mokkoi -- npx mokkoi-mcp-server');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#06090F] text-white overflow-x-hidden antialiased" style={{ fontFamily: "'Bricolage Grotesque', 'DM Sans', sans-serif" }}>

      {/* ═══ GRID BACKGROUND ═══ */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
        `,
        backgroundSize: '64px 64px',
      }} />

      {/* ═══ NAV ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06]" style={{ background: 'rgba(6,9,15,0.8)', backdropFilter: 'blur(24px) saturate(1.2)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>M</div>
            <span className="text-[17px] font-semibold tracking-[-0.02em]">Mokkoi</span>
          </div>

          <div className="hidden md:flex items-center gap-7 text-[13px] text-white/50 font-medium">
            <a href="#features" className="hover:text-white/90 transition-colors duration-200">Features</a>
            <a href="#how-it-works" className="hover:text-white/90 transition-colors duration-200">How it works</a>
            <a href="https://github.com/RHINOREX123/mokkoi-mcp-server" target="_blank" rel="noopener" className="hover:text-white/90 transition-colors duration-200">GitHub</a>
            <a href="https://www.npmjs.com/package/mokkoi-mcp-server" target="_blank" rel="noopener" className="hover:text-white/90 transition-colors duration-200">npm</a>
          </div>

          <div className="flex items-center gap-3">
            <a href="https://github.com/RHINOREX123/mokkoi-mcp-server" target="_blank" rel="noopener" className="hidden sm:flex items-center gap-2 text-[13px] text-white/50 hover:text-white/90 transition-colors duration-200 px-3 py-1.5 rounded-lg hover:bg-white/5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
              Star
            </a>
            <button onClick={() => navigate('/app')} className="px-5 py-2 text-[13px] font-semibold rounded-full transition-all duration-200 hover:brightness-110 active:scale-[0.97]" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)', boxShadow: '0 0 20px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
              Open App
            </button>

            {/* Mobile menu */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-white/60 hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                {mobileMenuOpen ? <><line x1="4" y1="4" x2="16" y2="16"/><line x1="16" y1="4" x2="4" y2="16"/></> : <><line x1="3" y1="6" x2="17" y2="6"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="14" x2="17" y2="14"/></>}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.06] px-6 py-4 space-y-3" style={{ background: 'rgba(6,9,15,0.95)' }}>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-[14px] text-white/60 hover:text-white py-1">Features</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block text-[14px] text-white/60 hover:text-white py-1">How it works</a>
            <a href="https://github.com/RHINOREX123/mokkoi-mcp-server" target="_blank" rel="noopener" className="block text-[14px] text-white/60 hover:text-white py-1">GitHub</a>
            <a href="https://www.npmjs.com/package/mokkoi-mcp-server" target="_blank" rel="noopener" className="block text-[14px] text-white/60 hover:text-white py-1">npm</a>
          </div>
        )}
      </nav>

      {/* ═══ HERO ═══ */}
      <section ref={hero.ref} className="relative pt-36 pb-12 md:pt-44 md:pb-20 overflow-hidden">
        {/* Radial glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] rounded-full opacity-[0.12]" style={{ background: 'radial-gradient(ellipse at center, #818CF8 0%, #6366F1 30%, transparent 70%)' }} />
          <div className="absolute top-40 left-1/4 w-[400px] h-[400px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #2DD4BF, transparent 70%)' }} />
        </div>

        <div className={`relative max-w-4xl mx-auto px-6 text-center transition-all duration-[1200ms] ease-out ${hero.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-[12px] font-medium mb-8 border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-white/60">Now live on npm &mdash; open source</span>
          </div>

          <h1 className="text-[40px] sm:text-[52px] md:text-[72px] font-extrabold tracking-[-0.035em] leading-[1.05] mb-7">
            AI agents design your{' '}
            <br className="hidden sm:block" />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #A5B4FC 0%, #818CF8 30%, #6366F1 60%, #2DD4BF 100%)' }}>
              mobile screens
            </span>
          </h1>

          <p className="text-[16px] md:text-[19px] text-white/45 max-w-[580px] mx-auto mb-10 leading-[1.7] font-normal" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            The first MCP server where Claude Code, Cursor, and AI agents generate production-ready React Native screens with live visual preview.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-6">
            <button onClick={() => navigate('/app')} className="group px-8 py-3.5 text-[14px] font-semibold rounded-full transition-all duration-300 hover:brightness-110 hover:shadow-[0_8px_40px_rgba(99,102,241,0.5)] active:scale-[0.97]" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)', boxShadow: '0 4px 24px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
              Try the Playground
              <span className="inline-block ml-2 transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
            </button>
            <button onClick={copy} className="flex items-center gap-3 px-5 py-3.5 text-[13px] rounded-full border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200 backdrop-blur-sm">
              <code className="text-white/60 font-mono text-[12px]">npx mokkoi-mcp-server</code>
              <span className="text-[11px] text-white/30 font-mono w-4">{copied ? '\u2713' : '\u2398'}</span>
            </button>
          </div>
        </div>

        {/* Phone Demo */}
        <div className={`relative max-w-md mx-auto mt-10 px-6 transition-all duration-[1200ms] delay-200 ease-out ${hero.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'}`}>
          {/* Glow behind phone */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[500px] rounded-full opacity-[0.08]" style={{ background: 'radial-gradient(ellipse, #818CF8, transparent 70%)' }} />

          {/* iPhone frame */}
          <div className="relative mx-auto rounded-[3rem] p-[2px] shadow-2xl" style={{ width: 280, background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.04) 100%)' }}>
            <div className="rounded-[2.85rem] overflow-hidden bg-[#0C1322]">
              {/* Notch */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-24 h-[22px] rounded-full bg-black/80" />
              </div>
              {/* Screen */}
              <div className="relative" style={{ height: 460 }}>
                <style>{`.phone-screen::-webkit-scrollbar { display: none; }`}</style>
                <div className={`phone-screen absolute inset-0 px-0.5 transition-all duration-400 ease-out ${phase === 'in' ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.96]'}`} style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                  <ScreenRenderer tree={MOCK_SCREEN_TREES[SCREEN_KEYS[activeScreen]]} />
                </div>
              </div>
              {/* Home bar */}
              <div className="flex justify-center pb-2.5 pt-1">
                <div className="w-28 h-[4px] rounded-full bg-white/15" />
              </div>
            </div>
          </div>

          {/* Carousel dots */}
          <div className="flex flex-col items-center mt-7 gap-3">
            <span className="text-[13px] text-white/35 font-medium tracking-wide">{SCREEN_LABELS[SCREEN_KEYS[activeScreen]] || SCREEN_KEYS[activeScreen]}</span>
            <div className="flex gap-1.5">
              {SCREEN_KEYS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setPhase('out'); setTimeout(() => { setActiveScreen(i); setPhase('in'); }, 300); }}
                  className={`rounded-full transition-all duration-300 ${i === activeScreen ? 'w-6 h-1.5' : 'w-1.5 h-1.5 hover:bg-white/25'}`}
                  style={{ background: i === activeScreen ? '#818CF8' : 'rgba(255,255,255,0.12)' }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF BAR ═══ */}
      <section className="py-14 border-y border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '50+', label: 'Screen Templates' },
              { value: '15', label: 'Design Rules' },
              { value: '11', label: 'MCP Tools' },
              { value: '5', label: 'App Categories' },
            ].map(s => (
              <div key={s.label}>
                <div className="text-[32px] font-extrabold tracking-[-0.02em] bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #C7D2FE, #818CF8)' }}>{s.value}</div>
                <div className="text-[13px] text-white/35 mt-1 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section ref={features.ref} id="features" className="py-28 md:py-36">
        <div className={`max-w-6xl mx-auto px-6 transition-all duration-[1000ms] ease-out ${features.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-16">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-indigo-400/80">Capabilities</span>
            <h2 className="text-[32px] md:text-[48px] font-extrabold mt-4 mb-5 tracking-[-0.03em] leading-[1.1]">Everything your AI agent needs</h2>
            <p className="text-white/40 max-w-lg mx-auto text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>Built for developers who want production-quality mobile screens without opening Figma.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
                  </svg>
                ),
                title: '50+ Screen Templates',
                desc: 'Login, dashboard, chat, e-commerce, fitness, fintech \u2014 production-ready layouts your AI agent generates instantly.',
                color: '#818CF8',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>
                  </svg>
                ),
                title: '15 Design Rules',
                desc: 'WCAG contrast, touch targets, spacing grid, platform awareness \u2014 every screen auto-validated for accessibility.',
                color: '#2DD4BF',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                  </svg>
                ),
                title: 'Design System Aware',
                desc: 'Scans your codebase, extracts your tokens, and generates screens that match your existing app perfectly.',
                color: '#F59E0B',
              },
            ].map(f => (
              <div key={f.title} className="group relative rounded-2xl p-7 transition-all duration-300 hover:-translate-y-0.5 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: `${f.color}12`, border: `1px solid ${f.color}20` }}>
                  {f.icon}
                </div>
                <h3 className="text-[17px] font-semibold mb-2.5 tracking-[-0.01em]">{f.title}</h3>
                <p className="text-[14px] text-white/45 leading-[1.7]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section ref={howItWorks.ref} id="how-it-works" className="py-28 md:py-36 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(129,140,248,0.02) 50%, transparent 100%)' }} />
        <div className={`relative max-w-3xl mx-auto px-6 transition-all duration-[1000ms] ease-out ${howItWorks.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-16">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-teal-400/80">How it works</span>
            <h2 className="text-[32px] md:text-[48px] font-extrabold mt-4 tracking-[-0.03em] leading-[1.1]">Three steps to ship</h2>
          </div>

          <div className="space-y-6">
            {[
              {
                step: '01',
                title: 'Connect',
                desc: 'One command. Works with Claude Code, Cursor, Windsurf, or any MCP-compatible AI agent.',
                code: 'claude mcp add mokkoi -- npx mokkoi-mcp-server',
                color: '#818CF8',
              },
              {
                step: '02',
                title: 'Describe',
                desc: 'Tell your AI agent what you need in plain English. No design files required.',
                code: '"Build me a login screen with social auth"',
                color: '#2DD4BF',
              },
              {
                step: '03',
                title: 'Generate',
                desc: 'Production-ready React Native code with proper styling, accessibility, and design tokens.',
                code: 'export function LoginScreen() { ... }',
                color: '#F59E0B',
              },
            ].map((s, idx) => (
              <div key={s.step} className="flex gap-5 items-start group">
                <div className="flex flex-col items-center gap-0">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[13px] font-bold font-mono" style={{ background: `${s.color}10`, color: s.color, border: `1px solid ${s.color}20` }}>
                    {s.step}
                  </div>
                  {idx < 2 && <div className="w-px h-8 mt-1" style={{ background: `linear-gradient(180deg, ${s.color}30, transparent)` }} />}
                </div>
                <div className="flex-1 pb-2">
                  <h3 className="text-[18px] font-semibold mb-1.5 tracking-[-0.01em]">{s.title}</h3>
                  <p className="text-[14px] text-white/45 mb-3 leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>{s.desc}</p>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-mono bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                    <code className="text-white/55 text-[12px] flex-1 overflow-x-auto">{s.code}</code>
                    {s.step === '01' && (
                      <button onClick={copy} className="text-[11px] text-white/30 hover:text-white/60 transition-colors flex-shrink-0 font-sans font-medium">
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SHOWCASE ═══ */}
      <section ref={showcase.ref} className="py-28 md:py-36">
        <div className={`max-w-5xl mx-auto px-6 transition-all duration-[1000ms] ease-out ${showcase.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-14">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-indigo-400/80">Playground</span>
            <h2 className="text-[32px] md:text-[48px] font-extrabold mt-4 mb-5 tracking-[-0.03em] leading-[1.1]">Generate any screen with AI</h2>
            <p className="text-white/40 max-w-lg mx-auto text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>Type a description, get production-ready React Native code. Try it live in the playground.</p>
          </div>

          {/* Demo area */}
          <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] p-[1px]" style={{ background: 'linear-gradient(135deg, rgba(129,140,248,0.08), rgba(99,102,241,0.02))' }}>
            <div className="rounded-[15px] overflow-hidden bg-[#0A0F1A]">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.04]">
                <div className="flex gap-[6px]">
                  <div className="w-[10px] h-[10px] rounded-full bg-[#FF5F57]/70" />
                  <div className="w-[10px] h-[10px] rounded-full bg-[#FEBC2E]/70" />
                  <div className="w-[10px] h-[10px] rounded-full bg-[#28C840]/70" />
                </div>
                <div className="flex-1 text-center text-[11px] text-white/25 font-mono tracking-wide">mokkoi.com/app</div>
              </div>

              {/* Content */}
              <div className="p-8 md:p-10 flex flex-col md:flex-row gap-8 items-center justify-center min-h-[380px]">
                {/* Chat bubbles */}
                <div className="flex-1 max-w-sm space-y-3">
                  <div className="bg-indigo-500/15 border border-indigo-500/15 rounded-2xl rounded-br-md px-5 py-3 text-[13px] text-white/80 ml-auto max-w-[280px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Create a fitness dashboard with activity rings and step counter
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md px-5 py-3.5 text-[13px] text-white/60 max-w-[280px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>M</div>
                      <span className="text-[11px] text-white/35 font-medium">Mokkoi</span>
                    </div>
                    Generated your fitness dashboard with 4 components &mdash; activity rings, step counter, calorie tracker, and streak card.
                  </div>
                </div>

                {/* Mini phone */}
                <div className="flex-shrink-0">
                  <div className="rounded-[1.75rem] p-[2px]" style={{ width: 180, background: 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))' }}>
                    <div className="rounded-[1.65rem] overflow-hidden bg-[#0C1322]" style={{ height: 340 }}>
                      <div className="flex justify-center pt-2 pb-1">
                        <div className="w-14 h-[14px] rounded-full bg-black/70" />
                      </div>
                      <div className="px-0.5 pb-2 phone-screen" style={{ height: 300, overflowY: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                        <ScreenRenderer tree={MOCK_SCREEN_TREES['HomeScreen']} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-10">
            <button onClick={() => navigate('/app')} className="group px-8 py-3.5 text-[14px] font-semibold rounded-full transition-all duration-300 hover:brightness-110 hover:shadow-[0_8px_40px_rgba(99,102,241,0.5)] active:scale-[0.97]" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)', boxShadow: '0 4px 24px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
              Try the Playground
              <span className="inline-block ml-2 transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
            </button>
          </div>
        </div>
      </section>

      {/* ═══ CATEGORIES ═══ */}
      <section ref={stats.ref} className="py-28 md:py-36 border-t border-white/[0.04]">
        <div className={`max-w-5xl mx-auto px-6 transition-all duration-[1000ms] ease-out ${stats.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-14">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-teal-400/80">Categories</span>
            <h2 className="text-[32px] md:text-[48px] font-extrabold mt-4 mb-5 tracking-[-0.03em] leading-[1.1]">Built for every app type</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {[
              { emoji: '\uD83D\uDCAA', name: 'Fitness', screens: '8 screens' },
              { emoji: '\uD83D\uDCB0', name: 'Fintech', screens: '6 screens' },
              { emoji: '\uD83D\uDCAC', name: 'Social', screens: '5 screens' },
              { emoji: '\uD83D\uDED2', name: 'E-commerce', screens: '6 screens' },
              { emoji: '\uD83C\uDFE5', name: 'Health', screens: '3 screens' },
            ].map(c => (
              <div key={c.name} className="rounded-xl p-5 text-center transition-all duration-200 hover:-translate-y-0.5 cursor-default bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1]">
                <div className="text-[28px] mb-2.5">{c.emoji}</div>
                <div className="font-semibold text-[14px] tracking-[-0.01em]">{c.name}</div>
                <div className="text-[12px] text-white/30 mt-1">{c.screens}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section ref={cta.ref} className="py-28 md:py-36 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(ellipse, #818CF8, transparent 70%)' }} />
        </div>

        <div className={`relative max-w-2xl mx-auto px-6 text-center transition-all duration-[1000ms] ease-out ${cta.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-[32px] md:text-[48px] font-extrabold mb-6 tracking-[-0.03em] leading-[1.1]">Start generating screens now</h2>
          <p className="text-white/40 text-[16px] mb-10 max-w-md mx-auto leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>One command to connect Mokkoi to your AI agent. Free and open source.</p>

          <div className="flex items-center justify-center gap-3 max-w-md mx-auto px-5 py-3.5 rounded-xl mb-10 bg-white/[0.03] border border-white/[0.06]">
            <span className="text-teal-400 text-[13px] font-mono">$</span>
            <code className="text-[13px] font-mono text-white/60 flex-1 text-left overflow-x-auto">claude mcp add mokkoi -- npx mokkoi-mcp-server</code>
            <button onClick={copy} className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-white/45 hover:text-white/70 border border-white/[0.06]">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button onClick={() => navigate('/app')} className="px-8 py-3.5 text-[14px] font-semibold rounded-full transition-all duration-300 hover:brightness-110 hover:shadow-[0_8px_40px_rgba(99,102,241,0.5)] active:scale-[0.97]" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)', boxShadow: '0 4px 24px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
              Open the Playground &rarr;
            </button>
            <a href="https://www.npmjs.com/package/mokkoi-mcp-server" target="_blank" rel="noopener" className="px-6 py-3.5 text-[14px] rounded-full border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-200">
              View on npm
            </a>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/[0.04] py-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>M</div>
              <span className="text-[13px] font-medium text-white/50">Mokkoi</span>
              <span className="text-white/15 mx-1">&middot;</span>
              <span className="text-[13px] text-white/25">Built with love</span>
            </div>

            <div className="flex items-center gap-5 text-[13px] text-white/35">
              <a href="https://github.com/RHINOREX123/mokkoi-mcp-server" target="_blank" rel="noopener" className="hover:text-white/70 transition-colors duration-200">GitHub</a>
              <a href="https://www.npmjs.com/package/mokkoi-mcp-server" target="_blank" rel="noopener" className="hover:text-white/70 transition-colors duration-200">npm</a>
              <a href="https://x.com/Mokkoi_dev" target="_blank" rel="noopener" className="hover:text-white/70 transition-colors duration-200">@Mokkoi_dev</a>
              <span className="text-white/15">MIT License</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
