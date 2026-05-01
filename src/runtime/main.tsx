import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ScreenRenderer } from '../components/ScreenRenderer'
import type { ComponentNode } from '../types/mokkoi'

/** Heuristic: is this row container a BottomNav?
 *  Inline-style signature from the BottomNav macro expansion in component-library.ts:
 *  flexDirection:'row', borderTopWidth:1, paddingBottom:34 (safe-area inset).
 *  paddingBottom>=24 is the safe-area signature that distinguishes BottomNav
 *  from generic horizontal button rows. */
function isBottomNavRow(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const s = el.style
  if (s.flexDirection !== 'row') return false
  if (parseFloat(s.paddingBottom || '0') < 24) return false
  if (parseFloat(s.borderTopWidth || '0') < 1) return false
  return el.querySelectorAll(':scope > [role="button"]').length >= 2
}

/** Extract a tab's label. Prefers the Text-child textContent; if the tab is
 *  icon-only (common when the AI generates raw nodes instead of using the
 *  BottomNav macro with `items`), falls back to the Material Symbols icon
 *  name — since Symbols glyphs render their name as text content, that
 *  name (e.g. 'home', 'person') is what's visible in textContent. */
function extractTabLabel(tab: HTMLElement): string {
  const clone = tab.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.material-symbols-outlined').forEach(n => n.remove())
  const text = (clone.textContent || '').trim()
  if (text) return text
  const iconSpan = tab.querySelector('.material-symbols-outlined')
  return (iconSpan?.textContent || '').trim()
}

function findClickedTab(target: EventTarget | null): { label: string; index: number } | null {
  if (!(target instanceof Element)) return null
  let tab: HTMLElement | null = null
  for (let cur: Element | null = target; cur; cur = cur.parentElement) {
    if (cur instanceof HTMLElement && cur.getAttribute('role') === 'button') {
      tab = cur
      break
    }
  }
  if (!tab || !isBottomNavRow(tab.parentElement)) return null
  const label = extractTabLabel(tab)
  if (!label) return null
  const siblings = Array.from(tab.parentElement!.children).filter(
    c => c.getAttribute('role') === 'button'
  )
  return { label, index: siblings.indexOf(tab) }
}

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

  function handleCapture(e: React.MouseEvent) {
    const found = findClickedTab(e.target)
    if (!found) return
    console.log(`[runtime-nav] tab clicked: '${found.label}' (index ${found.index})`)
    e.stopPropagation()
    window.parent.postMessage(
      { type: 'mokkoi:nav-click', label: found.label, sourceComponent: 'BottomNav', tabIndex: found.index },
      '*',
    )
  }

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
    <div
      onClickCapture={handleCapture}
      style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0A0A1A' }}
    >
      <ScreenRenderer tree={tree} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<RuntimeApp />)
