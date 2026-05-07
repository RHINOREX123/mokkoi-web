import { useCallback } from 'react'
import { resolveNavTarget } from '../utils/previewNavigation'
import type { FlowConnection } from '../components/FlowConnectors'

export interface PreviewNavScreen {
  id: string
  name: string
}

export interface PreviewNavigation {
  /** Imperatively set the active screen (e.g. from a sidebar tab click). */
  navigateTo: (screenId: string) => void
  /** Called when the user taps a button inside the preview phone.
   *  Returns true if a navigation occurred (so the caller can suppress
   *  the original click side-effects), false otherwise. */
  handleClick: (label: string | undefined) => boolean
}

/** Manages which screen is currently shown in the Preview-mode phone
 *  frame, and turns in-phone button clicks into screen swaps.
 *
 *  Resolution cascade (matches RuntimeIframePreview):
 *    1) FlowConnection strict match on normalized trigger.
 *    2) Fuzzy screen-name match (Profile → ProfileScreen).
 *    3) Single outgoing forward connection from the current screen.
 *
 *  Strict-only matching used to live here; bottom-nav taps slipped through
 *  because the wirer often emits non-label triggers (e.g. "select_workout"),
 *  so visible "Profile"/"Home" never matched a connection.
 *
 *  Stateless wrapper around the parent's `activeScreenId` + setter.
 *  Previously this hook held its own `currentScreenId` useState and a
 *  pair of sync effects in `PreviewPhoneFrame` reconciled it with the
 *  external prop — that produced an infinite ping-pong loop (each
 *  effect set the OTHER side's value, swapping them every render).
 *  Single source of truth now: the prop is the only owner. */
export function usePreviewNavigation(
  activeScreenId: string,
  onScreenChange: (screenId: string) => void,
  connections: FlowConnection[],
  screens: PreviewNavScreen[],
): PreviewNavigation {
  const navigateTo = useCallback((screenId: string) => {
    onScreenChange(screenId)
  }, [onScreenChange])

  const handleClick = useCallback(
    (label: string | undefined): boolean => {
      const target = resolveNavTarget(label, {
        connections,
        currentScreenId: activeScreenId,
        screens,
      })
      if (target && target !== activeScreenId) {
        onScreenChange(target)
        return true
      }
      return false
    },
    [connections, activeScreenId, onScreenChange, screens],
  )

  return { navigateTo, handleClick }
}
