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
  "What's on your mind?",
  'Describe your dream screen...',
  "Let's build something cool...",
  'What screen do you need?',
]

const EXAMPLE_CARDS = [
  { emoji: '\u{1F3CB}\uFE0F', title: 'Fitness Dashboard', desc: 'Activity rings & step counter', prompt: 'A fitness dashboard with activity rings, step counter, and calorie tracker' },
  { emoji: '\u{1F510}', title: 'Login Screen', desc: 'Email, password & social auth', prompt: 'A login screen with email, password fields and social auth buttons for Google and Apple' },
  { emoji: '\u{1F4AC}', title: 'Chat Interface', desc: 'Message bubbles & avatars', prompt: 'A chat interface with message bubbles, user avatars, and a message input bar' },
  { emoji: '\u{1F6D2}', title: 'Product Page', desc: 'Images, price & reviews', prompt: 'An e-commerce product page with product image, price, star reviews, and add to cart button' },
]

const QUICK_SUGGESTIONS = [
  'Make it darker',
  'Add more sections',
  'Change accent color',
  'Add bottom tabs',
  'Export code',
]

const GENERATING_STEPS = [
  { text: 'Understanding your design...', icon: 'brain' },
  { text: 'Creating components...', icon: 'build' },
  { text: 'Applying styles and tokens...', icon: 'paint' },
]

export function ChatPanel({ messages, onSend, isGenerating, initialPrompt }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const [placeholderVisible, setPlaceholderVisible] = useState(true)
  const [genStep, setGenStep] = useState(0)
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

  // Check if the last message is an assistant (non-error) message — show suggestions
  const lastMsg = messages[messages.length - 1]
  const showSuggestions = lastMsg?.role === 'assistant' && !lastMsg.content.startsWith('Error:') && !isGenerating

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
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
        {/* Empty state */}
        {messages.length === 0 && !isGenerating && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 24,
            padding: '0 4px',
          }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#F1F5F9', textAlign: 'center' }}>
              What would you like to build?
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}>
              {EXAMPLE_CARDS.map(card => (
                <button
                  key={card.title}
                  onClick={() => onSend(card.prompt)}
                  className="example-card"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 16,
                    padding: '16px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{card.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', marginBottom: 4 }}>
                    {card.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>
                    {card.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={msg.id}>
            <div
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

            {/* Quick suggestion pills after last assistant message */}
            {idx === messages.length - 1 && showSuggestions && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, marginLeft: 32, flexWrap: 'wrap' }}>
                {QUICK_SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => onSend(s)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#a5b4fc',
                      background: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(99,102,241,0.2)'
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(99,102,241,0.1)'
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Multi-step generating indicator */}
        {isGenerating && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: '#fff',
            }}>
              M
            </div>
            <div style={{
              padding: '12px 16px',
              borderRadius: '14px 14px 14px 4px',
              background: 'rgba(255,255,255,0.04)',
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
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#0c0c0e' }}>
        <div className="chat-input-bar relative transition-all duration-200">
          <div className="flex items-center gap-2 px-4" style={{ height: 56 }}>
            {/* Attachment button */}
            <button
              title="Attach screenshot"
              className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round">
                <path d="M8 3.5v9M3.5 8h9" />
              </svg>
            </button>

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

            {/* Generate button */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              className="shrink-0 flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed text-[13px] font-semibold text-white"
              style={{
                padding: '8px 20px',
                borderRadius: 10,
                background: input.trim() && !isGenerating
                  ? 'linear-gradient(135deg, #6366f1, #818cf8)'
                  : 'rgba(255,255,255,0.06)',
                boxShadow: input.trim() && !isGenerating
                  ? '0 2px 12px rgba(99,102,241,0.2)'
                  : 'none',
              }}
              onMouseEnter={e => {
                if (input.trim() && !isGenerating) {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.35)'
                }
              }}
              onMouseLeave={e => {
                if (input.trim() && !isGenerating) {
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
