import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ScreenRenderer } from '../components/ScreenRenderer'
import type { ComponentNode } from '../types/mokkoi'

function RuntimeApp() {
  const [tree, setTree] = useState<ComponentNode | null>(null)

  useEffect(() => {
    console.log('[runtime] mounted')
    function onMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== 'object') return
      if (e.data.type !== 'mokkoi:render-tree') return
      const incoming = e.data.tree as ComponentNode
      console.log('[runtime] received tree:', JSON.stringify(incoming).slice(0, 500))
      if (incoming && Array.isArray(incoming.children)) {
        for (const c of incoming.children) {
          if (typeof c === 'object' && c) {
            const propsSummary = c.props ? Object.keys(c.props).join(',') : '-'
            console.log('[runtime] rendering primitive:', c.type, 'props:', propsSummary || '(none)')
          }
        }
      }
      setTree(incoming)
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'mokkoi:runtime-ready' }, '*')
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (!tree) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', fontSize: 13, fontFamily: 'system-ui, sans-serif',
      }}>
        Waiting for tree…
      </div>
    )
  }
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0A0A1A' }}>
      <ScreenRenderer tree={tree} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<RuntimeApp />)
