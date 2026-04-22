import { Link } from 'react-router-dom'

export default function ComingSoonPage({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#06080D', color: '#E6EDF3',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 48, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #2563EB, #14B8A6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff' }}>M</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#E6EDF3' }}>Mokkoi</span>
        </Link>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 16px' }}>{title}</h1>
        <p style={{ fontSize: 16, color: '#7D8590', lineHeight: 1.6, margin: '0 0 32px' }}>
          {blurb || "We're building this. Follow us on Twitter for updates."}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="https://x.com/Mokkoi_dev" target="_blank" rel="noopener" style={{
            background: '#2563EB', color: '#fff', borderRadius: 10, padding: '12px 22px',
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>Follow @Mokkoi_dev</a>
          <Link to="/" style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid #1C2333',
            color: '#E6EDF3', borderRadius: 10, padding: '12px 22px',
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>← Back home</Link>
        </div>
      </div>
    </div>
  )
}
