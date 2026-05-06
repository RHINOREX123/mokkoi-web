import { useState, useCallback, useRef, useEffect } from 'react'
import type { ComponentNode } from '../types/mokkoi'
import { supabase } from '../lib/supabase'
import type { ChatMessage } from '../components/ChatPanel'
import { GAP, PAD_X, PAD_Y, type FlowConnection } from '../components/FlowConnectors'
import { DEFAULT_DEVICE, getCanvasDimensions, resolveDeviceId } from '../constants/devices'
import type { DeviceId } from '../constants/devices'

export interface GeneratedScreen {
  id: string
  name: string
  tree: ComponentNode
  originalPrompt?: string
  flowId?: string
  type?: 'generated' | 'image'
  imageUrl?: string
  source?: 'web' | 'mcp'
  /** Canvas x position (persisted to Supabase) */
  x?: number
  /** Canvas y position (persisted to Supabase) */
  y?: number
  /** Per-screen device ID */
  deviceId?: DeviceId
}

export interface ScreenManagement {
  generatedScreens: GeneratedScreen[]
  activeGeneratedId: string | null
  activeGenerated: GeneratedScreen | undefined
  generatedTree: ComponentNode | undefined
  hasScreens: boolean
  /** True once screens have been fetched from Supabase (even if result is empty) */
  screensLoaded: boolean
  editingScreenLabel: string | null
  editingScreenLabelValue: string

  setGeneratedScreens: React.Dispatch<React.SetStateAction<GeneratedScreen[]>>
  setActiveGeneratedId: React.Dispatch<React.SetStateAction<string | null>>
  setEditingScreenLabel: React.Dispatch<React.SetStateAction<string | null>>
  setEditingScreenLabelValue: React.Dispatch<React.SetStateAction<string>>

  handleDuplicateScreen: () => void
  handleRenameScreen: () => void
  commitScreenRename: () => void
  handleDeleteScreen: () => Promise<void>

  // Project data loading & persistence
  projectMessages: ChatMessage[]
  setProjectMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  projectName: string
  setProjectName: React.Dispatch<React.SetStateAction<string>>
  saveMessage: (msg: ChatMessage) => Promise<void>
  saveProjectName: (name: string) => Promise<void>
  projectLoadedRef: React.MutableRefObject<boolean>
  hasTreeRef: React.MutableRefObject<boolean>
  /** Returns the next available {x, y} position for a new screen (right of all existing screens) */
  getNextScreenPosition: () => { x: number; y: number }

  // Device selection — project-level default for new screens
  projectDeviceId: DeviceId
  setProjectDeviceId: (id: DeviceId) => void

  /** Change the selected screen's device */
  setScreenDeviceId: (screenId: string, deviceId: DeviceId) => void

  /** Get the active screen's deviceId (or project default) */
  activeDeviceId: DeviceId

  // Flow connections
  connections: FlowConnection[]
  setConnections: React.Dispatch<React.SetStateAction<FlowConnection[]>>
  addConnection: (from: string, to: string) => void
  removeConnection: (idx: number) => void
}

export function useScreenManagement(projectId: string | undefined): ScreenManagement {
  const [generatedScreens, setGeneratedScreens] = useState<GeneratedScreen[]>([])
  const [activeGeneratedId, setActiveGeneratedId] = useState<string | null>(null)
  const [editingScreenLabel, setEditingScreenLabel] = useState<string | null>(null)
  const [editingScreenLabelValue, setEditingScreenLabelValue] = useState('')
  const [projectMessages, setProjectMessages] = useState<ChatMessage[]>([])
  const [projectName, setProjectName] = useState('Untitled Project')
  const [projectDeviceId, setProjectDeviceIdState] = useState<DeviceId>(DEFAULT_DEVICE)
  const [connections, setConnections] = useState<FlowConnection[]>([])
  const [screensLoaded, setScreensLoaded] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectionsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectLoadedRef = useRef(false)
  const hasTreeRef = useRef(false)

  const activeGenerated = generatedScreens.find(s => s.id === activeGeneratedId)
  const generatedTree = activeGenerated?.tree
  hasTreeRef.current = !!generatedTree
  const hasScreens = generatedScreens.length > 0

  // Device is a project-level setting; per-screen overrides (legacy) are
  // ignored at read time so all screens render at the same device. The
  // `screens.device_id` column stays in the DB schema for backward-compat
  // but the UI no longer surfaces a per-screen picker — there's a single
  // source of truth in PreviewToolbar.
  const activeDeviceId: DeviceId = projectDeviceId

  // Load project data from Supabase
  useEffect(() => {
    if (!projectId) return
    const loadProject = async () => {
      if (!supabase) return
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()
      if (project) {
        setProjectName(project.name || 'Untitled Project')
        // Resolve legacy IDs (e.g. "iphone-standard" → "iphone-16") at read
        // time so the device dropdown's `d.id === deviceId` highlight check
        // works for old projects. Writes always go out as canonical IDs.
        setProjectDeviceIdState(resolveDeviceId(project.device_id || DEFAULT_DEVICE) as DeviceId)
        if (Array.isArray(project.connections)) {
          setConnections(project.connections as FlowConnection[])
        }
      }

      const { data: screens } = await supabase
        .from('screens')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true })
      if (screens && screens.length > 0) {
        const loaded: GeneratedScreen[] = screens.map(s => {
          const rawDeviceId = (s as Record<string, unknown>).device_id as string | undefined
          const imageUrl = (s as Record<string, unknown>).image_url as string | undefined
          return {
            id: s.id,
            name: s.name,
            tree: s.component_tree as ComponentNode,
            originalPrompt: s.original_prompt ?? s.prompt ?? undefined,
            source: (s.source as 'web' | 'mcp') ?? 'web',
            x: (s as Record<string, unknown>).x_pos as number | undefined,
            y: (s as Record<string, unknown>).y_pos as number | undefined,
            // Resolve legacy IDs at load (see project.device_id load above).
            deviceId: rawDeviceId ? (resolveDeviceId(rawDeviceId) as DeviceId) : undefined,
            imageUrl: imageUrl ?? undefined,
          }
        })

        // Defensive filter: drop orphaned placeholder rows. AI generation
        // creates a placeholder screen with an empty `{type:'View',children:[]}`
        // tree that the auto-save effect persists to Supabase before
        // generation completes. On success, the placeholder is removed
        // from local state AND deleted from Supabase (see useAIGeneration).
        // But projects generated before that delete shipped — or projects
        // where the post-success delete failed — still have orphan rows.
        // Without this filter, the orphan ends up at order_index 0 and
        // gets selected as the active screen, leaving the user with a
        // blank phone preview.
        const isOrphanPlaceholder = (s: GeneratedScreen) => {
          if (s.type === 'image' || s.imageUrl) return false
          const t = s.tree
          if (!t) return true
          if (t.type !== 'View') return false
          return !t.children || t.children.length === 0
        }
        const realScreens = loaded.filter(s => !isOrphanPlaceholder(s))
        const orphanIds = loaded.filter(s => isOrphanPlaceholder(s)).map(s => s.id)

        setGeneratedScreens(realScreens)
        setActiveGeneratedId(realScreens[0]?.id ?? null)

        // Cleanup pass: delete the orphan rows so they don't accumulate.
        // Best-effort — log on failure; the filter above keeps the UI
        // clean either way.
        if (orphanIds.length > 0 && supabase) {
          try {
            const { error } = await supabase.from('screens').delete().in('id', orphanIds)
            if (error) console.error('[mokkoi] orphan cleanup failed:', error.message)
          } catch (err) {
            console.error('[mokkoi] orphan cleanup threw:', err)
          }
        }
      }

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
          // Plan-mode metadata (may be undefined / empty for pre-Plan rows).
          metadata: (m.metadata && typeof m.metadata === 'object' && Object.keys(m.metadata).length > 0)
            ? m.metadata
            : undefined,
        }))
        setProjectMessages(loaded)
      }

      projectLoadedRef.current = true
      setScreensLoaded(true)
    }
    loadProject()
  }, [projectId])

  // Realtime subscription: listen for MCP-generated screens appearing on the canvas
  useEffect(() => {
    if (!projectId) return

    if (!supabase) return
    const channel = supabase
      .channel(`screens:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'screens',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const newScreen = payload.new as Record<string, unknown>
          // Only process screens from MCP (avoid duplicating our own inserts)
          if (newScreen.source !== 'mcp') return

          const screen: GeneratedScreen = {
            id: newScreen.id as string,
            name: newScreen.name as string,
            tree: newScreen.component_tree as ComponentNode,
            originalPrompt: (newScreen.original_prompt ?? newScreen.prompt ?? undefined) as string | undefined,
            source: 'mcp',
            x: (newScreen.x_pos as number) ?? undefined,
            y: (newScreen.y_pos as number) ?? undefined,
            deviceId: (newScreen.device_id as DeviceId) || undefined,
          }

          setGeneratedScreens(prev => {
            // Don't add if already exists
            if (prev.some(s => s.id === screen.id)) return prev
            return [...prev, screen]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'screens',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>
          if (updated.source !== 'mcp') return

          setGeneratedScreens(prev =>
            prev.map(s =>
              s.id === updated.id
                ? {
                    ...s,
                    name: updated.name as string,
                    tree: updated.component_tree as ComponentNode,
                    source: 'mcp',
                  }
                : s
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase!.removeChannel(channel)
    }
  }, [projectId])

  // Save all screens to Supabase (direct client-side upsert — no serverless function needed)
  const saveScreensNow = useCallback(async () => {
    if (!projectId || !projectLoadedRef.current || !supabase) return
    for (let i = 0; i < generatedScreens.length; i++) {
      const s = generatedScreens[i]
      try {
        const { error } = await supabase.from('screens').upsert({
          id: s.id,
          project_id: projectId,
          name: s.name,
          component_tree: s.tree,
          original_prompt: s.originalPrompt ?? null,
          order_index: i,
          source: s.source ?? 'web',
          x_pos: s.x ?? null,
          y_pos: s.y ?? null,
          // Per-screen device override (writes canonical IDs only — legacy
          // values are resolved at read time in the load effect above).
          // Without this, picking a different phone in the toolbar would
          // update local state but never persist; refresh would revert
          // to the project default.
          device_id: s.deviceId ?? null,
          updated_at: new Date().toISOString(),
        })
        if (error) {
          console.error('[auto-save] screen upsert failed:', s.id, s.name, error.message)
        }
      } catch (err) {
        console.error('[auto-save] screen save error:', s.id, s.name, err)
      }
    }
    const { error: projErr } = await supabase.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId)
    if (projErr) console.error('[auto-save] project update failed:', projErr)
  }, [generatedScreens, projectId])

  // Auto-save screens to Supabase (debounced)
  useEffect(() => {
    if (!projectId || !projectLoadedRef.current || !supabase) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { saveScreensNow() }, 2000)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [generatedScreens, projectId, saveScreensNow])

  // Flush pending saves before page unload (prevents data loss on refresh)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        // Use sendBeacon for reliable save on unload
        if (projectId && projectLoadedRef.current && supabase && generatedScreens.length > 0) {
          // Synchronous upsert attempt — navigator.sendBeacon not suitable for Supabase,
          // so we fire-and-forget the async save (browser gives ~2-3s for beforeunload handlers)
          saveScreensNow()
        }
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveScreensNow, projectId, generatedScreens])

  const saveProjectName = useCallback(async (name: string) => {
    if (!projectId || !supabase) return
    await supabase.from('projects').update({ name, updated_at: new Date().toISOString() }).eq('id', projectId)
  }, [projectId])

  // Auto-save connections (debounced)
  useEffect(() => {
    if (!projectId || !supabase || !projectLoadedRef.current) return
    if (connectionsSaveRef.current) clearTimeout(connectionsSaveRef.current)
    const sb = supabase
    connectionsSaveRef.current = setTimeout(async () => {
      if (!sb) return
      await sb.from('projects').update({ connections }).eq('id', projectId)
    }, 1000)
    return () => { if (connectionsSaveRef.current) clearTimeout(connectionsSaveRef.current) }
  }, [connections, projectId])

  const addConnection = useCallback((from: string, to: string) => {
    setConnections(prev => {
      // Don't add duplicate or self-connections
      if (from === to) return prev
      if (prev.some(c => c.fromScreenId === from && c.toScreenId === to)) return prev
      return [...prev, { fromScreenId: from, toScreenId: to }]
    })
  }, [])

  const removeConnection = useCallback((idx: number) => {
    setConnections(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const saveMessage = useCallback(async (msg: ChatMessage) => {
    if (!projectId || !supabase) return
    await supabase.from('messages').insert({
      id: msg.id,
      project_id: projectId,
      role: msg.role,
      content: msg.content,
      image_url: msg.imageData ?? null,
      // Plan-mode metadata (chips, extracted, ready_to_build, summary).
      // Default to {} so the column's NOT NULL constraint is honored on
      // pre-Plan-mode rows that never set this.
      metadata: msg.metadata ?? {},
    })
  }, [projectId])

  /** Calculate the next available position for a new screen (right of all existing screens) */
  const getNextScreenPosition = useCallback((): { x: number; y: number } => {
    if (generatedScreens.length === 0) return { x: PAD_X, y: PAD_Y }
    let maxRight = 0
    generatedScreens.forEach((s, i) => {
      const { CANVAS_W } = getCanvasDimensions(projectDeviceId)
      const sx = s.x ?? (PAD_X + i * (CANVAS_W + GAP))
      const right = sx + CANVAS_W
      if (right > maxRight) maxRight = right
    })
    return { x: maxRight + GAP, y: PAD_Y }
  }, [generatedScreens, projectDeviceId])

  /** Update project default device and persist to Supabase */
  const setProjectDeviceId = useCallback((id: DeviceId) => {
    setProjectDeviceIdState(id)
    if (projectId && supabase) {
      supabase.from('projects').update({ device_id: id, updated_at: new Date().toISOString() }).eq('id', projectId).then()
    }
  }, [projectId])

  /** Change a specific screen's device */
  const setScreenDeviceId = useCallback((screenId: string, newDeviceId: DeviceId) => {
    setGeneratedScreens(prev => prev.map(s =>
      s.id === screenId ? { ...s, deviceId: newDeviceId } : s
    ))
  }, [])

  const handleDuplicateScreen = useCallback(() => {
    if (!activeGenerated) return
    const dupPos = getNextScreenPosition()
    const newScreen: GeneratedScreen = {
      id: crypto.randomUUID(),
      name: `${activeGenerated.name} (copy)`,
      tree: JSON.parse(JSON.stringify(activeGenerated.tree)),
      flowId: activeGenerated.flowId,
      deviceId: activeGenerated.deviceId,
      ...dupPos,
    }
    setGeneratedScreens(prev => [...prev, newScreen])
    setActiveGeneratedId(newScreen.id)
  }, [activeGenerated, getNextScreenPosition])

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

  const handleDeleteScreen = useCallback(async () => {
    if (!activeGeneratedId || !projectId || !supabase) return
    await supabase.from('screens').delete().eq('id', activeGeneratedId)
    setGeneratedScreens(prev => prev.filter(s => s.id !== activeGeneratedId))
    setActiveGeneratedId(null)
  }, [activeGeneratedId, projectId])

  return {
    generatedScreens,
    activeGeneratedId,
    activeGenerated,
    generatedTree,
    hasScreens,
    screensLoaded,
    editingScreenLabel,
    editingScreenLabelValue,
    setGeneratedScreens,
    setActiveGeneratedId,
    setEditingScreenLabel,
    setEditingScreenLabelValue,
    handleDuplicateScreen,
    handleRenameScreen,
    commitScreenRename,
    handleDeleteScreen,
    projectMessages,
    setProjectMessages,
    projectName,
    setProjectName,
    saveMessage,
    saveProjectName,
    projectLoadedRef,
    hasTreeRef,
    getNextScreenPosition,
    projectDeviceId,
    setProjectDeviceId,
    setScreenDeviceId,
    activeDeviceId,
    connections,
    setConnections,
    addConnection,
    removeConnection,
  }
}
