import { useState, useEffect, useCallback, useRef } from 'react'
import type { Screen, DesignTokens, MokkoiMessage, ScreenUpdatePayload, TokenUpdatePayload, ScreenListPayload } from '../types/mokkoi'

const DEFAULT_TOKENS: DesignTokens = {
  colors: {
    primary: '#818CF8',
    background: '#0F172A',
    surface: '#1E293B',
    text: '#F8FAFC',
    textMuted: '#94A3B8',
    accent: '#818CF8',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
  },
  fonts: {
    heading: 'DM Sans',
    body: 'DM Sans',
    mono: 'JetBrains Mono',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
  },
}

const DEMO_SCREENS: Screen[] = [
  { id: '1', name: 'HomeScreen', component: 'HomeScreen', updatedAt: Date.now() },
  { id: '2', name: 'ProfileScreen', component: 'ProfileScreen', updatedAt: Date.now() - 60000 },
  { id: '3', name: 'SettingsScreen', component: 'SettingsScreen', updatedAt: Date.now() - 120000 },
]

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export function useMokkoiSocket(url = 'ws://localhost:3100') {
  const [screens, setScreens] = useState<Screen[]>(DEMO_SCREENS)
  const [tokens, setTokens] = useState<DesignTokens>(DEFAULT_TOKENS)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [selectedScreenId, setSelectedScreenId] = useState<string>(DEMO_SCREENS[0].id)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setStatus('connecting')
    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('connected')
        // Request initial data from bridge
        ws.send(JSON.stringify({ type: 'list_screens' }))
        ws.send(JSON.stringify({ type: 'get_tokens' }))
      }

      ws.onmessage = (event) => {
        try {
          const message: MokkoiMessage = JSON.parse(event.data)

          switch (message.type) {
            case 'connected': {
              // Bridge confirmed connection
              break
            }
            case 'screen_list':
            case 'screen_list_response': {
              const payload = message.payload as ScreenListPayload
              if (payload.screens) {
                setScreens(payload.screens)
                if (payload.screens.length > 0 && !payload.screens.find(s => s.id === selectedScreenId)) {
                  setSelectedScreenId(payload.screens[0].id)
                }
              }
              break
            }
            case 'screen_update':
            case 'screen_update_response': {
              const payload = message.payload as ScreenUpdatePayload
              if (payload.screenId) {
                setScreens(prev =>
                  prev.map(s =>
                    s.id === payload.screenId
                      ? { ...s, name: payload.name, component: payload.component, updatedAt: Date.now() }
                      : s
                  )
                )
              }
              // Re-fetch screen list after updates
              ws.send(JSON.stringify({ type: 'list_screens' }))
              break
            }
            case 'token_update':
            case 'token_update_response': {
              const payload = message.payload as TokenUpdatePayload
              if (payload.tokens) {
                setTokens(payload.tokens)
              }
              break
            }
            case 'resource_updated': {
              // MCP server notified a resource changed — re-fetch
              ws.send(JSON.stringify({ type: 'list_screens' }))
              ws.send(JSON.stringify({ type: 'get_tokens' }))
              break
            }
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        setStatus('disconnected')
        reconnectTimer.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      setStatus('disconnected')
      reconnectTimer.current = setTimeout(connect, 3000)
    }
  }, [url, selectedScreenId])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((type: string, payload?: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

  const selectedScreen = screens.find(s => s.id === selectedScreenId) ?? screens[0]

  return {
    screens,
    tokens,
    status,
    selectedScreen,
    selectedScreenId,
    setSelectedScreenId,
    send,
  }
}
