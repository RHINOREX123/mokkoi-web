import { useState, useCallback } from 'react'
import type { ComponentNode } from '../types/mokkoi'
import type { ChatMessage } from '../components/ChatPanel'
import { supabase } from '../lib/supabase'
import type { GeneratedScreen } from './useScreenManagement'
import type { VariationSettings } from '../components/VariationsPanel'

const FLOW_KEYWORDS = [
  'flow', 'onboarding', 'walkthrough', 'multi-screen', 'complete app',
  'full app', 'series of screens', 'connected screens', 'user journey',
  'navigation flow', 'multi screen', 'multiple screens', 'screen flow',
  'app flow', 'checkout flow', 'signup flow', 'sign up flow',
]

const EDIT_KEYWORDS = [
  'change the', 'update the', 'modify', 'remove', 'add to', 'make it', 'make this',
  'replace', 'fix', 'adjust', 'tweak', 'edit', 'move', 'resize', 'recolor',
  'darker', 'lighter', 'bigger', 'smaller', 'delete',
  'recreate', 'with white', 'with black', 'with light', 'with dark',
  'white background', 'light theme', 'dark theme', 'light mode', 'dark mode',
  'this screen',
]

const CREATE_KEYWORDS = [
  'create a', 'create an', 'build a', 'build an', 'design a', 'design an',
  'generate a', 'generate an', 'new screen', 'make a new', 'make me a', 'make me an',
]

// Strong create signal: if prompt matches these patterns, ALWAYS create (never edit)
const STRONG_CREATE_PATTERN = /\b(create|build|design|generate)\s+(a|an|me)\b/i
const STRONG_NEW_PATTERN = /\bnew\b/i

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

/** Returns true if the prompt is unambiguously a create request, even if a screen is selected */
function isStrongCreateIntent(prompt: string): boolean {
  return STRONG_CREATE_PATTERN.test(prompt) || STRONG_NEW_PATTERN.test(prompt)
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) throw new Error('Not authenticated. Please sign in.')
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    throw new Error('Not authenticated. Please sign in.')
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export interface AIGeneration {
  isGenerating: boolean
  isGeneratingVariations: boolean

  handleSend: (prompt: string, imageData?: string, imageMimeType?: string, forceNew?: boolean, regenerateTree?: ComponentNode) => Promise<void>
  handleRegenerate: () => void
  handleGenerateVariations: (settings: VariationSettings) => Promise<void>
  handleGenerateFromImage: (screen: GeneratedScreen) => void
}

interface AIGenerationDeps {
  projectId: string | undefined
  activeGeneratedId: string | null
  activeGenerated: GeneratedScreen | undefined
  generatedScreens: GeneratedScreen[]
  setGeneratedScreens: React.Dispatch<React.SetStateAction<GeneratedScreen[]>>
  setActiveGeneratedId: React.Dispatch<React.SetStateAction<string | null>>
  projectMessages: ChatMessage[]
  setProjectMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  saveMessage: (msg: ChatMessage) => Promise<void>
  setToastMessage: (msg: string) => void
  setShowVariationsPanel: (show: boolean) => void
}

export function useAIGeneration(deps: AIGenerationDeps): AIGeneration {
  const {
    projectId,
    activeGeneratedId,
    activeGenerated,
    generatedScreens,
    setGeneratedScreens,
    setActiveGeneratedId,
    setProjectMessages,
    saveMessage,
    setToastMessage,
    setShowVariationsPanel,
  } = deps

  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false)

  const handleSend = useCallback(async (prompt: string, imageData?: string, imageMimeType?: string, forceNew?: boolean, regenerateTree?: ComponentNode) => {
    // Clear any previous error messages
    setProjectMessages(prev => {
      const lastMsg = prev[prev.length - 1]
      if (lastMsg?.role === 'assistant' && lastMsg.content.startsWith('Error:')) {
        return prev.slice(0, -1)
      }
      return prev
    })

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      imageData,
    }

    setProjectMessages(prev => [...prev, userMsg])
    saveMessage(userMsg)

    const flowRequest = isFlowPrompt(prompt) && !imageData

    // Intent detection: strong create signals always win over edit
    let editingScreenId: string | null = null
    if (!forceNew && activeGeneratedId) {
      // If prompt contains "new" or starts with "create/build/design/generate a", always create
      if (isStrongCreateIntent(prompt)) {
        editingScreenId = null
      } else {
        const hasEditIntent = isEditIntent(prompt)
        const hasCreateIntent = isCreateIntent(prompt)
        if (hasEditIntent && !hasCreateIntent) {
          editingScreenId = activeGeneratedId
        } else if (!hasEditIntent && hasCreateIntent) {
          editingScreenId = null
        } else if (!hasEditIntent && !hasCreateIntent) {
          // No clear intent — default to editing selected screen
          editingScreenId = activeGeneratedId
        } else {
          // Both edit and create detected but no strong create signal — default to edit
          editingScreenId = activeGeneratedId
        }
      }
    }

    const editingScreen = editingScreenId
      ? generatedScreens.find(s => s.id === editingScreenId)
      : null

    // Flow generation
    if (flowRequest && !editingScreen) {
      const placeholderId = crypto.randomUUID()
      const placeholderName = prompt.length > 20 ? prompt.slice(0, 20) + '...' : prompt
      const placeholderScreen: GeneratedScreen = {
        id: placeholderId,
        name: placeholderName,
        originalPrompt: prompt,
        tree: { type: 'View', style: {}, children: [] },
      }
      setGeneratedScreens(prev => [...prev, placeholderScreen])
      setActiveGeneratedId(placeholderId)
      setIsGenerating(true)

      try {
        const authHeaders = await getAuthHeaders()
        const res = await fetch('/api/generate-flow', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ prompt, projectId }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Failed to generate flow')
        }

        const { screens, modelUsed: flowModelUsed } = await res.json()
        const flowId = crypto.randomUUID()
        const screenNames = (screens as Array<{ id: string; name: string; tree: ComponentNode }>).map((s: { name: string }) => s.name)

        const newFlowScreens: GeneratedScreen[] = (screens as Array<{ id: string; name: string; tree: ComponentNode }>).map((s: { id: string; name: string; tree: ComponentNode }) => ({
          id: crypto.randomUUID(),
          name: s.name,
          tree: s.tree,
          flowId,
        }))

        setGeneratedScreens(prev => {
          const withoutPlaceholder = prev.filter(s => s.id !== placeholderId)
          return [...withoutPlaceholder, ...newFlowScreens]
        })
        setActiveGeneratedId(newFlowScreens[0].id)

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Generated a flow with ${screens.length} screens: ${screenNames.join(' \u2192 ')}`,
          timestamp: Date.now(),
          flowScreenNames: screenNames,
          modelUsed: flowModelUsed,
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

    // Single screen generation
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
        originalPrompt: prompt,
        tree: { type: 'View', style: {}, children: [] },
      }
      setGeneratedScreens(prev => [...prev, newScreen])
      setActiveGeneratedId(targetId)
    }

    setIsGenerating(true)

    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          prompt,
          projectId,
          ...(editingScreen ? { currentScreen: editingScreen.tree, screenId: editingScreenId } : {}),
          ...(regenerateTree ? { currentScreen: regenerateTree, screenName: screenName } : {}),
          ...(imageData ? { imageData, imageMimeType: imageMimeType || 'image/png' } : {}),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate screen')
      }

      const { tree, modelUsed } = await res.json()

      setGeneratedScreens(prev => prev.map(s =>
        s.id === targetId ? { ...s, tree } : s
      ))

      const action = editingScreen ? 'Updated' : 'Generated'
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `${action} Screen ${screenNumber}: ${screenName}`,
        timestamp: Date.now(),
        modelUsed,
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
  }, [activeGeneratedId, generatedScreens, saveMessage, projectId, setGeneratedScreens, setActiveGeneratedId, setProjectMessages])

  const handleRegenerate = useCallback(() => {
    if (!activeGenerated) return
    const originalPrompt = activeGenerated.originalPrompt
      || activeGenerated.name.replace(/\s*v\d+/gi, '').replace(/\s*\(failed\)/gi, '').trim()
      || 'this mobile app screen'
    const regeneratePrompt = `Regenerate this screen with a fresh design approach. Original request: "${originalPrompt}"`
    handleSend(regeneratePrompt, undefined, undefined, true, activeGenerated.tree)
  }, [activeGenerated, handleSend])

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

    const placeholders: GeneratedScreen[] = []
    for (let i = 0; i < settings.count; i++) {
      const ph: GeneratedScreen = {
        id: crypto.randomUUID(),
        name: `${activeGenerated.name} v${i + 1}`,
        originalPrompt: activeGenerated.originalPrompt,
        tree: { type: 'View', style: {}, children: [] },
      }
      placeholders.push(ph)
    }
    setGeneratedScreens(prev => [...prev, ...placeholders])
    setActiveGeneratedId(placeholders[0].id)

    const promises = placeholders.map(async (ph, i) => {
      const variationPrompt = `You are creating variation ${i + 1} of a mobile screen design.

Here is the original screen's component tree JSON:
${originalTree}

Creative direction: ${creativeDesc[settings.creativeRange]}
${aspectInstructions.length > 0 ? 'Aspects to change: ' + aspectInstructions.join(' ') : ''}
${settings.customInstructions ? 'Additional instructions: ' + settings.customInstructions : ''}

Generate a new version of this screen as a variation. Return ONLY the JSON component tree.`

      try {
        const authHeaders = await getAuthHeaders()
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ prompt: variationPrompt, projectId }),
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
  }, [activeGenerated, projectId, setGeneratedScreens, setActiveGeneratedId, setToastMessage, setShowVariationsPanel])

  const handleGenerateFromImage = useCallback((screen: GeneratedScreen) => {
    if (!screen.imageUrl) return
    const match = screen.imageUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return
    const [, mimeType, base64] = match
    handleSend('Recreate this screen design', base64, mimeType, true)
  }, [handleSend])

  return {
    isGenerating,
    isGeneratingVariations,
    handleSend,
    handleRegenerate,
    handleGenerateVariations,
    handleGenerateFromImage,
  }
}
