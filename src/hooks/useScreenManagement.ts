import { useState, useCallback, useRef, useEffect } from 'react'
import type { ComponentNode } from '../types/mokkoi'
import { supabase } from '../lib/supabase'
import type { ChatMessage } from '../components/ChatPanel'

export interface GeneratedScreen {
  id: string
  name: string
  tree: ComponentNode
  originalPrompt?: string
  flowId?: string
  type?: 'generated' | 'image'
  imageUrl?: string
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
}

export function useScreenManagement(projectId: string | undefined): ScreenManagement {
  const [generatedScreens, setGeneratedScreens] = useState<GeneratedScreen[]>([])
  const [activeGeneratedId, setActiveGeneratedId] = useState<string | null>(null)
  const [editingScreenLabel, setEditingScreenLabel] = useState<string | null>(null)
  const [editingScreenLabelValue, setEditingScreenLabelValue] = useState('')
  const [projectMessages, setProjectMessages] = useState<ChatMessage[]>([])
  const [projectName, setProjectName] = useState('Untitled Project')

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectLoadedRef = useRef(false)
  const hasTreeRef = useRef(false)

  const activeGenerated = generatedScreens.find(s => s.id === activeGeneratedId)
  const generatedTree = activeGenerated?.tree
  hasTreeRef.current = !!generatedTree
  const hasScreens = generatedScreens.length > 0

  // Load project data from Supabase
  useEffect(() => {
    if (!projectId) return
    const loadProject = async () => {
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()
      if (project) {
        setProjectName(project.name || 'Untitled Project')
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
          originalPrompt: s.original_prompt ?? undefined,
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

  // Auto-save screens to Supabase (debounced)
  useEffect(() => {
    if (!projectId || !projectLoadedRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      for (let i = 0; i < generatedScreens.length; i++) {
        const s = generatedScreens[i]
        await supabase.from('screens').upsert({
          id: s.id,
          project_id: projectId,
          name: s.name,
          component_tree: s.tree,
          original_prompt: s.originalPrompt ?? null,
          order_index: i,
          updated_at: new Date().toISOString(),
        })
      }
      await supabase.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId)
    }, 2000)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [generatedScreens, projectId])

  const saveProjectName = useCallback(async (name: string) => {
    if (!projectId) return
    await supabase.from('projects').update({ name, updated_at: new Date().toISOString() }).eq('id', projectId)
  }, [projectId])

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
  }, [activeGenerated])

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
    if (!activeGeneratedId || !projectId) return
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
  }
}
