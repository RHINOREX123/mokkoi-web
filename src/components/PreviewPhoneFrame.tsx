import { useEffect, useCallback } from 'react'
import { PhoneFrame } from './PhoneFrame'
import { usePreviewNavigation } from '../hooks/usePreviewNavigation'
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
   *  update its activeGeneratedId for chat-scoping etc. */
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
}

/** Single big phone frame for Preview mode. Renders the active screen's
 *  tree and intercepts button clicks to perform in-phone navigation via
 *  the project's FlowConnections.
 *
 *  Loading state is delegated to PhoneFrame, which already renders a
 *  ShimmerSkeleton when isGenerating is true. We additionally gate
 *  click-driven navigation while a generation is in progress so taps
 *  don't fire stale connections. */
export function PreviewPhoneFrame({
  screens,
  connections,
  activeScreenId,
  onActiveScreenChange,
  projectDeviceId,
  isGenerating = false,
  isStreaming = false,
  streamingTree = null,
}: PreviewPhoneFrameProps) {
  const nav = usePreviewNavigation(activeScreenId, connections)

  // Sync external activeScreenId → internal nav state when the parent
  // changes it (e.g. user clicks SCREENS in the hamburger menu).
  // Deps include nav.navigateTo (stable from useCallback []) instead of
  // the whole nav object — that one is a fresh reference every render.
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

  const activeScreen = screens.find(s => s.id === nav.currentScreenId)

  // Intercept button clicks anywhere inside the phone frame.
  // Disabled while generation is in progress (spec edge case).
  const onClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isGenerating) return
      const target = e.target as HTMLElement
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
      onClickCapture={onClickCapture}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', padding: 24, overflow: 'auto',
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
  )
}
