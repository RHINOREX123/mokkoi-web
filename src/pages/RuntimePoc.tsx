import { useEffect, useRef, useState } from 'react'
import { expandComponents } from '../../lib/component-library'
import type { ComponentNode } from '../types/mokkoi'

// A representative Mokkoi-shape macro tree — what the AI emits before
// expansion. We run it through expandComponents() (the same path the
// canvas/snack export uses) so the iframe receives pre-expanded primitives,
// matching what production Supabase trees look like.
const SAMPLE_MACRO_TREE: ComponentNode = {
  type: 'View',
  style: { flex: 1, backgroundColor: '#0A0A1A' },
  children: [
    {
      type: 'HeaderBar',
      props: { title: 'Discover', showBack: false, rightIcons: ['notifications', 'settings'] },
    },
    {
      type: 'ScrollView',
      style: { flex: 1 },
      props: { contentContainerStyle: { padding: 16, gap: 16 } },
      children: [
        {
          type: 'SearchBar',
          props: { placeholder: 'Search restaurants, dishes…' },
        },
        {
          type: 'View',
          style: { flexDirection: 'row', gap: 12 },
          children: [
            { type: 'StatCard', props: { icon: 'local_fire_department', iconColor: '#F97316', value: '1.2k', label: 'Trending' } },
            { type: 'StatCard', props: { icon: 'star', iconColor: '#FBBF24', value: '4.8', label: 'Avg. rating' } },
            { type: 'StatCard', props: { icon: 'schedule', iconColor: '#818CF8', value: '15m', label: 'Avg. wait' } },
          ],
        },
        { type: 'SectionHeader', props: { title: 'Featured', actionText: 'See all' } },
        {
          type: 'PromoCard',
          props: { title: '50% off your first order', subtitle: 'Limited time — use code MOKKOI50', buttonText: 'Claim' },
        },
        { type: 'SectionHeader', props: { title: 'Popular near you' } },
        {
          type: 'View',
          style: { gap: 8 },
          children: [
            { type: 'ListRow', props: { icon: 'restaurant', iconColor: '#F97316', title: 'Sakura Sushi', subtitle: '0.4 mi · $$ · Japanese', trailing: '4.7' } },
            { type: 'ListRow', props: { icon: 'local_pizza', iconColor: '#EF4444', title: 'Pizzeria Romana', subtitle: '0.6 mi · $$ · Italian', trailing: '4.5' } },
            { type: 'ListRow', props: { icon: 'lunch_dining', iconColor: '#22C55E', title: 'Green Bowl', subtitle: '0.8 mi · $ · Healthy', trailing: '4.6' } },
          ],
        },
      ],
    },
    {
      type: 'BottomNav',
      props: {
        items: [
          { icon: 'home', label: 'Home', active: true },
          { icon: 'search', label: 'Discover' },
          { icon: 'favorite', label: 'Saved' },
          { icon: 'person', label: 'Profile' },
        ],
      },
    },
  ],
}

const EXPANDED_TREE: ComponentNode = expandComponents(SAMPLE_MACRO_TREE) as ComponentNode

export default function RuntimePoc() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.type === 'mokkoi:runtime-ready') {
        console.log('[parent] runtime ready')
        setReady(true)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  function send() {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'mokkoi:render-tree', tree: EXPANDED_TREE },
      '*',
    )
    setSent(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#06080D', color: '#E6EDF3', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>Mokkoi Runtime POC</h1>
      <p style={{ fontSize: 13, color: '#7D8590', marginBottom: 16 }}>
        Iframe status: {ready ? 'ready' : 'waiting'} · Tree sent: {sent ? 'yes' : 'no'}
      </p>
      <button
        onClick={send}
        disabled={!ready}
        style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: ready ? '#2563EB' : '#1C2333',
          color: '#fff', fontSize: 13, cursor: ready ? 'pointer' : 'default',
          marginBottom: 16,
        }}
      >
        Send tree to runtime
      </button>
      <div style={{
        width: 390, height: 700, border: '1px solid #1C2333',
        borderRadius: 12, overflow: 'hidden', background: '#0A0A1A',
      }}>
        <iframe
          ref={iframeRef}
          src="/runtime/index.html"
          title="Mokkoi Runtime POC"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      </div>
    </div>
  )
}
