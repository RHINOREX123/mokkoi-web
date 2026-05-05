import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, checkCredits, logUsage, deductCredits, getUserPlan } from './_lib/auth-helper.js'
import { getUserPlan as getUserTier, getFreeAppCount, decideAppGate, FREE_APP_LIMIT } from './_lib/userPlan.js'
import { normalizeComponentTree } from './_lib/normalizer.js'
import { expandComponents } from '../lib/component-library.js'
import { validateBottomNavLabels } from './_lib/bottomnav-validator.js'
import { DESIGN_TOKENS, CONTENT_LIBRARY, COMPONENT_TYPES, VIEWPORT_BUDGET, CONTENT_DENSITY, PLATFORM_RULES, QUALITY_CHECKLIST, FUNCTIONAL_APP_RULES, buildPlannerSystem } from './_lib/design-system.js'
import { matchTemplate } from './_lib/template-matcher.js'
import { buildPersona, applyPersonaToTree } from './_lib/persona.js'

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

/** Build a Claude-compatible messages array from conversation history + current prompt. */
function buildMessages(
  conversationHistory: Array<{ role: string; content: string }> | undefined,
  currentContent: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  if (Array.isArray(conversationHistory)) {
    for (const m of conversationHistory.slice(-5)) {
      const role = m.role === 'assistant' ? 'assistant' : 'user'
      if (messages.length > 0 && messages[messages.length - 1].role === role) {
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
  return [...messages, { role: 'user', content: currentContent }]
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

export function parseScreenArray(text: string): any {
  const jsonText = stripCodeFences(text)
  // Try 1: direct parse
  try { return JSON.parse(jsonText) } catch {}
  // Try 2: repair truncated JSON
  try { return repairJSON(jsonText) } catch {}
  // Try 3: slice from first [ to last ]. Handles both leading prose
  // ("Here's your screens: [...]") and trailing prose ("[...] Hope this helps!").
  // Verbose models do both; the prior implementation only handled the leading case.
  const arrayStart = jsonText.indexOf('[')
  const arrayEnd = jsonText.lastIndexOf(']')
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    const extracted = jsonText.slice(arrayStart, arrayEnd + 1)
    try { return JSON.parse(extracted) } catch {}
    try { return repairJSON(extracted) } catch {}
  }
  // Try 4: find JSON in a code block the stripCodeFences missed
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()) } catch {}
    try { return repairJSON(codeBlockMatch[1].trim()) } catch {}
  }
  console.error('[parseScreenArray] All JSON parse attempts failed. Full raw body:\n', jsonText)
  return null
}

function parseAppPlan(text: string): AppPlan | null {
  const jsonText = stripCodeFences(text)
  try { return JSON.parse(jsonText) } catch {}
  try { return repairJSON(jsonText) } catch {}
  const objStart = jsonText.indexOf('{')
  const objEnd = jsonText.lastIndexOf('}')
  if (objStart >= 0 && objEnd > objStart) {
    const extracted = jsonText.slice(objStart, objEnd + 1)
    try { return JSON.parse(extracted) } catch {}
    try { return repairJSON(extracted) } catch {}
  }
  return null
}

const STRICT_ARRAY_SUFFIX = '\n\nOutput MUST be a single JSON array, nothing before or after. No markdown fences. No explanation. The first character is `[`. The last character is `]`.'
const STRICT_OBJECT_SUFFIX = '\n\nOutput MUST be a single JSON object, nothing before or after. No markdown fences. No explanation. The first character is `{`. The last character is `}`.'

async function callAnthropic(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  })
}

interface AppPlan {
  appName: string
  screens: Array<{ id: string; name: string; description: string; screenType: string; isHome: boolean }>
  navigation: { type: 'tabs' | 'stack' | 'hybrid'; tabScreens?: string[]; connections: Array<{ from: string; to: string; trigger: string }> }
  designDirection: { theme: string; accentColor: string; style: string }
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
  res.write(`data: ${JSON.stringify(data)}\n\n`)
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

  const { prompt, projectId, conversationHistory } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing or invalid prompt' })

  const userPlan = await getUserPlan(user.id, user.email)
  const model = userPlan === 'free' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-20250514'

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        system: [{ type: 'text', text: FLOW_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: buildMessages(conversationHistory, prompt),
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

async function handleApp(req: VercelRequest, res: VercelResponse, user: any) {
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

  const { prompt, projectId, conversationHistory } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing or invalid prompt' })

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const userPlan = await getUserPlan(user.id, user.email)

  try {
    // ===== PHASE 1: Plan the app with Haiku =====
    sendSSE(res, { type: 'status', phase: 'planning', message: 'Planning your app...' })

    const templateMatch = matchTemplate(prompt)
    if (templateMatch) {
      console.log(`[planner] template match: ${templateMatch.templateId} (score=${templateMatch.score.toFixed(2)})`)
    }
    const plannerSystem = buildPlannerSystem(templateMatch?.templateId)

    const PLANNER_MODEL = 'claude-haiku-4-5-20251001'
    const plannerBody = {
      model: PLANNER_MODEL,
      max_tokens: 2000,
      system: [{ type: 'text', text: plannerSystem, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
    }

    let planResponse = await callAnthropic(apiKey, plannerBody)
    if (!planResponse.ok) {
      console.error('Plan API error:', planResponse.status, await planResponse.text())
      sendSSE(res, { type: 'error', message: 'Failed to plan app. Try again.' })
      return res.end()
    }

    let planData: any = await planResponse.json()
    let planText: string = planData.content?.[0]?.text ?? ''
    let plan: AppPlan | null = parseAppPlan(planText)

    if (!plan && planData.stop_reason === 'max_tokens') {
      console.error('[generate-flow] Phase 1 planner hit max_tokens; retrying with bumped tokens + strict suffix. Stop reason:', planData.stop_reason, 'Full raw body:\n', planText)
      const retryResp = await callAnthropic(apiKey, {
        ...plannerBody,
        max_tokens: 64000,
        system: [{ type: 'text', text: plannerSystem + STRICT_OBJECT_SUFFIX, cache_control: { type: 'ephemeral' } }],
      })
      if (retryResp.ok) {
        planData = await retryResp.json()
        planText = planData.content?.[0]?.text ?? ''
        plan = parseAppPlan(planText)
      } else {
        console.error('[generate-flow] Phase 1 planner retry HTTP error:', retryResp.status, await retryResp.text())
      }
    }

    if (!plan) {
      console.error('[generate-flow] Phase 1 planner parse failed. Stop reason:', planData.stop_reason, 'Full raw body:\n', planText)
      sendSSE(res, { type: 'error', message: 'Failed to parse app plan. Try a more specific description.' })
      return res.end()
    }

    if (!plan.screens || !Array.isArray(plan.screens) || plan.screens.length < 2) {
      sendSSE(res, { type: 'error', message: 'Invalid app plan. Try a more detailed description.' })
      return res.end()
    }
    if (!plan.screens.some(s => s.isHome)) plan.screens[0].isHome = true
    if (plan.screens.length > 8) plan.screens = plan.screens.slice(0, 8)

    sendSSE(res, { type: 'plan', plan })

    // ===== PHASE 2: Generate all screens =====
    const screenCount = plan.screens.length
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

    const genBody = {
      model: genModel,
      max_tokens: 48000,
      system: [{ type: 'text', text: APP_GENERATION_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: buildMessages(conversationHistory, genPrompt),
    }

    let genResponse = await callAnthropic(apiKey, genBody)
    if (!genResponse.ok) {
      console.error('Generation API error:', genResponse.status, await genResponse.text())
      logUsage({ userId: user.id, projectId, modelUsed: genModel, generationType: 'app', promptPreview: prompt, success: false })
      sendSSE(res, { type: 'error', message: 'Failed to generate screens. Try again.' })
      return res.end()
    }

    let genData: any = await genResponse.json()
    let genText: string = genData.content?.[0]?.text ?? ''
    let screens = parseScreenArray(genText)

    if (!screens && genData.stop_reason === 'max_tokens') {
      console.error('[generate-flow] Phase 2 screen-gen hit max_tokens; retrying with 64000 + strict suffix. Stop reason:', genData.stop_reason, 'Full raw body:\n', genText)
      const retryResp = await callAnthropic(apiKey, {
        ...genBody,
        max_tokens: 64000,
        system: [{ type: 'text', text: APP_GENERATION_SYSTEM_PROMPT + STRICT_ARRAY_SUFFIX, cache_control: { type: 'ephemeral' } }],
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
      console.error('[generate-flow] Phase 2 screen-gen parse failed. Stop reason:', genData.stop_reason, 'Full raw body:\n', genText)
      sendSSE(res, { type: 'error', message: 'Failed to parse generated screens.' })
      return res.end()
    }
    if (!Array.isArray(screens)) {
      screens = screens?.tree ? [screens] : []
    }
    if (screens.length === 0) {
      sendSSE(res, { type: 'error', message: 'AI did not return valid screen array.' })
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

    const normalizedScreens = screens.map((s: any, i: number) => {
      const screenId = crypto.randomUUID()
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
      const normalized = {
        id: screenId,
        planId: s.id || plan.screens[i]?.id || `screen-${i + 1}`,
        name: s.name || plan.screens[i]?.name || `Screen ${i + 1}`,
        tree,
      }
      sendSSE(res, { type: 'screen', index: i, screen: { id: normalized.id, name: normalized.name, tree: normalized.tree } })
      sendSSE(res, { type: 'status', phase: 'generating', message: `Generated ${normalized.name} (${i + 1}/${screenCount})`, current: i + 1, total: screenCount })
      return normalized
    })

    // Build connections from plan
    const planIdToScreenId = new Map<string, string>()
    for (const s of normalizedScreens) planIdToScreenId.set(s.planId, s.id)

    const connections = buildConnections(plan, planIdToScreenId)

    const homePlanId = plan.screens.find(s => s.isHome)?.id || plan.screens[0]?.id
    const homeScreenId = planIdToScreenId.get(homePlanId) || normalizedScreens[0]?.id

    if (!user.isMCP) await deductCredits(user.id, 'app', user.email)

    logUsage({
      userId: user.id, projectId: projectId || undefined, modelUsed: genModel,
      tokensIn: (planData.usage?.input_tokens || 0) + (genData.usage?.input_tokens || 0),
      tokensOut: (planData.usage?.output_tokens || 0) + (genData.usage?.output_tokens || 0),
      generationType: 'app', promptPreview: prompt, success: true,
    })

    sendSSE(res, {
      type: 'complete',
      screens: normalizedScreens.map((s: { id: string; name: string; tree: unknown }) => ({ id: s.id, name: s.name, tree: s.tree })),
      connections, homeScreenId, appName: plan.appName,
      modelUsed: genModel.includes('sonnet') ? 'Sonnet' : 'Haiku',
    })
    res.end()
  } catch (err) {
    console.error('Generate app error:', err)
    sendSSE(res, { type: 'error', message: `Failed: ${err instanceof Error ? err.message : String(err)}` })
    res.end()
  }
}

// ==================== ROUTER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await authenticateRequest(req, res)
  if (!user) return

  const { mode } = req.body ?? {}

  if (mode === 'app') {
    return handleApp(req, res, user)
  }
  return handleFlow(req, res, user)
}
