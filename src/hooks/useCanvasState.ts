import { useState, useRef, useEffect, useCallback } from 'react'

export interface CanvasState {
  zoomLevel: number
  panOffset: { x: number; y: number }
  activeTool: 'select' | 'pan'
  isSpacePanning: boolean
  canvasRef: React.RefObject<HTMLDivElement | null>
  isPanning: React.MutableRefObject<boolean>
  isZooming: React.MutableRefObject<boolean>
  didPan: React.MutableRefObject<boolean>
  isSpaceHeld: React.MutableRefObject<boolean>

  setActiveTool: (tool: 'select' | 'pan') => void
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  resetPan: () => void
  handleCanvasMouseDown: (e: React.MouseEvent) => void
  canvasCursor: string
  panActive: boolean
}

export function useCanvasState(): CanvasState {
  const [zoomLevel, setZoomLevel] = useState(100)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select')
  const [isSpacePanning, setIsSpacePanning] = useState(false)

  const canvasRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const isZooming = useRef(false)
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didPan = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const panOffsetStart = useRef({ x: 0, y: 0 })
  const isSpaceHeld = useRef(false)
  // Refs for latest state values — avoids stale closures in wheel handler
  const zoomRef = useRef(zoomLevel)
  const panRef = useRef(panOffset)
  zoomRef.current = zoomLevel
  panRef.current = panOffset

  // Canvas wheel handler — attached natively with { passive: false } so preventDefault works
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement

      // Always let native scroll happen inside the device-picker dropdowns.
      // Both PreviewToolbar (.mokkoi-device-menu) and ScreenContextToolbar
      // (.mokkoi-screen-device-list) render their listbox INSIDE canvas-side,
      // so wheel events bubble through here. Without this guard the
      // preventDefault below kills the dropdown's overflow:auto scroll —
      // users see "Scroll for Pixel · Galaxy · iPad" but the wheel does
      // nothing, making the dropdown feel frozen.
      if (target.closest('.mokkoi-device-menu, .mokkoi-screen-device-list')) return

      if (!e.ctrlKey && !e.metaKey) {
        const phoneFrame = target.closest('.phone-screen, [class*="phone"], [class*="phoneFrame"]')
        if (phoneFrame) return
      }

      e.preventDefault()
      e.stopPropagation()

      if (e.ctrlKey || e.metaKey) {
        // Cursor-anchored zoom (Figma-style): the point under the cursor stays fixed
        const rect = el.getBoundingClientRect()
        // Cursor position relative to canvas center (matches transformOrigin: center center)
        const cursorX = e.clientX - rect.left - rect.width / 2
        const cursorY = e.clientY - rect.top - rect.height / 2

        // Smooth zoom: scale delta by deltaY magnitude for trackpad pinch support
        const rawDelta = -e.deltaY * 0.5
        const delta = Math.max(-15, Math.min(15, rawDelta))
        const prevZoom = zoomRef.current
        const newZoom = Math.min(300, Math.max(25, prevZoom + delta))
        if (newZoom === prevZoom) return

        // Mark zooming for transition suppression
        isZooming.current = true
        if (zoomTimer.current) clearTimeout(zoomTimer.current)
        zoomTimer.current = setTimeout(() => { isZooming.current = false }, 150)

        // Zoom-to-point formula: keeps cursorX/cursorY fixed on screen
        // newPan = cursor - (cursor - oldPan) * (newZoom / oldZoom)
        const scaleFactor = newZoom / prevZoom
        const oldPan = panRef.current
        setPanOffset({
          x: cursorX - scaleFactor * (cursorX - oldPan.x),
          y: cursorY - scaleFactor * (cursorY - oldPan.y),
        })
        setZoomLevel(newZoom)
      } else if (e.shiftKey) {
        setPanOffset(prev => ({ ...prev, x: prev.x - e.deltaY }))
      } else {
        setPanOffset(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }))
      }
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // Global mouse move/up for panning smoothness
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning.current) {
        const dx = e.clientX - panStart.current.x
        const dy = e.clientY - panStart.current.y
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          didPan.current = true
        }
        setPanOffset({
          x: panOffsetStart.current.x + dx,
          y: panOffsetStart.current.y + dy,
        })
      }
    }
    const cleanupPan = () => {
      if (isPanning.current) {
        isPanning.current = false
        requestAnimationFrame(() => { didPan.current = false })
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    // Also clean up if mouse leaves the window entirely (prevents stuck state)
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.relatedTarget === null) cleanupPan()
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', cleanupPan)
    document.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', cleanupPan)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  // Spacebar hold for panning
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const inInput = ['INPUT', 'TEXTAREA'].includes(tag)
      if (e.code === 'Space' && !inInput) {
        e.preventDefault()
        isSpaceHeld.current = true
        setIsSpacePanning(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceHeld.current = false
        setIsSpacePanning(false)
      }
    }
    document.addEventListener('wheel', preventBrowserZoom, { passive: false })
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    return () => {
      document.removeEventListener('wheel', preventBrowserZoom)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const zoomIn = useCallback(() => setZoomLevel(z => Math.min(300, z + 5)), [])
  const zoomOut = useCallback(() => setZoomLevel(z => Math.max(25, z - 5)), [])
  const resetPan = useCallback(() => setPanOffset({ x: 0, y: 0 }), [])
  const resetZoom = useCallback(() => { setZoomLevel(100); setPanOffset({ x: 0, y: 0 }) }, [])

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || isSpaceHeld.current || activeTool === 'pan') {
      if (e.button === 1) e.preventDefault()
      isPanning.current = true
      didPan.current = false
      panStart.current = { x: e.clientX, y: e.clientY }
      panOffsetStart.current = { ...panOffset }
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }
  }, [activeTool, panOffset])

  const panActive = activeTool === 'pan' || isSpacePanning
  const canvasCursor = isPanning.current ? 'grabbing' : panActive ? 'grab' : 'default'

  return {
    zoomLevel,
    panOffset,
    activeTool,
    isSpacePanning,
    canvasRef,
    isPanning,
    isZooming,
    didPan,
    isSpaceHeld,
    setActiveTool,
    setZoomLevel,
    setPanOffset,
    zoomIn,
    zoomOut,
    resetZoom,
    resetPan,
    handleCanvasMouseDown,
    canvasCursor,
    panActive,
  }
}
