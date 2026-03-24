import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useParams, useNavigate } from 'react-router-dom'
import { PhoneFrame } from './components/PhoneFrame'
import { getCanvasDimensions } from './constants/devices'
import { ChatPanel } from './components/ChatPanel'
import { CodeExportModal } from './components/CodeExportModal'
import { ShareModal } from './components/ShareModal'
import { MousePointer2, Hand, ZoomIn, ZoomOut, PenTool, Sparkles, Download, Share2, Plus, X, Upload, Pencil, LogOut, Maximize2, Check, RotateCcw, ImagePlus } from 'lucide-react'
import { GAP, PAD_X, PAD_Y } from './components/FlowConnectors'
import { DirectEditToolbar } from './components/DirectEditToolbar'
import { CommandPalette, type Command as CmdType } from './components/CommandPalette'
import { ScreenContextToolbar } from './components/ScreenContextToolbar'
import { VariationsPanel } from './components/VariationsPanel'
import { QrCodeModal } from './components/QrCodeModal'
import { ScreenshotModal } from './components/ScreenshotModal'
import { CanvasToolbar } from './components/CanvasToolbar'
import { ImportHtmlModal } from './components/ImportHtmlModal'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopNavbar } from './components/TopNavbar'
import { NoCreditsModal } from './components/PricingPage'
import { useScreenExport } from './hooks/useScreenExport'

import { supabase } from './lib/supabase'
import { resetAnalytics } from './lib/analytics'
import { useCanvasState } from './hooks/useCanvasState'
import { useScreenManagement } from './hooks/useScreenManagement'
import { useAIGeneration } from './hooks/useAIGeneration'
import { useDirectEdit } from './hooks/useDirectEdit'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

interface CanvasRefImage {
  id: string
  url: string
  name: string
}

function App() {
  const [searchParams] = useSearchParams()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const initialPrompt = searchParams.get('prompt') || undefined

  // --- Core hooks ---
  const canvas = useCanvasState()
  const screens = useScreenManagement(projectId)
  const phoneFrameRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Screen drag state
  const isDraggingScreen = useRef(false)
  const dragScreenId = useRef<string | null>(null)
  const dragStart = useRef({ x: 0, y: 0 })
  const dragScreenStart = useRef({ x: 0, y: 0 })
  const didDragScreen = useRef(false)
  const zoomRef = useRef(canvas.zoomLevel)
  zoomRef.current = canvas.zoomLevel

  // UI state
  const [showCodeExport, setShowCodeExport] = useState(false)
  const [referenceImages, setReferenceImages] = useState<CanvasRefImage[]>([])
  const [toastMessage, setToastMessage] = useState('')
  const screenExport = useScreenExport({
    phoneFrameRefs,
    onToast: setToastMessage,
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [focusTrigger, setFocusTrigger] = useState(0)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showVariationsPanel, setShowVariationsPanel] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [showDeleteScreenConfirm, setShowDeleteScreenConfirm] = useState(false)
  const [showScreenshotModal, setShowScreenshotModal] = useState(false)
  const [showImportHtmlModal, setShowImportHtmlModal] = useState(false)
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false)
  const [canvasDragOver, setCanvasDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Resizable panel
  const [splitRatio, setSplitRatio] = useState(0.28)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // AI Generation
  const ai = useAIGeneration({
    projectId,
    activeGeneratedId: screens.activeGeneratedId,
    activeGenerated: screens.activeGenerated,
    generatedScreens: screens.generatedScreens,
    setGeneratedScreens: screens.setGeneratedScreens,
    setActiveGeneratedId: screens.setActiveGeneratedId,
    projectMessages: screens.projectMessages,
    setProjectMessages: screens.setProjectMessages,
    saveMessage: screens.saveMessage,
    setToastMessage,
    setShowVariationsPanel,
    getNextScreenPosition: screens.getNextScreenPosition,
    deviceId: screens.activeDeviceId,
  })

  // Direct Edit
  const directEdit = useDirectEdit({
    activeGeneratedId: screens.activeGeneratedId,
    phoneFrameRefs,
    setActiveGeneratedId: screens.setActiveGeneratedId,
    setToastMessage,
  })

  // Keyboard shortcuts
  useKeyboardShortcuts({
    setShowCommandPalette,
    setActiveTool: canvas.setActiveTool,
    setActiveGeneratedId: screens.setActiveGeneratedId,
    setShowCodeExport,
    setFocusTrigger,
    setZoomLevel: canvas.setZoomLevel,
    setPanOffset: canvas.setPanOffset,
    hasTreeRef: screens.hasTreeRef,
  })

  // Build screen positions map for layout
  const screenPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>()
    let xOffset = PAD_X
    screens.generatedScreens.forEach((s) => {
      const { CANVAS_W } = getCanvasDimensions(s.deviceId || screens.projectDeviceId)
      map.set(s.id, {
        x: s.x ?? xOffset,
        y: s.y ?? PAD_Y,
      })
      xOffset += CANVAS_W + GAP
    })
    return map
  }, [screens.generatedScreens, screens.projectDeviceId])

  // Screen drag handlers (global mousemove/mouseup)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingScreen.current || !dragScreenId.current) return
      const scale = zoomRef.current / 100
      const dx = (e.clientX - dragStart.current.x) / scale
      const dy = (e.clientY - dragStart.current.y) / scale
      if (!didDragScreen.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        didDragScreen.current = true
      }
      if (didDragScreen.current) {
        const newX = dragScreenStart.current.x + dx
        const newY = dragScreenStart.current.y + dy
        const id = dragScreenId.current
        screens.setGeneratedScreens(prev => prev.map(s =>
          s.id === id ? { ...s, x: newX, y: newY } : s
        ))
      }
    }
    const cleanupScreenDrag = () => {
      if (isDraggingScreen.current) {
        isDraggingScreen.current = false
        dragScreenId.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        // didDragScreen stays true so the click handler ignores it
        requestAnimationFrame(() => { didDragScreen.current = false })
      }
    }
    // Also clean up if mouse leaves the window entirely (prevents stuck state)
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.relatedTarget === null) cleanupScreenDrag()
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', cleanupScreenDrag)
    document.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', cleanupScreenDrag)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [screens.setGeneratedScreens])

  // Split panel dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        let ratio = (e.clientX - rect.left) / rect.width
        ratio = Math.max(0.2, Math.min(0.45, ratio))
        setSplitRatio(ratio)
      }
    }
    const handleMouseUp = () => { isDragging.current = false; document.body.style.cursor = ''; document.body.style.userSelect = '' }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
  }, [])

  // Auto-hide toast (and detect credit errors)
  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(''), 2000)
    return () => clearTimeout(t)
  }, [toastMessage])

  // Detect "No credits" errors from chat messages and show modal
  useEffect(() => {
    const lastMsg = screens.projectMessages[screens.projectMessages.length - 1]
    if (lastMsg?.role === 'assistant' && lastMsg.content.includes('No credits remaining')) {
      setShowNoCreditsModal(true)
    }
  }, [screens.projectMessages])

  // --- Handlers ---
  const handleDeleteProject = async () => {
    if (!projectId) return
    if (supabase) await supabase.from('projects').delete().eq('id', projectId)
    setShowDeleteConfirm(false)
    navigate('/projects')
  }

  const startDragging = () => { isDragging.current = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none' }

  const handleCanvasUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const name = file.name.replace(/\.[^.]+$/, '')
      setReferenceImages(prev => [...prev, { id: crypto.randomUUID(), url: dataUrl, name: name.length > 20 ? name.slice(0, 20) + '...' : name }])
    }
    reader.readAsDataURL(file)
  }


  const handleCanvasDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.types.includes('Files')) setCanvasDragOver(true) }, [])

  const handleCanvasDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    const rect = canvas.canvasRef.current?.getBoundingClientRect()
    if (rect && (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom)) setCanvasDragOver(false)
  }, [canvas.canvasRef])

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setCanvasDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => {
      const match = (reader.result as string).match(/^data:([^;]+);base64,(.+)$/)
      if (match) ai.handleSend('Recreate this screen design', match[2], match[1], true)
    }
    reader.readAsDataURL(file)
  }, [ai.handleSend])

  const handleEditViaChat = useCallback(() => { setFocusTrigger(t => t + 1) }, [])
  const handleChangeColorScheme = useCallback(() => {
    window.dispatchEvent(new CustomEvent('mokkoi-set-chat-input', { detail: { text: 'Change the color scheme of this screen to ' } }))
    setFocusTrigger(t => t + 1)
  }, [])
  const handleMakeDarker = useCallback(() => { if (screens.activeGeneratedId) ai.handleSend('Make this screen darker with a dark theme') }, [screens.activeGeneratedId, ai.handleSend])
  const handleMakeLighter = useCallback(() => { if (screens.activeGeneratedId) ai.handleSend('Make this screen lighter with a light theme') }, [screens.activeGeneratedId, ai.handleSend])
  const handlePreviewNewTab = useCallback(() => {
    if (!screens.activeGeneratedId || !projectId) return
    // Store the current in-memory tree in sessionStorage so PreviewPage can render it
    // without needing a Supabase round-trip (works for unsaved screens too)
    const payload = { tree: screens.generatedTree, name: screens.activeGenerated?.name || 'Untitled Screen', deviceId: screens.activeDeviceId }
    try { sessionStorage.setItem('mokkoi-preview-data', JSON.stringify(payload)) } catch { /* quota exceeded, fall back to Supabase fetch */ }
    window.open(`/preview/${projectId}/${screens.activeGeneratedId}`, '_blank')
  }, [screens.activeGeneratedId, screens.generatedTree, screens.activeGenerated, projectId])
  const handleShowQrCode = useCallback(() => {
    if (!projectId) return
    setQrUrl(screens.activeGeneratedId ? `${window.location.origin}/preview/${projectId}/${screens.activeGeneratedId}` : `${window.location.origin}/view/${projectId}`)
    setShowQrModal(true)
  }, [projectId, screens.activeGeneratedId])

  const getExportTarget = useCallback(() => {
    const screen = screens.activeGenerated
    if (!screen?.tree) return null
    return {
      screenId: screen.id,
      screenName: screen.name,
      tree: screen.tree,
      deviceId: screen.deviceId || screens.projectDeviceId,
      originalPrompt: screen.originalPrompt,
    }
  }, [screens.activeGenerated, screens.projectDeviceId])

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (canvas.didPan.current || canvas.activeTool === 'pan' || canvas.isSpaceHeld.current) return
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset?.canvasBg === 'true') {
      if (directEdit.directEditMode) { directEdit.exitDirectEdit(false); return }
      screens.setActiveGeneratedId(null)
    }
  }

  const handleFlowScreenClick = (screenName: string) => {
    const screen = screens.generatedScreens.find(s => s.name === screenName)
    if (screen) screens.setActiveGeneratedId(screen.id)
  }

  const handlePhoneClick = (e: React.MouseEvent, screenId: string) => {
    e.stopPropagation()
    // Only skip selection if a real drag happened (3px+ movement), not just a mouseDown/mouseUp cycle
    if (canvas.activeTool === 'pan' || canvas.isSpaceHeld.current) return
    if (didDragScreen.current || canvas.didPan.current) return
    if (directEdit.directEditMode) { directEdit.handleDirectEditClick(e, screenId); return }
    screens.setActiveGeneratedId(screenId)
  }

  /** Start dragging a screen on the canvas */
  const handleScreenMouseDown = (e: React.MouseEvent, screenId: string, sx: number, sy: number) => {
    if (e.button !== 0) return // left click only
    if (canvas.activeTool === 'pan' || canvas.isSpaceHeld.current) return // let canvas pan handle it
    if (directEdit.directEditMode) return // don't drag in direct edit mode
    e.stopPropagation() // prevent canvas panning
    isDraggingScreen.current = true
    dragScreenId.current = screenId
    dragStart.current = { x: e.clientX, y: e.clientY }
    dragScreenStart.current = { x: sx, y: sy }
    didDragScreen.current = false
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

  // Command palette
  const commands: CmdType[] = useMemo(() => [
    { id: 'select-tool', label: 'Select Tool', shortcut: 'V', icon: <MousePointer2 size={16} />, group: 'Tools', action: () => canvas.setActiveTool('select') },
    { id: 'pan-tool', label: 'Hand Tool', shortcut: 'H', icon: <Hand size={16} />, group: 'Tools', action: () => canvas.setActiveTool('pan') },
    { id: 'new-screen', label: 'New Screen', shortcut: 'N', icon: <Plus size={16} />, group: 'Canvas', action: () => { screens.setActiveGeneratedId(null); setShowCodeExport(false); setFocusTrigger(t => t + 1) } },
    { id: 'zoom-in', label: 'Zoom In', shortcut: '+', icon: <ZoomIn size={16} />, group: 'Canvas', action: canvas.zoomIn },
    { id: 'zoom-out', label: 'Zoom Out', shortcut: '-', icon: <ZoomOut size={16} />, group: 'Canvas', action: canvas.zoomOut },
    { id: 'reset-zoom', label: 'Reset Zoom', shortcut: 'Ctrl+0', icon: <Maximize2 size={16} />, group: 'Canvas', action: canvas.resetZoom },
    { id: 'export-code', label: 'Export Code', shortcut: 'Ctrl+E', icon: <Download size={16} />, group: 'Project', action: () => { if (screens.generatedTree) setShowCodeExport(true) } },
    { id: 'share', label: 'Share Project', icon: <Share2 size={16} />, group: 'Project', action: () => setShowShareModal(true) },
    { id: 'rename-project', label: 'Rename Project', icon: <Pencil size={16} />, group: 'Project', action: () => setToastMessage('Use navbar to rename') },
    { id: 'upload-ref', label: 'Upload Reference Image', icon: <Upload size={16} />, group: 'Canvas', action: () => fileInputRef.current?.click() },
    { id: 'go-projects', label: 'Go to All Projects', icon: <span style={{ display: 'flex' }}>&larr;</span>, group: 'Navigation', action: () => navigate('/projects') },
    { id: 'sign-out', label: 'Sign Out', icon: <LogOut size={16} />, group: 'Account', action: async () => { resetAnalytics(); if (supabase) await supabase.auth.signOut(); navigate('/auth') } },
  ], [screens.generatedTree, canvas.zoomIn, canvas.zoomOut, canvas.resetZoom, navigate])

  return (
    <div className="app-shell" style={{ height: '100vh', background: '#000000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp" style={{ display: 'none' }} onChange={handleCanvasUpload} />

      <TopNavbar
        projectName={screens.projectName}
        setProjectName={screens.setProjectName}
        saveProjectName={screens.saveProjectName}
        isGenerating={ai.isGenerating}
        generatedTree={screens.generatedTree}
        activeGeneratedTree={screens.activeGenerated?.tree}
        setActiveGeneratedId={screens.setActiveGeneratedId}
        setShowCodeExport={setShowCodeExport}
        setShowShareModal={setShowShareModal}
        setShowCommandPalette={setShowCommandPalette}
        setShowDeleteConfirm={setShowDeleteConfirm}
        setToastMessage={setToastMessage}
      />

      {/* Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 20px', borderRadius: 10, background: '#1a1a2e', color: '#34d399',
          fontSize: 13, fontWeight: 500, border: '1px solid rgba(52,211,153,0.2)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 200, animation: 'fadeInDown 0.25s ease-out',
        }}>{toastMessage}</div>
      )}

      {/* Delete project confirmation */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowDeleteConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', minWidth: 340, maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Delete this project?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#94a3b8' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDeleteProject} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div ref={containerRef} className="main-panels" style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
        {/* Chat panel */}
        <div className="chat-side" style={{ width: `${splitRatio * 100}%`, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#0A0A0A' }}>
          <ErrorBoundary fallbackMessage="Chat panel encountered an error">
            <ChatPanel
              messages={screens.projectMessages} onSend={ai.handleSend}
              onExportCode={() => screens.generatedTree && setShowCodeExport(true)}
              isGenerating={ai.isGenerating} isStreaming={ai.isStreaming} streamingText={ai.streamingText} initialPrompt={initialPrompt}
              onFlowScreenClick={handleFlowScreenClick} hasScreens={screens.hasScreens}
              selectedScreenName={screens.activeGenerated?.name} selectedScreenTree={screens.activeGenerated?.tree}
              onSelectedScreenClick={() => { if (screens.activeGeneratedId) phoneFrameRefs.current.get(screens.activeGeneratedId)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }) }}
              onDeselectScreen={() => screens.setActiveGeneratedId(null)} focusTrigger={focusTrigger}
              onStopGenerating={ai.isGenerating ? ai.handleStopGenerating : undefined}
            />
          </ErrorBoundary>
        </div>

        {/* Divider */}
        <div onMouseDown={startDragging} style={{ width: 1, cursor: 'col-resize', background: 'rgba(255,255,255,0.06)', flexShrink: 0, transition: 'background 0.2s', zIndex: 10 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.width = '3px' }}
          onMouseLeave={e => { if (!isDragging.current) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.width = '1px' } }}
        />

        {/* Canvas */}
        <ErrorBoundary fallbackMessage="Canvas encountered an error">
          <div ref={canvas.canvasRef} className="canvas-side"
            onMouseDown={canvas.handleCanvasMouseDown} onClick={handleCanvasClick}
            onDragOver={handleCanvasDragOver} onDragLeave={handleCanvasDragLeave} onDrop={handleCanvasDrop}
            style={{
              width: `${(1 - splitRatio) * 100}%`, position: 'relative', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#E8E8E8', backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)',
              backgroundSize: '24px 24px', backgroundPosition: `${canvas.panOffset.x}px ${canvas.panOffset.y}px`,
              cursor: canvas.canvasCursor,
            }}>
            {canvasDragOver && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(129,140,248,0.06)', backdropFilter: 'blur(2px)', border: '3px dashed rgba(129,140,248,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, pointerEvents: 'none' }}>
                <ImagePlus size={48} style={{ color: '#818CF8', opacity: 0.8 }} />
                <span style={{ color: '#818CF8', fontSize: 16, fontWeight: 600 }}>Drop screenshot to generate screen</span>
                <span style={{ color: 'rgba(129,140,248,0.6)', fontSize: 13 }}>PNG, JPG, or WEBP</span>
              </div>
            )}

            {!screens.hasScreens && !ai.isGenerating && referenceImages.length === 0 ? (
              <div data-canvas-bg="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, pointerEvents: 'none', userSelect: 'none', transform: `translate(${canvas.panOffset.x}px, ${canvas.panOffset.y}px)` }}>
                <span style={{ fontSize: 15, color: 'rgba(0,0,0,0.3)', fontWeight: 500 }}>Your designs will appear here</span>
              </div>
            ) : (
              <div data-canvas-bg="true" style={{
                position: 'relative',
                minWidth: 1, minHeight: 1,
                transform: `translate(${canvas.panOffset.x}px, ${canvas.panOffset.y}px) scale(${canvas.zoomLevel / 100})`,
                transformOrigin: 'center center', transition: (canvas.isPanning.current || isDraggingScreen.current || canvas.isZooming.current) ? 'none' : 'transform 0.15s ease-out',
                cursor: canvas.panActive ? 'inherit' : 'default',
              }}>
                {screens.generatedScreens.map((screen) => {
                  const isActive = screen.id === screens.activeGeneratedId
                  const isImage = screen.type === 'image'
                  const sx = screen.x ?? (screenPositions.get(screen.id)?.x ?? PAD_X)
                  const sy = screen.y ?? PAD_Y
                  const { CANVAS_W: frameW } = getCanvasDimensions(screen.deviceId || screens.projectDeviceId)
                  return (
                    <div key={screen.id}
                      onMouseDown={(e) => handleScreenMouseDown(e, screen.id, sx, sy)}
                      onClick={(e) => handlePhoneClick(e, screen.id)}
                      style={{
                        position: 'absolute',
                        left: sx,
                        top: sy,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        cursor: canvas.panActive ? 'inherit' : isDraggingScreen.current && dragScreenId.current === screen.id ? 'grabbing' : 'grab',
                        flexShrink: 0,
                      }}>
                      {screens.editingScreenLabel === screen.id ? (
                        <input autoFocus value={screens.editingScreenLabelValue} onChange={e => screens.setEditingScreenLabelValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') screens.commitScreenRename(); if (e.key === 'Escape') screens.setEditingScreenLabel(null) }}
                          onBlur={screens.commitScreenRename} onClick={e => e.stopPropagation()}
                          style={{ fontSize: 11, fontWeight: 500, color: '#fff', textAlign: 'center', maxWidth: frameW, width: frameW * 0.7, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(99,102,241,0.4)', outline: 'none', boxSizing: 'border-box' as const }}
                        />
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 500, color: isActive ? '#fff' : 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: frameW, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', padding: '3px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.5)', boxSizing: 'border-box' as const }}>
                          {screen.name}
                        </span>
                      )}

                      <ErrorBoundary fallbackMessage="Screen render error">
                        <div data-screen-id={screen.id}
                          ref={el => { if (el) phoneFrameRefs.current.set(screen.id, el); else phoneFrameRefs.current.delete(screen.id) }}
                          style={{
                            borderRadius: 34, transition: 'box-shadow 0.25s', position: 'relative',
                            cursor: directEdit.directEditMode ? 'crosshair' : undefined,
                            boxShadow: directEdit.directEditMode && isActive ? '0 8px 32px rgba(0,0,0,0.3), 0 0 0 3px rgba(59,130,246,0.5), 0 0 20px rgba(59,130,246,0.15)' : isActive && screen.source === 'mcp' ? '0 8px 32px rgba(0,0,0,0.3), 0 0 0 3px rgba(52,211,153,0.5), 0 0 20px rgba(52,211,153,0.15)' : isActive ? '0 8px 32px rgba(0,0,0,0.3), 0 0 0 3px rgba(99,102,241,0.5), 0 0 20px rgba(99,102,241,0.15)' : screen.source === 'mcp' ? '0 8px 32px rgba(0,0,0,0.2), 0 0 0 1px rgba(52,211,153,0.3)' : '0 8px 32px rgba(0,0,0,0.2)',
                          }}
                          onMouseOverCapture={directEdit.directEditMode ? directEdit.handleDirectEditHover : undefined}
                          onMouseOutCapture={directEdit.directEditMode ? directEdit.handleDirectEditHoverOut : undefined}
                        >
                          <PhoneFrame generatedTree={!isImage ? screen.tree : undefined} imageUrl={isImage ? screen.imageUrl : undefined} isGenerating={ai.isGenerating && isActive} isStreaming={ai.isStreaming && isActive} streamingTree={isActive ? ai.partialTree : null} deviceId={screen.deviceId || screens.projectDeviceId} />
                          {directEdit.directEditMode && isActive && directEdit.directEditSelectedEl && (
                            <div data-direct-edit-toolbar="true">
                              <DirectEditToolbar target={directEdit.directEditSelectedEl} phoneFrameEl={phoneFrameRefs.current.get(screen.id)!} onClose={() => directEdit.setDirectEditSelectedEl(null)} onChanged={() => directEdit.setDirectEditDirty(true)} />
                            </div>
                          )}

                        </div>
                      </ErrorBoundary>

                      {isImage && (
                        <button onClick={(e) => { e.stopPropagation(); ai.handleGenerateFromImage(screen) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.4)', transition: 'all 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                        ><Sparkles size={12} />Generate from this</button>
                      )}
                    </div>
                  )
                })}

                {referenceImages.map(img => (
                  <div key={img.id} onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0, position: 'relative' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#888', padding: '2px 8px', borderRadius: 6 }}>Ref: {img.name}</span>
                    <div style={{ position: 'relative' }}>
                      <img src={img.url} alt={img.name} style={{ maxWidth: 280, maxHeight: 500, borderRadius: 12, border: '2px solid rgba(0,0,0,0.15)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', objectFit: 'contain', background: '#fff' }} />
                      <button onClick={() => setReferenceImages(prev => prev.filter(i => i.id !== img.id))} style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: '#1a1a1a', color: '#fff', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f87171'; e.currentTarget.style.borderColor = '#f87171' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                        title="Remove reference image"
                      ><X size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <ScreenContextToolbar
              visible={!!screens.activeGeneratedId && !!screens.activeGenerated?.tree}
              screenName={screens.activeGenerated?.name || ''} screenTree={screens.activeGenerated?.tree}
              screenId={screens.activeGeneratedId || ''}
              onRegenerate={ai.handleRegenerate} onOpenVariations={() => setShowVariationsPanel(true)}
              onEditViaChat={handleEditViaChat} onChangeColorScheme={handleChangeColorScheme}
              onMakeDarker={handleMakeDarker} onMakeLighter={handleMakeLighter}
              onPreviewNewTab={handlePreviewNewTab} onShowQrCode={handleShowQrCode}
              onExportCode={() => { if (screens.generatedTree) setShowCodeExport(true) }}
              onDownloadPNG={() => { const t = getExportTarget(); if (t) screenExport.downloadPNG(t) }}
              onDownloadTSX={() => { const t = getExportTarget(); if (t) screenExport.downloadTSX(t) }}
              onDownloadZIP={() => { const t = getExportTarget(); if (t) screenExport.downloadZIP(t) }}
              onDownloadExpo={() => { const t = getExportTarget(); if (t) screenExport.downloadExpoProject(t, screens.projectName) }}
              onDuplicate={() => { screens.handleDuplicateScreen(); setToastMessage('Screen duplicated!') }}
              onRename={screens.handleRenameScreen}
              onDelete={() => setShowDeleteScreenConfirm(true)}
              onToast={setToastMessage} onDirectEdit={directEdit.enterDirectEdit}
              deviceId={screens.activeDeviceId}
              onDeviceChange={(id) => {
                if (screens.activeGeneratedId) {
                  screens.setScreenDeviceId(screens.activeGeneratedId, id)
                } else {
                  screens.setProjectDeviceId(id)
                }
              }}
            />

            {directEdit.directEditMode && (
              <div style={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'rgba(59,130,246,0.12)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.3)', zIndex: 60, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                <PenTool size={14} color="#3B82F6" />
                <span style={{ fontSize: 12, fontWeight: 500, color: '#93C5FD' }}>Direct Edit Mode — Click any element to edit</span>
                <button onClick={() => directEdit.exitDirectEdit(false)} style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', fontSize: 11, fontWeight: 600, cursor: 'pointer', marginLeft: 4 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                >Exit</button>
              </div>
            )}

            {directEdit.directEditMode && directEdit.directEditDirty && (
              <div style={{ position: 'absolute', bottom: 70, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 60 }}>
                <button onClick={() => directEdit.exitDirectEdit(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', fontSize: 12, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(12px)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                ><RotateCcw size={14} />Discard changes</button>
                <button onClick={directEdit.saveDirectEdits} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#93C5FD', fontSize: 12, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(12px)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.3)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)' }}
                ><Check size={14} />Save changes</button>
              </div>
            )}

            <CanvasToolbar activeTool={canvas.activeTool} zoomLevel={canvas.zoomLevel} directEditMode={directEdit.directEditMode}
              setActiveTool={canvas.setActiveTool} zoomIn={canvas.zoomIn} zoomOut={canvas.zoomOut} resetZoom={canvas.resetZoom}
              enterDirectEdit={directEdit.enterDirectEdit} exitDirectEdit={directEdit.exitDirectEdit}
              onScreenshotModal={() => setShowScreenshotModal(true)} onUploadRef={() => fileInputRef.current?.click()}
              onImportHtml={() => setShowImportHtmlModal(true)} />

          </div>
        </ErrorBoundary>
      </div>

      <style>{`
        @keyframes fadeInDown { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @media (max-width: 768px) { .main-panels { flex-direction: column !important; } .chat-side { width: 100% !important; height: 50% !important; border-bottom: 1px solid rgba(255,255,255,0.06); } .canvas-side { width: 100% !important; height: 50% !important; } }
      `}</style>

      {showCodeExport && screens.generatedTree && <CodeExportModal tree={screens.generatedTree} screenName={screens.activeGenerated?.name} onClose={() => setShowCodeExport(false)} />}
      <CommandPalette commands={commands} isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
      <ShareModal projectId={projectId || ''} projectName={screens.projectName} isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
      <VariationsPanel isOpen={showVariationsPanel} onClose={() => setShowVariationsPanel(false)} onGenerate={ai.handleGenerateVariations} isGenerating={ai.isGeneratingVariations} />
      {showQrModal && <QrCodeModal url={qrUrl} onClose={() => setShowQrModal(false)} />}
      {showScreenshotModal && <ScreenshotModal onClose={() => setShowScreenshotModal(false)} onGenerate={(imageData, imageMimeType, prompt) => { setShowScreenshotModal(false); ai.handleSend(prompt || 'Recreate this screen design', imageData, imageMimeType, true) }} isGenerating={ai.isGenerating} />}

      {showImportHtmlModal && <ImportHtmlModal
        onClose={() => setShowImportHtmlModal(false)}
        projectId={projectId}
        onImported={(screen, modelUsed) => {
          setShowImportHtmlModal(false)
          const pos = screens.getNextScreenPosition()
          const newScreen = {
            id: crypto.randomUUID(),
            name: screen.name || 'Imported Screen',
            tree: screen.tree,
            originalPrompt: `[Imported from ${screen.detectedSource || 'web'}]`,
            source: 'web' as const,
            x: pos.x,
            y: pos.y,
          }
          screens.setGeneratedScreens(prev => [...prev, newScreen])
          screens.setActiveGeneratedId(newScreen.id)
          const modelLabel = modelUsed === 'sonnet' ? ' via Sonnet (complex layout)' : ' via Haiku'
          setToastMessage(`Imported: ${screen.name}${modelLabel}`)
        }}
      />}

      {showDeleteScreenConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={() => setShowDeleteScreenConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', minWidth: 340, maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Delete this screen?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#94a3b8' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteScreenConfirm(false)} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={async () => { await screens.handleDeleteScreen(); setShowDeleteScreenConfirm(false); setToastMessage('Screen deleted') }} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showNoCreditsModal && (
        <NoCreditsModal
          onClose={() => setShowNoCreditsModal(false)}
          onTopUp={async () => {
            setShowNoCreditsModal(false)
            try {
              const session = supabase ? (await supabase.auth.getSession()).data.session : null
              if (!session) return
              const res = await fetch('/api/create-topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ userId: session.user.id, email: session.user.email }),
              })
              const data = await res.json()
              if (data.checkoutUrl) window.location.href = data.checkoutUrl
              else setToastMessage(data.error || 'Top-up not available yet')
            } catch { setToastMessage('Something went wrong') }
          }}
          onUpgrade={() => { setShowNoCreditsModal(false); navigate('/pricing') }}
        />
      )}
    </div>
  )
}

export default App
