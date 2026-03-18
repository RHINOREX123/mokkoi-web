import { useEffect } from 'react'

interface KeyboardShortcutsDeps {
  setShowCommandPalette: React.Dispatch<React.SetStateAction<boolean>>
  setActiveTool: (tool: 'select' | 'pan') => void
  setActiveGeneratedId: React.Dispatch<React.SetStateAction<string | null>>
  setShowCodeExport: (show: boolean) => void
  setFocusTrigger: React.Dispatch<React.SetStateAction<number>>
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  hasTreeRef: React.MutableRefObject<boolean>
}

export function useKeyboardShortcuts(deps: KeyboardShortcutsDeps): void {
  const {
    setShowCommandPalette,
    setActiveTool,
    setActiveGeneratedId,
    setShowCodeExport,
    setFocusTrigger,
    setZoomLevel,
    setPanOffset,
    hasTreeRef,
  } = deps

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const inInput = ['INPUT', 'TEXTAREA'].includes(tag)

      // Ctrl+K → Command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(prev => !prev)
        return
      }

      // Global shortcuts (only when not in an input)
      if (!inInput) {
        if (e.key === 'v' || e.key === 'V') { setActiveTool('select'); return }
        if (e.key === 'h' || e.key === 'H') { setActiveTool('pan'); return }
        if (e.key === 'n' || e.key === 'N') {
          setActiveGeneratedId(null)
          setShowCodeExport(false)
          setFocusTrigger(t => t + 1)
          return
        }
        if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoomLevel(z => Math.min(300, z + 5)); return }
        if (e.key === '-') { e.preventDefault(); setZoomLevel(z => Math.max(25, z - 5)); return }
        if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setZoomLevel(100); setPanOffset({ x: 0, y: 0 }); return }
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); if (hasTreeRef.current) setShowCodeExport(true); return }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [setShowCommandPalette, setActiveTool, setActiveGeneratedId, setShowCodeExport, setFocusTrigger, setZoomLevel, setPanOffset, hasTreeRef])
}
