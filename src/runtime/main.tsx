import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ScreenRenderer } from '../components/ScreenRenderer'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { validateTree } from '../utils/validateTree'
import type { ComponentNode, NavIntent } from '../types/mokkoi'
import type { PillState } from './state'

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

/** Filter/segment chip-row detector. Generated screens often emit a horizontal
 *  row of TouchableOpacity chips (All / Easy / Tempo / Intervals / Advanced)
 *  which the wirer may pre-resolve to nav targets — but these are local UI
 *  state, not navigation. Heuristic: parent flexDirection:row, ALL children
 *  are [role="button"] (no title Text mixed in — that's a header, not a
 *  chip row), 3+ buttons total, each with a small subtree (≤4 descendants on
 *  the median). BottomNav is filtered out earlier in classifyClickedElement
 *  (its row has paddingBottom>=24 + borderTopWidth>=1). */
function isFilterChipClick(btn: HTMLElement): boolean {
  const parent = btn.parentElement
  if (!(parent instanceof HTMLElement)) return false
  if (parent.style.flexDirection !== 'row') return false
  const allChildren = Array.from(parent.children).filter(
    c => c instanceof HTMLElement,
  ) as HTMLElement[]
  // Header rows (back arrow + title + actions) mix buttons with a Text title.
  // Real chip rows are 100% buttons. If anything non-button sits in the row,
  // bail — this is the fix for back-arrow being swallowed in detail-screen
  // headers like "← 5K Race Prep ♡ ↗".
  const buttons = allChildren.filter(c => c.getAttribute('role') === 'button')
  if (buttons.length !== allChildren.length) return false
  if (buttons.length < 3) return false
  const counts = buttons.map(s => s.querySelectorAll('*').length).sort((a, b) => a - b)
  const median = counts[Math.floor(counts.length / 2)] ?? 0
  return median <= 4
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

  // 3. Filter/segment chip row? Defer with no toast — these are local UI state,
  // not navigation. The wirer may have wired chips to a destination; this is
  // the runtime safety net.
  if (isFilterChipClick(btn)) {
    return { kind: 'Deferred', label: extractButtonLabel(btn), deferReason: 'filter-chip' }
  }

  // 4. List-row pattern? Defer (Phase 2 macro metadata problem).
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

/** Measure the BottomNav row in the iframe (if any) and return the toast's
 *  `bottom` offset so the toast clears it with 16px of breathing room.
 *  Falls back to 24px when no BottomNav is present. Re-measured on every render
 *  via ToastState.nonce so screen changes pick up new BottomNav dimensions. */
function computeToastBottom(): number {
  const all = document.querySelectorAll<HTMLElement>('div')
  for (const el of Array.from(all)) {
    const s = el.style
    if (s.flexDirection !== 'row') continue
    if (parseFloat(s.paddingBottom || '0') < 24) continue
    if (parseFloat(s.borderTopWidth || '0') < 1) continue
    if (el.querySelectorAll(':scope > [role="button"]').length < 2) continue
    const rect = el.getBoundingClientRect()
    const viewportH = document.documentElement.clientHeight
    return Math.round(viewportH - rect.top + 16)
  }
  return 24
}

function Toast({ state }: { state: ToastState | null }) {
  if (!state) return null
  return (
    <div
      key={state.nonce}
      style={{
        position: 'absolute',
        left: '50%',
        bottom: computeToastBottom(),
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
 * Fallback UI — shown when validateTree rejects (root malformed) OR when the
 * ErrorBoundary catches a crash inside ScreenRenderer. Single visual for both
 * paths so the user can't tell which layer caught the failure. Matches the
 * runtime's dark aesthetic.
 * ──────────────────────────────────────────────────────────────────────────── */

function RuntimeFallback({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100%', width: '100%', gap: 12, padding: 24,
      background: '#0A0A1A', color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: 'rgba(248,113,113,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, color: '#f87171',
      }}>
        !
      </div>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
        {message}
      </h3>
      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', textAlign: 'center', maxWidth: 260 }}>
        The screen tree had an unexpected shape.
      </p>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Runtime app
 * ──────────────────────────────────────────────────────────────────────────── */

function RuntimeApp() {
  const [tree, setTree] = useState<ComponentNode | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  // Workstream D: parent-mirrored pillState for filter-pill active styling.
  // Posted alongside the tree on mokkoi:render-tree, and incrementally via
  // mokkoi:pill-state on pill taps. Undefined-safe — ScreenRenderer accepts
  // optional props and renders unchanged when these aren't provided.
  const [pillState, setPillState] = useState<PillState | undefined>(undefined)
  const [activeScreenId, setActiveScreenId] = useState<string | undefined>(undefined)

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
        // Workstream D: additive pillState + activeScreenId fields. Old
        // parents that don't send them leave these as undefined; new
        // parents keep the iframe's pill view in sync with the tree.
        if (e.data.pillState && typeof e.data.pillState === 'object') {
          setPillState(e.data.pillState as PillState)
        }
        if (typeof e.data.activeScreenId === 'string') {
          setActiveScreenId(e.data.activeScreenId)
        }
        return
      }
      // Workstream D: incremental pill-state update (no tree change).
      if (e.data.type === 'mokkoi:pill-state') {
        try {
          if (e.data.pillState && typeof e.data.pillState === 'object') {
            setPillState(e.data.pillState as PillState)
          }
          if (typeof e.data.activeScreenId === 'string') {
            setActiveScreenId(e.data.activeScreenId)
          }
        } catch (err) {
          console.warn('[runtime] mokkoi:pill-state handler crashed; ignoring', err)
        }
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
          ? 'Coming soon'
          : 'This click type is not yet wired')
        return
      }
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'mokkoi:runtime-ready' }, '*')
    return () => window.removeEventListener('message', onMessage)
  }, [])

  function handleCapture(e: React.MouseEvent) {
    // Deep-nav: if the clicked element walks up to a [role="button"] carrying
    // `data-mokkoi-nav`, the LLM/wirer already declared the intent. Forward it
    // verbatim to the parent and bypass the heuristic classifier (which would
    // otherwise defer compound clickables like cards). Existing classification
    // is the fallback for old projects with no navIntent.
    let navBtn: HTMLElement | null = null
    if (e.target instanceof Element) {
      for (let cur: Element | null = e.target; cur; cur = cur.parentElement) {
        if (cur instanceof HTMLElement && cur.getAttribute('role') === 'button') {
          navBtn = cur
          break
        }
      }
    }
    const rawNav = navBtn?.dataset.mokkoiNav
    let navIntent: NavIntent | null = null
    if (rawNav) {
      try {
        navIntent = JSON.parse(rawNav) as NavIntent
      } catch (err) {
        console.warn('[mokkoi-click] malformed data-mokkoi-nav:', err)
      }
    }

    // 1. Real nav intents (push/openSheet/back/toggleState) take priority.
    //    noop falls through so the legacy CSS classifier still gets a shot
    //    at BottomNav rows, back glyphs, etc. (which are sanitized to
    //    navIntent:{kind:'noop'} by the validator but were always handled
    //    by classifyClickedElement pre-Phase 0).
    if (navIntent) {
      if (navIntent.kind === 'toggleState') {
        e.stopPropagation()
        window.parent.postMessage(
          {
            type: 'mokkoi:toggleState',
            group: navIntent.group,
            stateKey: navIntent.stateKey,
          },
          '*',
        )
        return
      }
      if (
        navIntent.kind === 'push' ||
        navIntent.kind === 'openSheet' ||
        navIntent.kind === 'back'
      ) {
        e.stopPropagation()
        const labelClone = navBtn!.cloneNode(true) as HTMLElement
        labelClone.querySelectorAll('.material-symbols-outlined').forEach(n => n.remove())
        const label = (labelClone.textContent || '').trim().replace(/\s+/g, ' ')
        const targetForLog = 'target' in navIntent ? navIntent.target : '(back)'
        console.log(`[mokkoi-click] iframe → navIntent=${navIntent.kind}:${targetForLog}`)
        window.parent.postMessage(
          { type: 'mokkoi:click', elementKind: 'Button', label, navIntent },
          '*',
        )
        return
      }
      // navIntent.kind === 'noop' → fall through to legacy classifier
    }

    // 2. Legacy CSS classifier — handles BottomNav rows, back glyphs, and
    //    other shapes that worked pre-Phase 0.
    const c = classifyClickedElement(e.target)
    if (!c) {
      // 3. Last resort: noop intent with a toast message.
      if (navIntent && navIntent.kind === 'noop' && navIntent.toastMessage) {
        e.stopPropagation()
        window.parent.postMessage(
          { type: 'mokkoi:toast', message: navIntent.toastMessage },
          '*',
        )
      }
      // 4. Otherwise silent: truly dead click, no signal anywhere.
      return
    }

    // Deferred: handle iframe-side (toast + diagnostic), don't bother parent.
    // Exception: list-row defers are forwarded so the parent can attempt
    // singleTarget routing. If the parent can't resolve, it posts back
    // mokkoi:click-deferred which fires the toast via the message handler.
    if (c.kind === 'Deferred') {
      e.stopPropagation()
      console.log(
        `[mokkoi-click] iframe → kind=Deferred reason=${c.deferReason} label='${c.label}'`,
      )
      if (c.deferReason === 'list-row') {
        window.parent.postMessage(
          {
            type: 'mokkoi:click',
            elementKind: c.kind,
            label: c.label,
            deferReason: c.deferReason,
          },
          '*',
        )
        return
      }
      if (c.deferReason === 'filter-chip') {
        // Filter chips are local UI state. Suppress navigation entirely; no
        // toast (a "not wired" message here would be wrong — this is the
        // intended behaviour). The chip's pressed-opacity + active CSS
        // already gives the user tap feedback.
        return
      }
      showToast('This click type is not yet wired')
      return
    }

    e.stopPropagation()
    console.log(`[mokkoi-click] iframe → kind=${c.kind} label='${c.label}'`)
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

  // Layer 1: light root validation. Catches malformed shapes before they reach
  // ScreenRenderer (whose mid-tree code does node.children?.filter — would
  // throw on string children, etc.). Failures render the fallback directly;
  // no need to involve the ErrorBoundary for an expected guard.
  const validation = validateTree(tree)
  if (!validation.valid) {
    console.warn('[runtime] tree validation failed:', validation.reason)
    return <RuntimeFallback message="Couldn't render this screen" />
  }

  // Layer 2: ErrorBoundary catches anything that slips past validation and
  // crashes mid-render (e.g., undefined property access deep in the tree).
  // Same fallback UI as Layer 1 so the user sees one consistent state.
  // `telemetrySurface="runtime"` enables Week 5 Day 0 PostHog tracking on catch.
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
      <ErrorBoundary
        fallback={<RuntimeFallback message="Couldn't render this screen" />}
        telemetrySurface="runtime"
      >
        <ScreenRenderer tree={validation.tree} pillState={pillState} activeScreenId={activeScreenId} />
        <RenderCompleteSignal treeId={validation.tree} />
      </ErrorBoundary>
      <Toast state={toast} />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Render-complete signal
 *
 * Posts `mokkoi:render-complete` (iframe → parent) immediately after the
 * ScreenRenderer commit settles. ADDITIVE new message type introduced Week 5
 * Day 0 for first-paint p50 telemetry — old parent code that doesn't listen
 * for it just ignores the message harmlessly. Existing message shapes are
 * unchanged.
 *
 * Implementation: a useEffect keyed on the tree object fires after every
 * render where the tree reference changed. Sits as a sibling of ScreenRenderer
 * inside the same boundary so it only fires when the render actually committed
 * (if ScreenRenderer throws, the boundary catches and this never runs — which
 * is correct: a crashed render didn't "complete").
 *
 * No payload — parent correlates by maintaining its own "last post time" ref
 * and computes the latency on receipt. We intentionally do NOT add a postId or
 * screen_id field here, to avoid touching the existing `mokkoi:render-tree`
 * shape. Race condition (back-to-back posts) is benign for a p50 metric.
 *
 * TODO (Week 5 Day 5 README): document `mokkoi:render-complete` in the
 * runtime protocol message-types section when runtime/README.md is written.
 * ──────────────────────────────────────────────────────────────────────────── */

function RenderCompleteSignal({ treeId }: { treeId: ComponentNode }) {
  useEffect(() => {
    window.parent.postMessage({ type: 'mokkoi:render-complete' }, '*')
  }, [treeId])
  return null
}

createRoot(document.getElementById('root')!).render(<RuntimeApp />)
