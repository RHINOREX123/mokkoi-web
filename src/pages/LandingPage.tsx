import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/* ─── tiny helpers ─── */
function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // If already in viewport on mount, show immediately
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s cubic-bezier(.16,1,.3,1) ${delay}s, transform 0.6s cubic-bezier(.16,1,.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Copy button ─── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{
        background: 'rgba(255,255,255,.06)',
        border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 6,
        padding: '6px 14px',
        color: copied ? '#34d399' : '#94a3b8',
        fontSize: 13,
        cursor: 'pointer',
        transition: 'all .2s',
        fontFamily: 'inherit',
      }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

/* ─── Phone Frame ─── */
function PhonePreview({ children, scale = 1 }: { children: React.ReactNode; scale?: number }) {
  return (
    <div style={{
      width: 280 * scale,
      height: 580 * scale,
      borderRadius: 36 * scale,
      border: `${2 * scale}px solid rgba(255,255,255,.12)`,
      background: '#0a0a0a',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: '0 25px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.05), inset 0 1px 0 rgba(255,255,255,.05)',
      flexShrink: 0,
    }}>
      {/* Notch / Dynamic Island */}
      <div style={{
        position: 'absolute',
        top: 10 * scale,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 90 * scale,
        height: 24 * scale,
        borderRadius: 20 * scale,
        background: '#000',
        zIndex: 10,
      }} />
      {/* Screen content */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 34 * scale,
        overflow: 'hidden',
        overflowY: 'auto',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
      }}>
        {children}
      </div>
      {/* Home bar */}
      <div style={{
        position: 'absolute',
        bottom: 6 * scale,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 100 * scale,
        height: 4 * scale,
        borderRadius: 4 * scale,
        background: 'rgba(255,255,255,.2)',
        zIndex: 10,
      }} />
    </div>
  );
}

/* ─── Mock Screen Content ─── */
function MockHomeScreen() {
  return (
    <div style={{ padding: '52px 18px 24px', background: 'linear-gradient(180deg, #0a0a0a 0%, #000000 100%)', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Good morning 👋</div>
          <div style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700 }}>Alex</div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: 'linear-gradient(135deg, #818cf8, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>A</div>
      </div>
      <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #a78bfa 100%)', borderRadius: 16, padding: '18px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: '#e0e7ff', fontSize: 13, fontWeight: 500 }}>Weekly Progress</span>
          <span style={{ fontSize: 16 }}>🚀</span>
        </div>
        <div style={{ color: '#fff', fontSize: 32, fontWeight: 800, marginBottom: 8 }}>84%</div>
        <div style={{ height: 6, background: 'rgba(255,255,255,.2)', borderRadius: 3 }}>
          <div style={{ height: 6, width: '84%', background: '#fff', borderRadius: 3 }} />
        </div>
        <div style={{ color: '#c7d2fe', fontSize: 11, marginTop: 8 }}>21 of 25 tasks completed this week</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[{ label: 'TASKS', value: '12', sub: '+3 today', icon: '✅' }, { label: 'STREAK', value: '7d', sub: '🌟 Best!', icon: '🔥' }].map((c) => (
          <div key={c.label} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, padding: '14px 12px', border: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#64748b', fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>{c.label}</span>
              <span style={{ fontSize: 14 }}>{c.icon}</span>
            </div>
            <div style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 800 }}>{c.value}</div>
            <div style={{ color: '#34d399', fontSize: 11 }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' as const }}>Recent Activity</div>
        {[{ t: 'Design review completed', s: '2 hours ago', dot: '#34d399' }, { t: 'New comment on PR #42', s: '5 hours ago', dot: '#818cf8' }].map((a) => (
          <div key={a.t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: a.dot, flexShrink: 0 }} />
            <div>
              <div style={{ color: '#e2e8f0', fontSize: 13 }}>{a.t}</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>{a.s}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockLoginScreen() {
  return (
    <div style={{ padding: '72px 24px 24px', background: 'linear-gradient(180deg, #0a0a0a 0%, #000000 100%)', minHeight: '100%', display: 'flex', flexDirection: 'column' as const }}>
      <div style={{ textAlign: 'center' as const, marginBottom: 36 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1, #818cf8)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✦</div>
        <div style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Welcome Back</div>
        <div style={{ color: '#64748b', fontSize: 13 }}>Sign in to your account</div>
      </div>
      {['Email address', 'Password'].map((p) => (
        <div key={p} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, border: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ color: '#475569', fontSize: 13 }}>{p}</div>
        </div>
      ))}
      <div style={{ color: '#818cf8', fontSize: 12, textAlign: 'right' as const, marginBottom: 20 }}>Forgot password?</div>
      <div style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', borderRadius: 12, padding: '14px 0', textAlign: 'center' as const, color: '#fff', fontWeight: 600, fontSize: 15, marginBottom: 20 }}>Sign In</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
        <span style={{ color: '#475569', fontSize: 12 }}>or continue with</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {['G', ''].map((l, i) => (
          <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '12px 0', textAlign: 'center' as const, border: '1px solid rgba(255,255,255,.06)', color: '#94a3b8', fontSize: 18 }}>
            {l || '🍎'}
          </div>
        ))}
      </div>
    </div>
  );
}

function MockChatScreen() {
  return (
    <div style={{ padding: '48px 14px 24px', background: 'linear-gradient(180deg, #0a0a0a 0%, #000000 100%)', minHeight: '100%', display: 'flex', flexDirection: 'column' as const }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 17, background: 'linear-gradient(135deg, #10b981, #34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>AI</div>
        <div>
          <div style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>FitBot Trainer</div>
          <div style={{ color: '#34d399', fontSize: 11 }}>● Online</div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
        {/* AI message */}
        <div style={{ maxWidth: '80%' }}>
          <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: '4px 14px 14px 14px', padding: '10px 14px', color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>
            Hey! Ready for today's workout? I've prepared a HIIT session 💪
          </div>
          <div style={{ color: '#475569', fontSize: 10, marginTop: 4, marginLeft: 4 }}>2:30 PM</div>
        </div>
        {/* User message */}
        <div style={{ maxWidth: '80%', alignSelf: 'flex-end' }}>
          <div style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', borderRadius: '14px 4px 14px 14px', padding: '10px 14px', color: '#fff', fontSize: 13, lineHeight: 1.5 }}>
            Yes! Let's do it 🔥
          </div>
          <div style={{ color: '#475569', fontSize: 10, marginTop: 4, textAlign: 'right' as const }}>2:31 PM</div>
        </div>
        {/* AI message */}
        <div style={{ maxWidth: '80%' }}>
          <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: '4px 14px 14px 14px', padding: '10px 14px', color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>
            Starting with 4 rounds of burpees, mountain climbers & squat jumps. 45s on, 15s rest.
          </div>
          <div style={{ color: '#475569', fontSize: 10, marginTop: 4, marginLeft: 4 }}>2:31 PM</div>
        </div>
      </div>
      {/* Input */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,.04)', borderRadius: 24, padding: '10px 16px', border: '1px solid rgba(255,255,255,.06)', color: '#475569', fontSize: 13 }}>Message...</div>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>↑</div>
      </div>
    </div>
  );
}

/* ─── Screens carousel for hero ─── */
const SCREENS = [
  { label: 'Dashboard', comp: <MockHomeScreen /> },
  { label: 'Login', comp: <MockLoginScreen /> },
  { label: 'Chat', comp: <MockChatScreen /> },
];

/* ─── MAIN LANDING PAGE ─── */
export default function LandingPage() {
  const navigate = useNavigate();
  const [activeScreen, setActiveScreen] = useState(0);
  const [heroPrompt, setHeroPrompt] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check auth state
  useEffect(() => {
    supabase?.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
  }, []);

  // Auth-aware navigation: logged in → /projects or create project, not logged in → /auth
  const goToApp = () => navigate(isLoggedIn ? '/projects' : '/auth');
  const goWithPrompt = async (prompt: string) => {
    if (!prompt.trim()) return;
    if (!isLoggedIn) {
      navigate('/auth');
      return;
    }
    // Create a project and navigate to it with the prompt
    if (!supabase) { navigate('/auth'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth'); return; }
    const { data } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name: prompt.slice(0, 30) })
      .select()
      .single();
    if (data) navigate(`/app/${data.id}?prompt=${encodeURIComponent(prompt.trim())}`);
  };

  // Cycle screens
  useEffect(() => {
    const t = setInterval(() => setActiveScreen((s) => (s + 1) % SCREENS.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background: '#000000', color: '#e2e8f0', minHeight: '100vh', fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif", overflowX: 'hidden' as const }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { background: #000000; }
        ::selection { background: #6366f1; color: #fff; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 3px; }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes glow-pulse { 0%,100% { opacity: .4; } 50% { opacity: .7; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .landing-nav-links { display: flex; align-items: center; gap: 32px; }
        .landing-mobile-cta { display: none; }
        .landing-cta-cmd { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        @media (max-width: 768px) {
          .landing-nav-links { display: none !important; }
          .landing-mobile-cta { display: block !important; }
          .landing-hero-ctas { flex-direction: column !important; align-items: stretch !important; }
          .landing-hero-ctas > * { width: 100%; text-align: center; justify-content: center; }
          .landing-hero-code-block { overflow-x: auto; }
          .landing-hero-code-block code { font-size: 12px !important; }
          .landing-cta-cmd { flex-direction: column !important; gap: 8px !important; }
          .landing-cta-cmd code { font-size: 11px !important; word-break: break-all; white-space: normal !important; }
          .landing-browser-content { flex-direction: column !important; padding: 24px 16px !important; }
          .landing-footer-inner { flex-direction: column !important; text-align: center; }
        }
      `}</style>

      {/* ─── NAV ─── */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(9,9,11,.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,.05)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>M</div>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' }}>Mokkoi</span>
          </div>

          {/* Desktop links */}
          <div className="landing-nav-links">
            {['Features', 'How it works', 'Playground'].map((l) => (
              <a
                key={l}
                href={l === 'Playground' ? (isLoggedIn ? '/projects' : '/auth') : `#${l.toLowerCase().replace(/\s/g, '-')}`}
                style={{ color: '#94a3b8', fontSize: 14, textDecoration: 'none', transition: 'color .2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
              >
                {l}
              </a>
            ))}
            <a
              href="https://github.com/RHINOREX123/mokkoi-mcp-server"
              target="_blank"
              rel="noopener"
              style={{ color: '#94a3b8', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, transition: 'color .2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
              Star
            </a>
            <button
              onClick={() => goToApp()}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all .2s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              Start Building →
            </button>
          </div>

          {/* Mobile CTA */}
          <button
            className="landing-mobile-cta"
            onClick={() => goToApp()}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 18px',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Start Building →
          </button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{
        position: 'relative',
        paddingTop: 160,
        paddingBottom: 100,
        overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute',
          top: -200,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 800,
          height: 600,
          background: 'radial-gradient(ellipse, rgba(99,102,241,.12) 0%, transparent 70%)',
          pointerEvents: 'none',
          animation: 'glow-pulse 6s ease-in-out infinite',
        }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
          {/* Badge */}
          <FadeIn>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 16px',
                borderRadius: 100,
                border: '1px solid rgba(99,102,241,.3)',
                background: 'rgba(99,102,241,.08)',
                fontSize: 13,
                color: '#a5b4fc',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: '#34d399', animation: 'glow-pulse 2s infinite' }} />
                Now live on npm — open source
              </div>
            </div>
          </FadeIn>

          {/* Headline */}
          <FadeIn delay={0.1}>
            <h1 style={{
              textAlign: 'center',
              fontSize: 'clamp(36px, 6vw, 72px)',
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              maxWidth: 800,
              margin: '0 auto 24px',
            }}>
              Build{' '}
              <span style={{
                background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 40%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                mobile screens
              </span>
              {' '}with AI
            </h1>
          </FadeIn>

          {/* Subtitle */}
          <FadeIn delay={0.15}>
            <p style={{
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: 'clamp(16px, 2vw, 19px)',
              lineHeight: 1.6,
              maxWidth: 560,
              margin: '0 auto 40px',
            }}>
              Describe any screen. Get production-ready React Native code instantly. Free and open source.
            </p>
          </FadeIn>

          {/* Hero prompt input */}
          <FadeIn delay={0.2}>
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <div
                style={{
                  position: 'relative',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid rgba(255,255,255,.1)',
                  boxShadow: '0 4px 32px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.03)',
                  transition: 'border-color .2s, box-shadow .2s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,.4)'; e.currentTarget.style.boxShadow = '0 4px 32px rgba(99,102,241,.12), 0 0 0 1px rgba(99,102,241,.2)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'; e.currentTarget.style.boxShadow = '0 4px 32px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.03)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 14px 20px' }}>
                  <input
                    type="text"
                    value={heroPrompt}
                    onChange={(e) => setHeroPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && heroPrompt.trim()) { goWithPrompt(heroPrompt.trim()); } }}
                    placeholder="Describe a mobile screen..."
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#f1f5f9',
                      fontSize: 16,
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    onClick={() => { if (heroPrompt.trim()) goWithPrompt(heroPrompt.trim()); }}
                    style={{
                      background: heroPrompt.trim() ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,.06)',
                      border: 'none',
                      borderRadius: 10,
                      padding: '10px 20px',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: heroPrompt.trim() ? 'pointer' : 'default',
                      transition: 'all .2s',
                      fontFamily: 'inherit',
                      opacity: heroPrompt.trim() ? 1 : 0.5,
                    }}
                  >
                    Generate
                  </button>
                </div>
              </div>

              {/* Suggestion chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, justifyContent: 'center', gap: 8, marginTop: 16 }}>
                {['Fitness Dashboard', 'Login Screen', 'Chat Interface', 'E-commerce Product', 'Settings Page'].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => goWithPrompt(chip)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,.1)',
                      borderRadius: 100,
                      padding: '6px 14px',
                      color: '#94a3b8',
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all .2s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,.4)'; e.currentTarget.style.color = '#c7d2fe'; e.currentTarget.style.background = 'rgba(99,102,241,.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* npx command as secondary CTA */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
                <div className="landing-hero-code-block" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid rgba(255,255,255,.08)',
                  borderRadius: 10,
                  padding: '10px 16px',
                }}>
                  <code style={{ color: '#a5b4fc', fontSize: 14, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>npx mokkoi-mcp-server</code>
                  <CopyButton text="npx mokkoi-mcp-server" />
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Phone showcase */}
          <FadeIn delay={0.3}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: 72,
              position: 'relative',
            }}>
              {/* Glow behind phone */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 400,
                height: 400,
                background: 'radial-gradient(circle, rgba(99,102,241,.15) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />
              <div style={{ animation: 'float 6s ease-in-out infinite', position: 'relative' }}>
                <PhonePreview>
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    {SCREENS.map((s, i) => (
                      <div
                        key={s.label}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          opacity: i === activeScreen ? 1 : 0,
                          transition: 'opacity 0.6s ease-in-out',
                          pointerEvents: i === activeScreen ? 'auto' : 'none',
                        }}
                      >
                        {s.comp}
                      </div>
                    ))}
                  </div>
                </PhonePreview>
              </div>
            </div>
            {/* Dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              {SCREENS.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => setActiveScreen(i)}
                  style={{
                    width: i === activeScreen ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: i === activeScreen ? '#6366f1' : 'rgba(255,255,255,.15)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all .3s',
                    padding: 0,
                  }}
                />
              ))}
            </div>
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: 13, marginTop: 8 }}>
              {SCREENS[activeScreen].label}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── SOCIAL PROOF BAR ─── */}
      <FadeIn>
        <section style={{
          borderTop: '1px solid rgba(255,255,255,.05)',
          borderBottom: '1px solid rgba(255,255,255,.05)',
          padding: '32px 24px',
        }}>
          <div style={{
            maxWidth: 800,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'center',
            gap: 64,
            flexWrap: 'wrap' as const,
          }}>
            {[
              { n: '50+', l: 'Screen Templates' },
              { n: '15', l: 'Design Rules' },
              { n: '11', l: 'MCP Tools' },
              { n: '5', l: 'App Categories' },
            ].map((s) => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>{s.n}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </section>
      </FadeIn>

      {/* ─── FEATURES ─── */}
      <section id="features" style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <div style={{ color: '#818cf8', fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 12 }}>CAPABILITIES</div>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>Everything your AI agent needs</h2>
              <p style={{ color: '#64748b', fontSize: 17, maxWidth: 500, margin: '0 auto' }}>
                Production-quality mobile screens without opening Figma.
              </p>
            </div>
          </FadeIn>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {[
              {
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
                title: '50+ Screen Templates',
                desc: 'Login, dashboard, chat, e-commerce, fitness, fintech — production-ready layouts your AI agent generates instantly.',
              },
              {
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>,
                title: '15 Design Rules',
                desc: 'WCAG contrast, touch targets, spacing grid, platform awareness — every screen auto-validated for accessibility.',
              },
              {
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>,
                title: 'Design System Aware',
                desc: 'Scans your codebase, extracts your tokens, and generates screens that match your existing app perfectly.',
              },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.1}>
                <div style={{
                  background: 'rgba(255,255,255,.02)',
                  border: '1px solid rgba(255,255,255,.06)',
                  borderRadius: 16,
                  padding: '32px 28px',
                  transition: 'all .3s',
                  cursor: 'default',
                  height: '100%',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,.2)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    {f.icon}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: '#f1f5f9' }}>{f.title}</h3>
                  <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MCP SERVER ─── */}
      <section style={{ padding: '80px 24px 100px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <div style={{ color: '#818cf8', fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 12 }}>MCP SERVER</div>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>Works with Claude Code &amp; Cursor</h2>
              <p style={{ color: '#94a3b8', fontSize: 17, lineHeight: 1.7, maxWidth: 600, margin: '0 auto' }}>
                The only React Native MCP server. Generate screens from your terminal that appear on the canvas in real-time.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 16,
              padding: '32px',
              fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontSize: 14,
              lineHeight: 1.8,
              marginBottom: 48,
              overflow: 'auto',
            }}>
              <div style={{ color: '#64748b' }}>$ claude mcp add mokkoi -- npx mokkoi-mcp</div>
              <div style={{ color: '#64748b' }}>$ claude</div>
              <div style={{ color: '#e2e8f0', marginTop: 8 }}>
                <span style={{ color: '#818cf8' }}>&gt;</span> Create a 4-screen onboarding flow for my fitness app
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ color: '#34d399' }}>✓ Generated screens/Welcome.tsx</div>
                <div style={{ color: '#34d399' }}>✓ Generated screens/Goals.tsx</div>
                <div style={{ color: '#34d399' }}>✓ Generated screens/FitnessLevel.tsx</div>
                <div style={{ color: '#34d399' }}>✓ Generated screens/Personalization.tsx</div>
                <div style={{ color: '#34d399' }}>✓ Synced to mokkoi.com canvas</div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              marginBottom: 48,
            }}>
              {[
                { tool: 'generate_screen', desc: 'Text to React Native screen' },
                { tool: 'edit_screen', desc: 'Modify existing screens' },
                { tool: 'screenshot_to_screen', desc: 'Screenshot to code' },
                { tool: 'generate_flow', desc: 'Multi-screen flows' },
                { tool: 'sync_from_canvas', desc: 'Pull canvas edits' },
                { tool: 'watch_canvas', desc: 'Track changes' },
                { tool: 'list_templates', desc: '28 ready templates' },
              ].map((t) => (
                <div key={t.tool} style={{
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid rgba(255,255,255,.06)',
                  borderRadius: 12,
                  padding: '16px 20px',
                }}>
                  <div style={{ color: '#818cf8', fontSize: 13, fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 600, marginBottom: 4 }}>{t.tool}</div>
                  <div style={{ color: '#94a3b8', fontSize: 14 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div style={{ textAlign: 'center' }}>
              <a
                href="https://www.npmjs.com/package/mokkoi-mcp"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 32px',
                  background: '#818cf8',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 16,
                  borderRadius: 12,
                  textDecoration: 'none',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#6366f1')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#818cf8')}
              >
                Get Started with MCP →
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" style={{ padding: '80px 24px 100px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <div style={{ color: '#818cf8', fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 12 }}>HOW IT WORKS</div>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em' }}>Three steps to ship</h2>
            </div>
          </FadeIn>

          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 0 }}>
            {[
              {
                n: '01',
                title: 'Connect',
                desc: 'One command. Works with Claude Code, Cursor, Windsurf, or any MCP-compatible AI agent.',
                code: 'claude mcp add mokkoi — npx mokkoi-mcp-server',
              },
              {
                n: '02',
                title: 'Describe',
                desc: 'Tell your AI agent what you need in plain English. No design files required.',
                code: '"Build me a login screen with social auth"',
              },
              {
                n: '03',
                title: 'Generate',
                desc: 'Production-ready React Native code with proper styling, accessibility, and design tokens.',
                code: null,
              },
            ].map((step, i) => (
              <FadeIn key={step.n} delay={i * 0.1}>
                <div style={{
                  display: 'flex',
                  gap: 24,
                  padding: '32px 0',
                  borderBottom: i < 2 ? '1px solid rgba(255,255,255,.05)' : undefined,
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {step.n}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>{step.title}</h3>
                    <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.6, marginBottom: step.code ? 14 : 0 }}>{step.desc}</p>
                    {step.code && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(0,0,0,.3)',
                        border: '1px solid rgba(255,255,255,.06)',
                        borderRadius: 10,
                        padding: '10px 16px',
                      }}>
                        <code style={{ color: '#a5b4fc', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{step.code}</code>
                        {i === 0 && <CopyButton text="claude mcp add mokkoi -- npx mokkoi-mcp-server" />}
                      </div>
                    )}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PLAYGROUND PREVIEW ─── */}
      <section id="playground" style={{ padding: '80px 24px 100px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ color: '#818cf8', fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 12 }}>PLAYGROUND</div>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>Generate any screen with AI</h2>
              <p style={{ color: '#64748b', fontSize: 17, maxWidth: 500, margin: '0 auto' }}>
                Type a description, get production-ready React Native code. Try it live.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            {/* Browser window mockup */}
            <div style={{
              maxWidth: 900,
              margin: '0 auto',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,.08)',
              background: 'rgba(255,255,255,.02)',
              overflow: 'hidden',
            }}>
              {/* Title bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,.05)',
                background: 'rgba(0,0,0,.2)',
              }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: '#ef4444' }} />
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: '#f59e0b' }} />
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: '#22c55e' }} />
                </div>
                <div style={{ flex: 1, textAlign: 'center', color: '#475569', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>mokkoi.com/app</div>
              </div>
              {/* Content */}
              <div className="landing-browser-content" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 48,
                padding: '48px 32px',
                flexWrap: 'wrap' as const,
              }}>
                {/* Chat side */}
                <div style={{ maxWidth: 320, flex: 1, minWidth: 260 }}>
                  <div style={{
                    background: 'rgba(99,102,241,.1)',
                    border: '1px solid rgba(99,102,241,.2)',
                    borderRadius: '14px 14px 4px 14px',
                    padding: '14px 18px',
                    marginBottom: 16,
                  }}>
                    <p style={{ color: '#c7d2fe', fontSize: 14, lineHeight: 1.5 }}>Create a fitness dashboard with activity rings and step counter</p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>M</span>
                    </div>
                    <div style={{
                      background: 'rgba(255,255,255,.04)',
                      border: '1px solid rgba(255,255,255,.06)',
                      borderRadius: '4px 14px 14px 14px',
                      padding: '14px 18px',
                    }}>
                      <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5 }}>Generated your fitness dashboard with 4 components — activity rings, step counter, calorie tracker, and streak card.</p>
                    </div>
                  </div>
                </div>
                {/* Phone side */}
                <PhonePreview scale={0.75}>
                  <MockHomeScreen />
                </PhonePreview>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
              <button
                onClick={() => goToApp()}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '14px 32px',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 24px rgba(99,102,241,.25)',
                  transition: 'all .25s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,.25)'; }}
              >
                Start Building →
              </button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── CATEGORIES ─── */}
      <section style={{ padding: '80px 24px 100px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ color: '#818cf8', fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 12 }}>CATEGORIES</div>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em' }}>Built for every app type</h2>
            </div>
          </FadeIn>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 16,
          }}>
            {[
              { icon: '💪', name: 'Fitness', count: '8 screens' },
              { icon: '💰', name: 'Fintech', count: '6 screens' },
              { icon: '💬', name: 'Social', count: '5 screens' },
              { icon: '🛒', name: 'E-commerce', count: '6 screens' },
              { icon: '❤️', name: 'Health', count: '3 screens' },
            ].map((c, i) => (
              <FadeIn key={c.name} delay={i * 0.05}>
                <div style={{
                  background: 'rgba(255,255,255,.02)',
                  border: '1px solid rgba(255,255,255,.06)',
                  borderRadius: 14,
                  padding: '28px 16px',
                  textAlign: 'center',
                  transition: 'all .3s',
                  cursor: 'default',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,.2)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>{c.icon}</div>
                  <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{c.name}</div>
                  <div style={{ color: '#64748b', fontSize: 13 }}>{c.count}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section style={{ padding: '80px 24px 100px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <FadeIn>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>
              Start generating screens now
            </h2>
            <p style={{ color: '#64748b', fontSize: 17, marginBottom: 32 }}>
              One command to connect Mokkoi to your AI agent. Free and open source.
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="landing-cta-cmd" style={{
              background: 'rgba(0,0,0,.3)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 12,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
              maxWidth: 520,
              margin: '0 auto 24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <span style={{ color: '#34d399', fontFamily: "'JetBrains Mono', monospace", fontSize: 14, flexShrink: 0 }}>$</span>
                <code style={{ color: '#e2e8f0', fontSize: 14, fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis' }}>claude mcp add mokkoi — npx mokkoi-mcp-server</code>
              </div>
              <CopyButton text="claude mcp add mokkoi -- npx mokkoi-mcp-server" />
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' as const }}>
              <button
                onClick={() => goToApp()}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '14px 28px',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all .25s',
                  boxShadow: '0 4px 24px rgba(99,102,241,.25)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Start Building →
              </button>
              <a
                href="https://www.npmjs.com/package/mokkoi-mcp-server"
                target="_blank"
                rel="noopener"
                style={{
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid rgba(255,255,255,.08)',
                  borderRadius: 10,
                  padding: '14px 28px',
                  color: '#94a3b8',
                  fontSize: 15,
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all .25s',
                  display: 'inline-block',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)'; e.currentTarget.style.color = '#e2e8f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                View on npm
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,.05)',
        padding: '40px 24px',
      }}>
        <div className="landing-footer-inner" style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap' as const,
          gap: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 10 }}>M</div>
            <span style={{ color: '#475569', fontSize: 14 }}>Mokkoi · Built with love</span>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {[
              { label: 'GitHub', href: 'https://github.com/RHINOREX123/mokkoi-mcp-server' },
              { label: 'npm', href: 'https://www.npmjs.com/package/mokkoi-mcp-server' },
              { label: '@Mokkoi_dev', href: 'https://x.com/Mokkoi_dev' },
            ].map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener"
                style={{ color: '#475569', fontSize: 13, textDecoration: 'none', transition: 'color .2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#94a3b8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
              >
                {l.label}
              </a>
            ))}
            <span style={{ color: '#334155', fontSize: 13 }}>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
