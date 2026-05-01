import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { expandComponents } from '../../lib/component-library'
import { computeFitScale } from '../utils/computeFitScale'
import { findNavigationTarget } from '../utils/previewNavigation'
import { getDevicePreset, DEFAULT_DEVICE } from '../constants/devices'
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
}

/** Duplicated from src/pages/RuntimePoc.tsx (typed there against
 *  RuntimeScreenSummary; here against GeneratedScreen). De-dup tracked as
 *  P3 backlog item — extract to src/utils/fuzzyMatchScreen.ts with a generic
 *  shape parameter once Week 4 stabilizes. */
function fuzzyMatchScreen(label: string, screens: GeneratedScreen[]): GeneratedScreen | null {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*screen$/, '').trim()
  const target = norm(label)
  if (!target) return null
  for (const s of screens) if (norm(s.name) === target) return s
  for (const s of screens) {
    const n = norm(s.name)
    if (n && (n.includes(target) || target.includes(n))) return s
  }
  return null
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
}: RuntimeIframePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [iframeReady, setIframeReady] = useState(false)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

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

  // Iframe ready handshake.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.type === 'mokkoi:runtime-ready') {
        console.log('[runtime-preview] runtime ready')
        setIframeReady(true)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

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

      if (!label) {
        console.warn(`[mokkoi-click] parent → kind=${kind} label='' tried= matched=none reason=empty-label`)
        e.source?.postMessage({ type: 'mokkoi:click-unresolved', label: '', kind }, '*')
        return
      }

      tried.push('flowConnection')
      const flowTarget = findNavigationTarget(connections, activeScreenId, label)
      if (flowTarget) {
        console.log(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=${tried.join(',')} matched=flowConnection:${flowTarget}`)
        if (flowTarget !== activeScreenId) onActiveScreenChange(flowTarget)
        return
      }

      tried.push('fuzzyName')
      const fuzzy = fuzzyMatchScreen(label, screens)
      if (fuzzy) {
        console.log(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=${tried.join(',')} matched=fuzzyName:${fuzzy.id}`)
        if (fuzzy.id !== activeScreenId) onActiveScreenChange(fuzzy.id)
        return
      }

      console.warn(`[mokkoi-click] parent → kind=${kind} label='${label}' tried=${tried.join(',')} matched=none`)
      e.source?.postMessage({ type: 'mokkoi:click-unresolved', label, kind }, '*')
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
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'mokkoi:render-tree', tree: expanded },
      '*',
    )
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
