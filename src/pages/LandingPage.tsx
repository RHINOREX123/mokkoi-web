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
      { threshold: 0.15, ...opts }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
};

const SCREEN_KEYS = Object.keys(MOCK_SCREEN_TREES);
const SCREEN_LABELS: Record<string, string> = {
  home: 'Dashboard',
  login: 'Login',
  profile: 'Profile',
  chat: 'Chat',
  dashboard: 'Finance',
};

/* ───────── component ───────── */
export default function LandingPage() {
  const navigate = useNavigate();
  const [activeScreen, setActiveScreen] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [copied, setCopied] = useState(false);

  // hero section
  const hero = useInView();
  const features = useInView();
  const howItWorks = useInView();
  const showcase = useInView();
  const stats = useInView();
  const cta = useInView();

  /* carousel */
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
    <div className="min-h-screen bg-[#060B14] text-white overflow-x-hidden" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>

      {/* ═══ NAV ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5" style={{ background: 'rgba(6,11,20,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>M</div>
            <span className="text-lg font-semibold tracking-tight">Mokkoi</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="https://github.com/RHINOREX123/mokkoi-mcp-server" target="_blank" className="hover:text-white transition-colors">GitHub</a>
            <a href="https://www.npmjs.com/package/mokkoi-mcp-server" target="_blank" className="hover:text-white transition-colors">npm</a>
            <a href="https://docs.mokkoi.com" className="hover:text-white transition-colors">Docs</a>
            <a href="https://mokkoi.com/app" className="hover:text-white transition-colors">Playground</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/RHINOREX123/mokkoi-mcp-server" target="_blank" className="hidden sm:flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
              <span>Star</span>
            </a>
            <button onClick={() => navigate('/app')} className="px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 hover:scale-105" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}>
              Open App
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section ref={hero.ref} className="relative pt-32 pb-8 md:pt-40 md:pb-16">
        {/* background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-20" style={{ background: 'radial-gradient(ellipse, #818CF8 0%, transparent 70%)' }} />
        </div>

        <div className={`relative max-w-5xl mx-auto px-6 text-center transition-all duration-1000 ${hero.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 border border-white/10" style={{ background: 'rgba(129,140,248,0.1)' }}>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/70">Now live on npm — open source</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            AI agents design your{' '}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #818CF8 0%, #6366F1 40%, #2DD4BF 100%)' }}>
              mobile screens
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            The first MCP server where Claude Code, Cursor, and AI agents generate production-ready React Native screens — with visual preview.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <button onClick={() => navigate('/app')} className="group px-8 py-3.5 text-sm font-semibold rounded-full transition-all duration-300 hover:scale-105" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)', boxShadow: '0 4px 30px rgba(99,102,241,0.4)' }}>
              Try the Playground
              <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">→</span>
            </button>
            <button onClick={copy} className="flex items-center gap-3 px-6 py-3.5 text-sm rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-200">
              <code className="text-white/70 font-mono text-xs">npx mokkoi-mcp-server</code>
              <span className="text-xs text-white/40">{copied ? '✓' : '⎘'}</span>
            </button>
          </div>
        </div>

        {/* Phone Demo */}
        <div className={`relative max-w-lg mx-auto mt-8 px-6 transition-all duration-1000 delay-300 ${hero.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          {/* iPhone frame */}
          <div className="relative mx-auto rounded-[3rem] p-[3px] shadow-2xl" style={{ width: 300, background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)' }}>
            <div className="rounded-[2.85rem] overflow-hidden" style={{ background: '#0F172A' }}>
              {/* notch */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-28 h-6 rounded-full bg-black" />
              </div>
              {/* screen */}
              <div className="relative px-1 pb-4" style={{ height: 500, overflow: 'hidden' }}>
                <div className={`absolute inset-0 px-1 transition-all duration-400 ${phase === 'in' ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]'}`}>
                  <ScreenRenderer tree={MOCK_SCREEN_TREES[SCREEN_KEYS[activeScreen]]} />
                </div>
              </div>
              {/* home bar */}
              <div className="flex justify-center pb-3">
                <div className="w-32 h-1 rounded-full bg-white/20" />
              </div>
            </div>
          </div>

          {/* Carousel label + dots */}
          <div className="flex flex-col items-center mt-6 gap-3">
            <span className="text-sm text-white/40 font-medium">{SCREEN_LABELS[SCREEN_KEYS[activeScreen]] || SCREEN_KEYS[activeScreen]}</span>
            <div className="flex gap-2">
              {SCREEN_KEYS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setPhase('out'); setTimeout(() => { setActiveScreen(i); setPhase('in'); }, 300); }}
                  className={`rounded-full transition-all duration-300 ${i === activeScreen ? 'w-6 h-2' : 'w-2 h-2 hover:bg-white/30'}`}
                  style={{ background: i === activeScreen ? '#818CF8' : 'rgba(255,255,255,0.15)' }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF BAR ═══ */}
      <section className="py-12 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '50+', label: 'Screen Templates' },
              { value: '15', label: 'Design Rules' },
              { value: '11', label: 'MCP Tools' },
              { value: '5', label: 'App Categories' },
            ].map(s => (
              <div key={s.label}>
                <div className="text-3xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #818CF8, #2DD4BF)' }}>{s.value}</div>
                <div className="text-sm text-white/40 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section ref={features.ref} className="py-24 md:py-32">
        <div className={`max-w-6xl mx-auto px-6 transition-all duration-1000 ${features.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-16">
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#818CF8]">Capabilities</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-4 mb-4">Everything your AI agent needs</h2>
            <p className="text-white/40 max-w-xl mx-auto">Built for developers who want production-quality mobile screens without opening Figma.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '◫',
                title: '50+ Screen Templates',
                desc: 'Login, dashboard, chat, e-commerce, fitness, fintech — production-ready layouts your AI agent can generate instantly.',
                gradient: 'linear-gradient(135deg, rgba(129,140,248,0.1), rgba(99,102,241,0.05))',
                border: 'rgba(129,140,248,0.15)',
              },
              {
                icon: '✓',
                title: '15 Design Rules',
                desc: 'WCAG contrast, touch targets, spacing grid, platform awareness — every screen auto-validated for accessibility.',
                gradient: 'linear-gradient(135deg, rgba(45,212,191,0.1), rgba(20,184,166,0.05))',
                border: 'rgba(45,212,191,0.15)',
              },
              {
                icon: '⬡',
                title: 'Design System Aware',
                desc: 'Scans your codebase, extracts your tokens, and generates screens that match your existing app perfectly.',
                gradient: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(234,128,5,0.05))',
                border: 'rgba(245,158,11,0.15)',
              },
            ].map(f => (
              <div key={f.title} className="group relative rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1" style={{ background: f.gradient, border: `1px solid ${f.border}` }}>
                <div className="text-2xl mb-5">{f.icon}</div>
                <h3 className="text-lg font-semibold mb-3">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section ref={howItWorks.ref} className="py-24 md:py-32 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent, rgba(129,140,248,0.03), transparent)' }} />
        <div className={`relative max-w-4xl mx-auto px-6 transition-all duration-1000 ${howItWorks.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-16">
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#2DD4BF]">How it works</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-4">Three steps to generated screens</h2>
          </div>

          <div className="space-y-8">
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
            ].map(s => (
              <div key={s.step} className="flex gap-6 items-start group">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}30` }}>
                  {s.step}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-white/50 mb-3">{s.desc}</p>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-mono" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <code className="text-white/60 text-xs flex-1 overflow-x-auto">{s.code}</code>
                    {s.step === '01' && (
                      <button onClick={copy} className="text-xs text-white/30 hover:text-white/60 transition-colors flex-shrink-0">
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

      {/* ═══ SHOWCASE — AI Generated ═══ */}
      <section ref={showcase.ref} className="py-24 md:py-32">
        <div className={`max-w-6xl mx-auto px-6 transition-all duration-1000 ${showcase.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-16">
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#818CF8]">Playground</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-4 mb-4">Generate any screen with AI</h2>
            <p className="text-white/40 max-w-xl mx-auto">Type a description, get production-ready React Native code. Try it live in the playground.</p>
          </div>

          {/* Demo screenshot area */}
          <div className="relative rounded-2xl overflow-hidden border border-white/10 p-1" style={{ background: 'linear-gradient(135deg, rgba(129,140,248,0.05), rgba(99,102,241,0.02))' }}>
            <div className="rounded-xl overflow-hidden" style={{ background: '#0B1120' }}>
              {/* fake toolbar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 text-center text-xs text-white/30 font-mono">mokkoi.com/app</div>
              </div>

              {/* chat demo */}
              <div className="p-8 flex flex-col md:flex-row gap-8 items-center justify-center min-h-[400px]">
                {/* chat bubbles */}
                <div className="flex-1 max-w-sm space-y-4">
                  <div className="bg-[#818CF8]/20 border border-[#818CF8]/20 rounded-2xl rounded-br-md px-5 py-3 text-sm ml-auto max-w-[280px]">
                    Create a fitness dashboard with activity rings and step counter
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-5 py-3 text-sm text-white/70 max-w-[280px]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>M</div>
                      <span className="text-xs text-white/40">Mokkoi</span>
                    </div>
                    Generated your fitness dashboard with 4 components — activity rings, step counter, calorie tracker, and streak card.
                  </div>
                </div>

                {/* mini phone */}
                <div className="flex-shrink-0">
                  <div className="rounded-[2rem] p-[2px]" style={{ width: 200, background: 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))' }}>
                    <div className="rounded-[1.9rem] overflow-hidden" style={{ background: '#0F172A', height: 380 }}>
                      <div className="flex justify-center pt-2 pb-1">
                        <div className="w-16 h-4 rounded-full bg-black" />
                      </div>
                      <div className="px-1 pb-2 overflow-hidden" style={{ height: 340 }}>
                        <ScreenRenderer tree={MOCK_SCREEN_TREES['home']} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <button onClick={() => navigate('/app')} className="group px-8 py-3.5 text-sm font-semibold rounded-full transition-all duration-300 hover:scale-105" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)', boxShadow: '0 4px 30px rgba(99,102,241,0.3)' }}>
              Try the Playground
              <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>
      </section>

      {/* ═══ CATEGORIES ═══ */}
      <section ref={stats.ref} className="py-24 md:py-32 border-t border-white/5">
        <div className={`max-w-6xl mx-auto px-6 transition-all duration-1000 ${stats.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-16">
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#2DD4BF]">Categories</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-4 mb-4">Built for every app type</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { emoji: '💪', name: 'Fitness', screens: '8 screens' },
              { emoji: '💰', name: 'Fintech', screens: '6 screens' },
              { emoji: '💬', name: 'Social', screens: '5 screens' },
              { emoji: '🛒', name: 'E-commerce', screens: '6 screens' },
              { emoji: '🏥', name: 'Health', screens: '3 screens' },
            ].map(c => (
              <div key={c.name} className="rounded-xl p-6 text-center transition-all duration-200 hover:-translate-y-1 cursor-default" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-3xl mb-3">{c.emoji}</div>
                <div className="font-semibold text-sm">{c.name}</div>
                <div className="text-xs text-white/30 mt-1">{c.screens}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section ref={cta.ref} className="py-24 md:py-32 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-10" style={{ background: 'radial-gradient(ellipse, #818CF8, transparent)' }} />
        </div>

        <div className={`relative max-w-3xl mx-auto px-6 text-center transition-all duration-1000 ${cta.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Start generating screens now</h2>
          <p className="text-white/40 text-lg mb-10 max-w-lg mx-auto">One command to connect Mokkoi to your AI agent. Free and open source.</p>

          <div className="flex items-center justify-center gap-3 max-w-lg mx-auto px-6 py-4 rounded-2xl mb-8" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-[#2DD4BF] text-sm font-mono">$</span>
            <code className="text-sm font-mono text-white/70 flex-1 text-left overflow-x-auto">claude mcp add mokkoi -- npx mokkoi-mcp-server</code>
            <button onClick={copy} className="text-sm font-medium px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/50">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => navigate('/app')} className="px-8 py-3.5 text-sm font-semibold rounded-full transition-all duration-300 hover:scale-105" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)', boxShadow: '0 4px 30px rgba(99,102,241,0.4)' }}>
              Open the Playground →
            </button>
            <a href="https://www.npmjs.com/package/mokkoi-mcp-server" target="_blank" className="px-6 py-3.5 text-sm rounded-full border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all">
              View on npm
            </a>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>M</div>
              <span className="text-sm font-medium text-white/60">Mokkoi</span>
              <span className="text-sm text-white/20">·</span>
              <span className="text-sm text-white/30">Built with love</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-white/40">
              <a href="https://github.com/RHINOREX123/mokkoi-mcp-server" target="_blank" className="hover:text-white transition-colors">GitHub</a>
              <a href="https://www.npmjs.com/package/mokkoi-mcp-server" target="_blank" className="hover:text-white transition-colors">npm</a>
              <a href="https://x.com/Mokkoi_dev" target="_blank" className="hover:text-white transition-colors">@Mokkoi_dev</a>
              <span className="text-white/20">MIT License</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
