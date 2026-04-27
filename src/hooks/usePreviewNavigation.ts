import { useState, useCallback } from 'react'
import { findNavigationTarget } from '../utils/previewNavigation'
import type { FlowConnection } from '../components/FlowConnectors'

export interface PreviewNavigation {
  currentScreenId: string
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
 *  `initialScreenId` is read ONLY on mount — later changes to the prop
 *  are ignored. To change the active screen imperatively (e.g. from the
 *  hamburger SCREENS list), call `navigateTo`. The consumer component
 *  is responsible for syncing external screen-id state into this hook
 *  via `navigateTo` if it needs that behavior. */
export function usePreviewNavigation(
  initialScreenId: string,
  connections: FlowConnection[],
): PreviewNavigation {
  const [currentScreenId, setCurrentScreenId] = useState(initialScreenId)

  const navigateTo = useCallback((screenId: string) => {
    setCurrentScreenId(screenId)
  }, [])

  // Rebuilds when currentScreenId changes — intentional, since
  // findNavigationTarget needs the live screen to match connections.
  // Do NOT remove currentScreenId from deps; a stale closure here would
  // make navigation always look up from the initial screen.
  const handleClick = useCallback(
    (label: string | undefined): boolean => {
      const target = findNavigationTarget(connections, currentScreenId, label)
      if (target) {
        setCurrentScreenId(target)
        return true
      }
      return false
    },
    [connections, currentScreenId],
  )

  return { currentScreenId, navigateTo, handleClick }
}
