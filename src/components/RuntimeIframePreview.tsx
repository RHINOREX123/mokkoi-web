import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { expandComponents } from '../../lib/component-library'
import { computeFitScale } from '../utils/computeFitScale'
import { findNavigationTarget } from '../utils/previewNavigation'
import { fuzzyMatchScreen } from '../utils/fuzzyMatchScreen'
import { getDevicePreset, DEFAULT_DEVICE } from '../constants/devices'
import { trackEvent } from '../lib/analytics'
import type { ComponentNode } from '../types/mokkoi'
import type { FlowConnection } from './FlowConnectors'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import type { DeviceId } from '../constants/devices'

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
    function onClick(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.type !== 'mokkoi:click') return
      const kind = String(e.data.elementKind ?? '')
      const label = String(e.data.label ?? '')
      if (!activeScreenId) return

      const tried: string[] = []
      const has_label = label.length > 0

      if (!label) {
        if (import.meta.env.DEV) console.warn(`[mokkoi-click] parent → kind=${kind} label='' tried= matched=none reason=empty-label`)
        e.source?.postMessage({ type: 'mokkoi:click-unresolved', label: '', kind }, '*')
        trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'unresolved' })
        trackEvent('runtime_click_unresolved', { project_id: projectId, kind, label: '' })
        return
      }

      tried.push('flowConnection')
      const flowTarget = findNavigationTarget(connections, activeScreenId, label)
      if (flowTarget) {
        if (import.meta.env.DEV) console.log(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=${tried.join(',')} matched=flowConnection:${flowTarget}`)
        if (flowTarget !== activeScreenId) onActiveScreenChange(flowTarget)
        trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'flow_connection' })
        return
      }

      tried.push('fuzzyName')
      const fuzzy = fuzzyMatchScreen(label, screens)
      if (fuzzy) {
        if (import.meta.env.DEV) console.log(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=${tried.join(',')} matched=fuzzyName:${fuzzy.id}`)
        if (fuzzy.id !== activeScreenId) onActiveScreenChange(fuzzy.id)
        trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'fuzzy_name' })
        return
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
        if (target !== activeScreenId) onActiveScreenChange(target)
        trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'single_target' })
        return
      }

      if (import.meta.env.DEV) console.warn(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=${tried.join(',')} matched=none`)
      e.source?.postMessage({ type: 'mokkoi:click-unresolved', label, kind }, '*')
      trackEvent('runtime_click', { project_id: projectId, kind, has_label, resolution: 'unresolved' })
      trackEvent('runtime_click_unresolved', { project_id: projectId, kind, label })
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
  }, [iframeReady, treeFingerprint, disabled])

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
    </div>
  )
}
