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
 *  project's FlowConnection list. */
export function usePreviewNavigation(
  initialScreenId: string,
  connections: FlowConnection[],
): PreviewNavigation {
  const [currentScreenId, setCurrentScreenId] = useState(initialScreenId)

  const navigateTo = useCallback((screenId: string) => {
    setCurrentScreenId(screenId)
  }, [])

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
