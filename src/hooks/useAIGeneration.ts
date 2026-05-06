import { useState, useCallback, useRef } from 'react'
import type { ComponentNode } from '../types/mokkoi'
import type { ChatMessage } from '../components/ChatPanel'
import { supabase } from '../lib/supabase'
import { trackEvent } from '../lib/analytics'
import type { GeneratedScreen } from './useScreenManagement'
import type { VariationSettings } from '../components/VariationsPanel'
import { GAP } from '../components/FlowConnectors'
import { getCanvasDimensions } from '../constants/devices'
import type { DeviceId } from '../constants/devices'

// Intent detection regexes. The old substring lists (e.g. 'build an app', 'flow')
// missed common phrasing like "Build a food delivery app" — 'build a X app' never
// matched 'build an app', so a multi-screen prompt routed to single-screen generation.
// These regexes require a create verb + article + an optional short modifier run +
// an app-category noun (or literal 'flow'), which matches natural phrasing reliably.

// Short-circuit: if the user explicitly names a single-screen artifact, skip app/flow
// routing — UNLESS the prompt also matches APP_INTENT_PATTERN, in which case the
// "build an app" framing wins. Resolves the v1 edge where "build a todo app with
// a stats screen" routed single-screen because it mentioned the word "screen".
const SINGLE_SCREEN_NOUN_PATTERN = /\b(screen|page|card|modal|dialog|widget|state|component|form|section|popup|tooltip|banner|header|footer|sidebar)\b/i

// App-category nouns cover the common archetypes users actually ask for. Expanded
// per product review to include podcast/music clients, wallets, reader/book apps,
// content hubs/feeds, and studio-style tools.
const APP_INTENT_PATTERN = /\b(build|create|make|design|generate)\s+(?:me\s+)?(?:a|an)\s+(?:\S+\s+){0,4}\b(app|tracker|dashboard|platform|tool|manager|planner|organizer|journal|diary|client|player|wallet|reader|book|hub|feed|studio)\b/i

const FLOW_INTENT_PATTERN = /\b(build|create|make|design|generate)\s+(?:me\s+)?(?:a|an)\s+(?:\S+\s+){0,4}\bflow\b/i

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

// Exported for unit testing (src/hooks/__tests__/intent-detection.test.ts).
// Keep in lock-step with the regex patterns above.
export function isAppPrompt(prompt: string): boolean {
  // App intent ("Build a fitness tracker app …") wins over single-screen-noun
  // mentions inside the same prompt. Only treat as single-screen when the
  // prompt names a single-screen artifact AND lacks app intent (e.g. "Design
  // a login screen"). This unblocks prompts like "build a habit tracking app
  // with a stats screen" that previously short-circuited to 1 screen.
  if (APP_INTENT_PATTERN.test(prompt)) return true
  if (SINGLE_SCREEN_NOUN_PATTERN.test(prompt)) return false
  return false
}

export function isFlowPrompt(prompt: string): boolean {
  return FLOW_INTENT_PATTERN.test(prompt)
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

// Returns a chat-ready string. Error returns are prefixed with "Error: " so
// ChatPanel's startsWith('Error:') check colors them red and shows Try Again.
// Cancellation is NOT an error and intentionally returns no prefix.
function getUserFriendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('rate limit') || message.includes('429') || message.includes('credits'))
    return "Error: You've run out of credits. Upgrade your plan or wait for monthly reset."
  if (message.includes('401') || message.includes('unauthorized') || message.includes('auth'))
    return 'Error: Your session has expired. Please sign in again.'
  if (message.includes('timeout') || message.includes('504') || message.includes('TIMEOUT'))
    return 'Error: Generation took too long. Please try a simpler prompt or try again.'
  if (message.includes('500') || message.includes('502') || message.includes('503'))
    return 'Error: Our servers are experiencing issues. Please try again in a moment.'
  if (message.includes('network') || message.includes('fetch') || message.includes('Failed to fetch'))
    return 'Error: Network error. Please check your connection and try again.'
  if (message.includes('overloaded') || message.includes('capacity'))
    return 'Error: AI is experiencing high demand. Please try again in a moment.'
  if (message.includes('payment') || message.includes('stripe') || message.includes('checkout'))
    return 'Error: Payment processing error. Please try again or contact support.'
  if (message.includes('Missing or invalid prompt'))
    return 'Error: Please provide a screen description and try again.'
  if (message.includes('AI_BRIEF_ONLY_NO_JSON') || message.includes('AI returned invalid JSON'))
    return 'Error: The AI got stuck mid-response. Please try regenerating.'
  if (
    message.includes('Failed to parse generated screens') ||
    message.includes('Failed to parse app plan') ||
    message.includes('Generation hit length limit')
  )
    return 'Error: The AI got tangled up generating your app. Try again — usually works on retry.'
  if (message.includes('abort') || message.includes('cancel'))
    return 'Generation cancelled.'

  // Show the actual error for debugging — don't hide behind generic messages
  if (message.length > 10 && message.length < 200)
    return `Error: ${message}`

  return 'Error: Something went wrong. Please try again.'
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
  isStreaming: boolean
  streamingText: string
  partialTree: ComponentNode | null
  appPhase: 'idle' | 'planning' | 'generating'
  appProgress: { current: number; total: number } | null

  handleSend: (prompt: string, images?: Array<{ data: string; mimeType: string }>, forceNew?: boolean, regenerateTree?: ComponentNode) => Promise<void>
  handleRegenerate: () => void
  handleGenerateVariations: (settings: VariationSettings) => Promise<void>
  handleGenerateFromImage: (screen: GeneratedScreen) => void
  handleStopGenerating: () => void
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
  getNextScreenPosition: () => { x: number; y: number }
  addConnection: (from: string, to: string) => void
  deviceId: DeviceId
  /** Open the paywall modal — called when the backend emits an SSE 'paywall' event */
  onPaywall?: () => void
  /** Fired after a successful app generation so the navbar count can refresh */
  onAppGenerated?: () => void
  /** Current project name (used to detect auto-derived prompt-slice names) */
  projectName?: string
  /** Update the navbar title locally */
  setProjectName?: React.Dispatch<React.SetStateAction<string>>
  /** Persist the project name to Supabase */
  saveProjectName?: (name: string) => Promise<void>
}

/** Build conversation history from recent messages for Claude context */
function buildConversationHistory(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  // Take last 5 non-error messages, skip any with image data (too large)
  const eligible = messages.filter(m =>
    !m.imageData && !(m.role === 'assistant' && m.content.startsWith('Error:'))
  )
  return eligible.slice(-5).map(m => ({
    role: m.role,
    content: m.role === 'assistant'
      ? m.content // assistant messages are already summaries like "Generated Screen 1: Login"
      : m.content,
  }))
}

export function useAIGeneration(deps: AIGenerationDeps): AIGeneration {
  const {
    projectId,
    activeGeneratedId,
    activeGenerated,
    generatedScreens,
    setGeneratedScreens,
    setActiveGeneratedId,
    projectMessages,
    setProjectMessages,
    saveMessage,
    setToastMessage,
    setShowVariationsPanel,
    getNextScreenPosition,
    addConnection,
    deviceId,
    onPaywall,
    onAppGenerated,
    projectName,
    setProjectName,
    saveProjectName,
  } = deps

  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [partialTree, setPartialTree] = useState<ComponentNode | null>(null)
  const [appPhase, setAppPhase] = useState<'idle' | 'planning' | 'generating'>('idle')
  const [appProgress, setAppProgress] = useState<{ current: number; total: number } | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleSend = useCallback(async (prompt: string, images?: Array<{ data: string; mimeType: string }>, forceNew?: boolean, regenerateTree?: ComponentNode) => {
    // Clear any previous error messages
    setProjectMessages(prev => {
      const lastMsg = prev[prev.length - 1]
      if (lastMsg?.role === 'assistant' && lastMsg.content.startsWith('Error:')) {
        return prev.slice(0, -1)
      }
      return prev
    })

    // Cap images at 4 defensively (UI also enforces).
    const imagesArr = Array.isArray(images) ? images.slice(0, 4) : []
    const hasImages = imagesArr.length > 0
    // Legacy callers stored a single base64 string on the chat message.
    // Preserve the same shape (first image) for in-conversation thumbnails.
    const firstImageData = hasImages ? imagesArr[0].data : undefined

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      imageData: firstImageData,
    }

    setProjectMessages(prev => [...prev, userMsg])
    saveMessage(userMsg)

    const startTime = Date.now()
    const flowRequest = isFlowPrompt(prompt) && !hasImages

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

    // App generation — "Build me a fitness app" type prompts
    // Reference images are now supported on the multi-screen path — they
    // inform visual style of the planner + screen generation. Domain still
    // comes from the user's text prompt (see REFERENCE_INSPIRATION_BLOCK in
    // api/generate-flow.ts).
    const appRequest = isAppPrompt(prompt) && !editingScreen
    if (appRequest) {
      const placeholderId = crypto.randomUUID()
      const placeholderName = prompt.length > 25 ? prompt.slice(0, 25) + '...' : prompt
      const nextPos = getNextScreenPosition()
      const placeholderScreen: GeneratedScreen = {
        id: placeholderId,
        name: placeholderName,
        originalPrompt: prompt,
        tree: { type: 'View', style: {}, children: [] },
        deviceId,
        ...nextPos,
      }
      setGeneratedScreens(prev => [...prev, placeholderScreen])
      setActiveGeneratedId(placeholderId)
      setIsGenerating(true)
      setAppPhase('planning')
      setAppProgress(null)

      try {
        const authHeaders = await getAuthHeaders()
        const conversationHistory = buildConversationHistory(projectMessages)
        const res = await fetch('/api/generate-flow', {
          method: 'POST',
          headers: { ...authHeaders, 'Accept': 'text/event-stream' },
          body: JSON.stringify({ mode: 'app', prompt, projectId, conversationHistory, deviceId, images: imagesArr }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Failed to generate app')
        }

        // Read SSE stream
        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''
        let allScreens: Array<{ id: string; name: string; tree: ComponentNode }> = []
        let connections: Array<{ fromScreenId: string; toScreenId: string }> = []
        let homeScreenId = ''
        let appName = ''
        let modelUsed = ''
        let paywallHit = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr || jsonStr === '[DONE]') continue

            try {
              const event = JSON.parse(jsonStr)

              if (event.type === 'status') {
                setAppPhase(event.phase || 'generating')
                if (event.current != null && event.total != null) {
                  setAppProgress({ current: event.current, total: event.total })
                }
              } else if (event.type === 'screen') {
                allScreens.push(event.screen)
              } else if (event.type === 'complete') {
                allScreens = event.screens || allScreens
                connections = event.connections || []
                homeScreenId = event.homeScreenId || ''
                appName = event.appName || ''
                modelUsed = event.modelUsed || ''
              } else if (event.type === 'paywall') {
                // Free-tier limit hit. Not an error — surface the upgrade modal
                // instead of an error toast, drop the placeholder, and stop
                // reading the stream cleanly.
                paywallHit = true
                trackEvent('paywall_triggered')
                onPaywall?.()
              } else if (event.type === 'error') {
                throw new Error(event.message)
              }
            } catch (parseErr) {
              // Skip unparseable SSE lines
              if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
                if (parseErr.message.startsWith('Failed') || parseErr.message.startsWith('AI')) {
                  throw parseErr
                }
              }
            }
          }

          if (paywallHit) break
        }

        if (paywallHit) {
          setGeneratedScreens(prev => prev.filter(s => s.id !== placeholderId))
          if (projectId && supabase) {
            try {
              await supabase.from('screens').delete().eq('id', placeholderId)
            } catch (err) {
              console.error('[mokkoi] failed to delete placeholder screen', placeholderId, err)
            }
          }
          return
        }

        if (allScreens.length === 0) {
          throw new Error('No screens were generated')
        }

        // Calculate grid positions for screens
        const { CANVAS_W, CANVAS_H } = getCanvasDimensions(deviceId)
        const cols = allScreens.length <= 4 ? allScreens.length : Math.ceil(allScreens.length / 2)
        const appScreens: GeneratedScreen[] = allScreens.map((s, i) => ({
          id: s.id,
          name: s.name,
          tree: s.tree,
          originalPrompt: prompt,
          deviceId,
          x: nextPos.x + (i % cols) * (CANVAS_W + GAP),
          y: nextPos.y + Math.floor(i / cols) * (CANVAS_H + GAP + 50),
        }))

        // Replace placeholder with actual screens
        setGeneratedScreens(prev => {
          const withoutPlaceholder = prev.filter(s => s.id !== placeholderId)
          return [...withoutPlaceholder, ...appScreens]
        })

        // Delete the placeholder row from Supabase. The auto-save effect
        // persists it during the (multi-second) generation, so removing it
        // from local state isn't enough — without this, on the next page
        // load the empty-tree row gets fetched back as `loaded[0]` and
        // selected as the active screen, leaving the user with a blank
        // phone preview. Best-effort: log on failure; the load-time filter
        // in useScreenManagement is the safety net.
        if (projectId && supabase) {
          try {
            await supabase.from('screens').delete().eq('id', placeholderId)
          } catch (err) {
            console.error('[mokkoi] failed to delete placeholder screen', placeholderId, err)
          }
        }

        // Select home screen
        const homeScreen = appScreens.find(s => s.id === homeScreenId) || appScreens[0]
        setActiveGeneratedId(homeScreen.id)

        // Auto-create flow connections
        for (const conn of connections) {
          addConnection(conn.fromScreenId, conn.toScreenId)
        }

        // Auto-rename the project from the auto-derived prompt-slice (e.g.
        // "Build a meal planning app with") to the planner's clean appName
        // (e.g. "MealPlan"). Only fires when the current name still matches
        // the prompt-slice — i.e. the user hasn't manually renamed.
        // Dashboard.tsx and AuthPage.tsx both seed projects.name with
        // `prompt.trim().slice(0, 30)`, so that's our auto-derived signature.
        const autoDerivedName = prompt.trim().slice(0, 30)
        if (
          appName &&
          appName !== projectName &&
          projectName === autoDerivedName &&
          setProjectName &&
          saveProjectName
        ) {
          setProjectName(appName)
          try {
            await saveProjectName(appName)
          } catch (err) {
            console.error('[mokkoi] failed to auto-rename project', err)
          }
        }

        // Chat message
        const screenNames = appScreens.map(s => s.name)
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Generated ${appName || 'your app'} with ${allScreens.length} screens: ${screenNames.join(' \u2192 ')}`,
          timestamp: Date.now(),
          flowScreenNames: screenNames,
          modelUsed,
        }
        setProjectMessages(prev => [...prev, assistantMsg])
        saveMessage(assistantMsg)
        trackEvent('app_generated', { screen_count: allScreens.length, generation_time_ms: Date.now() - startTime })
        onAppGenerated?.()
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: getUserFriendlyError(err),
          timestamp: Date.now(),
        }
        setProjectMessages(prev => [...prev, errorMsg])
        saveMessage(errorMsg)
        // Remove placeholder on error
        setGeneratedScreens(prev => prev.filter(s => s.id !== placeholderId))
      } finally {
        setIsGenerating(false)
        setAppPhase('idle')
        setAppProgress(null)
      }
      return
    }

    // Flow generation
    if (flowRequest && !editingScreen) {
      const placeholderId = crypto.randomUUID()
      const placeholderName = prompt.length > 20 ? prompt.slice(0, 20) + '...' : prompt
      const nextPos = getNextScreenPosition()
      const placeholderScreen: GeneratedScreen = {
        id: placeholderId,
        name: placeholderName,
        originalPrompt: prompt,
        tree: { type: 'View', style: {}, children: [] },
        deviceId,
        ...nextPos,
      }
      setGeneratedScreens(prev => [...prev, placeholderScreen])
      setActiveGeneratedId(placeholderId)
      setIsGenerating(true)

      try {
        const authHeaders = await getAuthHeaders()
        const conversationHistory = buildConversationHistory(projectMessages)
        const res = await fetch('/api/generate-flow', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ prompt, projectId, conversationHistory }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Failed to generate flow')
        }

        const { screens, modelUsed: flowModelUsed } = await res.json()
        const flowId = crypto.randomUUID()
        const screenNames = (screens as Array<{ id: string; name: string; tree: ComponentNode }>).map((s: { name: string }) => s.name)

        const newFlowScreens: GeneratedScreen[] = (screens as Array<{ id: string; name: string; tree: ComponentNode }>).map((s: { id: string; name: string; tree: ComponentNode }, i: number) => ({
          id: crypto.randomUUID(),
          name: s.name,
          tree: s.tree,
          flowId,
          deviceId,
          x: nextPos.x + i * (getCanvasDimensions(deviceId).CANVAS_W + GAP),
          y: nextPos.y,
        }))

        setGeneratedScreens(prev => {
          const withoutPlaceholder = prev.filter(s => s.id !== placeholderId)
          return [...withoutPlaceholder, ...newFlowScreens]
        })
        setActiveGeneratedId(newFlowScreens[0].id)

        // Delete the placeholder row from Supabase (see app-generation
        // path above for the rationale).
        if (projectId && supabase) {
          try {
            await supabase.from('screens').delete().eq('id', placeholderId)
          } catch (err) {
            console.error('[mokkoi] failed to delete placeholder screen', placeholderId, err)
          }
        }

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
        trackEvent('flow_generated', { screen_count: screens.length, generation_time_ms: Date.now() - startTime })
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: getUserFriendlyError(err),
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
      const singlePos = getNextScreenPosition()
      const newScreen: GeneratedScreen = {
        id: targetId,
        name: screenName,
        originalPrompt: prompt,
        tree: { type: 'View', style: {}, children: [] },
        deviceId,
        ...singlePos,
      }
      setGeneratedScreens(prev => [...prev, newScreen])
      setActiveGeneratedId(targetId)
    }

    setIsGenerating(true)
    setIsStreaming(true)
    setStreamingText('')
    setPartialTree(null)

    // Create AbortController for cancellation
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const authHeaders = await getAuthHeaders()
      const conversationHistory = buildConversationHistory(projectMessages)
      const requestBody = {
        prompt,
        projectId,
        conversationHistory,
        deviceId,
        ...(editingScreen ? { currentScreen: editingScreen.tree, screenId: editingScreenId } : {}),
        ...(regenerateTree ? { currentScreen: regenerateTree, screenName: screenName } : {}),
        ...(hasImages ? {
          images: imagesArr,
          // Legacy fields for backward-compat with the older API contract.
          imageData: imagesArr[0].data,
          imageMimeType: imagesArr[0].mimeType || 'image/png',
        } : {}),
      }

      const res = await fetch('/api/generate?stream=true', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate screen')
      }

      // Read SSE stream
      const reader = res.body?.getReader()
      if (!reader) throw new Error('Streaming not supported')

      const decoder = new TextDecoder()
      let fullText = ''
      let finalTree: ComponentNode | null = null
      let finalModelUsed = ''
      let sseBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          if (!data) continue

          try {
            const event = JSON.parse(data)
            if (event.type === 'text') {
              fullText += event.content
              setStreamingText(fullText)
            } else if (event.type === 'partial_tree') {
              setPartialTree(event.tree)
            } else if (event.type === 'complete') {
              finalTree = event.tree
              finalModelUsed = event.modelUsed || ''
            } else if (event.type === 'error') {
              throw new Error(event.message || 'Generation failed')
            }
          } catch (parseErr) {
            // If it's a rethrown error, propagate it
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr
            }
          }
        }
      }

      if (!finalTree) throw new Error('No component tree received')

      setGeneratedScreens(prev => prev.map(s =>
        s.id === targetId ? { ...s, tree: finalTree! } : s
      ))

      const action = editingScreen ? 'Updated' : 'Generated'
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `${action} Screen ${screenNumber}: ${screenName}`,
        timestamp: Date.now(),
        modelUsed: finalModelUsed,
      }
      setProjectMessages(prev => [...prev, assistantMsg])
      saveMessage(assistantMsg)
      trackEvent('screen_generated', { is_edit: Boolean(editingScreen), generation_time_ms: Date.now() - startTime, streaming: true })
    } catch (err) {
      // Don't show error for user-initiated cancellation
      if (err instanceof DOMException && err.name === 'AbortError') {
        trackEvent('generation_cancelled')
        const cancelMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Generation cancelled.',
          timestamp: Date.now(),
        }
        setProjectMessages(prev => [...prev, cancelMsg])
        saveMessage(cancelMsg)
      } else {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: getUserFriendlyError(err),
          timestamp: Date.now(),
        }
        setProjectMessages(prev => [...prev, errorMsg])
        saveMessage(errorMsg)
      }
    } finally {
      abortControllerRef.current = null
      setIsGenerating(false)
      setIsStreaming(false)
      setStreamingText('')
      setPartialTree(null)
    }
  }, [activeGeneratedId, generatedScreens, saveMessage, projectId, projectMessages, setGeneratedScreens, setActiveGeneratedId, setProjectMessages, onPaywall, onAppGenerated, projectName, setProjectName, saveProjectName])

  const handleRegenerate = useCallback(() => {
    if (!activeGenerated) return
    const originalPrompt = activeGenerated.originalPrompt
      || activeGenerated.name.replace(/\s*v\d+/gi, '').replace(/\s*\(failed\)/gi, '').trim()
      || 'this mobile app screen'
    const regeneratePrompt = `Regenerate this screen with a fresh design approach. Original request: "${originalPrompt}"`
    handleSend(regeneratePrompt, undefined, true, activeGenerated.tree)
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
    const varPos = getNextScreenPosition()
    for (let i = 0; i < settings.count; i++) {
      const ph: GeneratedScreen = {
        id: crypto.randomUUID(),
        name: `${activeGenerated.name} v${i + 1}`,
        originalPrompt: activeGenerated.originalPrompt,
        tree: { type: 'View', style: {}, children: [] },
        deviceId,
        x: varPos.x + i * (getCanvasDimensions(deviceId).CANVAS_W + GAP),
        y: varPos.y,
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

  const handleStopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  const handleGenerateFromImage = useCallback((screen: GeneratedScreen) => {
    if (!screen.imageUrl) return
    const match = screen.imageUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return
    const [, mimeType, base64] = match
    handleSend('Recreate this screen design', [{ data: base64, mimeType }], true)
  }, [handleSend])

  return {
    isGenerating,
    isGeneratingVariations,
    isStreaming,
    streamingText,
    partialTree,
    appPhase,
    appProgress,
    handleSend,
    handleRegenerate,
    handleGenerateVariations,
    handleGenerateFromImage,
    handleStopGenerating,
  }
}
