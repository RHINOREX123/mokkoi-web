import { useState, useRef, useEffect } from 'react'
import type { ComponentNode } from '../types/mokkoi'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ChatInputProps {
  onScreenGenerated: (tree: ComponentNode | '__generating__') => void
  initialPrompt?: string
}

const PLACEHOLDERS = [
  'A fitness dashboard with activity rings...',
  'A login screen with social auth...',
  'A chat interface with message bubbles...',
  'An e-commerce product page...',
  'A settings page with toggle switches...',
]

export function ChatInput({ onScreenGenerated, initialPrompt }: ChatInputProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
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
  }, [messages])

  const handleSend = async (text?: string) => {
    const prompt = (text ?? input).trim()
    if (!prompt || isGenerating) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsGenerating(true)
    onScreenGenerated('__generating__')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate screen')
      }

      const { tree } = await res.json()

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Generated your screen design',
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, assistantMsg])
      setIsGenerating(false)
      onScreenGenerated(tree)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errorMsg])
      setIsGenerating(false)
      onScreenGenerated('__generating__')
    }
  }

  // Handle initial prompt from URL
  useEffect(() => {
    if (initialPrompt && !initialPromptHandled.current) {
      initialPromptHandled.current = true
      handleSend(initialPrompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col w-full max-w-[600px] mx-auto">
      {/* Chat history */}
      {messages.length > 0 && (
        <div className="mb-3 max-h-[160px] overflow-y-auto px-1 space-y-2 scrollbar-thin">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3.5 py-2 rounded-xl text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-mokkoi-accent/15 text-mokkoi-accent rounded-br-sm'
                    : msg.content.startsWith('Error:')
                      ? 'bg-red-500/10 text-red-400 rounded-bl-sm'
                      : 'bg-mokkoi-surface text-mokkoi-text-muted rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex justify-start">
              <div className="px-3.5 py-2 rounded-xl rounded-bl-sm bg-mokkoi-surface text-mokkoi-text-dim text-[13px] flex items-center gap-2">
                <span className="inline-flex gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_infinite]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
                </span>
                <span className="ml-1">Generating...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Input bar - larger, more prominent */}
      <div className="relative rounded-2xl bg-white/[0.04] border border-white/[0.1] shadow-[0_4px_32px_rgba(0,0,0,0.5)] transition-all duration-200 focus-within:border-mokkoi-accent/40 focus-within:shadow-[0_4px_32px_rgba(99,102,241,0.15)]">
        <div className="flex items-center gap-3 px-5" style={{ height: 56 }}>
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
              className="w-full bg-transparent text-[16px] text-mokkoi-text outline-none disabled:opacity-50"
              style={{ caretColor: '#818cf8' }}
            />
            {!input && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none text-[16px] text-white/25 transition-opacity duration-300"
                style={{ opacity: placeholderVisible ? 1 : 0 }}
              >
                {PLACEHOLDERS[placeholderIdx]}
              </span>
            )}
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isGenerating}
            className="shrink-0 h-10 px-5 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed text-[14px] font-semibold text-white"
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

      {/* Hint text */}
      <div className="mt-2.5 text-center text-[11px] text-white/20">
        Press Enter to send &middot; AI generates a mobile screen from your description
      </div>
    </div>
  )
}
