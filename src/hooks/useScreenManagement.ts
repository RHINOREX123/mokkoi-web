import { useState, useCallback, useRef, useEffect } from 'react'
import type { ComponentNode } from '../types/mokkoi'
import { supabase } from '../lib/supabase'
import type { ChatMessage } from '../components/ChatPanel'
import { GAP, PAD_X, PAD_Y } from '../components/FlowConnectors'
import { DEFAULT_DEVICE, getCanvasDimensions } from '../constants/devices'
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

}

export function useScreenManagement(projectId: string | undefined): ScreenManagement {
  const [generatedScreens, setGeneratedScreens] = useState<GeneratedScreen[]>([])
  const [activeGeneratedId, setActiveGeneratedId] = useState<string | null>(null)
  const [editingScreenLabel, setEditingScreenLabel] = useState<string | null>(null)
  const [editingScreenLabelValue, setEditingScreenLabelValue] = useState('')
  const [projectMessages, setProjectMessages] = useState<ChatMessage[]>([])
  const [projectName, setProjectName] = useState('Untitled Project')
  const [projectDeviceId, setProjectDeviceIdState] = useState<DeviceId>(DEFAULT_DEVICE)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectLoadedRef = useRef(false)
  const hasTreeRef = useRef(false)

  const activeGenerated = generatedScreens.find(s => s.id === activeGeneratedId)
  const generatedTree = activeGenerated?.tree
  hasTreeRef.current = !!generatedTree
  const hasScreens = generatedScreens.length > 0

  // Active screen's device, falling back to project default
  const activeDeviceId: DeviceId = (activeGenerated?.deviceId as DeviceId) || projectDeviceId

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
        setProjectDeviceIdState((project.device_id as DeviceId) || DEFAULT_DEVICE)
      }

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
          originalPrompt: s.original_prompt ?? s.prompt ?? undefined,
          source: (s.source as 'web' | 'mcp') ?? 'web',
          x: (s as Record<string, unknown>).x_pos as number | undefined,
          y: (s as Record<string, unknown>).y_pos as number | undefined,
          deviceId: ((s as Record<string, unknown>).device_id as DeviceId) || undefined,
        }))
        setGeneratedScreens(loaded)
        setActiveGeneratedId(loaded[0].id)
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
        }))
        setProjectMessages(loaded)
      }

      projectLoadedRef.current = true
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

  // Auto-save screens to Supabase (debounced)
  useEffect(() => {
    if (!projectId || !projectLoadedRef.current || !supabase) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const sb = supabase
    saveTimerRef.current = setTimeout(async () => {
      for (let i = 0; i < generatedScreens.length; i++) {
        const s = generatedScreens[i]
        await sb.from('screens').upsert({
          id: s.id,
          project_id: projectId,
          name: s.name,
          component_tree: s.tree,
          original_prompt: s.originalPrompt ?? null,
          order_index: i,
          updated_at: new Date().toISOString(),
          source: s.source ?? 'web',
          x_pos: s.x ?? null,
          y_pos: s.y ?? null,
          device_id: s.deviceId ?? DEFAULT_DEVICE,
        })
      }
      await sb.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId)
    }, 2000)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [generatedScreens, projectId])

  const saveProjectName = useCallback(async (name: string) => {
    if (!projectId || !supabase) return
    await supabase.from('projects').update({ name, updated_at: new Date().toISOString() }).eq('id', projectId)
  }, [projectId])

  const saveMessage = useCallback(async (msg: ChatMessage) => {
    if (!projectId || !supabase) return
    await supabase.from('messages').insert({
      id: msg.id,
      project_id: projectId,
      role: msg.role,
      content: msg.content,
      image_url: msg.imageData ?? null,
    })
  }, [projectId])

  /** Calculate the next available position for a new screen (right of all existing screens) */
  const getNextScreenPosition = useCallback((): { x: number; y: number } => {
    if (generatedScreens.length === 0) return { x: PAD_X, y: PAD_Y }
    let maxRight = 0
    generatedScreens.forEach((s, i) => {
      const screenDevice = s.deviceId || projectDeviceId
      const { CANVAS_W } = getCanvasDimensions(screenDevice)
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
  }
}
