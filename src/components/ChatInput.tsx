import { useState, useRef, useEffect } from 'react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  screenKey?: string
  timestamp: number
}

const MOCK_SCREEN_KEYS = ['HomeScreen', 'LoginScreen', 'ProfileScreen', 'ChatScreen', 'DashboardScreen']

const SCREEN_LABELS: Record<string, string> = {
  HomeScreen: 'Home Screen',
  LoginScreen: 'Login Screen',
  ProfileScreen: 'Profile Screen',
  ChatScreen: 'Chat Screen',
  DashboardScreen: 'Dashboard Screen',
}

function pickRandomScreen(): string {
  return MOCK_SCREEN_KEYS[Math.floor(Math.random() * MOCK_SCREEN_KEYS.length)]
}

interface ChatInputProps {
  onScreenGenerated: (screenKey: string) => void
}

export function ChatInput({ onScreenGenerated }: ChatInputProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isGenerating) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsGenerating(true)
    onScreenGenerated('__generating__')

    // Mock: after 2s delay, pick a random screen
    setTimeout(() => {
      const screenKey = pickRandomScreen()
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Generated ${SCREEN_LABELS[screenKey]}`,
        screenKey,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, assistantMsg])
      setIsGenerating(false)
      onScreenGenerated(screenKey)
    }, 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col w-full max-w-[420px] mx-auto">
      {/* Chat history */}
      {messages.length > 0 && (
        <div className="mb-3 max-h-[140px] overflow-y-auto px-1 space-y-2 scrollbar-thin">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3 py-1.5 rounded-xl text-[12px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-mokkoi-accent/15 text-mokkoi-accent rounded-br-sm'
                    : 'bg-mokkoi-surface text-mokkoi-text-muted rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex justify-start">
              <div className="px-3 py-1.5 rounded-xl rounded-bl-sm bg-mokkoi-surface text-mokkoi-text-dim text-[12px] flex items-center gap-1.5">
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_infinite]" />
                  <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                  <span className="w-1 h-1 rounded-full bg-mokkoi-accent/60 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
                </span>
                <span className="ml-1">Generating...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Input bar */}
      <div className="relative flex items-center gap-2 rounded-2xl bg-mokkoi-surface/80 border border-mokkoi-border-subtle backdrop-blur-sm px-4 py-2 transition-colors focus-within:border-mokkoi-accent/30 focus-within:bg-mokkoi-surface">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your screen..."
          disabled={isGenerating}
          className="flex-1 bg-transparent text-[13px] text-mokkoi-text placeholder:text-mokkoi-text-dim outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isGenerating}
          className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-mokkoi-accent/20 text-mokkoi-accent transition-all hover:bg-mokkoi-accent/30 disabled:opacity-30 disabled:hover:bg-mokkoi-accent/20 disabled:cursor-not-allowed"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>
      </div>
    </div>
  )
}
