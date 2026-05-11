import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { expandComponents } from '../../lib/component-library'
import { computeFitScale } from '../utils/computeFitScale'
import { findNavigationTarget } from '../utils/previewNavigation'
import { fuzzyMatchScreen } from '../utils/fuzzyMatchScreen'
import { getDevicePreset, DEFAULT_DEVICE } from '../constants/devices'
import { trackEvent } from '../lib/analytics'
import type { ComponentNode, NavIntent } from '../types/mokkoi'
import type { FlowConnection } from './FlowConnectors'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import type { DeviceId } from '../constants/devices'
import { substituteSentinels } from '../utils/sentinelSubstitution'
import type { DeepNavRouteGraph } from '../utils/exportTsx'

export type { AppData } from '../utils/sentinelSubstitution'

/** Screen shape extensions added by the planner (Stream A) but not yet
 *  threaded through GeneratedScreen. Read defensively. */
interface ScreenExtras {
  presentation?: 'screen' | 'modal'
  dataSource?: { collection: string; paramKey?: string }
}

/** Slugify a string for tolerant id matching (e.g. "Push-ups" ↔ "push-ups"). */
function slugify(s: unknown): string {
  return String(s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Find a record across the planner's appData blob for the given screen, no
 *  matter which of the four shape combinations the LLM produced:
 *   - appData[collection] as id-keyed object vs array of records
 *   - navIntent params keyed by 'id' vs by routeGraph's declared paramKey
 *   - id value as the record's real id vs a slug of its name
 *  Returns undefined when nothing resolves; the substitution helper then
 *  leaves the {{sentinel}} text in place as a visible debug aid. */
function resolveRecord(
  appData: unknown,
  collection: string | undefined,
  paramKey: string | undefined,
  params: Record<string, string> | undefined,
): Record<string, unknown> | undefined {
  if (!appData || typeof appData !== 'object' || !collection) return undefined
  const coll = (appData as Record<string, unknown>)[collection]
  if (!coll) return undefined
  // Build a list of candidate id values to try: the routeGraph-declared
  // paramKey first, then every other param value (covers LLM variance like
  // params.id vs params.workoutId).
  const candidates: string[] = []
  if (paramKey && params?.[paramKey]) candidates.push(params[paramKey])
  if (params) for (const k of Object.keys(params)) {
    const v = params[k]
    if (v && !candidates.includes(v)) candidates.push(v)
  }
  if (candidates.length === 0) return undefined
  // Array shape: linear scan, match record.id, then slug(record.name).
  if (Array.isArray(coll)) {
    for (const c of candidates) {
      const hit = coll.find((r): r is Record<string, unknown> =>
        !!r && typeof r === 'object' && (r as Record<string, unknown>).id === c
      )
      if (hit) return hit
    }
    for (const c of candidates) {
      const cs = slugify(c)
      const hit = coll.find((r): r is Record<string, unknown> =>
        !!r && typeof r === 'object' && slugify((r as Record<string, unknown>).name) === cs
      )
      if (hit) return hit
    }
    return undefined
  }
  // Keyed-object shape: direct lookup, then scan values by record.id, then
  // by slug(record.name).
  const obj = coll as Record<string, unknown>
  for (const c of candidates) {
    const v = obj[c]
    if (v && typeof v === 'object') return v as Record<string, unknown>
  }
  const values = Object.values(obj).filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
  for (const c of candidates) {
    const hit = values.find(r => r.id === c)
    if (hit) return hit
  }
  for (const c of candidates) {
    const cs = slugify(c)
    const hit = values.find(r => slugify(r.name) === cs)
    if (hit) return hit
  }
  return undefined
}

interface RuntimeIframePreviewProps {
  screens: GeneratedScreen[]
  connections: FlowConnection[]
  projectName: string
  activeScreenId: string
  onActiveScreenChange: (screenId: string) => void
  deviceId?: DeviceId
  manualZoom?: number | null
  disabled?: boolean
  /** Stable project identifier (Supabase row id). Threaded through for Week 5
   *  Day 0 telemetry properties. Optional — if absent, events fire without it. */
  projectId?: string
  /** Planner-produced record collections (Stream A). When present, detail
   *  screens with a dataSource get their {{sentinels}} substituted before the
   *  tree is posted into the iframe. Old projects omit this; substitution is
   *  a no-op then. Loose type because the planner emits arrays per collection
   *  while the substitution path also accepts id-keyed objects — resolveRecord
   *  handles both at runtime. */
  appData?: unknown
  /** Planner-produced route graph. Used to look up the active screen's
   *  dataSource (collection name + param key) and its kind ('modal' triggers
   *  the slide-up animation). The generated screens carry no per-screen
   *  metadata, so this is the canonical source. */
  routeGraph?: DeepNavRouteGraph | null
}

/** Recursive node count — used as a tree-size dimension on render telemetry.
 *  Cheap (~O(n) one-pass) and only fires on actual posts, not on every render.
 *  Children can be `ComponentNode | string` per the schema; strings (text leaves)
 *  count as 1 node each. */
function countTreeNodes(node: ComponentNode | string): number {
  if (typeof node === 'string') return 1
  let n = 1
  if (Array.isArray(node.children)) {
    for (const c of node.children) n += countTreeNodes(c)
  }
  return n
}

/** Production runtime preview. Drop-in replacement shape for InlineSnackPreview:
 *  overlays the static <PreviewPhoneFrame> via position:absolute; inset:0, with
 *  the same scaling math. The iframe src points at /runtime/index.html (the
 *  Mokkoi runtime built from src/runtime/main.tsx) instead of Snack's web
 *  player.
 *
 *  Architecture (mirrors RuntimePoc.tsx):
 *  - Iframe boots and posts mokkoi:runtime-ready.
 *  - Parent posts the active screen's expanded tree via mokkoi:render-tree.
 *  - Iframe forwards user clicks as mokkoi:click {elementKind, label}.
 *  - Parent resolves: FlowConnection → fuzzy name → mokkoi:click-unresolved.
 *
 *  Tree source is canvas memory (props), NOT Supabase. The runtime here is
 *  passive — receives whatever the parent posts. */
export function RuntimeIframePreview({
  screens,
  connections,
  activeScreenId,
  onActiveScreenChange,
  deviceId,
  manualZoom = null,
  disabled = false,
  projectId,
  appData,
  routeGraph,
}: RuntimeIframePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [iframeReady, setIframeReady] = useState(false)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  // Telemetry refs (Week 5 Day 0). mountTimeMs feeds runtime_iframe_ready's
  // ms_since_mounted. lastPostMs feeds runtime_render_complete's ms_since_posted
  // — set on every mokkoi:render-tree post, cleared on receipt of
  // mokkoi:render-complete. Race condition (back-to-back posts produce one
  // complete) is benign for a p50 metric and keeps us from changing the
  // existing render-tree message shape with a postId field.
  const mountTimeMs = useRef<number>(Date.now())
  const lastPostMs = useRef<number | null>(null)
  const lastPostScreenId = useRef<string | null>(null)
  const lastPostNodeCount = useRef<number>(0)

  // In-session back-stack for the iframe preview. Generated trees rarely wire a
  // back arrow via FlowConnection (the wirer keys on forward triggers like
  // "select_workout"), so without this every IconButton{label='arrow_back'} tap
  // would land in the runtime's "no screen wired" toast. We push the previous
  // screen on every forward navigation and pop on back-glyph clicks; if the
  // stack is empty we fall back to screens[0] (entry/home).
  const historyRef = useRef<string[]>([])

  // Current navigation params per screen id (populated when a navIntent push
  // carries them). Used to look up the record for sentinel substitution
  // before posting the detail screen's tree into the iframe.
  const paramsByScreenRef = useRef<Record<string, Record<string, string>>>({})

  // Tracks whether the active screen is a modal-presentation screen. Drives
  // the CSS slide-up transition and the close (X) overlay rendered in the
  // wrapper (outside the iframe).
  const [modalAnim, setModalAnim] = useState(false)

  const device = getDevicePreset(deviceId || DEFAULT_DEVICE)
  const isAndroid = device.category === 'Android'

  const activeScreen = useMemo(
    () => screens.find(s => s.id === activeScreenId),
    [screens, activeScreenId],
  )

  // Stable fingerprint of the active tree — same pattern InlineSnackPreview uses
  // to gate its expensive payload memo. Prevents re-posts on parent renders
  // where the tree object identity changed but its content didn't.
  const treeFingerprint = useMemo(() => {
    if (!activeScreen?.tree) return ''
    return `${activeScreen.id}:${JSON.stringify(activeScreen.tree).length}`
  }, [activeScreen])

  // ResizeObserver — same callback-ref pattern as InlineSnackPreview /
  // PreviewPhoneFrame so the observer (re-)attaches on every wrapper mount.
  const setWrapperRef = useCallback((el: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (el) {
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          setContainerSize({ w: width, h: height })
        }
      })
      ro.observe(el)
      observerRef.current = ro
    }
  }, [])

  // Reset back-stack when the project switches. activeScreenId can also change
  // for non-click reasons (canvas-editor tile selection); we only push in the
  // click handler, so a stale stack across project boundaries would be the
  // worst kind of pointer — clear it.
  useEffect(() => {
    historyRef.current = []
  }, [projectId])

  // Mount-time telemetry (Week 5 Day 0). Fires once per RuntimeIframePreview
  // instance — i.e. canvas open with flag on, project switch, refresh-button
  // bump (key change → new instance). flag_namespace is hardcoded 'live' to
  // match the App.tsx key prefix; if the prefix scheme ever expands, lift this
  // into a prop.
  useEffect(() => {
    mountTimeMs.current = Date.now()
    lastPostMs.current = null
    trackEvent('runtime_iframe_mounted', {
      project_id: projectId,
      screen_count: screens.length,
      device_id: deviceId,
      flag_namespace: 'live',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Iframe ready handshake + render-complete listener (Week 5 Day 0).
  // mokkoi:render-complete is the additive iframe-side signal posted after
  // every ScreenRenderer commit; parent computes ms_since_posted from
  // lastPostMs ref. Old iframe HTML cached in browsers won't post it; that
  // session simply produces no runtime_render_complete events, no error.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.type === 'mokkoi:runtime-ready') {
        console.log('[runtime-preview] runtime ready')
        setIframeReady(true)
        trackEvent('runtime_iframe_ready', {
          project_id: projectId,
          ms_since_mounted: Date.now() - mountTimeMs.current,
        })
        return
      }
      if (e.data?.type === 'mokkoi:render-complete') {
        const postedAt = lastPostMs.current
        if (postedAt == null) return
        trackEvent('runtime_render_complete', {
          project_id: projectId,
          screen_id: lastPostScreenId.current,
          ms_since_posted: Date.now() - postedAt,
          tree_node_count: lastPostNodeCount.current,
        })
        lastPostMs.current = null
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [projectId])

  // Click routing — mirrors src/pages/RuntimePoc.tsx:179-221. FlowConnection,
  // then fuzzy name match, then echo mokkoi:click-unresolved so the runtime
  // can toast.
  useEffect(() => {
    // Back-button glyphs the runtime can emit. Material Symbols + lucide aliases.
    // Compared case-insensitively against the IconButton label.
    const BACK_GLYPHS = new Set([
      'arrow_back', 'arrow_back_ios', 'arrow_back_ios_new',
      'chevron_left', 'keyboard_backspace', 'west',
      'arrow-left', 'arrow-back', 'chevron-left',
    ])

    function navigateForward(target: string, params?: Record<string, string>) {
      if (target === activeScreenId) return
      // Avoid pushing duplicates back-to-back (defensive against double-click).
      const stack = historyRef.current
      if (stack[stack.length - 1] !== activeScreenId) {
        stack.push(activeScreenId)
      }
      if (params && Object.keys(params).length > 0) {
        paramsByScreenRef.current[target] = params
      }
      const targetScreen = screens.find(s => s.id === target) as
        | (GeneratedScreen & ScreenExtras)
        | undefined
      // Modal detection: prefer the screen's explicit presentation (legacy
      // single-screen apps) but fall back to the planner's routeGraph kind
      // for deep-nav apps where the screen object never gets a presentation
      // field stamped on it.
      const rgKind = routeGraph?.screens.find(s => s.id === target)?.kind
      const isModal = targetScreen?.presentation === 'modal' || rgKind === 'modal'
      setModalAnim(isModal)
      onActiveScreenChange(target)
    }

    function onClick(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.type !== 'mokkoi:click') return
      const kind = String(e.data.elementKind ?? '')
      const label = String(e.data.label ?? '')
      const deferReason = String(e.data.deferReason ?? '')
      const navIntent = (e.data.navIntent ?? null) as NavIntent | null
      if (!activeScreenId) return

      const tried: string[] = []
      const has_label = label.length > 0
      const isListRowDefer = kind === 'Deferred' && deferReason === 'list-row'

      // Deep-nav resolution: manual FlowConnection > navIntent > fuzzy/single.
      // Manual wires win because users editing connections by hand must not be
      // silently overruled by LLM-emitted intents on regen.
      if (navIntent && navIntent.kind !== 'noop' && !isListRowDefer) {
        tried.push('flowConnection')
        const flowTarget = label
          ? findNavigationTarget(connections, activeScreenId, label)
          : null
        if (flowTarget && flowTarget !== navIntent.target) {
          console.warn(
            `[mokkoi-click] manual FlowConnection overrode navIntent (manual=${flowTarget} navIntent=${navIntent.target})`,
          )
          navigateForward(flowTarget)
          trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'flow_connection' })
          return
        }
        if (flowTarget) {
          navigateForward(flowTarget)
          trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'flow_connection' })
          return
        }
        tried.push('navIntent')
        if (screens.some(s => s.id === navIntent.target)) {
          if (import.meta.env.DEV) console.log(`[mokkoi-click] parent → tried=${tried.join(',')} matched=navIntent:${navIntent.target}`)
          navigateForward(navIntent.target, navIntent.params)
          trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'nav_intent' })
          return
        }
        if (import.meta.env.DEV) console.warn(`[mokkoi-click] navIntent target='${navIntent.target}' not found; falling through`)
      }

      // Back-glyph short-circuit. The wirer doesn't reliably wire back arrows
      // (planner connections key on forward triggers), so we maintain an
      // in-session history stack and pop on back. Empty stack falls back to
      // the project's entry screen — typically the first generated screen.
      if (kind === 'IconButton' && BACK_GLYPHS.has(label.trim().toLowerCase())) {
        const stack = historyRef.current
        let target: string | undefined
        while (stack.length) {
          const candidate = stack.pop()!
          if (candidate !== activeScreenId && screens.some(s => s.id === candidate)) {
            target = candidate
            break
          }
        }
        if (!target) {
          const entry = screens[0]?.id
          if (entry && entry !== activeScreenId) target = entry
        }
        if (target) {
          if (import.meta.env.DEV) console.log(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=backHistory matched=${target}`)
          const targetScreen = screens.find(s => s.id === target) as
            | (GeneratedScreen & ScreenExtras) | undefined
          setModalAnim(targetScreen?.presentation === 'modal')
          onActiveScreenChange(target)
          trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'back_history' })
        } else {
          if (import.meta.env.DEV) console.log(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=backHistory matched=none`)
          trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'back_noop' })
        }
        return
      }

      if (!label && !isListRowDefer) {
        if (import.meta.env.DEV) console.warn(`[mokkoi-click] parent → kind=${kind} label='' tried= matched=none reason=empty-label`)
        e.source?.postMessage({ type: 'mokkoi:click-unresolved', label: '', kind }, '*')
        trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'unresolved' })
        trackEvent('runtime_click_unresolved', { project_id: projectId, kind, label: '' })
        return
      }

      // List-row defers have no label to match on — skip flow/fuzzy and go
      // straight to the singleTarget fallback.
      if (!isListRowDefer) {
        tried.push('flowConnection')
        const flowTarget = findNavigationTarget(connections, activeScreenId, label)
        if (flowTarget) {
          if (import.meta.env.DEV) console.log(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=${tried.join(',')} matched=flowConnection:${flowTarget}`)
          navigateForward(flowTarget)
          trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'flow_connection' })
          return
        }

        tried.push('fuzzyName')
        const fuzzy = fuzzyMatchScreen(label, screens)
        if (fuzzy) {
          if (import.meta.env.DEV) console.log(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=${tried.join(',')} matched=fuzzyName:${fuzzy.id}`)
          navigateForward(fuzzy.id)
          trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'fuzzy_name' })
          return
        }
      }

      tried.push('singleTarget')
      const outgoing = connections.filter(c =>
        c.fromScreenId === activeScreenId &&
        c.trigger !== 'nav_back' &&
        c.trigger !== 'back'
      )
      if (outgoing.length === 1) {
        const target = outgoing[0].toScreenId
        if (import.meta.env.DEV) console.log(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=${tried.join(',')} matched=singleTarget:${target}`)
        navigateForward(target)
        trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'single_target' })
        return
      }

      if (import.meta.env.DEV) console.warn(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=${tried.join(',')} matched=none`)
      // For unresolved list-row defers, post click-deferred so the iframe shows
      // the macro-metadata toast. Otherwise fall back to click-unresolved.
      if (isListRowDefer) {
        e.source?.postMessage({ type: 'mokkoi:click-deferred', reason: 'list-row' }, '*')
      } else {
        e.source?.postMessage({ type: 'mokkoi:click-unresolved', label, kind }, '*')
        trackEvent('runtime_click_unresolved', { project_id: projectId, kind, label })
      }
      trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'unresolved' })
    }
    window.addEventListener('message', onClick)
    return () => window.removeEventListener('message', onClick)
  }, [connections, screens, activeScreenId, onActiveScreenChange])

  // Post the active tree whenever it changes and the iframe is ready.
  // While disabled (generation in progress), hold off — partial trees aren't
  // worth posting. Streaming throttle is Day 4 work; the fingerprint guard
  // above is the minimum protection for now.
  useEffect(() => {
    if (disabled) return
    if (!iframeReady) return
    if (!activeScreen?.tree) return
    let expanded: ComponentNode
    try {
      expanded = expandComponents(activeScreen.tree) as ComponentNode
    } catch (err) {
      console.error('[runtime-preview] expandComponents failed', err)
      return
    }

    // Deep-nav: sentinel substitution. The planner emits routeGraph entries
    // with `dataSource: <collectionName>` and `params: [<paramKey>]`. Look
    // those up by activeScreen.id, then resolve a record from appData using
    // the tolerant resolveRecord helper (handles array vs keyed shapes and
    // slug-vs-id navIntent values). Misses are left in place as a visible
    // debug aid.
    const rgEntry = routeGraph?.screens.find(s => s.id === activeScreen.id)
    const collection = typeof rgEntry?.dataSource === 'string' ? rgEntry.dataSource : undefined
    const paramKey = Array.isArray(rgEntry?.params) ? rgEntry.params[0] : undefined
    if (appData && collection) {
      const params = paramsByScreenRef.current[activeScreen.id]
      const record = resolveRecord(appData, collection, paramKey, params)
      if (record) {
        const subbed = substituteSentinels(expanded, record as Record<string, unknown>)
        if (subbed && typeof subbed === 'object') {
          expanded = subbed as ComponentNode
        }
      }
    }

    const treeJson = JSON.stringify(expanded)
    const nodeCount = countTreeNodes(expanded)
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'mokkoi:render-tree', tree: expanded },
      '*',
    )
    // Telemetry (Week 5 Day 0). Stamp post-time refs BEFORE the message lands;
    // they're consumed by the mokkoi:render-complete handler above.
    lastPostMs.current = Date.now()
    lastPostScreenId.current = activeScreen.id
    lastPostNodeCount.current = nodeCount
    trackEvent('runtime_render_tree_posted', {
      project_id: projectId,
      screen_id: activeScreen.id,
      tree_node_count: nodeCount,
      tree_byte_size: treeJson.length,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeReady, treeFingerprint, disabled, appData, routeGraph])

  // Close the current modal screen: pop the back-stack to the previous screen.
  // Mirrors the back-glyph short-circuit in the click handler so the user can
  // dismiss a modal even when the LLM-generated tree forgot its own X button.
  const closeModal = useCallback(() => {
    const stack = historyRef.current
    let target: string | undefined
    while (stack.length) {
      const cand = stack.pop()!
      if (cand !== activeScreenId && screens.some(s => s.id === cand)) {
        target = cand
        break
      }
    }
    if (!target) target = screens[0]?.id
    if (target && target !== activeScreenId) {
      const ts = screens.find(s => s.id === target) as
        | (GeneratedScreen & ScreenExtras) | undefined
      const rgKind = routeGraph?.screens.find(s => s.id === target)?.kind
      setModalAnim(ts?.presentation === 'modal' || rgKind === 'modal')
      onActiveScreenChange(target)
    }
  }, [activeScreenId, screens, onActiveScreenChange, routeGraph])

  // Resolve current screen's presentation: explicit `presentation` field on
  // the screen wins; otherwise consult the routeGraph kind (deep-nav apps).
  const activePresentation = ((activeScreen as
    | (GeneratedScreen & ScreenExtras) | undefined)?.presentation
    ?? (routeGraph?.screens.find(s => s.id === activeScreenId)?.kind === 'modal' ? 'modal' : undefined))

  // Slide-up: when we navigate INTO a modal screen, we want the iframe pane
  // to slide up from offscreen. We can't remount the iframe (would drop the
  // handshake), so we animate a wrapper div via a transform + transition,
  // toggling state on the next frame after modalAnim flips on.
  const [modalSlidIn, setModalSlidIn] = useState(false)
  useEffect(() => {
    if (modalAnim && activePresentation === 'modal') {
      setModalSlidIn(false)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setModalSlidIn(true))
      })
      return () => cancelAnimationFrame(id)
    }
    setModalSlidIn(true)
  }, [modalAnim, activePresentation, activeScreenId])

  if (disabled) return null

  const scale = computeFitScale({
    container: containerSize,
    device: { w: device.width, h: device.height },
    manualZoom,
  })

  return (
    <div
      ref={setWrapperRef}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // Once the runtime is ready, take over click handling. Until then
        // let clicks fall through to the static PreviewPhoneFrame underneath.
        pointerEvents: iframeReady ? 'auto' : 'none',
        opacity: iframeReady ? 1 : 0,
        transition: 'opacity 0.25s ease',
      }}
    >
      <div
        style={{
          width: device.width,
          height: device.height,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          // Match PhoneFrame chassis radius so the iframe corners align
          // with the static phone underneath while it's fading in.
          borderRadius: isAndroid ? 36 : 48,
          overflow: 'hidden',
          background: '#0A0A1A',
          visibility: containerSize.w === 0 ? 'hidden' : 'visible',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            // Modal slide-up: transform-driven so the iframe never remounts.
            transform:
              activePresentation === 'modal' && !modalSlidIn
                ? 'translateY(100%)'
                : 'translateY(0)',
            transition:
              activePresentation === 'modal'
                ? 'transform 250ms ease-out'
                : undefined,
          }}
        >
          <iframe
            ref={iframeRef}
            src="/runtime/index.html"
            title="Mokkoi Runtime Preview"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              background: '#0F172A',
            }}
          />
        </div>
        {activePresentation === 'modal' && (
          <button
            type="button"
            aria-label="Close modal"
            onClick={closeModal}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(15, 23, 42, 0.7)',
              color: '#E6EDF3',
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1001,
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
