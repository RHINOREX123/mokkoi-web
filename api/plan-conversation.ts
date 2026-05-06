// POST /api/plan-conversation — Plan-mode (Haiku) conversational planner.
//
// Plain JSON endpoint (NOT SSE). Free users get 402 + { error: 'paywall' }.
// Returns { reply, chips, ready_to_build, summary, extracted } on success.
// See docs/superpowers/specs/2026-05-07-plan-mode-conversational-engine-design.md.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest, getSupabaseConfig, logUsage } from './_lib/auth-helper.js'
import { getUserPlan } from './_lib/userPlan.js'
import { checkPlanRateLimit } from './_lib/plan-rate-limiter.js'
import {
  PLAN_SYSTEM_PROMPT,
  STRICT_JSON_SUFFIX,
  validatePlanResponse,
  extractJsonObject,
  type PlanResponse,
} from './_lib/plan-prompt.js'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 400
const TRIM_THRESHOLD = 25
const KEEP_LAST_N = 15
const PER_PROJECT_TURN_CAP = 50
const USER_MESSAGE_MAX_LEN = 4_000

type HistoryMsg = { role: 'user' | 'assistant'; content: string }

interface PlanRequestBody {
  projectId?: unknown
  userMessage?: unknown
  conversationHistory?: unknown
}

function jsonError(res: VercelResponse, status: number, body: Record<string, unknown>) {
  return res.status(status).json(body)
}

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

function normalizeHistory(raw: unknown): HistoryMsg[] {
  if (!Array.isArray(raw)) return []
  const out: HistoryMsg[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const role = (item as { role?: unknown }).role
    const content = (item as { content?: unknown }).content
    if (typeof content !== 'string') continue
    if (role !== 'user' && role !== 'assistant') continue
    out.push({ role, content })
  }
  return out
}

/**
 * Trim policy at derivedTurnCount >= 25:
 *   [history[0], ...history.slice(-15), extractedSnapshotPin]
 * The snapshot pin is appended as a synthetic system-style note in the last
 * user turn so Haiku has continuity without re-receiving 25 messages.
 */
function trimHistory(history: HistoryMsg[], snapshotPin: string | null): HistoryMsg[] {
  if (history.length < TRIM_THRESHOLD) return history
  const head = history[0]
  const tail = history.slice(-KEEP_LAST_N)
  const trimmed: HistoryMsg[] = head ? [head, ...tail] : tail.slice()
  if (snapshotPin) {
    // Glue the pin onto the most-recent user message so Anthropic sees it
    // alongside the latest input.
    for (let i = trimmed.length - 1; i >= 0; i--) {
      if (trimmed[i].role === 'user') {
        trimmed[i] = {
          role: 'user',
          content: `${trimmed[i].content}\n\n[memory pin — extracted so far]\n${snapshotPin}`,
        }
        break
      }
    }
  }
  return trimmed
}

/**
 * Pull the most-recent assistant `metadata.extracted` to use as a memory pin.
 * Best-effort — returns null on any failure.
 */
async function loadExtractedSnapshotPin(projectId: string): Promise<string | null> {
  const { url } = getSupabaseConfig()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  const supabase = createClient(url, serviceKey)
  const { data } = await supabase
    .from('messages')
    .select('metadata')
    .eq('project_id', projectId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const extracted = data?.metadata?.extracted
  if (!extracted || typeof extracted !== 'object') return null
  try {
    return JSON.stringify(extracted)
  } catch {
    return null
  }
}

/** Per-project hard cap — count turns directly from the messages table. */
async function getProjectTurnCount(projectId: string): Promise<number | null> {
  const { url } = getSupabaseConfig()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  const supabase = createClient(url, serviceKey)
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
  if (error) {
    console.warn('[plan-conversation] turn count query failed:', error.message)
    return null
  }
  return count ?? 0
}

interface AnthropicResponse {
  content?: Array<{ text?: string }>
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
}

async function callHaiku(
  apiKey: string,
  systemText: string,
  history: HistoryMsg[],
  userMessage: string,
): Promise<{ ok: true; data: AnthropicResponse } | { ok: false; status: number }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const m of history) {
    if (messages.length > 0 && messages[messages.length - 1].role === m.role) {
      messages[messages.length - 1].content += '\n' + m.content
    } else {
      messages.push({ role: m.role, content: m.content })
    }
  }
  if (messages.length > 0 && messages[0].role === 'assistant') messages.shift()
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
    messages.push({ role: 'assistant', content: 'Understood, continuing.' })
  }
  messages.push({ role: 'user', content: userMessage })

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral', ttl: '1h' } }],
      messages,
    }),
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    console.error('[plan-conversation] Anthropic error', resp.status, body.slice(0, 400))
    return { ok: false, status: resp.status }
  }
  const data = (await resp.json()) as AnthropicResponse
  return { ok: true, data }
}

function tryParse(text: string): unknown {
  if (!text) return null
  const slice = extractJsonObject(text)
  try {
    return JSON.parse(slice)
  } catch {
    return null
  }
}

/**
 * Save the assistant reply to messages with planner metadata. Fire-and-forget
 * so a save failure never breaks the response to the user. The client also
 * has the data in-memory and will save user messages on its own per spec.
 */
function saveAssistantMessage(projectId: string, response: PlanResponse): void {
  const { url } = getSupabaseConfig()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return
  const supabase = createClient(url, serviceKey)
  supabase
    .from('messages')
    .insert({
      project_id: projectId,
      role: 'assistant',
      content: response.reply,
      metadata: {
        chips: response.chips,
        extracted: response.extracted,
        ready_to_build: response.ready_to_build,
        summary: response.summary,
      },
    })
    .then(({ error }) => {
      if (error) console.warn('[plan-conversation] save assistant message failed:', error.message)
    })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return jsonError(res, 405, { error: 'method_not_allowed' })

  const user = await authenticateRequest(req, res)
  if (!user) return

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return jsonError(res, 500, { error: 'ANTHROPIC_API_KEY is not configured' })

  // Plan gating — note: anonymous + MCP + admin all resolve to 'paid'.
  const tier = await getUserPlan(user.id, user.email)
  if (tier === 'free') {
    return jsonError(res, 402, { error: 'paywall', reason: 'plan_mode_requires_paid' })
  }

  // Per-user sliding-window rate limit.
  const rate = checkPlanRateLimit(user.id)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSec))
    return jsonError(res, 429, { error: 'rate_limit', retryAfter: rate.retryAfterSec })
  }

  const body = (req.body ?? {}) as PlanRequestBody
  const { projectId, userMessage } = body

  if (!isUuid(projectId)) return jsonError(res, 400, { error: 'invalid_project_id' })
  if (typeof userMessage !== 'string' || userMessage.trim().length === 0) {
    return jsonError(res, 400, { error: 'invalid_user_message' })
  }
  const trimmedUserMessage = userMessage.trim().slice(0, USER_MESSAGE_MAX_LEN)

  const history = normalizeHistory(body.conversationHistory)
  // Server-derived. Client `turnCount` is NOT in the schema and is ignored
  // even if sent — prevents a malicious client from pinning turnCount=0 to
  // bypass trim or the ≥2-turn ready_to_build guard.
  const derivedTurnCount = history.length

  // Per-project hard cap (count messages already in DB).
  const dbTurnCount = await getProjectTurnCount(projectId)
  if (dbTurnCount !== null && dbTurnCount >= PER_PROJECT_TURN_CAP) {
    return jsonError(res, 429, { error: 'plan_turns_exceeded' })
  }

  // Trim long histories. Memory pin pulled from latest assistant metadata.
  const snapshotPin = derivedTurnCount >= TRIM_THRESHOLD
    ? await loadExtractedSnapshotPin(projectId)
    : null
  const effectiveHistory = trimHistory(history, snapshotPin)

  // First call.
  let parsed = await callAndParse(apiKey, PLAN_SYSTEM_PROMPT, effectiveHistory, trimmedUserMessage)

  // Single retry with strict-JSON suffix on parse failure.
  if (!parsed.response) {
    parsed = await callAndParse(
      apiKey,
      PLAN_SYSTEM_PROMPT + STRICT_JSON_SUFFIX,
      effectiveHistory,
      trimmedUserMessage,
    )
  }

  if (!parsed.response) {
    if (parsed.networkStatus && parsed.networkStatus >= 500) {
      console.error('[plan-conversation] upstream failed both attempts')
    }
    logUsage({
      userId: user.id,
      projectId,
      modelUsed: MODEL,
      generationType: 'plan_turn',
      promptPreview: trimmedUserMessage,
      success: false,
    })
    return jsonError(res, 500, { error: 'planner_unavailable' })
  }

  // Server-side guard: refuse ready_to_build before turn 2. derivedTurnCount
  // counts entries already in history; the current user message brings it to
  // history.length + 1 logical turns, but the guard wants at least 2 prior
  // user turns recorded — we approximate via history.length >= 2.
  let response = parsed.response
  if (response.ready_to_build && derivedTurnCount < 2) {
    response = {
      ...response,
      ready_to_build: false,
      summary: null,
      // Force a confirming question. Replace chips so the user has an out.
      chips: response.chips.length > 0 ? response.chips : ['Yes, start building', 'Refine the vibe', 'Add a screen'],
      reply: response.reply.endsWith('?')
        ? response.reply
        : `${response.reply} Want me to start, or anything else first?`,
    }
  }

  // Best-effort persist. Don't await — fire-and-forget like logUsage.
  saveAssistantMessage(projectId, response)

  if (parsed.usage) {
    logUsage({
      userId: user.id,
      projectId,
      modelUsed: MODEL,
      tokensIn: parsed.usage.input_tokens,
      tokensOut: parsed.usage.output_tokens,
      cacheReadTokens: parsed.usage.cache_read_input_tokens,
      cacheCreationTokens: parsed.usage.cache_creation_input_tokens,
      generationType: 'plan_turn',
      promptPreview: trimmedUserMessage,
      success: true,
    })
  }

  return res.status(200).json(response)
}

interface CallResult {
  response: PlanResponse | null
  usage?: AnthropicResponse['usage']
  networkStatus?: number
}

async function callAndParse(
  apiKey: string,
  systemText: string,
  history: HistoryMsg[],
  userMessage: string,
): Promise<CallResult> {
  const result = await callHaiku(apiKey, systemText, history, userMessage)
  if (!result.ok) return { response: null, networkStatus: result.status }
  const text = result.data.content?.[0]?.text ?? ''
  const raw = tryParse(text)
  const validated = validatePlanResponse(raw)
  return { response: validated, usage: result.data.usage }
}
