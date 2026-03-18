import { useState, useCallback, useRef, useEffect } from 'react'

export interface DirectEdit {
  directEditMode: boolean
  directEditSelectedEl: HTMLElement | null
  directEditDirty: boolean

  setDirectEditSelectedEl: React.Dispatch<React.SetStateAction<HTMLElement | null>>
  setDirectEditDirty: React.Dispatch<React.SetStateAction<boolean>>

  enterDirectEdit: () => void
  exitDirectEdit: (save?: boolean) => void
  saveDirectEdits: () => void
  handleDirectEditClick: (e: React.MouseEvent, screenId: string) => void
  handleDirectEditHover: (e: React.MouseEvent) => void
  handleDirectEditHoverOut: (e: React.MouseEvent) => void
}

interface DirectEditDeps {
  activeGeneratedId: string | null
  phoneFrameRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  setActiveGeneratedId: React.Dispatch<React.SetStateAction<string | null>>
  setToastMessage: (msg: string) => void
}

export function useDirectEdit(deps: DirectEditDeps): DirectEdit {
  const { activeGeneratedId, phoneFrameRefs, setActiveGeneratedId, setToastMessage } = deps

  const [directEditMode, setDirectEditMode] = useState(false)
  const [directEditSelectedEl, setDirectEditSelectedEl] = useState<HTMLElement | null>(null)
  const [directEditDirty, setDirectEditDirty] = useState(false)
  const directEditSnapshotRef = useRef<Map<string, string>>(new Map())

  const enterDirectEdit = useCallback(() => {
    if (!activeGeneratedId) return
    setDirectEditMode(true)
    setDirectEditSelectedEl(null)
    setDirectEditDirty(false)
    const el = phoneFrameRefs.current.get(activeGeneratedId)
    if (el) {
      const phoneScreen = el.querySelector('.phone-screen') as HTMLElement | null
      if (phoneScreen) {
        directEditSnapshotRef.current.set(activeGeneratedId, phoneScreen.innerHTML)
      }
    }
  }, [activeGeneratedId, phoneFrameRefs])

  const exitDirectEdit = useCallback((save?: boolean) => {
    phoneFrameRefs.current.forEach(el => {
      const phoneScreen = el.querySelector('.phone-screen') as HTMLElement | null
      if (phoneScreen) {
        phoneScreen.querySelectorAll('[data-de-hover]').forEach(n => {
          (n as HTMLElement).style.outline = '';
          (n as HTMLElement).removeAttribute('data-de-hover')
        })
        phoneScreen.querySelectorAll('[data-de-selected]').forEach(n => {
          (n as HTMLElement).style.outline = '';
          (n as HTMLElement).removeAttribute('data-de-selected')
        })
      }
    })
    if (!save && directEditDirty && activeGeneratedId) {
      const el = phoneFrameRefs.current.get(activeGeneratedId)
      const snapshot = directEditSnapshotRef.current.get(activeGeneratedId)
      if (el && snapshot) {
        const phoneScreen = el.querySelector('.phone-screen') as HTMLElement | null
        if (phoneScreen) phoneScreen.innerHTML = snapshot
      }
    }
    setDirectEditMode(false)
    setDirectEditSelectedEl(null)
    setDirectEditDirty(false)
    directEditSnapshotRef.current.clear()
  }, [directEditDirty, activeGeneratedId, phoneFrameRefs])

  const saveDirectEdits = useCallback(() => {
    if (!activeGeneratedId) return
    setToastMessage('Direct edits saved!')
    setDirectEditDirty(false)
    directEditSnapshotRef.current.clear()
    const el = phoneFrameRefs.current.get(activeGeneratedId)
    if (el) {
      const phoneScreen = el.querySelector('.phone-screen') as HTMLElement | null
      if (phoneScreen) {
        directEditSnapshotRef.current.set(activeGeneratedId, phoneScreen.innerHTML)
      }
    }
  }, [activeGeneratedId, phoneFrameRefs, setToastMessage])

  const handleDirectEditClick = useCallback((e: React.MouseEvent, screenId: string) => {
    if (!directEditMode) return
    e.stopPropagation()
    e.preventDefault()

    const target = e.target as HTMLElement
    if (target.closest('[data-direct-edit-toolbar]')) return

    if (directEditSelectedEl) {
      directEditSelectedEl.style.outline = ''
      directEditSelectedEl.removeAttribute('data-de-selected')
    }

    const phoneEl = phoneFrameRefs.current.get(screenId)
    const phoneScreen = phoneEl?.querySelector('.phone-screen')
    if (target === phoneScreen || target === phoneEl) {
      setDirectEditSelectedEl(null)
      return
    }

    target.style.outline = '2px dashed #3B82F6'
    target.setAttribute('data-de-selected', 'true')
    setDirectEditSelectedEl(target)
    setActiveGeneratedId(screenId)
  }, [directEditMode, directEditSelectedEl, phoneFrameRefs, setActiveGeneratedId])

  const handleDirectEditHover = useCallback((e: React.MouseEvent) => {
    if (!directEditMode) return
    const target = e.target as HTMLElement
    if (target.closest('[data-direct-edit-toolbar]')) return
    if (target.hasAttribute('data-de-selected')) return
    target.style.outline = '1px solid rgba(59,130,246,0.3)'
    target.setAttribute('data-de-hover', 'true')
  }, [directEditMode])

  const handleDirectEditHoverOut = useCallback((e: React.MouseEvent) => {
    if (!directEditMode) return
    const target = e.target as HTMLElement
    if (target.hasAttribute('data-de-selected')) return
    target.style.outline = ''
    target.removeAttribute('data-de-hover')
  }, [directEditMode])

  // Escape key to exit direct edit
  useEffect(() => {
    if (!directEditMode) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitDirectEdit(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [directEditMode, exitDirectEdit])

  return {
    directEditMode,
    directEditSelectedEl,
    directEditDirty,
    setDirectEditSelectedEl,
    setDirectEditDirty,
    enterDirectEdit,
    exitDirectEdit,
    saveDirectEdits,
    handleDirectEditClick,
    handleDirectEditHover,
    handleDirectEditHoverOut,
  }
}
