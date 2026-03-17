import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useParams, useNavigate } from 'react-router-dom'
import { PhoneFrame } from './components/PhoneFrame'
import { ChatPanel, type ChatMessage } from './components/ChatPanel'
import { CodeExportModal } from './components/CodeExportModal'
import { ShareModal } from './components/ShareModal'
import { MousePointer2, Hand, ZoomOut, ZoomIn, PenTool, Upload, Sparkles, Download, Share2, Plus, X, Pencil, LogOut, Menu, ArrowLeft, Copy, Trash2, Settings, User as UserIcon, Undo2, Redo2, Clipboard, ClipboardCopy, Command, ChevronRight, Maximize2 } from 'lucide-react'
import { CommandPalette, type Command as CmdType } from './components/CommandPalette'
import { ScreenContextToolbar } from './components/ScreenContextToolbar'
import { VariationsPanel, type VariationSettings } from './components/VariationsPanel'
import { QrCodeModal } from './components/QrCodeModal'
import { convertTreeToJSX } from './components/CodeExportModal'
import html2canvas from 'html2canvas'
import type { ComponentNode } from './types/mokkoi'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'

interface GeneratedScreen {
  id: string
  name: string
  tree: ComponentNode
  /** If this screen is part of a flow, all screens in the flow share the same flowId */
  flowId?: string
  /** Screen type: 'generated' for AI screens, 'image' for uploaded screenshots */
  type?: 'generated' | 'image'
  /** Data URL for uploaded screenshot images */
  imageUrl?: string
}

interface CanvasRefImage {
  id: string
  url: string
  name: string
}

const FLOW_KEYWORDS = [
  'flow', 'onboarding', 'walkthrough', 'multi-screen', 'complete app',
  'full app', 'series of screens', 'connected screens', 'user journey',
  'navigation flow', 'multi screen', 'multiple screens', 'screen flow',
  'app flow', 'checkout flow', 'signup flow', 'sign up flow',
]

const EDIT_KEYWORDS = [
  'change', 'update', 'modify', 'remove', 'add to', 'make it', 'make the',
  'replace', 'fix', 'adjust', 'tweak', 'edit', 'move', 'resize', 'recolor',
  'darker', 'lighter', 'bigger', 'smaller', 'add a', 'delete',
]

const CREATE_KEYWORDS = [
  'create', 'build', 'make a', 'design a', 'new', 'generate a',
  'create a', 'build a', 'design', 'make me',
]

function isFlowPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return FLOW_KEYWORDS.some(kw => lower.includes(kw))
}

function isEditIntent(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return EDIT_KEYWORDS.some(kw => lower.includes(kw))
}

function isCreateIntent(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return CREATE_KEYWORDS.some(kw => lower.includes(kw))
}

function App() {
  const [searchParams] = useSearchParams()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const initialPrompt = searchParams.get('prompt') || undefined

  const [generatedScreens, setGeneratedScreens] = useState<GeneratedScreen[]>([])
  const [activeGeneratedId, setActiveGeneratedId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showCodeExport, setShowCodeExport] = useState(false)
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select')
  const [zoomLevel, setZoomLevel] = useState(100)
  const [referenceImages, setReferenceImages] = useState<CanvasRefImage[]>([])

  // Project-level chat messages — one continuous thread
  const [projectMessages, setProjectMessages] = useState<ChatMessage[]>([])

  // Editable project name
  const [projectName, setProjectName] = useState('Untitled Project')
  const [isEditingName, setIsEditingName] = useState(false)
  const projectNameInputRef = useRef<HTMLInputElement>(null)

  // Share toast
  const [showShareToast, setShowShareToast] = useState(false)

  // Auth user
  const [user, setUser] = useState<User | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [focusTrigger, setFocusTrigger] = useState(0)
  const [showEditSubmenu, setShowEditSubmenu] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showVariationsPanel, setShowVariationsPanel] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [showDeleteScreenConfirm, setShowDeleteScreenConfirm] = useState(false)
  const [editingScreenLabel, setEditingScreenLabel] = useState<string | null>(null)
  const [editingScreenLabelValue, setEditingScreenLabelValue] = useState('')
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const hamburgerMenuRef = useRef<HTMLDivElement>(null)
  const editSubmenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resizable panel — left is chat (28%), right is canvas (72%)
  const [splitRatio, setSplitRatio] = useState(0.28)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const hasTreeRef = useRef(false)
  const phoneFrameRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Pan state — Figma-style translate-based panning
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const didPan = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const panOffsetStart = useRef({ x: 0, y: 0 })
  const isSpaceHeld = useRef(false)
  const [isSpacePanning, setIsSpacePanning] = useState(false) // state for cursor re-render

  // Debounce timer ref for auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectLoadedRef = useRef(false)

  // Load user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  // Load project data from Supabase
  useEffect(() => {
    if (!projectId) return
    const loadProject = async () => {
      // Load project info
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()
      if (project) {
        setProjectName(project.name || 'Untitled Project')
      }

      // Load screens
      const { data: screens } = await supabase
        .from('screens')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true })
      if (screens && screens.length > 0) {
        const loaded: GeneratedScreen[] = screens.map(s => ({
          id: s.id,
          name: s.name,
          tree: s.component_tree as ComponentNode,
        }))
        setGeneratedScreens(loaded)
        setActiveGeneratedId(loaded[0].id)
      }

      // Load messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
      if (msgs && msgs.length > 0) {
        const loaded: ChatMessage[] = msgs.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.created_at).getTime(),
          imageData: m.image_url ?? undefined,
        }))
        setProjectMessages(loaded)
      }

      projectLoadedRef.current = true
    }
    loadProject()
  }, [projectId])

  // Auto-save screens to Supabase (debounced)
  useEffect(() => {
    if (!projectId || !projectLoadedRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      // Upsert all screens
      for (let i = 0; i < generatedScreens.length; i++) {
        const s = generatedScreens[i]
        await supabase.from('screens').upsert({
          id: s.id,
          project_id: projectId,
          name: s.name,
          component_tree: s.tree,
          order_index: i,
          updated_at: new Date().toISOString(),
        })
      }
      // Update project timestamp
      await supabase.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId)
    }, 2000)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [generatedScreens, projectId])

  // Save project name to Supabase
  const saveProjectName = useCallback(async (name: string) => {
    if (!projectId) return
    await supabase.from('projects').update({ name, updated_at: new Date().toISOString() }).eq('id', projectId)
  }, [projectId])

  // Save a message to Supabase
  const saveMessage = useCallback(async (msg: ChatMessage) => {
    if (!projectId) return
    await supabase.from('messages').insert({
      id: msg.id,
      project_id: projectId,
      role: msg.role,
      content: msg.content,
      image_url: msg.imageData ?? null,
    })
  }, [projectId])

  // Sign out handler
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  const handleDeleteProject = async () => {
    if (!projectId) return
    await supabase.from('projects').delete().eq('id', projectId)
    setShowDeleteConfirm(false)
    navigate('/projects')
  }

  const handleShareCopy = () => {
    setShowShareModal(true)
    setShowHamburgerMenu(false)
  }

  // Focus project name input when editing
  useEffect(() => {
    if (isEditingName) {
      projectNameInputRef.current?.focus()
      projectNameInputRef.current?.select()
    }
  }, [isEditingName])

  // Auto-hide share toast
  useEffect(() => {
    if (!showShareToast) return
    const t = setTimeout(() => setShowShareToast(false), 2000)
    return () => clearTimeout(t)
  }, [showShareToast])

  // Auto-hide toast message
  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(''), 2000)
    return () => clearTimeout(t)
  }, [toastMessage])

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
      if (hamburgerMenuRef.current && !hamburgerMenuRef.current.contains(e.target as Node)) {
        setShowHamburgerMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Prevent browser-level Ctrl+scroll zoom + spacebar pan shortcut
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      // Prevent browser zoom on Ctrl+scroll globally
      if (e.ctrlKey) e.preventDefault()
    }
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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        let ratio = (e.clientX - rect.left) / rect.width
        ratio = Math.max(0.2, Math.min(0.45, ratio))
        setSplitRatio(ratio)
      }
      // Handle canvas panning via global mousemove for smoothness
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
    const handleMouseUp = () => {
      isDragging.current = false
      if (isPanning.current) {
        isPanning.current = false
        // Reset didPan after a tick so click handlers can still read it
        requestAnimationFrame(() => { didPan.current = false })
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Current active generated screen
  const activeGenerated = generatedScreens.find(s => s.id === activeGeneratedId)
  const generatedTree = activeGenerated?.tree
  hasTreeRef.current = !!generatedTree

  const handleSend = useCallback(async (prompt: string, imageData?: string, imageMimeType?: string, forceNew?: boolean) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      imageData,
    }

    // Add user message to project-level chat
    setProjectMessages(prev => [...prev, userMsg])
    saveMessage(userMsg)

    // Detect flow requests
    const flowRequest = isFlowPrompt(prompt) && !imageData

    // Intent detection: decide whether to edit or create
    let editingScreenId: string | null = null
    if (!forceNew && activeGeneratedId) {
      const hasEditIntent = isEditIntent(prompt)
      const hasCreateIntent = isCreateIntent(prompt)
      if (hasEditIntent && !hasCreateIntent) {
        editingScreenId = activeGeneratedId
      } else if (!hasEditIntent && hasCreateIntent) {
        editingScreenId = null
      } else if (hasEditIntent && hasCreateIntent) {
        editingScreenId = activeGeneratedId
      } else {
        editingScreenId = activeGeneratedId
      }
    }

    const editingScreen = editingScreenId
      ? generatedScreens.find(s => s.id === editingScreenId)
      : null

    // Don't use flow mode when editing an existing screen
    if (flowRequest && !editingScreen) {
      // === FLOW GENERATION ===
      const placeholderId = crypto.randomUUID()
      const placeholderName = prompt.length > 20 ? prompt.slice(0, 20) + '...' : prompt
      const placeholderScreen: GeneratedScreen = {
        id: placeholderId,
        name: placeholderName,
        tree: { type: 'View', style: {}, children: [] },
      }
      setGeneratedScreens(prev => [...prev, placeholderScreen])
      setActiveGeneratedId(placeholderId)
      setIsGenerating(true)

      try {
        const res = await fetch('/api/generate-flow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Failed to generate flow')
        }

        const { screens } = await res.json()
        const flowId = crypto.randomUUID()
        const screenNames = (screens as Array<{ id: string; name: string; tree: ComponentNode }>).map((s: { name: string }) => s.name)

        // Create flow screens
        const newFlowScreens: GeneratedScreen[] = (screens as Array<{ id: string; name: string; tree: ComponentNode }>).map((s: { id: string; name: string; tree: ComponentNode }) => ({
          id: crypto.randomUUID(),
          name: s.name,
          tree: s.tree,
          flowId,
        }))

        // Replace placeholder with flow screens
        setGeneratedScreens(prev => {
          const withoutPlaceholder = prev.filter(s => s.id !== placeholderId)
          return [...withoutPlaceholder, ...newFlowScreens]
        })
        setActiveGeneratedId(newFlowScreens[0].id)

        // Add assistant message to project chat
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Generated a flow with ${screens.length} screens: ${screenNames.join(' \u2192 ')}`,
          timestamp: Date.now(),
          flowScreenNames: screenNames,
        }
        setProjectMessages(prev => [...prev, assistantMsg])
        saveMessage(assistantMsg)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${errorMessage}`,
          timestamp: Date.now(),
        }
        setProjectMessages(prev => [...prev, errorMsg])
        saveMessage(errorMsg)
      } finally {
        setIsGenerating(false)
      }
      return
    }

    // === SINGLE SCREEN GENERATION ===
    let targetId: string
    let screenName: string
    const screenNumber = editingScreen
      ? generatedScreens.findIndex(s => s.id === editingScreenId) + 1
      : generatedScreens.length + 1

    if (editingScreen) {
      targetId = editingScreenId!
      screenName = editingScreen.name
    } else {
      targetId = crypto.randomUUID()
      screenName = prompt.length > 20 ? prompt.slice(0, 20) + '...' : prompt
      const newScreen: GeneratedScreen = {
        id: targetId,
        name: screenName,
        tree: { type: 'View', style: {}, children: [] },
      }
      setGeneratedScreens(prev => [...prev, newScreen])
      setActiveGeneratedId(targetId)
    }

    setIsGenerating(true)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          ...(editingScreen ? { currentScreen: editingScreen.tree } : {}),
          ...(imageData ? { imageData, imageMimeType: imageMimeType || 'image/png' } : {}),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate screen')
      }

      const { tree } = await res.json()

      setGeneratedScreens(prev => prev.map(s =>
        s.id === targetId ? { ...s, tree } : s
      ))

      // Project-level assistant message with screen context
      const action = editingScreen ? 'Updated' : 'Generated'
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `${action} Screen ${screenNumber}: ${screenName}`,
        timestamp: Date.now(),
      }
      setProjectMessages(prev => [...prev, assistantMsg])
      saveMessage(assistantMsg)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        timestamp: Date.now(),
      }
      setProjectMessages(prev => [...prev, errorMsg])
      saveMessage(errorMsg)
    } finally {
      setIsGenerating(false)
    }
  }, [activeGeneratedId, generatedScreens, saveMessage])

  // Handle clicking a screen name in a flow message
  const handleFlowScreenClick = (screenName: string) => {
    const screen = generatedScreens.find(s => s.name === screenName && s.flowId)
    if (screen) {
      setActiveGeneratedId(screen.id)
    }
  }

  const startDragging = () => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // Handle file upload from canvas toolbar — places image as REFERENCE on canvas
  const handleCanvasUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const name = file.name.replace(/\.[^.]+$/, '')
      setReferenceImages(prev => [...prev, {
        id: crypto.randomUUID(),
        url: dataUrl,
        name: name.length > 20 ? name.slice(0, 20) + '...' : name,
      }])
    }
    reader.readAsDataURL(file)
  }

  const removeReferenceImage = (id: string) => {
    setReferenceImages(prev => prev.filter(img => img.id !== id))
  }

  // Generate a screen from an uploaded screenshot on the canvas
  const handleGenerateFromImage = (screen: GeneratedScreen) => {
    if (!screen.imageUrl) return
    const match = screen.imageUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return
    const [, mimeType, base64] = match
    handleSend('Recreate this screen design', base64, mimeType, true)
  }

  // === Screen Context Toolbar Handlers ===

  // Regenerate: re-send original prompt for the selected screen
  const handleRegenerate = useCallback(() => {
    if (!activeGenerated) return
    const screenName = activeGenerated.name
    // Use the screen name as the regeneration prompt
    handleSend(`Regenerate: ${screenName}`, undefined, undefined, false)
  }, [activeGenerated, activeGeneratedId, generatedScreens, handleSend])

  // Edit via chat: focus chat input with editing context
  const handleEditViaChat = useCallback(() => {
    setFocusTrigger(t => t + 1)
  }, [])

  // Change color scheme: pre-fill chat
  const handleChangeColorScheme = useCallback(() => {
    // We'll use a custom event to set the chat input text
    const event = new CustomEvent('mokkoi-set-chat-input', {
      detail: { text: 'Change the color scheme of this screen to ' }
    })
    window.dispatchEvent(event)
    setFocusTrigger(t => t + 1)
  }, [])

  // Make darker / lighter
  const handleMakeDarker = useCallback(() => {
    if (!activeGeneratedId) return
    handleSend('Make this screen darker with a dark theme')
  }, [activeGeneratedId, handleSend])

  const handleMakeLighter = useCallback(() => {
    if (!activeGeneratedId) return
    handleSend('Make this screen lighter with a light theme')
  }, [activeGeneratedId, handleSend])

  // Preview in new tab
  const handlePreviewNewTab = useCallback(() => {
    if (!activeGenerated?.tree) return
    const code = convertTreeToJSX(activeGenerated.tree)
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${activeGenerated.name} - Mokkoi Preview</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0F172A;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:-apple-system,system-ui,sans-serif}</style>
</head><body>
<div style="width:390px;min-height:844px;background:#0F172A;overflow:auto">
<pre style="color:#94a3b8;font-size:11px;padding:16px;white-space:pre-wrap">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</div></body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }, [activeGenerated])

  // Show QR Code
  const handleShowQrCode = useCallback(() => {
    if (!projectId) return
    const previewUrl = `${window.location.origin}/view/${projectId}`
    setQrUrl(previewUrl)
    setShowQrModal(true)
  }, [projectId])

  // Resize phone frame (these are visual-only hints for now)
  const handleResizeMobile = useCallback(() => {
    setToastMessage('Resized to iPhone 14 (390×844)')
  }, [])

  const handleResizeTablet = useCallback(() => {
    setToastMessage('Resized to iPad (768×1024)')
  }, [])

  // Download as image
  const handleDownloadImage = useCallback(async () => {
    if (!activeGeneratedId) return
    const el = phoneFrameRefs.current.get(activeGeneratedId)
    if (!el) { setToastMessage('Could not capture screen'); return }
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#000',
        scale: 2,
        useCORS: true,
      })
      const link = document.createElement('a')
      link.download = `${activeGenerated?.name || 'screen'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      setToastMessage('Image downloaded!')
    } catch {
      setToastMessage('Failed to capture image')
    }
  }, [activeGeneratedId, activeGenerated])

  // Duplicate screen
  const handleDuplicateScreen = useCallback(() => {
    if (!activeGenerated) return
    const newScreen: GeneratedScreen = {
      id: crypto.randomUUID(),
      name: `${activeGenerated.name} (copy)`,
      tree: JSON.parse(JSON.stringify(activeGenerated.tree)),
      flowId: activeGenerated.flowId,
    }
    setGeneratedScreens(prev => [...prev, newScreen])
    setActiveGeneratedId(newScreen.id)
    setToastMessage('Screen duplicated!')
  }, [activeGenerated])

  // Rename screen
  const handleRenameScreen = useCallback(() => {
    if (!activeGenerated) return
    setEditingScreenLabel(activeGenerated.id)
    setEditingScreenLabelValue(activeGenerated.name)
  }, [activeGenerated])

  const commitScreenRename = useCallback(() => {
    if (!editingScreenLabel) return
    const newName = editingScreenLabelValue.trim() || 'Untitled'
    setGeneratedScreens(prev => prev.map(s =>
      s.id === editingScreenLabel ? { ...s, name: newName } : s
    ))
    setEditingScreenLabel(null)
  }, [editingScreenLabel, editingScreenLabelValue])

  // Delete screen
  const handleDeleteScreen = useCallback(async () => {
    if (!activeGeneratedId || !projectId) return
    // Remove from Supabase
    await supabase.from('screens').delete().eq('id', activeGeneratedId)
    // Remove from state
    setGeneratedScreens(prev => prev.filter(s => s.id !== activeGeneratedId))
    setActiveGeneratedId(null)
    setShowDeleteScreenConfirm(false)
    setToastMessage('Screen deleted')
  }, [activeGeneratedId, projectId])

  // Generate variations
  const handleGenerateVariations = useCallback(async (settings: VariationSettings) => {
    if (!activeGenerated?.tree) return
    setIsGeneratingVariations(true)

    const creativeDesc = {
      refine: 'Make very small, subtle changes — keep the overall structure and design nearly identical but tweak minor details.',
      explore: 'Make moderate changes — try different arrangements, color variations, or component styles while keeping the same general purpose.',
      reimagine: 'Create a completely different design — reimagine the screen from scratch with a new layout, style, and visual approach.',
    }

    const aspectInstructions: string[] = []
    if (settings.aspects.layout) aspectInstructions.push('Vary the layout and arrangement of elements.')
    if (settings.aspects.colorScheme) aspectInstructions.push('Use a different color scheme.')
    if (settings.aspects.images) aspectInstructions.push('Change image placements and styles.')
    if (settings.aspects.textFont) aspectInstructions.push('Use different font sizes and weights.')
    if (settings.aspects.textContent) aspectInstructions.push('Change the text content.')

    const originalTree = JSON.stringify(activeGenerated.tree)

    // Create placeholder screens for each variation
    const placeholders: GeneratedScreen[] = []
    for (let i = 0; i < settings.count; i++) {
      const ph: GeneratedScreen = {
        id: crypto.randomUUID(),
        name: `${activeGenerated.name} v${i + 1}`,
        tree: { type: 'View', style: {}, children: [] },
      }
      placeholders.push(ph)
    }
    setGeneratedScreens(prev => [...prev, ...placeholders])
    setActiveGeneratedId(placeholders[0].id)

    // Generate each variation in parallel
    const promises = placeholders.map(async (ph, i) => {
      const variationPrompt = `You are creating variation ${i + 1} of a mobile screen design.

Here is the original screen's component tree JSON:
${originalTree}

Creative direction: ${creativeDesc[settings.creativeRange]}
${aspectInstructions.length > 0 ? 'Aspects to change: ' + aspectInstructions.join(' ') : ''}
${settings.customInstructions ? 'Additional instructions: ' + settings.customInstructions : ''}

Generate a new version of this screen as a variation. Return ONLY the JSON component tree.`

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: variationPrompt }),
        })
        if (!res.ok) throw new Error('Failed')
        const { tree } = await res.json()
        setGeneratedScreens(prev => prev.map(s =>
          s.id === ph.id ? { ...s, tree } : s
        ))
      } catch {
        setGeneratedScreens(prev => prev.map(s =>
          s.id === ph.id ? { ...s, name: `${ph.name} (failed)` } : s
        ))
      }
    })

    await Promise.all(promises)
    setIsGeneratingVariations(false)
    setShowVariationsPanel(false)
    setToastMessage(`Generated ${settings.count} variations!`)
  }, [activeGenerated])

  // Determine canvas state
  const hasScreens = generatedScreens.length > 0

  // Zoom handlers
  const zoomIn = () => setZoomLevel(z => Math.min(300, z + 5))
  const zoomOut = () => setZoomLevel(z => Math.max(25, z - 5))
  const resetZoom = () => { setZoomLevel(100); resetPan() }

  // Canvas wheel handler — attached natively with { passive: false } so preventDefault works
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      // If the scroll target is inside a phone frame, let it scroll naturally
      // (unless Ctrl is held — then zoom takes priority)
      const target = e.target as HTMLElement
      if (!e.ctrlKey && !e.metaKey) {
        // Check if the target is inside any phone frame element
        const phoneFrame = target.closest('.phone-screen, [class*="phone"], [class*="phoneFrame"]')
        if (phoneFrame) {
          // Don't intercept — let the phone content scroll naturally
          return
        }
      }

      // Prevent ALL default wheel behavior on canvas (no browser scroll)
      e.preventDefault()
      e.stopPropagation()

      if (e.ctrlKey || e.metaKey) {
        // Zoom toward mouse cursor position
        const rect = el.getBoundingClientRect()
        const mx = e.clientX - rect.left - rect.width / 2
        const my = e.clientY - rect.top - rect.height / 2

        setZoomLevel(prevZoom => {
          const delta = e.deltaY > 0 ? -5 : 5
          const newZoom = Math.min(300, Math.max(25, prevZoom + delta))
          const scaleFactor = newZoom / prevZoom
          setPanOffset(prev => ({
            x: mx - scaleFactor * (mx - prev.x),
            y: my - scaleFactor * (my - prev.y),
          }))
          return newZoom
        })
      } else if (e.shiftKey) {
        // Shift + scroll = horizontal pan
        setPanOffset(prev => ({ ...prev, x: prev.x - e.deltaY }))
      } else {
        // Regular scroll = vertical pan (+ honor deltaX for trackpad horizontal)
        setPanOffset(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }))
      }
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // Pan handlers — Figma-style: hand tool, middle mouse, or spacebar+drag
  // Middle-click and spacebar ALWAYS pan regardless of active tool
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Middle-click and spacebar always start pan, regardless of tool
    if (e.button === 1 || isSpaceHeld.current || activeTool === 'pan') {
      if (e.button === 1) e.preventDefault()
      isPanning.current = true
      didPan.current = false
      panStart.current = { x: e.clientX, y: e.clientY }
      panOffsetStart.current = { ...panOffset }
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }
  }

  const resetPan = () => setPanOffset({ x: 0, y: 0 })

  // Click empty canvas to deselect (only in select mode)
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (didPan.current) return
    if (activeTool === 'pan' || isSpaceHeld.current) return
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset?.canvasBg === 'true') {
      setActiveGeneratedId(null)
    }
  }

  // Phone click handler — select only in select mode and if not panning
  const handlePhoneClick = (e: React.MouseEvent, screenId: string) => {
    e.stopPropagation()
    if (didPan.current) return
    if (activeTool === 'pan' || isSpaceHeld.current) return
    setActiveGeneratedId(screenId)
  }

  // Open share modal
  const handleShare = () => {
    setShowShareModal(true)
  }

  // Project name editing
  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditingName(false)
    }
    if (e.key === 'Escape') {
      setIsEditingName(false)
    }
  }

  const handleNameBlur = () => {
    setIsEditingName(false)
    const name = projectName.trim() || 'Untitled Project'
    if (!projectName.trim()) setProjectName(name)
    saveProjectName(name)
  }

  // Determine canvas cursor
  const panActive = activeTool === 'pan' || isSpacePanning
  const canvasCursor = isPanning.current ? 'grabbing' : panActive ? 'grab' : 'default'

  // Toolbar button helper
  const tbBtn = (id: string, icon: React.ReactNode, tooltip: string, onClick?: () => void) => {
    const isActiveTool = id === 'select' || id === 'pan'
    const isActive = isActiveTool && activeTool === id
    return (
      <button
        title={tooltip}
        onClick={onClick ?? (() => { if (id === 'select' || id === 'pan') setActiveTool(id) })}
        style={{
          width: 32, height: 32, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
          color: isActive ? '#fff' : '#999',
          border: 'none', cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        {icon}
      </button>
    )
  }

  // Command palette commands
  const commands: CmdType[] = useMemo(() => [
    { id: 'select-tool', label: 'Select Tool', shortcut: 'V', icon: <MousePointer2 size={16} />, group: 'Tools', action: () => setActiveTool('select') },
    { id: 'pan-tool', label: 'Hand Tool', shortcut: 'H', icon: <Hand size={16} />, group: 'Tools', action: () => setActiveTool('pan') },
    { id: 'new-screen', label: 'New Screen', shortcut: 'N', icon: <Plus size={16} />, group: 'Canvas', action: () => { setActiveGeneratedId(null); setShowCodeExport(false); setFocusTrigger(t => t + 1) } },
    { id: 'zoom-in', label: 'Zoom In', shortcut: '+', icon: <ZoomIn size={16} />, group: 'Canvas', action: zoomIn },
    { id: 'zoom-out', label: 'Zoom Out', shortcut: '-', icon: <ZoomOut size={16} />, group: 'Canvas', action: zoomOut },
    { id: 'reset-zoom', label: 'Reset Zoom', shortcut: 'Ctrl+0', icon: <Maximize2 size={16} />, group: 'Canvas', action: resetZoom },
    { id: 'export-code', label: 'Export Code', shortcut: 'Ctrl+E', icon: <Download size={16} />, group: 'Project', action: () => { if (generatedTree) setShowCodeExport(true) } },
    { id: 'share', label: 'Share Project', icon: <Share2 size={16} />, group: 'Project', action: handleShare },
    { id: 'rename-project', label: 'Rename Project', icon: <Pencil size={16} />, group: 'Project', action: () => setIsEditingName(true) },
    { id: 'upload-ref', label: 'Upload Reference Image', icon: <Upload size={16} />, group: 'Canvas', action: () => fileInputRef.current?.click() },
    { id: 'go-projects', label: 'Go to All Projects', icon: <ArrowLeft size={16} />, group: 'Navigation', action: () => navigate('/projects') },
    { id: 'sign-out', label: 'Sign Out', icon: <LogOut size={16} />, group: 'Account', action: handleSignOut },
  ], [generatedTree, handleShare, handleSignOut, navigate, zoomIn, zoomOut, resetZoom])

  return (
    <div className="app-shell" style={{ height: '100vh', background: '#000000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Hidden file input for canvas upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        style={{ display: 'none' }}
        onChange={handleCanvasUpload}
      />

      {/* Navbar */}
      <nav
        style={{
          height: 48, flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center',
          padding: '0 16px',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          gap: 10,
          transformOrigin: 'unset',
          zoom: 1,
          position: 'relative',
          zIndex: 50,
        }}
      >
        {/* Left: M logo (home link) */}
        <div
          onClick={() => navigate('/projects')}
          style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            color: '#fff', fontSize: 11, fontWeight: 800,
            cursor: 'pointer', transition: 'opacity 0.2s',
          }}
          title="Go to projects"
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          M
        </div>

        {/* Hamburger menu */}
        <div ref={hamburgerMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
            style={{
              width: 28, height: 28, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: showHamburgerMenu ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: 'none', cursor: 'pointer', color: '#94a3b8',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!showHamburgerMenu) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { if (!showHamburgerMenu) e.currentTarget.style.background = 'transparent' }}
          >
            <Menu size={18} />
          </button>
          {showHamburgerMenu && (
            <div style={{
              position: 'absolute', top: 34, left: 0,
              background: '#1A1A1A',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: 4,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              zIndex: 100, minWidth: 220,
            }}>
              <button
                onClick={() => { navigate('/projects'); setShowHamburgerMenu(false) }}
                style={hamburgerItemStyle}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <ArrowLeft size={16} color="#94a3b8" />
                Go to all projects
              </button>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />

              {/* Edit submenu — opens on hover to the right */}
              <div
                style={{ position: 'relative' }}
                onMouseEnter={() => { if (editSubmenuTimer.current) { clearTimeout(editSubmenuTimer.current); editSubmenuTimer.current = null } setShowEditSubmenu(true) }}
                onMouseLeave={() => { editSubmenuTimer.current = setTimeout(() => setShowEditSubmenu(false), 200) }}
              >
                <button
                  style={{ ...hamburgerItemStyle, justifyContent: 'space-between', background: showEditSubmenu ? 'rgba(255,255,255,0.06)' : 'transparent' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Pencil size={16} color="#94a3b8" />
                    Edit
                  </span>
                  <ChevronRight size={14} color="#555" />
                </button>
                {showEditSubmenu && (
                  <div style={{
                    position: 'absolute', left: '100%', top: 0,
                    background: '#1A1A1A',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12, padding: 4,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                    zIndex: 101, minWidth: 200,
                    marginLeft: 4,
                  }}>
                    {[
                      { label: 'Undo', icon: <Undo2 size={14} color="#94a3b8" />, shortcut: 'Ctrl+Z' },
                      { label: 'Redo', icon: <Redo2 size={14} color="#94a3b8" />, shortcut: 'Ctrl+Y' },
                      { label: 'Copy', icon: <ClipboardCopy size={14} color="#94a3b8" />, shortcut: 'Ctrl+C' },
                      { label: 'Paste', icon: <Clipboard size={14} color="#94a3b8" />, shortcut: 'Ctrl+V' },
                    ].map(item => (
                      <button
                        key={item.label}
                        onClick={() => { setToastMessage('Coming soon'); setShowHamburgerMenu(false); setShowEditSubmenu(false) }}
                        style={{ ...hamburgerItemStyle, fontSize: 12, padding: '7px 10px', justifyContent: 'space-between' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {item.icon}
                          {item.label}
                        </span>
                        <span style={{ fontSize: 10, color: '#555' }}>{item.shortcut}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Command menu */}
              <button
                onClick={() => { setShowCommandPalette(true); setShowHamburgerMenu(false) }}
                style={{ ...hamburgerItemStyle, justifyContent: 'space-between' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Command size={16} color="#94a3b8" />
                  Command menu
                </span>
                <span style={{ fontSize: 10, color: '#555' }}>Ctrl+K</span>
              </button>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />
              <button
                onClick={handleShareCopy}
                style={hamburgerItemStyle}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <Share2 size={16} color="#94a3b8" />
                Share
              </button>
              <button
                onClick={() => { setToastMessage('Coming soon'); setShowHamburgerMenu(false) }}
                style={hamburgerItemStyle}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <Download size={16} color="#94a3b8" />
                Download project
              </button>
              <button
                onClick={() => { setToastMessage('Coming soon'); setShowHamburgerMenu(false) }}
                style={hamburgerItemStyle}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <Copy size={16} color="#94a3b8" />
                Duplicate project
              </button>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />
              <button
                onClick={() => { setShowDeleteConfirm(true); setShowHamburgerMenu(false) }}
                style={{ ...hamburgerItemStyle, color: '#f87171' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <Trash2 size={16} color="#f87171" />
                Delete project
              </button>
            </div>
          )}
        </div>

        {/* Editable project name */}
        {isEditingName ? (
          <input
            ref={projectNameInputRef}
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            onKeyDown={handleNameKeyDown}
            onBlur={handleNameBlur}
            style={{
              fontSize: 14, fontWeight: 500, color: '#f1f5f9',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: 6,
              padding: '2px 8px',
              outline: 'none',
              minWidth: 120, maxWidth: 240,
            }}
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="project-name-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 14, fontWeight: 500, color: '#f1f5f9',
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 6,
              padding: '2px 8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              const pencil = e.currentTarget.querySelector('.pencil-icon') as HTMLElement
              if (pencil) pencil.style.opacity = '1'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
              const pencil = e.currentTarget.querySelector('.pencil-icon') as HTMLElement
              if (pencil) pencil.style.opacity = '0'
            }}
            title="Click to rename project"
          >
            {projectName}
            <span className="pencil-icon" style={{ opacity: 0, transition: 'opacity 0.2s', display: 'flex' }}>
              <Pencil size={12} color="#64748b" />
            </span>
          </button>
        )}

        {/* Generating indicator */}
        {isGenerating && (
          <div className="flex items-center gap-1.5 shrink-0" style={{
            padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 500,
            background: 'rgba(129,140,248,0.1)', color: 'rgba(129,140,248,0.7)',
            border: '1px solid rgba(129,140,248,0.15)',
          }}>
            <span className="inline-flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_infinite]" />
              <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
              <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
            </span>
            Generating
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right: action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* New screen button */}
          <button
            onClick={() => {
              setActiveGeneratedId(null)
              setShowCodeExport(false)
            }}
            style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 8,
              fontSize: 12, fontWeight: 500,
              color: '#818cf8',
              background: 'rgba(99,102,241,0.08)',
              border: '1px dashed rgba(99,102,241,0.3)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(99,102,241,0.15)'
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(99,102,241,0.08)'
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
            }}
            title="New screen"
          >
            <Plus size={14} />
            New Screen
          </button>

          {/* Export button */}
          <button
            onClick={() => { if (generatedTree) setShowCodeExport(true) }}
            style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 8,
              fontSize: 12, fontWeight: 500,
              color: '#94a3b8',
              background: 'transparent',
              border: 'none',
              cursor: generatedTree ? 'pointer' : 'default',
              opacity: generatedTree ? 1 : 0.4,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (generatedTree) e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
          >
            <Download size={14} />
            Export
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            style={{
              flexShrink: 0, position: 'relative',
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 8,
              fontSize: 12, fontWeight: 500,
              color: '#94a3b8',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
          >
            <Share2 size={14} />
            Share
          </button>

          {/* User avatar + dropdown */}
          <div ref={userMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff',
                cursor: 'pointer', transition: 'box-shadow 0.2s',
                boxShadow: showUserMenu ? '0 0 0 2px rgba(99,102,241,0.4)' : 'none',
              }}
              title={user?.user_metadata?.full_name || user?.email || 'User'}
            >
              {(user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </div>
            {showUserMenu && (
              <div style={{
                position: 'absolute', top: 36, right: 0,
                background: '#1A1A1A',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: 0,
                boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                zIndex: 100, minWidth: 260,
                overflow: 'hidden',
              }}>
                {/* User info */}
                <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                    {(user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.user_metadata?.full_name || user?.email || 'User'}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.email || ''}
                    </div>
                  </div>
                </div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 12px' }} />
                <div style={{ padding: '4px 8px' }}>
                  <button
                    onClick={() => { setToastMessage('Coming soon'); setShowUserMenu(false) }}
                    style={studioAvatarItemStyle}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <Settings size={18} color="#94a3b8" />
                    Settings
                  </button>
                  <button
                    onClick={() => { setToastMessage('Coming soon'); setShowUserMenu(false) }}
                    style={studioAvatarItemStyle}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <UserIcon size={18} color="#94a3b8" />
                    Manage account
                  </button>
                </div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 12px' }} />
                <div style={{ padding: '4px 8px 8px' }}>
                  <button
                    onClick={handleSignOut}
                    style={{ ...studioAvatarItemStyle, color: '#f87171' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <LogOut size={18} color="#f87171" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Toast messages */}
      {(showShareToast || toastMessage) && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 20px', borderRadius: 10,
          background: '#1a1a2e', color: '#34d399',
          fontSize: 13, fontWeight: 500,
          border: '1px solid rgba(52,211,153,0.2)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 200,
          animation: 'fadeInDown 0.25s ease-out',
        }}>
          {toastMessage || 'Link copied!'}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1A1A1A',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: 24,
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              minWidth: 340, maxWidth: 400,
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>
              Delete this project?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#94a3b8' }}>
              This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'rgba(248,113,113,0.15)',
                  border: '1px solid rgba(248,113,113,0.3)',
                  color: '#f87171', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content: LEFT = Chat, RIGHT = Canvas */}
      <div
        ref={containerRef}
        className="main-panels"
        style={{
          flex: 1, minHeight: 0, display: 'flex', position: 'relative',
        }}
      >
        {/* LEFT: Chat panel */}
        <div
          className="chat-side"
          style={{
            width: `${splitRatio * 100}%`,
            display: 'flex', flexDirection: 'column', minHeight: 0,
            background: '#0A0A0A',
            transformOrigin: 'unset',
            zoom: 1,
          }}
        >
          <ChatPanel
            messages={projectMessages}
            onSend={handleSend}
            onExportCode={() => generatedTree && setShowCodeExport(true)}
            isGenerating={isGenerating}
            initialPrompt={initialPrompt}
            onFlowScreenClick={handleFlowScreenClick}
            hasScreens={hasScreens}
            selectedScreenName={activeGenerated?.name}
            focusTrigger={focusTrigger}
          />
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={startDragging}
          style={{
            width: 1,
            cursor: 'col-resize',
            background: 'rgba(255,255,255,0.06)',
            position: 'relative',
            flexShrink: 0,
            transition: 'background 0.2s',
            zIndex: 10,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.width = '3px' }}
          onMouseLeave={e => { if (!isDragging.current) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.width = '1px' } }}
        />

        {/* RIGHT: Canvas */}
        <div
          ref={canvasRef}
          className="canvas-side"
          onMouseDown={handleCanvasMouseDown}
          onClick={handleCanvasClick}
          style={{
            width: `${(1 - splitRatio) * 100}%`,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#E8E8E8',
            backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
            cursor: canvasCursor,
          }}
        >
          {/* Canvas content — multi-screen infinite canvas */}
          {!hasScreens && !isGenerating && referenceImages.length === 0 ? (
            /* EMPTY STATE */
            <div data-canvas-bg="true" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              pointerEvents: 'none', userSelect: 'none',
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            }}>
              <span style={{ fontSize: 15, color: 'rgba(0,0,0,0.3)', fontWeight: 500 }}>
                Your designs will appear here
              </span>
            </div>
          ) : (
            /* ALL SCREENS + REFERENCE IMAGES */
            <div
              data-canvas-bg="true"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 40,
                padding: '40px 60px',
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel / 100})`,
                transformOrigin: 'center center',
                transition: isPanning.current ? 'none' : 'transform 0.15s ease-out',
                cursor: panActive ? 'inherit' : 'default',
              }}
            >
              {generatedScreens.map((screen, idx) => {
                const isActive = screen.id === activeGeneratedId
                const isScreenGenerating = isGenerating && isActive
                const isImage = screen.type === 'image'
                return (
                  <div
                    key={screen.id}
                    onClick={(e) => handlePhoneClick(e, screen.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                      cursor: panActive ? 'inherit' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {/* Screen label */}
                    {editingScreenLabel === screen.id ? (
                      <input
                        autoFocus
                        value={editingScreenLabelValue}
                        onChange={e => setEditingScreenLabelValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitScreenRename(); if (e.key === 'Escape') setEditingScreenLabel(null) }}
                        onBlur={commitScreenRename}
                        onClick={e => e.stopPropagation()}
                        style={{
                          fontSize: 11, fontWeight: 600,
                          color: '#6366f1',
                          textAlign: 'center', maxWidth: 200, width: 160,
                          padding: '2px 8px', borderRadius: 6,
                          background: 'rgba(99,102,241,0.1)',
                          border: '1px solid rgba(99,102,241,0.4)',
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: isActive ? '#6366f1' : '#888',
                        textAlign: 'center', maxWidth: 200,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        transition: 'color 0.2s',
                        padding: '2px 8px', borderRadius: 6,
                        background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                      }}>
                        {idx + 1}. {screen.name}
                      </span>
                    )}

                    {/* Phone frame with selection highlight */}
                    <div
                      ref={el => { if (el) phoneFrameRefs.current.set(screen.id, el); else phoneFrameRefs.current.delete(screen.id) }}
                      style={{
                        borderRadius: 52,
                        boxShadow: isActive
                          ? '0 8px 32px rgba(0,0,0,0.3), 0 0 0 3px rgba(99,102,241,0.5), 0 0 20px rgba(99,102,241,0.15)'
                          : '0 8px 32px rgba(0,0,0,0.2)',
                        transition: 'box-shadow 0.25s',
                      }}
                    >
                      <PhoneFrame
                        generatedTree={!isImage ? screen.tree : undefined}
                        imageUrl={isImage ? screen.imageUrl : undefined}
                        isGenerating={isScreenGenerating}
                      />
                    </div>

                    {/* "Generate from this" button for uploaded images */}
                    {isImage && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleGenerateFromImage(screen) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 14px', borderRadius: 20,
                          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                          color: '#fff', fontSize: 11, fontWeight: 600,
                          border: 'none', cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                      >
                        <Sparkles size={12} />
                        Generate from this
                      </button>
                    )}
                  </div>
                )
              })}

              {/* Reference images from toolbar upload */}
              {referenceImages.map(img => (
                <div
                  key={img.id}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    flexShrink: 0, position: 'relative',
                  }}
                >
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#888',
                    padding: '2px 8px', borderRadius: 6,
                  }}>
                    Ref: {img.name}
                  </span>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={img.url}
                      alt={img.name}
                      style={{
                        maxWidth: 280, maxHeight: 500,
                        borderRadius: 12,
                        border: '2px solid rgba(0,0,0,0.15)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                        objectFit: 'contain',
                        background: '#fff',
                      }}
                    />
                    {/* Remove button */}
                    <button
                      onClick={() => removeReferenceImage(img.id)}
                      style={{
                        position: 'absolute', top: -8, right: -8,
                        width: 22, height: 22, borderRadius: '50%',
                        background: '#1a1a1a', color: '#fff',
                        border: '2px solid rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: 12,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f87171'; e.currentTarget.style.borderColor = '#f87171' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                      title="Remove reference image"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Screen Context Toolbar — appears when a screen is selected */}
          <ScreenContextToolbar
            visible={!!activeGeneratedId && !!activeGenerated?.tree}
            screenName={activeGenerated?.name || ''}
            screenTree={activeGenerated?.tree}
            screenId={activeGeneratedId || ''}
            onRegenerate={handleRegenerate}
            onOpenVariations={() => setShowVariationsPanel(true)}
            onEditViaChat={handleEditViaChat}
            onChangeColorScheme={handleChangeColorScheme}
            onMakeDarker={handleMakeDarker}
            onMakeLighter={handleMakeLighter}
            onPreviewNewTab={handlePreviewNewTab}
            onShowQrCode={handleShowQrCode}
            onResizeMobile={handleResizeMobile}
            onResizeTablet={handleResizeTablet}
            onExportCode={() => { if (generatedTree) setShowCodeExport(true) }}
            onDownloadImage={handleDownloadImage}
            onDuplicate={handleDuplicateScreen}
            onRename={handleRenameScreen}
            onDelete={() => setShowDeleteScreenConfirm(true)}
            onToast={setToastMessage}
          />

          {/* Bottom canvas toolbar */}
          <div style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 16px',
            background: '#1A1A1A',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 20,
            transformOrigin: 'unset',
            zoom: 1,
          }}>
            {tbBtn('select', <MousePointer2 size={18} />, 'Select')}
            {tbBtn('pan', <Hand size={18} />, 'Pan')}

            {/* Separator */}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

            {tbBtn('zoomOut', <ZoomOut size={18} />, 'Zoom out', zoomOut)}
            <button
              title="Reset zoom"
              onClick={resetZoom}
              style={{
                fontSize: 12, fontWeight: 600, color: '#999', minWidth: 36, textAlign: 'center',
                userSelect: 'none', background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '4px 2px', borderRadius: 6, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#999'; e.currentTarget.style.background = 'transparent' }}
            >
              {zoomLevel}%
            </button>
            {tbBtn('zoomIn', <ZoomIn size={18} />, 'Zoom in', zoomIn)}

            {/* Separator */}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

            {tbBtn('pen', <PenTool size={18} />, 'Direct edit (coming soon)', () => {})}
            {tbBtn('upload', <Upload size={18} />, 'Upload reference image', () => fileInputRef.current?.click())}
          </div>
        </div>
      </div>

      {/* Responsive styles + toast animation */}
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @media (max-width: 768px) {
          .main-panels {
            flex-direction: column !important;
          }
          .chat-side {
            width: 100% !important;
            height: 50% !important;
            border-bottom: 1px solid rgba(255,255,255,0.06);
          }
          .canvas-side {
            width: 100% !important;
            height: 50% !important;
          }
        }
      `}</style>

      {/* Code Export Modal */}
      {showCodeExport && generatedTree && (
        <CodeExportModal
          tree={generatedTree}
          onClose={() => setShowCodeExport(false)}
        />
      )}

      {/* Command Palette */}
      <CommandPalette
        commands={commands}
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />

      {/* Share Modal */}
      <ShareModal
        projectId={projectId || ''}
        projectName={projectName}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      {/* Variations Panel */}
      <VariationsPanel
        isOpen={showVariationsPanel}
        onClose={() => setShowVariationsPanel(false)}
        onGenerate={handleGenerateVariations}
        isGenerating={isGeneratingVariations}
      />

      {/* QR Code Modal */}
      {showQrModal && (
        <QrCodeModal
          url={qrUrl}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {/* Delete Screen Confirmation */}
      {showDeleteScreenConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
          onClick={() => setShowDeleteScreenConfirm(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1A1A1A',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: 24,
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              minWidth: 340, maxWidth: 400,
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>
              Delete this screen?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#94a3b8' }}>
              This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteScreenConfirm(false)}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteScreen}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'rgba(248,113,113,0.15)',
                  border: '1px solid rgba(248,113,113,0.3)',
                  color: '#f87171', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const hamburgerItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', padding: '9px 12px', borderRadius: 8,
  background: 'transparent', border: 'none',
  color: '#e2e8f0', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', transition: 'background 0.15s',
  textAlign: 'left',
}

const studioAvatarItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', padding: '10px 12px', borderRadius: 8,
  background: 'transparent', border: 'none',
  color: '#e2e8f0', fontSize: 14, fontWeight: 500,
  cursor: 'pointer', transition: 'background 0.15s',
  textAlign: 'left',
}

export default App
