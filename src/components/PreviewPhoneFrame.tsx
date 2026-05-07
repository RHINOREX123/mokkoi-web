import { useEffect, useCallback, useRef, useState } from 'react'
import { PhoneFrame } from './PhoneFrame'
import { usePreviewNavigation } from '../hooks/usePreviewNavigation'
import { computeFitScale } from '../utils/computeFitScale'
import { getDevicePreset, DEFAULT_DEVICE } from '../constants/devices'
import type { FlowConnection } from './FlowConnectors'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import type { ComponentNode } from '../types/mokkoi'
import type { DeviceId } from '../constants/devices'

interface PreviewPhoneFrameProps {
  /** All screens in the project; the active one's tree is rendered. */
  screens: GeneratedScreen[]
  /** Project flow connections (from the wirer) used for in-phone navigation. */
  connections: FlowConnection[]
  /** Externally controlled active screen id. Changes from outside (e.g. the
   *  hamburger SCREENS list) sync into the internal nav state. */
  activeScreenId: string
  /** Called when in-phone navigation swaps the active screen, so App.tsx can
   *  update its activeGeneratedId for chat-scoping etc.
   *
   *  CONTRACT: must be referentially stable across parent renders (use the
   *  raw `useState` setter or wrap in `useCallback`). The internal sync
   *  effect lists this in its deps; an unstable callback would cause the
   *  effect to re-run every render and risk syncing back stale state. */
  onActiveScreenChange: (screenId: string) => void
  /** Project-level fallback device id when a screen has none. */
  projectDeviceId?: DeviceId
  /** When the active screen is being generated, click navigation is gated off
   *  and PhoneFrame shows its existing ShimmerSkeleton. */
  isGenerating?: boolean
  /** Streaming variant of generating (renders the streaming partial tree). */
  isStreaming?: boolean
  /** Partial tree during streaming generation. */
  streamingTree?: ComponentNode | null
  /** When non-null, overrides auto-fit. Driven by the PreviewToolbar zoom controls.
   *  Auto-fit (the default) computes 0.92 × min(W/dw, H/dh), capped at 1. */
  manualZoom?: number | null
  /** Reports the current effective scale up so the toolbar can show "60%" etc.
   *
   *  CONTRACT: must be referentially stable across parent renders (use the
   *  raw `useState` setter or wrap in `useCallback`). This is listed in an
   *  effect's deps; an unstable callback would fire the effect every render
   *  and — combined with state lifts in the parent — could trigger an
   *  infinite render loop. */
  onScaleChange?: (scale: number) => void
}

/** Single big phone frame for Preview mode. Auto-fits to container size by
 *  default; can be overridden via the manualZoom prop. Renders the active
 *  screen's tree and intercepts button clicks for in-phone navigation. */
export function PreviewPhoneFrame({
  screens,
  connections,
  activeScreenId,
  onActiveScreenChange,
  projectDeviceId,
  isGenerating = false,
  isStreaming = false,
  streamingTree = null,
  manualZoom = null,
  onScaleChange,
}: PreviewPhoneFrameProps) {
  const nav = usePreviewNavigation(activeScreenId, onActiveScreenChange, connections, screens)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  // Callback ref — (re-)attaches the ResizeObserver every time the wrapper
  // div mounts. We can't use a `useEffect(() => {...}, [])` + `useRef` here
  // because that effect runs once on mount; if the FIRST render hits the
  // empty-state branch (no activeScreen → no wrapper rendered), the effect
  // runs against `null` and never re-fires. When the wrapper later mounts,
  // no observer would attach, `containerSize` would stay {0,0}, and the
  // phone would be permanently hidden by the `visibility: hidden` guard
  // below. A callback ref is invoked by React on every DOM mount/unmount,
  // which avoids that dead-state. The deps `[]` keep the function reference
  // stable so React doesn't treat each render as a new ref and thrash the
  // observer.
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

  // Single source of truth: parent owns activeScreenId; the hook is a
  // stateless wrapper that calls onActiveScreenChange when the user taps
  // a button inside the phone. The previous bidirectional sync effects
  // produced an infinite ping-pong (each effect set the OTHER side's
  // value, swapping them every render) — gone now.
  const activeScreen = screens.find(s => s.id === activeScreenId)
  // Device is project-level only; per-screen overrides used to be supported
  // but caused state-sync bugs when the toolbar's selected device disagreed
  // with the rendered phone. Single source of truth now.
  const deviceId = projectDeviceId
  const device = getDevicePreset(deviceId || DEFAULT_DEVICE)
  const scale = computeFitScale({
    container: containerSize,
    device: { w: device.width, h: device.height },
    manualZoom,
  })

  // Report effective scale up so the toolbar can show "60%".
  useEffect(() => {
    onScaleChange?.(scale)
  }, [scale, onScaleChange])

  // Intercept button clicks for in-phone navigation.
  const onClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isGenerating) return
      const target = e.target
      if (!(target instanceof Element)) return
      const button = target.closest('button, [role="button"], [data-tab]')
      if (!button) return
      const label = (button.textContent || '').trim()
      const navigated = nav.handleClick(label)
      if (navigated) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
    [nav, isGenerating],
  )

  if (!activeScreen) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', padding: 40,
        color: '#94a3b8', fontSize: 13, textAlign: 'center',
      }}>
        No screen to preview yet — generate one to get started.
      </div>
    )
  }

  const isImage = activeScreen.type === 'image'

  return (
    <div
      ref={setWrapperRef}
      onClickCapture={onClickCapture}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', overflow: 'hidden',
      }}
    >
      <div
        data-screen-id={activeScreen.id}
        style={{
          width: device.width,
          height: device.height,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          // While container hasn't been measured yet, hide to avoid a 1.0-flash
          visibility: containerSize.w === 0 ? 'hidden' : 'visible',
          flexShrink: 0,
        }}
      >
        <PhoneFrame
          mode="preview"
          generatedTree={!isImage ? activeScreen.tree : undefined}
          imageUrl={isImage ? activeScreen.imageUrl : undefined}
          isGenerating={isGenerating}
          isStreaming={isStreaming}
          streamingTree={streamingTree}
          deviceId={projectDeviceId}
        />
      </div>
    </div>
  )
}
