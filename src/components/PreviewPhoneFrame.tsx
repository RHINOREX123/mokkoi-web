import { useEffect, useCallback, useRef, useState } from 'react'
import { PhoneFrame } from './PhoneFrame'
import { usePreviewNavigation } from '../hooks/usePreviewNavigation'
import { computeFitScale } from '../utils/computeFitScale'
import { getDevicePreset } from '../constants/devices'
import type { FlowConnection } from './FlowConnectors'
import type { GeneratedScreen } from '../hooks/useScreenManagement'
import type { ComponentNode } from '../types/mokkoi'
import type { DeviceId } from '../constants/devices'

interface PreviewPhoneFrameProps {
  screens: GeneratedScreen[]
  connections: FlowConnection[]
  activeScreenId: string
  onActiveScreenChange: (screenId: string) => void
  projectDeviceId?: DeviceId
  isGenerating?: boolean
  isStreaming?: boolean
  streamingTree?: ComponentNode | null
  /** When non-null, overrides auto-fit. Driven by the PreviewToolbar zoom controls. */
  manualZoom?: number | null
  /** Reports the current effective scale up so the toolbar can show "60%" etc. */
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
  const nav = usePreviewNavigation(activeScreenId, connections)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  // Sync external activeScreenId → internal nav state.
  useEffect(() => {
    if (nav.currentScreenId !== activeScreenId) {
      nav.navigateTo(activeScreenId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreenId, nav.navigateTo])

  // Sync internal nav state → external (so chat scoping etc. follows
  // when the user navigates by tapping inside the phone).
  useEffect(() => {
    if (nav.currentScreenId !== activeScreenId) {
      onActiveScreenChange(nav.currentScreenId)
    }
  }, [nav.currentScreenId, activeScreenId, onActiveScreenChange])

  // ResizeObserver — track the wrapper's available size for auto-fit.
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setContainerSize({ w: width, h: height })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const activeScreen = screens.find(s => s.id === nav.currentScreenId)
  const deviceId = activeScreen?.deviceId || projectDeviceId
  const device = getDevicePreset(deviceId || 'iphone-standard')
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
      ref={wrapperRef}
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
          deviceId={activeScreen.deviceId || projectDeviceId}
        />
      </div>
    </div>
  )
}
