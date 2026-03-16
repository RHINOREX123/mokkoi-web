import { useState, useRef, useEffect } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ChatPanelProps {
  messages: ChatMessage[]
  onSend: (prompt: string) => void
  isGenerating: boolean
  initialPrompt?: string
}

const PLACEHOLDERS = [
  'A fitness dashboard with activity rings...',
  'A login screen with social auth...',
  'A chat interface with message bubbles...',
  'An e-commerce product page...',
  'A settings page with toggle switches...',
]

export function ChatPanel({ messages, onSend, isGenerating, initialPrompt }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const [placeholderVisible, setPlaceholderVisible] = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const initialPromptHandled = useRef(false)

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating])

  // Handle initial prompt from URL
  useEffect(() => {
    if (initialPrompt && !initialPromptHandled.current) {
      initialPromptHandled.current = true
      onSend(initialPrompt)
    }
  }, [initialPrompt, onSend])

  const handleSend = () => {
    const prompt = input.trim()
    if (!prompt || isGenerating) return
    setInput('')
    onSend(prompt)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Chat header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontSize: 13,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase' as const,
      }}>
        Chat
      </div>

      {/* Messages area - scrollable */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.length === 0 && !isGenerating && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            opacity: 0.4,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(129,140,248,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round">
                <path d="M4 10h12M10 4v12" />
              </svg>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' as const, lineHeight: 1.5 }}>
              Describe a mobile screen<br />to get started
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            {/* AI avatar */}
            {msg.role === 'assistant' && (
              <div style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800, color: '#fff',
              }}>
                M
              </div>
            )}
            <div
              style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                fontSize: 13,
                lineHeight: 1.5,
                ...(msg.role === 'user'
                  ? {
                      background: 'rgba(129,140,248,0.15)',
                      color: '#a5b4fc',
                    }
                  : msg.content.startsWith('Error:')
                    ? {
                        background: 'rgba(248,113,113,0.1)',
                        color: '#f87171',
                      }
                    : {
                        background: 'rgba(255,255,255,0.04)',
                        color: '#94a3b8',
                      }
                ),
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Generating indicator */}
        {isGenerating && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: '#fff',
            }}>
              M
            </div>
            <div style={{
              padding: '10px 14px',
              borderRadius: '14px 14px 14px 4px',
              background: 'rgba(255,255,255,0.04)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span className="inline-flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_infinite]" />
                <span className="w-1.5 h-1.5 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                <span className="w-1.5 h-1.5 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
              </span>
              <span style={{ fontSize: 13, color: '#556480', marginLeft: 4 }}>Generating...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input bar - always visible at bottom */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="chat-input-bar relative transition-all duration-200">
          <div className="flex items-center gap-3 px-5" style={{ height: 56 }}>
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
                className="w-full bg-transparent text-[14px] text-mokkoi-text outline-none disabled:opacity-50"
                style={{ caretColor: '#818cf8' }}
              />
              {!input && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none text-[14px] text-white/25 transition-opacity duration-300"
                  style={{ opacity: placeholderVisible ? 1 : 0 }}
                >
                  {PLACEHOLDERS[placeholderIdx]}
                </span>
              )}
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              className="shrink-0 h-9 px-4 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed text-[13px] font-semibold text-white"
              style={{
                background: input.trim() && !isGenerating
                  ? 'linear-gradient(135deg, #6366f1, #818cf8)'
                  : 'rgba(255,255,255,0.06)',
              }}
            >
              Generate
            </button>
          </div>
        </div>
        <div style={{ marginTop: 8, textAlign: 'center' as const, fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>
          Press Enter to send &middot; AI generates a mobile screen from your description
        </div>
      </div>
    </div>
  )
}
