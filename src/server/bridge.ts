import { WebSocketServer, WebSocket } from 'ws'
import { spawn, type ChildProcess } from 'child_process'

const BRIDGE_PORT = 3100
const MCP_COMMAND = process.env.MCP_COMMAND ?? 'npx'
const MCP_ARGS = (process.env.MCP_ARGS ?? '@anthropic/mokkoi-mcp').split(' ')

// JSON-RPC helpers
let rpcId = 0
function createRpcRequest(method: string, params?: Record<string, unknown>) {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: ++rpcId,
    method,
    params: params ?? {},
  })
}

// Track pending RPC calls
interface PendingCall {
  ws: WebSocket
  originalType: string
  resolve: (result: unknown) => void
}
const pendingCalls = new Map<number, PendingCall>()

// MCP Server process management
let mcpProcess: ChildProcess | null = null
let mcpBuffer = ''

function startMcpServer(): ChildProcess {
  console.log(`[bridge] Starting MCP server: ${MCP_COMMAND} ${MCP_ARGS.join(' ')}`)

  const proc = spawn(MCP_COMMAND, MCP_ARGS, {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  })

  proc.stdout!.on('data', (chunk: Buffer) => {
    mcpBuffer += chunk.toString()

    // MCP uses newline-delimited JSON-RPC
    let newlineIdx: number
    while ((newlineIdx = mcpBuffer.indexOf('\n')) !== -1) {
      const line = mcpBuffer.slice(0, newlineIdx).trim()
      mcpBuffer = mcpBuffer.slice(newlineIdx + 1)

      if (!line) continue

      try {
        const message = JSON.parse(line)
        handleMcpResponse(message)
      } catch {
        console.error('[bridge] Failed to parse MCP response:', line)
      }
    }
  })

  proc.stderr!.on('data', (chunk: Buffer) => {
    console.error(`[mcp stderr] ${chunk.toString().trim()}`)
  })

  proc.on('close', (code) => {
    console.log(`[bridge] MCP server exited with code ${code}`)
    mcpProcess = null
  })

  proc.on('error', (err) => {
    console.error(`[bridge] Failed to start MCP server:`, err.message)
    mcpProcess = null
  })

  return proc
}

function sendToMcp(message: string) {
  if (!mcpProcess?.stdin?.writable) {
    console.error('[bridge] MCP server stdin not writable')
    return false
  }
  mcpProcess.stdin.write(message + '\n')
  return true
}

function handleMcpResponse(message: { id?: number; result?: unknown; error?: unknown; method?: string; params?: unknown }) {
  // Handle JSON-RPC response (has id)
  if (message.id !== undefined) {
    const pending = pendingCalls.get(message.id)
    if (pending) {
      pendingCalls.delete(message.id)

      const response = {
        type: `${pending.originalType}_response`,
        payload: message.error ? { error: message.error } : message.result,
      }

      if (pending.ws.readyState === WebSocket.OPEN) {
        pending.ws.send(JSON.stringify(response))
      }
    }
    return
  }

  // Handle JSON-RPC notification (no id) — these are server-initiated events
  if (message.method === 'notifications/resources/updated') {
    // Broadcast resource update to all connected clients
    broadcastToClients({
      type: 'resource_updated',
      payload: message.params,
    })
  }
}

function broadcastToClients(message: Record<string, unknown>) {
  const data = JSON.stringify(message)
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  })
}

// Initialize MCP server with required handshake
async function initializeMcp() {
  const initRequest = createRpcRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'mokkoi-web-bridge',
      version: '1.0.0',
    },
  })

  const currentId = rpcId
  sendToMcp(initRequest)

  // Wait for initialize response, then send initialized notification
  return new Promise<void>((resolve) => {
    pendingCalls.set(currentId, {
      ws: { readyState: WebSocket.OPEN, send: () => {} } as unknown as WebSocket,
      originalType: 'initialize',
      resolve: () => {
        // Send the initialized notification (no id, no response expected)
        const notification = JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        })
        sendToMcp(notification)
        console.log('[bridge] MCP handshake complete')
        resolve()
      },
    })

    // Override to call resolve on response
    const origPending = pendingCalls.get(currentId)!
    const origResolve = origPending.resolve
    pendingCalls.set(currentId, {
      ...origPending,
      ws: {
        readyState: WebSocket.OPEN,
        send: () => { origResolve(null) },
      } as unknown as WebSocket,
    })
  })
}

// Map web app messages to MCP tool calls
function translateToMcp(ws: WebSocket, message: { type: string; payload?: Record<string, unknown> }) {
  switch (message.type) {
    case 'list_screens': {
      const id = rpcId + 1
      const rpc = createRpcRequest('tools/call', {
        name: 'list_screens',
        arguments: message.payload ?? {},
      })
      pendingCalls.set(id, { ws, originalType: 'screen_list', resolve: () => {} })
      sendToMcp(rpc)
      break
    }

    case 'create_screen': {
      const id = rpcId + 1
      const rpc = createRpcRequest('tools/call', {
        name: 'create_screen',
        arguments: message.payload ?? {},
      })
      pendingCalls.set(id, { ws, originalType: 'screen_update', resolve: () => {} })
      sendToMcp(rpc)
      break
    }

    case 'update_screen': {
      const id = rpcId + 1
      const rpc = createRpcRequest('tools/call', {
        name: 'update_screen',
        arguments: message.payload ?? {},
      })
      pendingCalls.set(id, { ws, originalType: 'screen_update', resolve: () => {} })
      sendToMcp(rpc)
      break
    }

    case 'get_tokens': {
      const id = rpcId + 1
      const rpc = createRpcRequest('tools/call', {
        name: 'get_design_tokens',
        arguments: message.payload ?? {},
      })
      pendingCalls.set(id, { ws, originalType: 'token_update', resolve: () => {} })
      sendToMcp(rpc)
      break
    }

    case 'set_tokens': {
      const id = rpcId + 1
      const rpc = createRpcRequest('tools/call', {
        name: 'set_design_tokens',
        arguments: message.payload ?? {},
      })
      pendingCalls.set(id, { ws, originalType: 'token_update', resolve: () => {} })
      sendToMcp(rpc)
      break
    }

    case 'list_tools': {
      const id = rpcId + 1
      const rpc = createRpcRequest('tools/list')
      pendingCalls.set(id, { ws, originalType: 'tools_list', resolve: () => {} })
      sendToMcp(rpc)
      break
    }

    default:
      console.warn(`[bridge] Unknown message type: ${message.type}`)
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: `Unknown message type: ${message.type}` },
      }))
  }
}

// WebSocket server
const wss = new WebSocketServer({ port: BRIDGE_PORT })

wss.on('listening', async () => {
  console.log(`[bridge] WebSocket server listening on ws://localhost:${BRIDGE_PORT}`)

  // Start and initialize MCP server
  mcpProcess = startMcpServer()

  // Give the MCP server a moment to start
  await new Promise((r) => setTimeout(r, 1000))

  try {
    await initializeMcp()
  } catch (err) {
    console.error('[bridge] MCP initialization failed:', err)
  }
})

wss.on('connection', (ws) => {
  console.log('[bridge] Client connected')

  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    payload: { mcpAvailable: mcpProcess !== null },
  }))

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString())
      translateToMcp(ws, message)
    } catch {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Invalid JSON' },
      }))
    }
  })

  ws.on('close', () => {
    console.log('[bridge] Client disconnected')
  })
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[bridge] Shutting down...')
  mcpProcess?.kill()
  wss.close(() => {
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  mcpProcess?.kill()
  wss.close(() => {
    process.exit(0)
  })
})
