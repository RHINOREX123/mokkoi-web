import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ScreenRenderer } from '../components/ScreenRenderer'
import type { ComponentNode } from '../types/mokkoi'

/* ────────────────────────────────────────────────────────────────────────────
 * Click classification
 *
 * Single iframe-wrapper handler (Week 1 Day 4 pattern, generalised).
 * Walks up from the click target to the nearest [role="button"] and decides
 * what KIND of clickable it is. Parent receives a discriminated mokkoi:click
 * message and dispatches.
 *
 * Week 3 narrow scope (Day 1 design): only label-routable kinds are forwarded.
 * Compound clickables (cards, list rows) defer to Phase 2 macro metadata.
 * ──────────────────────────────────────────────────────────────────────────── */

type ElementKind = 'BottomNavTab' | 'Button' | 'IconButton' | 'Deferred'

interface Classified {
  kind: ElementKind
  label: string
  /** Index of the button among its role="button" siblings — used by BottomNav for tab position. */
  tabIndex?: number
  /** Reason a click was classified Deferred (debug signal, surfaces in toast & console). */
  deferReason?: string
}

/** BottomNav row signature (unchanged from Week 1 Day 4):
 *  flexDirection:row + paddingBottom>=24 (safe-area inset) + borderTopWidth>=1
 *  + ≥2 [role="button"] children. The paddingBottom>=24 is what distinguishes
 *  BottomNav from a generic horizontal button row. */
function isBottomNavRow(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const s = el.style
  if (s.flexDirection !== 'row') return false
  if (parseFloat(s.paddingBottom || '0') < 24) return false
  if (parseFloat(s.borderTopWidth || '0') < 1) return false
  return el.querySelectorAll(':scope > [role="button"]').length >= 2
}

/** Did the click happen inside a list-row pattern (FlatList content, or a
 *  hand-built column of repeating clickable rows)?
 *
 *  Structural rule: the clicked button's parent has ≥2 sibling [role="button"]s
 *  laid out vertically (flexDirection != 'row' → BottomNav case), AND the
 *  median sibling has a substantial subtree (≥5 descendants). The substantial-
 *  subtree check distinguishes list rows (image + multiple texts + chevron)
 *  from a vertical stack of simple buttons (Login: "Sign In" / "Sign Up" /
 *  "Forgot Password"), which we want to treat as Buttons, not defer.
 *
 *  Style-signature ancestor matching (FlatList inner: display:flex +
 *  flexDirection:column + flexGrow:0 + flexShrink:0) was tried first but
 *  over-matched: many AI-generated screens use FlatList as the *page* layout,
 *  which would defer every button on the page including header "See All"
 *  links. The structural rule keys on local repetition, which is what
 *  list-row-ness actually is. */
function isListRowClick(btn: HTMLElement): boolean {
  const parent = btn.parentElement
  if (!(parent instanceof HTMLElement)) return false
  if (parent.style.flexDirection === 'row') return false
  const siblings = Array.from(parent.children).filter(
    c => c instanceof HTMLElement && c.getAttribute('role') === 'button',
  ) as HTMLElement[]
  if (siblings.length < 2) return false
  const counts = siblings.map(s => s.querySelectorAll('*').length).sort((a, b) => a - b)
  const median = counts[Math.floor(counts.length / 2)] ?? 0
  return median >= 5
}

/** Count Text descendants that aren't Material Symbols icons. Material
 *  Symbols glyphs render their icon name as textContent in a span with
 *  class 'material-symbols-outlined' — those don't count as Text labels. */
function countTextDescendants(el: HTMLElement): number {
  let n = 0
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const text = (node.textContent || '').trim()
    if (!text) continue
    // Skip if the parent or ancestor is a Material Symbols span.
    let inIcon = false
    for (let cur: Node | null = node.parentNode; cur && cur !== el; cur = cur.parentNode) {
      if (cur instanceof HTMLElement && cur.classList.contains('material-symbols-outlined')) {
        inIcon = true
        break
      }
    }
    if (!inIcon) n++
  }
  return n
}

function getMaterialSymbols(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll('.material-symbols-outlined')) as HTMLElement[]
}

/** Extract the label for a Button: concat all non-icon Text descendants, trim. */
function extractButtonLabel(btn: HTMLElement): string {
  const clone = btn.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.material-symbols-outlined').forEach(n => n.remove())
  return (clone.textContent || '').trim().replace(/\s+/g, ' ')
}

function classifyClickedElement(target: EventTarget | null): Classified | null {
  if (!(target instanceof Element)) return null

  // 1. Walk up to the innermost role="button" ancestor.
  let btn: HTMLElement | null = null
  for (let cur: Element | null = target; cur; cur = cur.parentElement) {
    if (cur instanceof HTMLElement && cur.getAttribute('role') === 'button') {
      btn = cur
      break
    }
  }
  if (!btn) return null

  // 2. BottomNav tab? (highest priority — preserves Week 1 Day 4 behavior.)
  if (isBottomNavRow(btn.parentElement)) {
    const clone = btn.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.material-symbols-outlined').forEach(n => n.remove())
    let label = (clone.textContent || '').trim()
    if (!label) {
      // Icon-only tab: fall back to Material Symbols glyph name.
      const iconSpan = btn.querySelector('.material-symbols-outlined')
      label = (iconSpan?.textContent || '').trim()
    }
    if (!label) return null
    const siblings = Array.from(btn.parentElement!.children).filter(
      c => c.getAttribute('role') === 'button',
    )
    return { kind: 'BottomNavTab', label, tabIndex: siblings.indexOf(btn) }
  }

  // 3. List-row pattern? Defer (Phase 2 macro metadata problem).
  if (isListRowClick(btn)) {
    return { kind: 'Deferred', label: '', deferReason: 'list-row' }
  }

  // 4. Text counting → Button vs IconButton vs Deferred (compound).
  const textCount = countTextDescendants(btn)
  const icons = getMaterialSymbols(btn)

  if (textCount >= 2) {
    // Compound clickable (card, multi-text button with badge etc.) — defer.
    return { kind: 'Deferred', label: extractButtonLabel(btn), deferReason: 'compound' }
  }

  if (textCount === 1) {
    const label = extractButtonLabel(btn)
    if (!label) return { kind: 'Deferred', label: '', deferReason: 'empty-label' }
    return { kind: 'Button', label }
  }

  // textCount === 0
  if (icons.length === 1) {
    const label = (icons[0].textContent || '').trim()
    if (!label) return { kind: 'Deferred', label: '', deferReason: 'empty-icon' }
    return { kind: 'IconButton', label }
  }

  // No text, multiple/zero icons — nothing to route on.
  return { kind: 'Deferred', label: '', deferReason: icons.length === 0 ? 'no-label' : 'multi-icon' }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Toast — visible "click went nowhere" feedback
 *
 * One toast at a time (latest replaces previous). 300ms debounce by label so
 * mash-clicking doesn't chatter. ~1.4s lifetime then fade.
 * ──────────────────────────────────────────────────────────────────────────── */

interface ToastState {
  message: string
  /** Used to bust StrictMode-stable identity & retrigger CSS animation. */
  nonce: number
}

function Toast({ state }: { state: ToastState | null }) {
  if (!state) return null
  return (
    <div
      key={state.nonce}
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        background: 'rgba(15, 23, 42, 0.92)',
        color: '#E6EDF3',
        fontSize: 12,
        fontFamily: 'system-ui, sans-serif',
        padding: '8px 14px',
        borderRadius: 8,
        border: '1px solid rgba(148, 163, 184, 0.25)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        pointerEvents: 'none',
        zIndex: 1000,
        whiteSpace: 'nowrap',
        maxWidth: '85%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        animation: 'mokkoi-toast-fade 1400ms ease-out forwards',
      }}
    >
      {state.message}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Runtime app
 * ──────────────────────────────────────────────────────────────────────────── */

function RuntimeApp() {
  const [tree, setTree] = useState<ComponentNode | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  // Toast debounce: track last (label, timestamp) so rapid identical clicks fire one toast.
  const lastToastRef = useRef<{ message: string; t: number } | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  function showToast(message: string) {
    const now = Date.now()
    const last = lastToastRef.current
    if (last && last.message === message && now - last.t < 300) return
    lastToastRef.current = { message, t: now }
    setToast({ message, nonce: now })
    if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1400)
  }

  useEffect(() => {
    console.log('[runtime] mounted')
    function onMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== 'object') return
      if (e.data.type === 'mokkoi:render-tree') {
        const incoming = e.data.tree as ComponentNode
        console.log('[runtime] received tree:', JSON.stringify(incoming).slice(0, 500))
        setTree(incoming)
        return
      }
      // Parent reports back when it failed to resolve a click → show toast.
      if (e.data.type === 'mokkoi:click-unresolved') {
        const label = String(e.data.label ?? '')
        showToast(label ? `No screen wired for '${label}'` : 'No screen wired for this action')
        return
      }
      if (e.data.type === 'mokkoi:click-deferred') {
        const reason = String(e.data.reason ?? '')
        showToast(reason === 'list-row'
          ? 'List-row taps need macro metadata (Phase 2)'
          : 'This click type is not yet wired')
        return
      }
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'mokkoi:runtime-ready' }, '*')
    return () => window.removeEventListener('message', onMessage)
  }, [])

  function handleCapture(e: React.MouseEvent) {
    const c = classifyClickedElement(e.target)
    if (!c) return

    // Deferred: handle iframe-side (toast + diagnostic), don't bother parent.
    if (c.kind === 'Deferred') {
      e.stopPropagation()
      console.log(
        `[runtime-click] deferred (${c.deferReason})`,
        c.label ? `label='${c.label}'` : '(no label)',
      )
      showToast(c.deferReason === 'list-row'
        ? 'List-row taps need macro metadata (Phase 2)'
        : 'This click type is not yet wired')
      return
    }

    e.stopPropagation()
    console.log(`[runtime-click] kind=${c.kind} label='${c.label}'`)
    window.parent.postMessage(
      {
        type: 'mokkoi:click',
        elementKind: c.kind,
        label: c.label,
        metadata: c.kind === 'BottomNavTab' ? { tabIndex: c.tabIndex } : undefined,
      },
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
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0A0A1A',
        position: 'relative',
      }}
    >
      <ScreenRenderer tree={tree} />
      <Toast state={toast} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<RuntimeApp />)
