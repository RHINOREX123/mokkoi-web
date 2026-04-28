import { useCallback } from 'react'
import { findNavigationTarget } from '../utils/previewNavigation'
import type { FlowConnection } from '../components/FlowConnectors'

export interface PreviewNavigation {
  /** Imperatively set the active screen (e.g. from a sidebar tab click). */
  navigateTo: (screenId: string) => void
  /** Called when the user taps a button inside the preview phone.
   *  Returns true if a navigation occurred (so the caller can suppress
   *  the original click side-effects), false otherwise. */
  handleClick: (label: string | undefined) => boolean
}

/** Manages which screen is currently shown in the Preview-mode phone
 *  frame, and turns in-phone button clicks into screen swaps via the
 *  project's FlowConnection list.
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
): PreviewNavigation {
  const navigateTo = useCallback((screenId: string) => {
    onScreenChange(screenId)
  }, [onScreenChange])

  const handleClick = useCallback(
    (label: string | undefined): boolean => {
      const target = findNavigationTarget(connections, activeScreenId, label)
      if (target) {
        onScreenChange(target)
        return true
      }
      return false
    },
    [connections, activeScreenId, onScreenChange],
  )

  return { navigateTo, handleClick }
}
