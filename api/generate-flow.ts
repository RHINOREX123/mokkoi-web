import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, checkCredits, logUsage, deductCredits, getUserPlan, createUserSupabaseClient } from './_lib/auth-helper.js'
import {
  verifyProjectOwnership,
  createGenerationRun,
  updateRunProgress,
  completeRun,
  failRun,
  setProjectState,
} from './_lib/generation-runs.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getUserPlan as getUserTier, getFreeAppCount, decideAppGate, FREE_APP_LIMIT } from './_lib/userPlan.js'
import { normalizeComponentTree, validateNavIntents } from './_lib/normalizer.js'
import { repairDeadButtons, checkBackButton } from './_lib/dead-button-repair.js'
import { expandComponents } from '../lib/component-library.js'
import { validateBottomNavLabels } from './_lib/bottomnav-validator.js'
import { DESIGN_TOKENS, CONTENT_LIBRARY, COMPONENT_TYPES, VIEWPORT_BUDGET, CONTENT_DENSITY, PLATFORM_RULES, QUALITY_CHECKLIST, FUNCTIONAL_APP_RULES } from './_lib/design-system.js'
import { matchTemplate } from './_lib/template-matcher.js'
import { buildPersona, applyPersonaToTree } from './_lib/persona.js'
import {
  runAppPlanner,
  runPlanner,
  type AppPlan as PlannerAppPlan,
  type AppData,
  type RouteGraph,
} from './_lib/planner.js'
import { makeMilestone, deriveIdentified, type MilestoneKind, type MilestoneStatus } from './_lib/progress-events.js'

/**
 * Send a milestone SSE event. Additive to the existing 'status'/'plan'/'screen'
 * stream — pre-milestone clients ignore unknown types and keep working. Wrapped
 * in try/catch so a telemetry hiccup never propagates into the generation path.
 */
function emitMilestone(
  res: VercelResponse,
  kind: MilestoneKind,
  message: string,
  status: MilestoneStatus = 'inflight',
) {
  try {
    const m = makeMilestone(kind, message, status)
    sendSSE(res, { type: 'milestone', ...m })
  } catch (err) {
    console.warn('[generate-flow] milestone emit failed:', err instanceof Error ? err.message : err)
  }
}

const REFERENCE_INSPIRATION_BLOCK = `REFERENCE IMAGES — VISUAL INSPIRATION ONLY

The user attached reference image(s). The reference images decide HOW the screens LOOK. The user's text prompt decides WHAT the app IS.

THE DOMAIN COMES FROM THE USER'S TEXT PROMPT — NEVER FROM THE IMAGES.

Concrete example:
  - User says: "create a fitness app"
  - User attaches: 4 screenshots of a food/recipe app
  - You build: FITNESS screens (workouts, calories, steps, BPM, progress rings) styled with the food app's visual language — its palette, card radii, typography weight, spacing rhythm.
  - You do NOT build recipe/food screens. No "Thai Green Curry", no ingredient lists, no food-domain content from the images.

Pull from the references (visual style ONLY):
  - Color palette and accent colors
  - Typography vibe (weights, sizes, hierarchy)
  - Spacing and layout rhythm
  - Card shapes, corner radii, shadow style
  - Iconography style and density
  - Overall mood: dark/light, minimal/dense, playful/serious

Do NOT pull from the references:
  - The subject matter or app domain
  - Specific text labels, brand names, dish names, product names
  - Numerical data (prices, ratings, counts, times)
  - Section titles tied to the reference's domain
  - User names, profile photos, or any literal data values

Every generated screen MUST be in the user's domain. The bottom tab bar must reflect the user's domain (Home + primary features of the user's app), NOT the references' tabs.`

const FLOW_SYSTEM_PROMPT = `You are a world-class mobile UI designer and React Native expert. The user wants a MULTI-SCREEN FLOW. Generate 3-5 connected screens as a JSON array. Each screen should have: { "id": string, "name": string (e.g. "Welcome", "Sign Up", "Profile Setup"), "tree": ComponentNode }.

Your designs follow these principles:
- Hierarchy through size and weight, not just color
- Spacing creates visual grouping (tight within sections, generous between sections)
- Color restraint — one primary accent, surfaces for depth, greys for most text
- Every element has a purpose — no decorative noise
- Content is realistic and contextual — never generic placeholder text

${DESIGN_TOKENS}

${COMPONENT_TYPES}

${CONTENT_LIBRARY}

${VIEWPORT_BUDGET}

${CONTENT_DENSITY}

${PLATFORM_RULES}

FLOW CONSISTENCY RULES:
- All screens in a flow MUST use the exact same color palette, font sizes, and card styles
- Navigation elements (back button, progress indicator, tab bar) appear in the same position on every screen
- Header height, bottom navigation style, and card styling must be identical across all screens
- Users will see these screens side by side on a canvas — they must feel like one cohesive app
- Include navigation elements (Back button, Next button, Skip, progress indicators) that reference other screens

THEME RULES:
- Default to dark theme using the Dark Theme color tokens
- If the user requests a light theme, white background, light mode, or any light color scheme — use the Light Theme color tokens
- Always respect the user's explicit color and theme requests

${FUNCTIONAL_APP_RULES}

${QUALITY_CHECKLIST}

Return ONLY a JSON array of screen objects. No markdown, no explanation. Example format:
[{"id":"welcome","name":"Welcome","tree":{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54,"paddingBottom":34},"children":[]}},{"id":"signup","name":"Sign Up","tree":{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54,"paddingBottom":34},"children":[]}}]`

const APP_GENERATION_SYSTEM_PROMPT = `You are a world-class mobile UI designer and React Native expert. You are generating ALL screens for a mobile app. Generate a JSON array where each element has: { "id": string, "name": string, "tree": ComponentNode }.

Your designs follow these principles:
- Hierarchy through size and weight, not just color
- Spacing creates visual grouping (tight within sections, generous between sections)
- Color restraint — one primary accent, surfaces for depth, greys for most text
- Every element has a purpose — no decorative noise
- Content is realistic and contextual — never generic placeholder text

${DESIGN_TOKENS}

${COMPONENT_TYPES}

${CONTENT_LIBRARY}

${VIEWPORT_BUDGET}

${CONTENT_DENSITY}

${PLATFORM_RULES}

APP CONSISTENCY RULES (CRITICAL):
- ALL screens MUST use the EXACT same color palette, font sizes, and card styles
- Navigation elements (back button, tab bar) appear in the SAME position on every screen
- Header height, bottom navigation style, and card styling must be IDENTICAL across all screens
- Tab bar screens MUST include an identical BottomNav component with the same items — the active tab changes per screen
- Users will see these screens side by side on a canvas — they must feel like ONE cohesive app
- Use the SAME accent color for ALL primary actions, active states, and highlights

THEME RULES:
- Default to dark theme using the Dark Theme color tokens
- If the user requests light theme — use Light Theme color tokens
- Always respect the user's explicit color and theme requests

${FUNCTIONAL_APP_RULES}

${QUALITY_CHECKLIST}

Return ONLY a JSON array of screen objects. No markdown, no explanation.`

type RefImage = { data: string; mimeType?: string }

/** Build a Claude-compatible messages array from conversation history + current prompt.
 * If `images` is provided and non-empty, the final user turn is a multimodal block
 * (images + text) instead of a plain string. */
function buildMessages(
  conversationHistory: Array<{ role: string; content: string }> | undefined,
  currentContent: string,
  images?: RefImage[],
): Array<{ role: 'user' | 'assistant'; content: any }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: any }> = []
  if (Array.isArray(conversationHistory)) {
    for (const m of conversationHistory.slice(-5)) {
      const role = m.role === 'assistant' ? 'assistant' : 'user'
      if (messages.length > 0 && messages[messages.length - 1].role === role && typeof messages[messages.length - 1].content === 'string') {
        messages[messages.length - 1].content += '\n' + m.content
      } else {
        messages.push({ role, content: m.content })
      }
    }
    if (messages.length > 0 && messages[0].role === 'assistant') {
      messages.shift()
    }
  }
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
    messages.push({ role: 'assistant', content: 'Understood, continuing.' })
  }
  const finalContent = images && images.length > 0
    ? [
        ...images.map(img => ({
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: img.mimeType || 'image/png', data: img.data },
        })),
        { type: 'text' as const, text: currentContent },
      ]
    : currentContent
  return [...messages, { role: 'user', content: finalContent }]
}

function normalizeImages(raw: unknown): RefImage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((i: any) => i && typeof i.data === 'string' && i.data.length > 0)
    .slice(0, 4)
    .map((i: any) => ({ data: i.data, mimeType: typeof i.mimeType === 'string' ? i.mimeType : 'image/png' }))
}

/** Attempt to repair truncated JSON */
function repairJSON(text: string): any {
  let repaired = text
  let openBraces = 0, openBrackets = 0
  let inString = false, escaped = false
  for (const ch of repaired) {
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') openBraces++
    else if (ch === '}') openBraces--
    else if (ch === '[') openBrackets++
    else if (ch === ']') openBrackets--
  }
  if (inString) repaired += '"'
  repaired = repaired.replace(/[,:\s]+$/, '')
  for (let i = 0; i < openBraces; i++) repaired += '}'
  for (let i = 0; i < openBrackets; i++) repaired += ']'
  return JSON.parse(repaired)
}

function stripCodeFences(text: string): string {
  return text.trim().replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
}

/**
 * Repair a specific Sonnet 4.6 malformation: stray closing quotes after
 * unquoted numeric values, e.g. `"padding": 16"` → `"padding": 16`.
 * Anchored to `:\s*<number>"<,|}>` so it ONLY touches values in JSON-property
 * position; legitimately quoted strings like `"version": "1.0"` are untouched
 * because the repair requires the digits to be unquoted (no opening `"`).
 * Also handles array elements where applicable.
 */
function repairStrayDigitQuotes(text: string): string {
  // Property values: : 12" or : -1.5"  followed by , or }
  let out = text.replace(/(:\s*-?\d+(?:\.\d+)?)"(\s*[,}\]])/g, '$1$2')
  // Array elements: [ 12", 13", ...] — same pattern after , or [
  out = out.replace(/([,[]\s*-?\d+(?:\.\d+)?)"(\s*[,\]}])/g, '$1$2')
  return out
}

export function parseScreenArray(text: string): any {
  const jsonText = stripCodeFences(text)
  // Try 1: direct parse
  try { return JSON.parse(jsonText) } catch {}
  // Try 2: repair truncated JSON
  try { return repairJSON(jsonText) } catch {}
  // Try 3: repair Sonnet's stray-quote-after-numbers bug
  // (e.g. `"padding": 16"` → `"padding": 16`). Activated only when standard
  // parses fail, so well-formed inputs are never touched.
  const dequoted = repairStrayDigitQuotes(jsonText)
  if (dequoted !== jsonText) {
    try { return JSON.parse(dequoted) } catch {}
    try { return repairJSON(dequoted) } catch {}
  }
  // Try 4: slice from first [ to last ]. Handles both leading prose
  // ("Here's your screens: [...]") and trailing prose ("[...] Hope this helps!").
  // Verbose models do both; the prior implementation only handled the leading case.
  const arrayStart = jsonText.indexOf('[')
  const arrayEnd = jsonText.lastIndexOf(']')
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    const extracted = jsonText.slice(arrayStart, arrayEnd + 1)
    try { return JSON.parse(extracted) } catch {}
    try { return repairJSON(extracted) } catch {}
    // Also try the stray-quote repair on the extracted slice
    const extractedDequoted = repairStrayDigitQuotes(extracted)
    if (extractedDequoted !== extracted) {
      try { return JSON.parse(extractedDequoted) } catch {}
      try { return repairJSON(extractedDequoted) } catch {}
    }
  }
  // Try 5: find JSON in a code block the stripCodeFences missed
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    const block = codeBlockMatch[1].trim()
    try { return JSON.parse(block) } catch {}
    try { return repairJSON(block) } catch {}
    const blockDequoted = repairStrayDigitQuotes(block)
    if (blockDequoted !== block) {
      try { return JSON.parse(blockDequoted) } catch {}
      try { return repairJSON(blockDequoted) } catch {}
    }
  }
  console.error('[parseScreenArray] All JSON parse attempts failed. Full raw body:\n', jsonText)
  return null
}

const STRICT_ARRAY_SUFFIX = '\n\nOutput MUST be a single JSON array, nothing before or after. No markdown fences. No explanation. The first character is `[`. The last character is `]`. Numeric values MUST NOT be quoted: write `"padding": 16` (correct) NOT `"padding": 16"` (wrong — stray quote breaks parsing). All number literals are unquoted.'

async function callAnthropic(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  })
}

/**
 * Optional data-action attached to a screen by the planner. Track B of the
 * BYO-Backend MVP: when an auth screen has a primary submit button, the
 * planner emits a `dataAction` so the exporter knows to wire the button to
 * Supabase auth instead of a plain navigation.navigate().
 */
export interface ScreenDataAction {
  kind: 'auth.signInWithPassword' | 'auth.signUp' | 'auth.signOut'
  /** plan id of the screen to navigate to on success */
  redirectScreen?: string
}

/**
 * Sanitize a parsed planner screen's `dataAction` field. Returns undefined
 * unless the input matches the strict shape — defends against the LLM
 * hallucinating other action kinds.
 */
function validateDataAction(raw: unknown): ScreenDataAction | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const kind = r.kind
  if (kind !== 'auth.signInWithPassword' && kind !== 'auth.signUp' && kind !== 'auth.signOut') {
    return undefined
  }
  const out: ScreenDataAction = { kind }
  if (typeof r.redirectScreen === 'string' && r.redirectScreen.length > 0) {
    out.redirectScreen = r.redirectScreen
  }
  return out
}

export function buildConnections(
  plan: { navigation?: { connections?: Array<{ from: string; to: string; trigger: string }> } },
  planIdToScreenId: Map<string, string>
): Array<{ fromScreenId: string; toScreenId: string; trigger: string }> {
  return (plan.navigation?.connections || [])
    .map(c => ({ fromScreenId: planIdToScreenId.get(c.from) || '', toScreenId: planIdToScreenId.get(c.to) || '', trigger: c.trigger }))
    .filter(c => c.fromScreenId && c.toScreenId)
}

function sendSSE(res: VercelResponse, data: Record<string, unknown>) {
  // Tolerate writes after the client has disconnected. Track D's design
  // keeps the function running to completion so screens land in the DB
  // even when the user navigated away — but the SSE channel is gone, so
  // res.write throws EPIPE / "write after end". Swallow it; the DB-write
  // path is the source of truth, this is just the live progress mirror.
  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  } catch {
    // intentional no-op
  }
}

/**
 * Deep-nav helper. The LLM emits navIntent.target using planner ids (e.g.
 * "ExerciseDetail") because that's what the plan listed. The DB schema and
 * the rest of the client identify screens by UUID, so before sending the
 * tree out we walk it and remap each push/openSheet target through the
 * planId→UUID map built from this run. Targets not in the map are left
 * untouched — they get caught by the normalizer's validateNavIntents pass
 * downstream and turned into noop.
 */
function rewriteNavIntentTargets(node: unknown, map: Map<string, string>): void {
  if (!node || typeof node !== 'object') return
  const n = node as Record<string, unknown>
  const intent = n.navIntent as { kind?: string; target?: string } | undefined
  if (intent && typeof intent.target === 'string' && (intent.kind === 'push' || intent.kind === 'openSheet')) {
    const remapped = map.get(intent.target)
    if (remapped) intent.target = remapped
  }
  const children = n.children
  if (Array.isArray(children)) {
    for (const c of children) rewriteNavIntentTargets(c, map)
  }
}

// ==================== FLOW HANDLER (mode: default) ====================

async function handleFlow(req: VercelRequest, res: VercelResponse, user: any) {
  if (!user.isMCP) {
    const creditCheck = await checkCredits(user.id, 'flow', user.email)
    if (!creditCheck.hasCredits) {
      return res.status(402).json({ error: creditCheck.error, creditsRemaining: creditCheck.creditsRemaining, upgradeUrl: creditCheck.upgradeUrl })
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })

  const { prompt, projectId, conversationHistory, images: rawImages } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing or invalid prompt' })
  const images = normalizeImages(rawImages)

  const userPlan = await getUserPlan(user.id, user.email)
  const model = userPlan === 'free' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-20250514'

  // When references are attached, prepend the inspiration block so the model
  // lifts visual style only — domain still comes from the user's text prompt.
  const flowSystem = images.length > 0
    ? `${REFERENCE_INSPIRATION_BLOCK}\n\n${FLOW_SYSTEM_PROMPT}`
    : FLOW_SYSTEM_PROMPT

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        system: [{ type: 'text', text: flowSystem, cache_control: { type: 'ephemeral' } }],
        messages: buildMessages(conversationHistory, prompt, images),
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Anthropic API error:', response.status, errorBody)
      logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, generationType: 'flow', promptPreview: prompt, success: false })
      return res.status(502).json({ error: 'Failed to generate flow' })
    }

    const data: any = await response.json()
    const text: string = data.content?.[0]?.text ?? ''
    if (!text) return res.status(502).json({ error: 'Empty response from AI service' })

    let screens = parseScreenArray(text)
    if (!screens) return res.status(502).json({ error: `AI returned invalid JSON. Raw start: ${stripCodeFences(text).slice(0, 100)}` })

    if (!Array.isArray(screens)) {
      if (screens && screens.tree) {
        screens = [{ id: 'screen-1', name: 'Screen 1', tree: screens.tree }]
      } else {
        return res.status(502).json({ error: 'AI did not return a valid screen flow array' })
      }
    }

    // Screen-name list for the BottomNav label validator. Built from the AI's
    // own screen array so positional fallback (tab[i] → screenNames[i]) lines
    // up with the order the AI thought about the app in.
    const flowScreenNames: string[] = (screens as Array<{ id?: string; name?: string }>).map(
      (s, i) => s.name || s.id || `Screen ${i + 1}`,
    )

    screens = screens.map((s: any, i: number) => ({
      id: s.id || `screen-${i + 1}`,
      name: s.name || `Screen ${i + 1}`,
      tree: normalizeComponentTree(
        expandComponents(
          validateBottomNavLabels(
            s.tree || { type: 'View', style: {}, children: [] },
            flowScreenNames,
          ),
        ),
      ),
    }))

    if (!user.isMCP) await deductCredits(user.id, 'flow', user.email)

    logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, tokensIn: data.usage?.input_tokens, tokensOut: data.usage?.output_tokens, generationType: 'flow', promptPreview: prompt, success: true })

    return res.status(200).json({ screens, modelUsed: 'Sonnet' })
  } catch (err) {
    console.error('Generate flow error:', err)
    return res.status(500).json({ error: `Failed to generate flow: ${err instanceof Error ? err.message : String(err)}` })
  }
}

// ==================== APP HANDLER (mode: "app") ====================

async function handleApp(
  req: VercelRequest,
  res: VercelResponse,
  user: any,
  userSupabase: SupabaseClient | null,
  /** When true, run the deep-nav planner (emits appData + routeGraph and
   *  asks the LLM for detail screens + modals). When false, run the legacy
   *  single-tier planner. Both paths share the rest of this handler — same
   *  paywall, SSE protocol, per-screen normalization, persistence. */
  deepNav: boolean = false,
) {
  if (!user.isMCP) {
    const tier = await getUserTier(user.id, user.email)
    if (tier === 'free') {
      const freeAppsUsed = await getFreeAppCount(user.id)
      const gate = decideAppGate(tier, freeAppsUsed)
      if (!gate.allow) {
        // Expected business logic — emit a paywall SSE event and end the stream.
        // Switching headers to SSE here so the client gets the event instead of a JSON 402.
        // Payload reconstructed from local vars (instead of gate.*) because Vercel's
        // per-file TS check doesn't reliably narrow the AppGateDecision discriminated
        // union — same data, type-safe construction.
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.setHeader('X-Accel-Buffering', 'no')
        sendSSE(res, {
          type: 'paywall',
          reason: 'free_app_limit_reached',
          free_apps_used: freeAppsUsed,
          free_apps_limit: FREE_APP_LIMIT,
        })
        return res.end()
      }
      // Free user under limit: bypass the legacy credits hard-check. Credits are
      // a deprecated counter post-YC pivot; the 2-app lifetime cap above is the
      // real gate, and a free user with a 0 balance must still get 2 apps.
    } else {
      const creditCheck = await checkCredits(user.id, 'app', user.email)
      if (!creditCheck.hasCredits) {
        return res.status(402).json({ error: creditCheck.error, creditsRemaining: creditCheck.creditsRemaining, upgradeUrl: creditCheck.upgradeUrl })
      }
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })

  const { prompt, projectId, conversationHistory, images: rawImages } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing or invalid prompt' })
  // Token-budget guard: image inputs are expensive. The current pipeline makes
  // exactly two LLM calls (planner + bulk screen-gen), so we attach images to
  // both — total cost stays <2x of the no-image path. If this ever splits into
  // per-screen generation, scope images to planner + the FIRST (home) screen
  // only and let subsequent screens inherit visual style via the planner's
  // designDirection brief.
  const images = normalizeImages(rawImages)

  // Phase 2 Track 1: open a generation_run row before any SSE output so we
  // can still return a clean JSON 409 if another run is already active for
  // this project. Skip entirely for MCP / anonymous (no userSupabase) and
  // for calls without a projectId — generation still works, we just lose the
  // resumability benefit. The existing happy path is unaffected on failure.
  let runId: string | null = null
  if (userSupabase && typeof projectId === 'string' && projectId.length > 0) {
    const ownership = await verifyProjectOwnership(userSupabase, projectId, user.id)
    if (!ownership.ok) {
      return res.status(ownership.status).json({ error: ownership.error })
    }
    const created = await createGenerationRun(userSupabase, projectId, 'app', null)
    if (created.conflict) {
      return res
        .status(409)
        .json({ error: 'generation_in_progress', run_id: created.conflict.existingRunId })
    }
    if (created.run) {
      runId = created.run.id
      await setProjectState(userSupabase, projectId, 'building')
    }
    // Soft errors (created.error set, no run) are logged inside the helper —
    // we keep going so a transient DB hiccup doesn't kill generation.
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  // Track D — generation continuation: Vercel Node functions keep running
  // until exit or maxDuration even after the client closes the connection.
  // The previous draft of this code aborted the run on 'close', which
  // caused the (correct) screens to land in the DB while the run row
  // (incorrectly) said 'aborted'. We now just track the disconnect so
  // sendSSE can no-op silently; the main handler runs to completion and
  // finalizes the run via complete/fail naturally.
  //
  // Edge case: if the function dies mid-generation (maxDuration hit before
  // the LLM responds), the run stays 'running' indefinitely. The client
  // applies a stale-detection threshold in useGenerationRun so the UI
  // doesn't show a perpetual "Resuming…" — see that hook.
  if (runId) {
    res.on('close', () => {
      // Intentionally NOT calling abortRun here. The function keeps going.
      // Logged so server-side log scraping can correlate disconnect events
      // with the run row's eventual status.
      console.log(`[generate-flow] client disconnected mid-stream; run ${runId} continues server-side`)
    })
  }

  const userPlan = await getUserPlan(user.id, user.email)

  // Helper: when an SSE error path bails early, mark the run failed so the
  // next page load can show "last generation failed" instead of "still
  // running". Sets status='failed' atomically (the helper's filter on
  // status='running' makes double-finalization a no-op).
  const finalizeFailed = async (errorMessage: string) => {
    if (runId && userSupabase) {
      await failRun(userSupabase, runId, errorMessage)
    }
  }

  try {
    // ===== PHASE 1: Plan the app with Haiku =====
    // Milestone (a): analyzing — emitted alongside the existing 'status' event so
    // a client that knows about 'milestone' can render a timeline, while older
    // clients still see the legacy 'status' phase change.
    emitMilestone(res, 'analyzing', 'Analyzing your prompt…')
    sendSSE(res, { type: 'status', phase: 'planning', message: 'Planning your app...' })

    const templateMatch = matchTemplate(prompt)
    if (templateMatch) {
      console.log(`[planner] template match: ${templateMatch.templateId} (score=${templateMatch.score.toFixed(2)})`)
    }

    const plannerCallApi = async (body: any) => {
      const r = await callAnthropic(apiKey, body)
      return { ok: r.ok, status: r.status, json: () => r.json(), text: () => r.text() }
    }

    let plan: PlannerAppPlan | null = null
    let appData: AppData | undefined
    let routeGraph: RouteGraph | undefined
    let plannerUsage: { input_tokens?: number; output_tokens?: number } | undefined

    if (deepNav) {
      // Deep-nav planner: returns plan + appData + routeGraph. Parse failures
      // throw — we surface them as the same SSE 'error' event the legacy path
      // uses so the client UI is mode-agnostic.
      try {
        const out = await runPlanner({
          callApi: plannerCallApi,
          prompt,
          images,
          conversationHistory: undefined,
          templateId: templateMatch?.templateId,
        })
        plan = out.plan
        appData = out.appData
        routeGraph = out.routeGraph
        // Defensive: if the planner returns a malformed routeGraph, downstream
        // Phase 0 hooks (validateNavIntents, repairDeadButtons) would throw on
        // `.screens.map` and kill the whole batch. Drop routeGraph so the
        // screen loop falls back to the legacy path (no Phase 0 hooks) for
        // this run instead.
        if (routeGraph && !Array.isArray(routeGraph.screens)) {
          console.warn('[deep-nav] missing or malformed routeGraph from planner; falling back to single-screen mode for this generation')
          routeGraph = undefined
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[generate-flow] deep-nav planner failed:', msg)
        const isParse = msg.includes('parse_failed')
        sendSSE(res, {
          type: 'error',
          message: isParse
            ? 'Failed to parse app plan. Try a more specific description.'
            : 'Failed to plan app. Try again.',
        })
        await finalizeFailed(isParse ? 'plan_parse_failed' : 'plan_api_error')
        return res.end()
      }
    } else {
      const plannerResult = await runAppPlanner({
        callApi: plannerCallApi,
        prompt,
        images,
        conversationHistory: undefined,
        templateId: templateMatch?.templateId,
      })
      plan = plannerResult.plan
      plannerUsage = plannerUsage

      if (!plan) {
        if (plannerResult.failureCode === 'api_error') {
          console.error('Plan API error')
          sendSSE(res, { type: 'error', message: 'Failed to plan app. Try again.' })
          await finalizeFailed('plan_api_error')
          return res.end()
        }
        console.error('[generate-flow] Phase 1 planner parse failed (post-retry). Stop reason:', plannerResult.stopReason, 'Full raw body:\n', plannerResult.rawText)
        sendSSE(res, { type: 'error', message: 'Failed to parse app plan. Try a more specific description.' })
        await finalizeFailed('plan_parse_failed')
        return res.end()
      }
    }

    if (!plan.screens || !Array.isArray(plan.screens) || plan.screens.length < 2) {
      sendSSE(res, { type: 'error', message: 'Invalid app plan. Try a more detailed description.' })
      await finalizeFailed('plan_invalid')
      return res.end()
    }
    if (!plan.screens.some(s => s.isHome)) plan.screens[0].isHome = true
    if (plan.screens.length > 13) plan.screens = plan.screens.slice(0, 13)

    // Sanitize dataAction on each screen — drops unrecognized kinds, keeps
    // back-compat for plans without dataAction (most non-auth apps).
    for (const s of plan.screens) {
      const validated = validateDataAction((s as any).dataAction)
      if (validated) {
        s.dataAction = validated
      } else if ('dataAction' in s) {
        delete (s as any).dataAction
      }
    }

    // Milestone (b): identified — once the planner has produced a usable
    // app shape, surface what we understood so the user sees signal before
    // any screen renders. deriveIdentified pulls from appData when present
    // (deep-nav) and falls back to plan-only counts otherwise.
    emitMilestone(
      res,
      'identified',
      deriveIdentified(plan as { appName?: string; screens?: unknown[] }, appData as Record<string, unknown> | undefined),
      'done',
    )

    // Deep-nav extras (appData + routeGraph) ride alongside `plan` in the
    // same event so the client can persist them once instead of waiting for
    // 'complete'. The fields are undefined in legacy mode and the client
    // ignores them.
    sendSSE(res, { type: 'plan', plan, appData, routeGraph })

    // ===== PHASE 2: Generate all screens =====
    const screenCount = plan.screens.length
    // Milestone (c): generating — starts the long-running step. Done state is
    // emitted post-Promise.all alongside milestone (d).
    emitMilestone(res, 'generating', `Generating ${screenCount} screen${screenCount === 1 ? '' : 's'}…`)
    sendSSE(res, { type: 'status', phase: 'generating', message: `Generating ${screenCount} screens...`, current: 0, total: screenCount })

    // free-tier app gen on Sonnet for parse reliability; activation > free-tier COGS.
    // Phase 1 planner stays on Haiku (small JSON, rarely fails, big cost savings).
    const genModel = userPlan === 'free' ? 'claude-sonnet-4-6' : 'claude-sonnet-4-20250514'

    const screenList = plan.screens.map((s, i) =>
      `${i + 1}. "${s.name}" (id: "${s.id}", type: ${s.screenType}${s.isHome ? ', HOME SCREEN' : ''}): ${s.description}`
    ).join('\n')

    const tabInfo = plan.navigation?.tabScreens?.length
      ? `Tab screens: ${plan.navigation.tabScreens.join(', ')}. These screens MUST include an identical BottomNav. Active tab matches current screen.`
      : 'No bottom tabs — use stack navigation only.'

    const genPrompt = `Generate ALL ${screenCount} screens for "${plan.appName || 'MyApp'}".

SCREEN PLAN:
${screenList}

DESIGN: Theme: ${plan.designDirection?.theme || 'dark'}, Accent: ${plan.designDirection?.accentColor || '#6C5CE7'}, Style: ${plan.designDirection?.style || 'modern minimal'}
NAVIGATION: ${plan.navigation?.type || 'stack'}. ${tabInfo}

CRITICAL: ALL screens use accent ${plan.designDirection?.accentColor || '#6C5CE7'} for actions. Same surfaces, text colors, card styles. App name "${plan.appName || 'MyApp'}" in Home header.

Original request: "${prompt}"

IMPORTANT: Keep each screen's tree COMPACT. Use macro components (BottomNav, SearchBar, ProductCard, ListRow, StatCard, etc.) instead of building from raw Views. This keeps output small and ensures valid JSON.

Return ONLY a JSON array of ${screenCount} screens with "id", "name", "tree". No explanation, no markdown.`

    // Deep-nav addendum: when the planner produced a routeGraph, the screen
    // generator must emit navIntent fields on every TouchableOpacity that
    // navigates. Without this, the runtime falls back to fuzzy-match
    // heuristics — fine for legacy apps, useless for list→detail flows
    // where the planner already declared the intent. Static list of valid
    // targets is injected so the LLM doesn't invent screen ids.
    // Stringify appData for the screen-gen prompt. Tools downstream consume
    // it record-by-record via sentinel substitution, but the LLM also needs
    // the exact record names + ids when rendering list screens — otherwise
    // it hallucinates content (e.g. cards labeled "Chest Crusher" while
    // appData.workouts has "Push-ups"), breaking the list→detail data link.
    const appDataJson = deepNav && appData
      ? JSON.stringify(appData, null, 2).slice(0, 8000)
      : ''

    const deepNavAddendum = deepNav && routeGraph
      ? `

DEEP NAVIGATION — navIntent + appData BINDING (CRITICAL):

Every TouchableOpacity (button, card, list row) that navigates somewhere
MUST carry a "navIntent" field on the same node:

  { "type": "TouchableOpacity",
    "navIntent": { "kind": "push", "target": "<screenId>", "params": { "id": "<recordId>" } },
    "children": [ ... ] }

Rules:
- kind: "push" for screens, "openSheet" for modals, "noop" for non-navigating taps.
- target: MUST be one of these planner ids exactly:
${routeGraph.screens.map(s => `    "${s.id}" (${s.kind})`).join('\n')}
- params: include "id" pointing at an appData record id when navigating to a
  detail screen (params: ["id"]). Other params per the routeGraph entry.
- Every list/grid item that opens a detail screen MUST set navIntent on the
  outer TouchableOpacity (NOT on inner text/icons).
- Tab bar items DO NOT need navIntent — the runtime resolves tabs by id from
  the routeGraph.tabs list.

LIST SCREENS — BIND TO appData (CRITICAL):

When generating a list/grid/feed screen whose routeGraph entry has
\`dataSource: "<collection>"\`, you MUST render ONE card per record in
appData.<collection>. Use the record's EXACT name field for the card
title, and pass the record's \`id\` as the navIntent params.id.

NEVER invent new record names. NEVER skip records. The list screen
is data-bound, not creatively named.

appData (record source — these are the ONLY records that exist):
${appDataJson || '(none)'}

Detail screens (kind: "screen" with dataSource) MUST use {{name}},
{{description}}, etc. placeholders — the runtime substitutes them from
the matching appData record at navigation time.

Modals (kind: "modal") render their own content and may use sentinels
keyed off the navigating screen's current params.
`
      : ''

    const genSystem = images.length > 0
      ? `${REFERENCE_INSPIRATION_BLOCK}\n\n${APP_GENERATION_SYSTEM_PROMPT}${deepNavAddendum}`
      : `${APP_GENERATION_SYSTEM_PROMPT}${deepNavAddendum}`

    const genBody = {
      model: genModel,
      max_tokens: 48000,
      system: [{ type: 'text', text: genSystem, cache_control: { type: 'ephemeral' } }],
      messages: buildMessages(conversationHistory, genPrompt, images),
    }

    let genResponse = await callAnthropic(apiKey, genBody)
    if (!genResponse.ok) {
      console.error('Generation API error:', genResponse.status, await genResponse.text())
      logUsage({ userId: user.id, projectId, modelUsed: genModel, generationType: 'app', promptPreview: prompt, success: false })
      sendSSE(res, { type: 'error', message: 'Failed to generate screens. Try again.' })
      await finalizeFailed('screen_gen_api_error')
      return res.end()
    }

    let genData: any = await genResponse.json()
    let genText: string = genData.content?.[0]?.text ?? ''
    let screens = parseScreenArray(genText)

    // Retry on ANY parse failure, not just max_tokens. Sonnet 4.6 occasionally
    // emits malformed JSON (stray `"` after numeric values, e.g. `"padding": 16"`)
    // even when stop_reason='end_turn'. The stricter STRICT_ARRAY_SUFFIX usually
    // resolves it; max_tokens is bumped on the retry too in case the original
    // failed for length reasons we missed.
    if (!screens) {
      console.error('[generate-flow] Phase 2 screen-gen parse failed; retrying with 64000 + strict suffix. Stop reason:', genData.stop_reason, 'Full raw body:\n', genText)
      const retryResp = await callAnthropic(apiKey, {
        ...genBody,
        max_tokens: 64000,
        system: [{ type: 'text', text: genSystem + STRICT_ARRAY_SUFFIX, cache_control: { type: 'ephemeral' } }],
      })
      if (retryResp.ok) {
        genData = await retryResp.json()
        genText = genData.content?.[0]?.text ?? ''
        screens = parseScreenArray(genText)
      } else {
        console.error('[generate-flow] Phase 2 retry HTTP error:', retryResp.status, await retryResp.text())
      }
    }

    if (!screens) {
      console.error('[generate-flow] Phase 2 screen-gen parse failed (post-retry). Stop reason:', genData.stop_reason, 'Full raw body:\n', genText)
      sendSSE(res, { type: 'error', message: 'Failed to parse generated screens.' })
      await finalizeFailed('screen_parse_failed')
      return res.end()
    }
    if (!Array.isArray(screens)) {
      screens = screens?.tree ? [screens] : []
    }
    if (screens.length === 0) {
      sendSSE(res, { type: 'error', message: 'AI did not return valid screen array.' })
      await finalizeFailed('screen_array_invalid')
      return res.end()
    }

    // Bug 2: derive ONE persona per app so avatars, greetings, and the Profile
    // page all reference the same user. Deterministic from appName, so
    // re-generating the same app gives the same user.
    const persona = buildPersona(plan.appName || prompt)

    // Screen-name list for the BottomNav label validator. Prefer the
    // planner's tabScreens order (the canonical tab sequence) so positional
    // substitution lines up with what the BottomNav items[] array represents.
    // Fall back to the planner's full screen list in plan order.
    const planScreenById = new Map<string, { id: string; name?: string }>()
    for (const ps of (plan.screens || []) as Array<{ id: string; name?: string }>) {
      if (ps?.id) planScreenById.set(ps.id, ps)
    }
    const tabScreenNames: string[] = Array.isArray(plan.navigation?.tabScreens)
      ? (plan.navigation!.tabScreens as string[])
          .map(id => planScreenById.get(id)?.name)
          .filter((n): n is string => typeof n === 'string' && n.length > 0)
      : []
    const planScreenNames: string[] = tabScreenNames.length > 0
      ? tabScreenNames
      : ((plan.screens || []) as Array<{ name?: string }>)
          .map(s => s.name)
          .filter((n): n is string => typeof n === 'string' && n.length > 0)

    // Pre-allocate planner-id → DB-UUID mapping so deep-nav can rewrite
    // navIntent.target (planner emits descriptive ids like "ExerciseDetail",
    // DB schema requires UUID) in the same pass it normalizes the tree. The
    // legacy path doesn't read this map until the connections build later
    // (no behavior change there).
    const planIdToScreenId = new Map<string, string>()
    for (let i = 0; i < screens.length; i++) {
      const planId = screens[i].id || plan.screens[i]?.id || `screen-${i + 1}`
      planIdToScreenId.set(planId, crypto.randomUUID())
    }

    // Sequential async loop (was screens.map) so we can persist each screen
    // to the DB mid-stream. The LLM has already returned all screens by this
    // point — we're iterating over an in-memory array, so awaiting per-screen
    // INSERTs adds O(n × DB-roundtrip) which is negligible vs the LLM call.
    const normalizedScreens: Array<{ id: string; planId: string; name: string; tree: unknown }> = []
    for (let i = 0; i < screens.length; i++) {
      const s = screens[i]
      const planId = s.id || plan.screens[i]?.id || `screen-${i + 1}`
      const screenId = planIdToScreenId.get(planId)!
      const tree = normalizeComponentTree(
        expandComponents(
          validateBottomNavLabels(
            s.tree || { type: 'View', style: {}, children: [] },
            planScreenNames,
          ),
        ),
      )
      // Walk the tree and replace any invented person-name/email with the shared persona.
      applyPersonaToTree(tree, persona)
      // Deep-nav: rewrite navIntent.target from planner ids to DB UUIDs so
      // RuntimeIframePreview's `screens.some(s => s.id === navIntent.target)`
      // resolution actually matches. No-op on legacy 'app' mode (planner emits
      // no navIntents). Unknown targets are left untouched — normalizer's
      // validateNavIntents (when wired in a follow-up) will turn them into
      // noop.
      if (deepNav) rewriteNavIntentTargets(tree, planIdToScreenId)
      // Phase 0: validate navIntents against routeGraph (UUID-rewritten form)
      // and run dead-button repair stub. Both are no-ops on the legacy path.
      // Wrapped in a per-screen try/catch so a bug in either hook can't kill
      // the entire batch — on failure we fall back to the raw tree (worst
      // case: dead buttons on this one screen, vs. an empty generation).
      let finalTree: any = tree
      if (deepNav && routeGraph) {
        try {
          const uuidRouteGraph = {
            screens: routeGraph.screens.map(rs => ({
              ...rs,
              id: planIdToScreenId.get(rs.id) || rs.id,
            })),
            tabs: (routeGraph.tabs ?? []).map(t => planIdToScreenId.get(t) || t),
          }
          const validated = validateNavIntents(tree, uuidRouteGraph)
          finalTree = validated.tree
          if (validated.warnings.length > 0) {
            console.warn('[deep-nav] nav warnings for screen', planId, validated.warnings)
          }
          const repairStats = { buttonsScanned: 0, repaired: 0, toasted: 0, preserved: 0, errors: 0 }
          finalTree = repairDeadButtons(finalTree, uuidRouteGraph as any, planId, repairStats)
          if (repairStats.buttonsScanned > 0) {
            console.log('[deep-nav] dead-button repair', planId, repairStats)
          }
          // Warn-only back-button heuristic. Look up this screen's planner
          // metadata (presentation + params) and check for a back affordance.
          const meta = routeGraph.screens.find(rs => rs.id === planId)
          if (meta) {
            const back = checkBackButton(finalTree, {
              id: planId,
              presentation: meta.kind === 'modal' ? 'modal' : 'screen',
              params: meta.params,
            })
            if (back.warnings.length > 0) {
              console.warn('[deep-nav] back-button warnings', planId, back.warnings)
            }
          }
        } catch (err) {
          console.error('[deep-nav] per-screen phase-0 hook failed for', planId, '— falling back to original tree:', err)
          finalTree = tree
        }
      }
      const normalized = {
        id: screenId,
        planId,
        name: s.name || plan.screens[i]?.name || `Screen ${i + 1}`,
        tree: finalTree,
      }
      normalizedScreens.push(normalized)

      // Persist each screen as it's normalized so a refresh-during-flight
      // sees partial state. Service-role bypass would also work here but
      // userSupabase keeps RLS enforced. Best-effort: a write failure just
      // means the client's debounced upsert at the end of the stream will
      // catch up — the existing happy path is unaffected. Skip entirely
      // when no projectId / no user-scoped client (back-compat).
      if (userSupabase && typeof projectId === 'string') {
        const { error: insertErr } = await userSupabase.from('screens').insert({
          id: normalized.id,
          project_id: projectId,
          name: normalized.name,
          component_tree: normalized.tree,
          original_prompt: prompt,
          order_index: i,
          source: 'web',
        })
        if (insertErr) {
          console.warn('[generate-flow] mid-stream screen insert failed:', normalized.name, insertErr.message)
        }
      }

      sendSSE(res, { type: 'screen', index: i, screen: { id: normalized.id, name: normalized.name, tree: normalized.tree } })
      sendSSE(res, { type: 'status', phase: 'generating', message: `Generated ${normalized.name} (${i + 1}/${screenCount})`, current: i + 1, total: screenCount })

      // Update generation_runs progress so the project page (or a second
      // tab) can render an accurate "screen N of T" indicator via realtime.
      if (runId && userSupabase) {
        await updateRunProgress(userSupabase, runId, i + 1, screenCount)
      }
    }

    // Build connections from plan. planIdToScreenId was pre-allocated before
    // the screens loop so deep-nav could rewrite navIntent.target inline.
    const connections = buildConnections(plan, planIdToScreenId)

    // Deep-nav: rewrite the routeGraph (and any tabs list) from planner ids
    // to the DB UUIDs the client uses. The runtime navigates against screens
    // by id, so without this rewrite tab + entry lookups would never resolve.
    if (deepNav && routeGraph) {
      routeGraph = {
        screens: routeGraph.screens.map(s => ({
          ...s,
          id: planIdToScreenId.get(s.id) || s.id,
        })),
        tabs: (routeGraph.tabs ?? []).map(t => planIdToScreenId.get(t) || t),
      }
    }

    const homePlanId = plan.screens.find(s => s.isHome)?.id || plan.screens[0]?.id
    const homeScreenId = planIdToScreenId.get(homePlanId) || normalizedScreens[0]?.id

    if (!user.isMCP) await deductCredits(user.id, 'app', user.email)

    logUsage({
      userId: user.id, projectId: projectId || undefined, modelUsed: genModel,
      tokensIn: (plannerUsage?.input_tokens || 0) + (genData.usage?.input_tokens || 0),
      tokensOut: (plannerUsage?.output_tokens || 0) + (genData.usage?.output_tokens || 0),
      generationType: 'app', promptPreview: prompt, success: true,
    })

    // Milestone (d): complete — flips the 'generating' step to done and adds a
    // terminal 'Done' row. Emitted right before the legacy 'complete' event so
    // a client watching the timeline reaches the final state in the same tick
    // it learns the screens are ready.
    emitMilestone(res, 'generating', `Generated ${normalizedScreens.length} screen${normalizedScreens.length === 1 ? '' : 's'}`, 'done')
    emitMilestone(res, 'complete', `Done — ${normalizedScreens.length} screen${normalizedScreens.length === 1 ? '' : 's'} ready`, 'done')

    sendSSE(res, {
      type: 'complete',
      screens: normalizedScreens.map((s: { id: string; name: string; tree: unknown }) => ({ id: s.id, name: s.name, tree: s.tree })),
      connections, homeScreenId, appName: plan.appName,
      modelUsed: genModel.includes('sonnet') ? 'Sonnet' : 'Haiku',
      // Deep-nav extras: undefined in legacy mode; clients ignore unknown
      // fields gracefully.
      appData,
      routeGraph,
    })
    if (runId && userSupabase && typeof projectId === 'string') {
      await completeRun(userSupabase, runId)
      await setProjectState(userSupabase, projectId, 'built')
    }
    res.end()
  } catch (err) {
    console.error('Generate app error:', err)
    sendSSE(res, { type: 'error', message: `Failed: ${err instanceof Error ? err.message : String(err)}` })
    if (runId && userSupabase) {
      await failRun(userSupabase, runId, err instanceof Error ? err.message : String(err))
    }
    res.end()
  }
}

// ==================== ROUTER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await authenticateRequest(req, res)
  if (!user) return

  // Per-request user-JWT-scoped Supabase client. Used by handleApp to write
  // generation_runs and screens under the user's identity (RLS enforced)
  // instead of via service-role bypass. Null for MCP / anonymous callers,
  // in which case handleApp falls back to its pre-Phase-2 in-memory path.
  const userSupabase = createUserSupabaseClient(user.accessToken)

  const { mode } = req.body ?? {}

  // Deep-nav is the canonical app-generation mode (planner emits routeGraph
  // + appData + detail screens, runtime/exporter consume them). 'app' remains
  // a back-compat alias for the legacy single-tier planner so direct API
  // callers and older clients still work.
  if (mode === 'deep-nav' || mode === 'app') {
    return handleApp(req, res, user, userSupabase, mode === 'deep-nav')
  }
  return handleFlow(req, res, user)
}
