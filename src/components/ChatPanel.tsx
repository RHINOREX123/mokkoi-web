import { useState, useRef, useEffect } from 'react'
import type { ComponentNode } from '../types/mokkoi'
import { ScreenRenderer } from './ScreenRenderer'
import { convertTreeToTSX } from '../utils/exportTsx'
import { useUserPlan } from '../hooks/useUserPlan'
import ChipRow from './ChipRow'
import { VoiceMicButton } from './VoiceMicButton'
import { getAuthHeaders } from '../lib/authHeaders'

export interface PlanExtracted {
  domain: string | null
  primary_action: string | null
  vibe: string | null
  screens: string[] | null
  brand: string | null
}

export interface PlanMessageMetadata {
  /** Suggested 2-3 reply chips emitted by the Haiku planner */
  chips?: string[]
  /** Latest extracted snapshot ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â drives <PlanSummaryCard> */
  extracted?: PlanExtracted
  /** When true, planner has enough info to build */
  ready_to_build?: boolean
  /** 2-3 sentence build prompt; passed to /api/generate-flow on Build click */
  summary?: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  /** Base64 image data for screenshot messages */
  imageData?: string
  /** Screen names for flow messages (clickable links) */
  flowScreenNames?: string[]
  /** Which model generated this response (e.g. "Sonnet", "Haiku") */
  modelUsed?: string
  /** Plan-mode metadata (chips, extracted, ready_to_build, summary).
   *  Present on assistant messages emitted by /api/plan-conversation. */
  metadata?: PlanMessageMetadata
}

interface ChatPanelProps {
  messages: ChatMessage[]
  onSend: (prompt: string, images?: Array<{ data: string; mimeType: string }>) => void
  onExportCode?: () => void
  isGenerating: boolean
  isStreaming?: boolean
  streamingText?: string
  initialPrompt?: string
  /** Optional reference images attached on the dashboard via the Camera icon
   *  (up to 4). When set together with initialPrompt, the auto-send on mount
   *  fires with both the prompt and the images. Empty array = none. */
  initialImages?: Array<{ data: string; mediaType: string; fileName: string }>
  /** Callback when user clicks a screen name in a flow message */
  onFlowScreenClick?: (screenName: string) => void
  /** Whether any screens have been generated (hides example cards) */
  hasScreens?: boolean
  /** Whether screens have been fetched from Supabase (guards initial prompt) */
  screensLoaded?: boolean
  /** Name of the currently selected screen on canvas */
  selectedScreenName?: string
  /** Component tree of the currently selected screen (for thumbnail) */
  selectedScreenTree?: ComponentNode
  /** Callback when user clicks the screen thumbnail to scroll to it */
  onSelectedScreenClick?: () => void
  /** Callback to deselect the current screen */
  onDeselectScreen?: () => void
  /** Incrementing trigger to programmatically focus the chat input */
  focusTrigger?: number
  /** Callback to cancel in-progress generation */
  onStopGenerating?: () => void
  /** App generation phase (planning ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ generating) */
  appPhase?: 'idle' | 'planning' | 'generating'
  /** App generation progress (current/total screens) */
  appProgress?: { current: number; total: number } | null
  /** True when the user submitted from the dashboard's Plan toggle.
   *  Routes input to onPlanSend instead of onSend, renders a "Build my app"
   *  button in the chat header, and (when chips are present on the latest
   *  assistant message) renders ChipRow under it. */
  planMode?: boolean
  /** Plan-mode message handler ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â POST /api/plan-conversation. Required when
   *  planMode is true; ignored otherwise. */
  onPlanSend?: (userMessage: string) => void
  /** Sticky once Haiku emits ready_to_build:true; drives Build CTA glow. */
  readyToBuildLatched?: boolean
  /** Click handler for the Plan-mode Build button ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â feeds the latest summary
   *  into the build pipeline via handleSend(summary, ..., forceAppMode:true).
   *  Receives any images the user attached during the planning conversation
   *  (or from the dashboard's Camera button via initialImages). Build pipeline
   *  forwards them to /api/generate-flow as visual references. */
  onBuildFromPlan?: (images?: Array<{ data: string; mimeType: string }>) => void
  /** Whether the latest planning turn is in flight (drives chip disabled state). */
  planInflight?: boolean
  /** True when a server-side generation is running but this client did not
   *  start it ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â i.e., we navigated back to a project mid-stream, or this is
   *  a second tab observing live progress. Drives the "Resuming generationÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦"
   *  indicator above the regular generating UI. */
  resumingRun?: boolean
  /** Surfaces voice-flow errors (no_speech, mic denied, transcription failed)
   *  to the parent's toast system. Without this wired, the orb tears down
   *  silently when the user says nothing. */
  onVoiceError?: (message: string) => void
}

const PLACEHOLDERS = [
  'Ask Mokkoi…',
]

/** Human-readable timestamp under message labels in plan mode.
 *  - <1min: "now"
 *  - <60min: "5 min ago"
 *  - <24h:   "2:13 PM"
 *  - older:  "May 7 Ãƒâ€šÃ‚Â· 2:13 PM"
 *  Pattern adapted from Rocket's chat panel. */
function formatTimestamp(ts: number): string {
  const now = Date.now()
  const diffMs = now - ts
  if (diffMs < 60_000) return 'now'
  if (diffMs < 60 * 60_000) return `${Math.floor(diffMs / 60_000)} min ago`
  const d = new Date(ts)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (diffMs < 24 * 60 * 60_000) return time
  const monthDay = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return `${monthDay} · ${time}`
}

// (V1's EXAMPLE_CARDS \u2014 Fitness Dashboard / Login Screen / Chat Interface /
//  Product Page / App Flow \u2014 removed. Mokkoi has shifted from a single-screen
//  design tool to an app builder; landing on a fresh project page should not
//  push generic single-screen suggestions. Users either arrive with a prompt
//  (from the dashboard) or get a quiet "describe what to build" empty state.)

const QUICK_SUGGESTIONS = [
  'Make it darker',
  'Add more sections',
  'Change accent color',
  'Add bottom tabs',
  'Copy as TSX',
  'Copy JSON',
]

const GENERATING_STEPS = [
  { text: 'Understanding your design...', icon: 'brain' },
  { text: 'Creating components...', icon: 'build' },
  { text: 'Applying styles and tokens...', icon: 'paint' },
]

export function ChatPanel({ messages, onSend, onExportCode, isGenerating, isStreaming, streamingText, initialPrompt, initialImages, onFlowScreenClick, hasScreens, screensLoaded, selectedScreenName, selectedScreenTree, onSelectedScreenClick, onDeselectScreen, focusTrigger, onStopGenerating, appPhase, appProgress, planMode, onPlanSend, readyToBuildLatched, onBuildFromPlan, planInflight, resumingRun, onVoiceError }: ChatPanelProps) {
  // Plan-mode banner ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â dismissible, local state only. App.tsx strips the
  // ?mode=plan param on mount, so a refresh does NOT re-show the banner;
  // dismiss is effectively per-page-load. That's intentional: the banner is
  // a one-time announcement of the user's mode choice, not a persistent
  // status indicator.
  const [planBannerDismissed, setPlanBannerDismissed] = useState(false)
  const [input, setInput] = useState('')
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const [placeholderVisible, setPlaceholderVisible] = useState(true)
  const [genStep, setGenStep] = useState(0)
  // Multi-image attachment in the chat input. Up to MAX_IMAGES ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â matches the
  // dashboard PromptCard's Camera button behavior. Tapping the paperclip
  // multiple times APPENDS rather than REPLACES; user can also remove
  // individual thumbnails before sending.
  const MAX_IMAGES = 4
  type ChatImage = { data: string; name: string; mediaType: string }
  const [attachedImages, setAttachedImages] = useState<ChatImage[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const initialPromptHandled = useRef(false)
  const { plan } = useUserPlan()

  // Cycle placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderVisible(false)
      setTimeout(() => {
        setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length)
        setPlaceholderVisible(true)
      }, 300)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Multi-step generating progress
  useEffect(() => {
    if (!isGenerating) {
      setGenStep(0)
      return
    }
    setGenStep(0)
    const t1 = setTimeout(() => setGenStep(1), 2000)
    const t2 = setTimeout(() => setGenStep(2), 4000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isGenerating])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating])

  // Focus input when focusTrigger changes
  useEffect(() => {
    if (focusTrigger && focusTrigger > 0) {
      chatInputRef.current?.focus()
    }
  }, [focusTrigger])

  // Listen for external input text events (from toolbar actions)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.text) {
        setInput(detail.text)
        setTimeout(() => chatInputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('mokkoi-set-chat-input', handler)
    return () => window.removeEventListener('mokkoi-set-chat-input', handler)
  }, [])

  // Handle initial prompt from URL ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â only for NEW projects (no existing screens)
  // MUST wait for screensLoaded to avoid race condition: hasScreens is false before
  // Supabase fetch completes, which would incorrectly trigger generation on existing projects.
  const onSendRef = useRef(onSend)
  onSendRef.current = onSend
  const onPlanSendRef = useRef(onPlanSend)
  onPlanSendRef.current = onPlanSend
  useEffect(() => {
    if (!screensLoaded) return // Wait for Supabase fetch to complete
    if (initialPrompt && !initialPromptHandled.current && !hasScreens) {
      initialPromptHandled.current = true
      // Plan mode: route the very first prompt to the Haiku planner
      // (/api/plan-conversation), NOT the build pipeline. Without this branch
      // the auto-send fires onSend(prompt) which short-circuits the entire
      // conversational flow into a direct generation.
      //
      // Images attached on the dashboard (via Camera button) get held in the
      // chat-input attachedImages state instead of immediately dispatched.
      // Haiku is text-only, so images don't reach the planner ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â they ride
      // through to the build step when user clicks "Build my app". The chat
      // input shows them as thumbnails so the user knows they're queued.
      if (planMode && onPlanSendRef.current) {
        if (initialImages && initialImages.length > 0) {
          setAttachedImages(initialImages.map(img => ({
            data: img.data,
            name: img.fileName,
            mediaType: img.mediaType,
          })))
        }
        onPlanSendRef.current(initialPrompt)
        return
      }
      // If the dashboard handed off reference images alongside the prompt,
      // dispatch all of them so the very first generation sees full context.
      const wrapped =
        initialImages && initialImages.length > 0
          ? initialImages.map((img) => ({ data: img.data, mimeType: img.mediaType }))
          : undefined
      onSendRef.current(initialPrompt, wrapped)
    }
  }, [initialPrompt, initialImages, hasScreens, screensLoaded, planMode])

  const handleSend = () => {
    const hasAttached = attachedImages.length > 0
    const prompt = input.trim() || (hasAttached ? 'Recreate this screen design' : '')
    if ((!prompt && !hasAttached) || isGenerating) return
    setInput('')
    // Plan mode: route free-text to /api/plan-conversation. Haiku is text-only,
    // so attached images don't reach the planner ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â but they're held in state
    // and ride through to the build step when user clicks "Build my app".
    if (planMode && onPlanSend && !hasAttached) {
      onPlanSend(prompt)
      return
    }
    const wrapped = hasAttached
      ? attachedImages.map(img => ({ data: img.data, mimeType: img.mediaType }))
      : undefined
    setAttachedImages([])
    onSend(prompt, wrapped)
  }

  // Voice transcription bypass: skip the input field, send straight to
  // the same pipeline handleSend uses. Mirrors handleSend's mode-routing
  // (plan vs build) so voice has identical semantics to typed prompts.
  const handleVoiceTranscribed = (text: string) => {
    if (!text.trim()) {
      onVoiceError?.("We didn't hear that — try again")
      return
    }
    if (isGenerating) return
    const hasAttached = attachedImages.length > 0
    if (planMode && onPlanSend && !hasAttached) {
      onPlanSend(text.trim())
      return
    }
    const wrapped = hasAttached
      ? attachedImages.map(img => ({ data: img.data, mimeType: img.mediaType }))
      : undefined
    setAttachedImages([])
    onSend(text.trim(), wrapped)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    e.target.value = ''

    // Append (don't replace). Cap at MAX_IMAGES total. Each file is read
    // independently because FileReader is async; setState callback ensures
    // we don't race when multiple files load in different ticks.
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1]
        const mediaType = file.type || 'image/png'
        setAttachedImages(prev => {
          if (prev.length >= MAX_IMAGES) return prev
          return [...prev, { data: base64, name: file.name, mediaType }]
        })
      }
      reader.readAsDataURL(file)
    })
  }

  const handleSuggestionClick = async (s: string) => {
    if (s === 'Copy as TSX' && selectedScreenTree) {
      const tsx = convertTreeToTSX(selectedScreenTree, selectedScreenName, { addWatermark: plan === 'free' })
      await navigator.clipboard.writeText(tsx)
      // Dispatch a toast event
      window.dispatchEvent(new CustomEvent('mokkoi-toast', { detail: { message: 'React Native code copied!' } }))
      return
    }
    if (s === 'Copy JSON' && selectedScreenTree) {
      await navigator.clipboard.writeText(JSON.stringify(selectedScreenTree, null, 2))
      window.dispatchEvent(new CustomEvent('mokkoi-toast', { detail: { message: 'JSON copied to clipboard!' } }))
      return
    }
    if (s === 'Export code') {
      if (onExportCode) {
        onExportCode()
      }
      return
    }
    onSend(s)
  }

  // Check if the last message is an assistant (non-error) message ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â show suggestions.
  // In plan mode, the per-message Haiku chips replace these generic edit-screen
  // suggestions ("Make it darker", "Copy as TSX", etc.); suppress them.
  const lastMsg = messages[messages.length - 1]
  const showSuggestions = !planMode && lastMsg?.role === 'assistant' && !lastMsg.content.startsWith('Error:') && !lastMsg.flowScreenNames && !isGenerating

  // Show example cards only when zero screens AND zero messages
  const showExampleCards = messages.length === 0 && !isGenerating && !hasScreens

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes mokkoi-buildbtn-pulse {
          0%, 100% { box-shadow: 0 4px 16px -4px rgba(45,212,191,0.55); }
          50%      { box-shadow: 0 6px 22px -4px rgba(167,139,250,0.65); }
        }
        @keyframes mokkoi-build-card-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mokkoi-msg-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mokkoi-name-shift {
          from { background-position: 0% 0%; }
          to   { background-position: 200% 0%; }
        }
        @keyframes mokkoi-avatar-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(45,212,191,0), 0 0 0 0 rgba(167,139,250,0); }
          50%      { box-shadow: 0 0 0 4px rgba(45,212,191,0.16), 0 0 16px 0 rgba(167,139,250,0.18); }
        }
        @keyframes mokkoi-bubble-shine {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes mokkoi-typing-dot {
          0%, 60%, 100% { transform: scale(0.6); opacity: 0.4; }
          30%           { transform: scale(1.0); opacity: 1; }
        }
      `}</style>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Messages area - scrollable */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Plan-mode banner ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â purely informational. The generation pipeline
            doesn't yet behave differently in Plan mode (that's the future
            conversational-intent task); this banner exists so the surface
            matches the user's expectation that they're in Plan mode. */}
        {planMode && !planBannerDismissed && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(167,139,250,0.08)',
              border: '1px solid rgba(167,139,250,0.28)',
              color: '#e2e8f0',
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#a78bfa',
                boxShadow: '0 0 8px rgba(167,139,250,0.7)',
                flexShrink: 0,
                marginTop: 5,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: '#c4b5fd', marginBottom: 2 }}>
                Plan mode
              </div>
              <div style={{ color: '#94a3b8' }}>
                Mokkoi will ask clarifying questions before generating.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPlanBannerDismissed(true)}
              aria-label="Dismiss plan mode banner"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 2,
                fontSize: 14,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Plan-mode skip-ahead link ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â small, unobtrusive, top of panel.
            Only appears at turn 4+ (substantial conversation underway) AND
            before ready_to_build fires. Once Mokkoi flags ready, the inline
            featured Build card below the latest message takes over.
            User feedback yesterday: header button at turn 1 was distracting
            and forced scroll-up to reach. Now hidden early, surfaced only
            when escape-hatch is genuinely useful. */}
        {planMode && onBuildFromPlan && !readyToBuildLatched && !isGenerating
          && messages.filter(m => m.role === 'user').length >= 4 && (
          <button
            type="button"
            onClick={() => onBuildFromPlan(
              attachedImages.length > 0
                ? attachedImages.map(img => ({ data: img.data, mimeType: img.mediaType }))
                : undefined
            )}
            style={{
              alignSelf: 'flex-end',
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.55)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'DM Sans', system-ui, sans-serif",
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(45,212,191,0.4)'
              e.currentTarget.style.color = '#5eead4'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
            }}
          >
            Build now →
          </button>
        )}

        {/* Empty state ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â quiet hint, no generic template buttons. The user
            most often lands here with a prompt already in the URL from the
            dashboard, which immediately starts generation. The empty state
            only shows on truly-blank projects. */}
        {showExampleCards && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            padding: '0 24px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#F1F5F9',
              fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
              letterSpacing: '-0.01em',
            }}>
              What would you like to build?
            </div>
            <div style={{
              fontSize: 13,
              color: '#64748B',
              lineHeight: 1.55,
              maxWidth: 320,
            }}>
              Describe your app below — the more specific you are about screens
              and the user, the better Mokkoi can shape the first build.
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={msg.id}>
            {/* Plan-mode messages get Variant B styling: gradient-bordered
                Mokkoi bubbles, asymmetric corners, gradient name with shift
                animation, soft avatar glow, timestamp under name. Non-plan
                messages keep the existing minimal layout to avoid disrupting
                the build-mode UX. */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              animation: 'mokkoi-msg-in 280ms ease-out',
            }}>
              {/* Label row ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â for plan mode, add timestamp; assistant gets
                  pulse glow on the avatar and gradient-shift on the name. */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 4,
              }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, #2dd4bf, #a78bfa)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 800, color: '#fff',
                    animation: 'mokkoi-avatar-glow 3.2s ease-in-out infinite',
                  }}>
                    M
                  </div>
                )}
                {msg.role === 'assistant' ? (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    background: 'linear-gradient(90deg, #2dd4bf, #a78bfa, #2dd4bf)',
                    backgroundSize: '200% 100%',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                    animation: 'mokkoi-name-shift 6s linear infinite',
                  }}>
                    MOKKOI
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: '#555', fontWeight: 500 }}>
                    You
                  </span>
                )}
                <span style={{
                  fontSize: 10,
                  color: 'rgba(148,163,184,0.5)',
                  fontWeight: 400,
                  marginLeft: 4,
                }}>
                  {formatTimestamp(msg.timestamp)}
                </span>
              </div>

              {/* Message content ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â gradient bubble in plan mode, plain in build. */}
              <div style={{
                maxWidth: '92%',
                fontSize: 13,
                lineHeight: 1.6,
                color: msg.content.startsWith('Error:') ? '#f87171' : '#e2e8f0',
                ...(msg.role === 'assistant' && !msg.content.startsWith('Error:') ? {
                  // Gradient-bordered bubble for Mokkoi (used in both plan and build now)
                  padding: '12px 14px',
                  borderRadius: '16px 16px 16px 4px',
                  background:
                    'linear-gradient(rgba(15,15,15,1), rgba(15,15,15,1)) padding-box,' +
                    ' linear-gradient(135deg, rgba(45,212,191,0.55), rgba(167,139,250,0.55)) border-box',
                  border: '1px solid transparent',
                  position: 'relative' as const,
                  overflow: 'hidden' as const,
                } : {}),
                ...(msg.role === 'user' ? {
                  // Tinted right-leaning bubble for user (used in both plan and build now)
                  padding: '10px 14px',
                  borderRadius: '16px 16px 4px 16px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                } : {}),
              }}>
                {/* Subtle shimmer sweep across Mokkoi bubbles in plan mode.
                    7s loop ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â slow enough to feel premium, not jittery. */}
                {msg.role === 'assistant' && !msg.content.startsWith('Error:') && (
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)',
                      animation: 'mokkoi-bubble-shine 7s ease-in-out infinite',
                      pointerEvents: 'none',
                    }}
                  />
                )}
                {/* Show attached image thumbnail in user messages */}
                {msg.imageData && (
                  <div style={{ marginBottom: 8 }}>
                    <img
                      src={`data:image/png;base64,${msg.imageData}`}
                      alt="Attached screenshot"
                      style={{
                        maxWidth: '100%',
                        maxHeight: 120,
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    />
                  </div>
                )}
                {msg.content}

                {/* Retry button for errors */}
                {msg.content.startsWith('Error:') && idx > 0 && (() => {
                  const prevUserMsg = [...messages].slice(0, idx).reverse().find(m => m.role === 'user')
                  if (!prevUserMsg) return null
                  return (
                    <button
                      onClick={() => onSend(
                        prevUserMsg.content,
                        prevUserMsg.imageData
                          ? [{ data: prevUserMsg.imageData, mimeType: 'image/png' }]
                          : undefined
                      )}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        marginTop: 8, padding: '4px 10px', borderRadius: 6,
                        background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                        color: '#f87171', fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.15)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
                    >
                      Try again
                    </button>
                  )
                })()}

                {/* Model indicator removed ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â felt dev-toolish ("via Haiku" /
                    "via Sonnet" exposed implementation detail to end users).
                    Keep the modelUsed field on ChatMessage for telemetry; just
                    don't render it. */}

                {/* Flow screen names as clickable links */}
                {msg.flowScreenNames && msg.flowScreenNames.length > 0 && (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10,
                  }}>
                    {msg.flowScreenNames.map(name => (
                      <button
                        key={name}
                        onClick={() => onFlowScreenClick?.(name)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 500,
                          color: '#a5b4fc',
                          background: 'rgba(99,102,241,0.12)',
                          border: '1px solid rgba(99,102,241,0.25)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(99,102,241,0.25)'
                          e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(99,102,241,0.12)'
                          e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick suggestion pills after last assistant message */}
            {idx === messages.length - 1 && showSuggestions && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {QUICK_SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSuggestionClick(s)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#94a3b8',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
                      e.currentTarget.style.color = '#e2e8f0'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                      e.currentTarget.style.color = '#94a3b8'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Plan-mode chips ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â render under the latest assistant message that
            has chip suggestions. Only shown when planMode is active and the
            user is mid-conversation. Chips are SUGGESTIONS, not constraints ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
            free text always works via the input below. */}
        {planMode && onPlanSend && (() => {
          // Latest assistant message with chips. Earlier turns' chips are
          // intentionally not rendered (would create a stale forest of chips).
          let latestChipMsg: ChatMessage | null = null
          for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i]
            if (m.role === 'assistant' && m.metadata?.chips && m.metadata.chips.length > 0) {
              latestChipMsg = m
              break
            }
          }
          if (!latestChipMsg) return null
          // Hide chips once Build is the natural next action ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â keep input free.
          if (readyToBuildLatched) return null
          return (
            <div style={{ marginTop: -4, marginLeft: 24 }}>
              <ChipRow
                chips={latestChipMsg.metadata!.chips!}
                onTap={(chip) => onPlanSend(chip)}
                disabled={planInflight === true || isGenerating}
              />
            </div>
          )
        })()}

        {/* Inline-featured Build card ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â appears as a "Suggested next step"
            below the latest Mokkoi message once readyToBuildLatched fires.
            Replaces the old persistent header button. User scrolls naturally
            to the bottom of the conversation and finds this prominent
            affordance. Pattern borrowed from Rocket's "Suggested next step"
            cards. */}
        {planMode && onBuildFromPlan && readyToBuildLatched && !isGenerating && (
          <div
            style={{
              marginTop: 4,
              padding: 14,
              borderRadius: 14,
              background:
                'linear-gradient(rgba(13,13,13,1), rgba(13,13,13,1)) padding-box,' +
                ' linear-gradient(135deg, rgba(45,212,191,0.55), rgba(167,139,250,0.55)) border-box',
              border: '1px solid transparent',
              boxShadow: '0 0 24px -8px rgba(45,212,191,0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              animation: 'mokkoi-build-card-in 320ms ease-out',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: 'rgba(94,234,212,0.85)',
              }}
            >
              ✨ Suggested next step
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: '#e2e8f0' }}>
              I have everything I need to start building. Want to ship it?
            </div>
            <button
              type="button"
              onClick={() => onBuildFromPlan(
                attachedImages.length > 0
                  ? attachedImages.map(img => ({ data: img.data, mimeType: img.mediaType }))
                  : undefined
              )}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #2dd4bf, #a78bfa)',
                color: '#001a1f',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'DM Sans', system-ui, sans-serif",
                transition: 'transform 0.18s, box-shadow 0.18s',
                boxShadow: '0 4px 16px -4px rgba(45,212,191,0.55)',
                animation: 'mokkoi-buildbtn-pulse 2.4s ease-in-out infinite',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 8px 22px -4px rgba(45,212,191,0.7)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 16px -4px rgba(45,212,191,0.55)'
              }}
            >
              Build my app →
            </button>
          </div>
        )}

        {/* Multi-step generating indicator with streaming text */}
        {isGenerating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            {/* Label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 800, color: '#fff',
              }}>
                M
              </div>
              <span style={{ fontSize: 11, color: '#555', fontWeight: 500 }}>Mokkoi</span>
            </div>

            {isStreaming && streamingText ? (
              /* Streaming text preview */
              <div style={{ maxWidth: '90%' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#818CF8',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                  <span style={{ fontSize: 11, color: '#818CF8', fontWeight: 500 }}>
                    Streaming response...
                  </span>
                  <span style={{ fontSize: 10, color: '#64748B' }}>
                    {(streamingText.length / 1000).toFixed(1)}k chars
                  </span>
                </div>
                <div style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: '#64748B',
                  maxHeight: 80,
                  overflow: 'hidden',
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {streamingText.length > 200
                    ? streamingText.slice(streamingText.length - 200)
                    : streamingText}
                  <span style={{ color: '#818CF8', animation: 'blink 1s step-end infinite' }}>|</span>
                </div>
              </div>
            ) : appPhase && appPhase !== 'idle' ? (
              /* App generation progress (planning ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ generating screens) */
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                minWidth: 200,
              }}>
                {resumingRun && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 11, color: '#94a3b8',
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'rgba(129,140,248,0.08)',
                    border: '1px solid rgba(129,140,248,0.18)',
                    alignSelf: 'flex-start',
                    marginBottom: 2,
                  }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <circle cx="5" cy="5" r="3" fill="#818CF8">
                        <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                    </svg>
                    Resuming generation
                  </div>
                )}
                {/* Step 1: Planning */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  opacity: 1,
                }}>
                  {appPhase === 'generating' ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="7" fill="rgba(52,211,153,0.2)" />
                      <path d="M4 7l2 2 4-4" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" className="animate-spin" style={{ animationDuration: '1.5s' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  )}
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    Planning your app...
                  </span>
                </div>
                {/* Step 2: Generating screens */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  opacity: appPhase === 'generating' ? 1 : 0.3,
                }}>
                  {appPhase === 'generating' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" className="animate-spin" style={{ animationDuration: '1.5s' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  ) : (
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.15)' }} />
                  )}
                  <span style={{ fontSize: 12, color: appPhase === 'generating' ? '#94a3b8' : '#3e4a5e' }}>
                    {appProgress ? `Generating screens (${appProgress.current}/${appProgress.total})...` : 'Generating screens...'}
                  </span>
                </div>
              </div>
            ) : (
              /* Step-based progress (before stream starts) */
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                minWidth: 200,
              }}>
                {GENERATING_STEPS.map((step, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    opacity: i <= genStep ? 1 : 0.3,
                    transition: 'opacity 0.3s ease',
                  }}>
                    {i < genStep ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="7" fill="rgba(52,211,153,0.2)" />
                        <path d="M4 7l2 2 4-4" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : i === genStep ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" className="animate-spin" style={{ animationDuration: '1.5s' }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                    ) : (
                      <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.15)' }} />
                    )}
                    <span style={{ fontSize: 12, color: i <= genStep ? '#94a3b8' : '#3e4a5e' }}>
                      {step.text}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Stop generating button */}
            {onStopGenerating && (
              <button
                onClick={onStopGenerating}
                style={{
                  marginTop: 10,
                  padding: '5px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#f87171',
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(248,113,113,0.15)'
                  e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(248,113,113,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(248,113,113,0.2)'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="2" y="2" width="8" height="8" rx="1.5" fill="#f87171" />
                </svg>
                Stop generating
              </button>
            )}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#0c0c0e' }}>
        {/* Selected screen indicator with thumbnail */}
        {selectedScreenName && (
          <div style={{
            marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(129,140,248,0.15)',
            borderRadius: 10,
          }}>
            {/* Mini screen thumbnail */}
            {selectedScreenTree && (
              <div
                onClick={onSelectedScreenClick}
                title="Click to scroll to screen"
                style={{
                  width: 36, height: 64, borderRadius: 8,
                  overflow: 'hidden', flexShrink: 0,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: '#0F172A',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div style={{
                  transform: 'scale(0.112)',
                  transformOrigin: 'top left',
                  width: 320, height: 568,
                  pointerEvents: 'none',
                }}>
                  <ScreenRenderer tree={selectedScreenTree} />
                </div>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, color: '#64748B', fontWeight: 500,
                marginBottom: 2,
              }}>
                Editing
              </div>
              <div style={{
                fontSize: 12, color: '#f1f5f9', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {selectedScreenName}
              </div>
            </div>
            {/* Deselect button */}
            {onDeselectScreen && (
              <button
                onClick={onDeselectScreen}
                title="Deselect screen"
                style={{
                  width: 20, height: 20, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#64748B', fontSize: 12, cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                &times;
              </button>
            )}
          </div>
        )}
        {/* Attached images preview ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â supports up to MAX_IMAGES thumbnails.
            Each has its own remove button. The paperclip button below appends
            to this row up to the cap. Plan mode also routes images here from
            the dashboard via `initialImages`. */}
        {attachedImages.length > 0 && (
          <div style={{
            marginBottom: 10,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            padding: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
          }}>
            {attachedImages.map((img, i) => (
              <div
                key={`${img.name}-${i}`}
                style={{
                  position: 'relative',
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)',
                  flexShrink: 0,
                }}
                title={img.name}
              >
                <img
                  src={`data:${img.mediaType};base64,${img.data}`}
                  alt={img.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Remove ${img.name}`}
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    fontSize: 11,
                    lineHeight: 1,
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: 11,
              color: '#64748B',
              padding: '0 4px',
            }}>
              {attachedImages.length} of {MAX_IMAGES} attached
              {planMode && ' · used as visual reference at build'}
            </div>
          </div>
        )}

        {/* Ask Mokkoi header ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â sits just above the input bar so users see what
            this box does at a glance. The branded verb keeps Mokkoi front-of-mind. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 6, padding: '0 4px',
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
            background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800, color: '#fff',
            boxShadow: '0 1px 4px rgba(99,102,241,0.4)',
          }}>
            M
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600,
            background: 'linear-gradient(135deg, #818cf8, #c4b5fd)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: 0.2,
          }}>
            Ask Mokkoi
          </span>
        </div>

        <div className="chat-input-bar relative transition-all duration-200">
          <div className="flex items-center gap-2 px-4" style={{ height: 56 }}>
            {/* Attachment button */}
            <button
              title="Attach screenshot"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round">
                <path d="M8 3.5v9M3.5 8h9" />
              </svg>
            </button>

            {/* Voice input — premium magic flow: tap, speak, silence auto-stops, transcribe, send.
                No transcribed text shown; goes straight to handleVoiceTranscribed which mirrors handleSend's routing. */}
            <VoiceMicButton
              size="compact"
              disabled={isGenerating}
              getAuthHeaders={getAuthHeaders}
              onTranscribed={handleVoiceTranscribed}
              onError={onVoiceError}
            />

            <div className="flex-1 relative">
              <input
                ref={chatInputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
                className="w-full bg-transparent text-[14px] text-mokkoi-text outline-none disabled:opacity-50"
                style={{ caretColor: '#818cf8' }}
              />
              {!input && attachedImages.length === 0 && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none text-[14px] text-white/25 transition-opacity duration-300"
                  style={{ opacity: placeholderVisible ? 1 : 0 }}
                >
                  {PLACEHOLDERS[placeholderIdx]}
                </span>
              )}
              {!input && attachedImages.length > 0 && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none text-[14px] text-white/25">
                  Describe the screen, or press Generate
                </span>
              )}
            </div>

            {/* Generate button */}
            <button
              onClick={handleSend}
              disabled={(!input.trim() && attachedImages.length === 0) || isGenerating}
              className="shrink-0 flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed text-[13px] font-semibold text-white"
              style={{
                padding: '8px 20px',
                borderRadius: 10,
                background: (input.trim() || attachedImages.length > 0) && !isGenerating
                  ? 'linear-gradient(135deg, #2dd4bf, #06b6d4)'
                  : 'rgba(255,255,255,0.06)',
                boxShadow: (input.trim() || attachedImages.length > 0) && !isGenerating
                  ? '0 2px 12px rgba(99,102,241,0.2)'
                  : 'none',
              }}
              onMouseEnter={e => {
                if ((input.trim() || attachedImages.length > 0) && !isGenerating) {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.35)'
                }
              }}
              onMouseLeave={e => {
                if ((input.trim() || attachedImages.length > 0) && !isGenerating) {
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(99,102,241,0.2)'
                }
              }}
            >
              Generate
            </button>
          </div>
        </div>
        <div style={{ marginTop: 8, textAlign: 'center' as const, fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>
          Press Enter to send
        </div>
      </div>
    </div>
  )
}
