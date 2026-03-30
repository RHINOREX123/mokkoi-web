import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, checkCredits, logUsage, deductCredits, getUserPlan } from './auth-helper.js'
import { normalizeComponentTree } from './normalizer.js'
import { DESIGN_TOKENS, CONTENT_LIBRARY, COMPONENT_TYPES, VIEWPORT_BUDGET, CONTENT_DENSITY, PLATFORM_RULES, QUALITY_CHECKLIST, APP_PLANNER_SYSTEM_PROMPT } from './design-system.js'

// Reuse the flow generation system prompt for Phase 2 (screen generation)
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

${QUALITY_CHECKLIST}

Return ONLY a JSON array of screen objects. No markdown, no explanation.`

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

/** Attempt to repair truncated JSON by closing unclosed braces/brackets */
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

interface AppPlan {
  appName: string
  screens: Array<{
    id: string
    name: string
    description: string
    screenType: string
    isHome: boolean
  }>
  navigation: {
    type: 'tabs' | 'stack' | 'hybrid'
    tabScreens?: string[]
    connections: Array<{ from: string; to: string; trigger: string }>
  }
  designDirection: {
    theme: string
    accentColor: string
    style: string
  }
}

function sendSSE(res: VercelResponse, data: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await authenticateRequest(req, res)
  if (!user) return

  if (!user.isMCP) {
    const creditCheck = await checkCredits(user.id, 'app')
    if (!creditCheck.hasCredits) {
      return res.status(402).json({
        error: creditCheck.error,
        creditsRemaining: creditCheck.creditsRemaining,
        upgradeUrl: creditCheck.upgradeUrl,
      })
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })
  }

  const { prompt, projectId, conversationHistory } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' })
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const userPlan = await getUserPlan(user.id)

  try {
    // ========== PHASE 1: Plan the app with Haiku (fast + cheap) ==========
    sendSSE(res, { type: 'status', phase: 'planning', message: 'Planning your app...' })

    const planResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: [{ type: 'text', text: APP_PLANNER_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!planResponse.ok) {
      const errBody = await planResponse.text()
      console.error('Plan API error:', planResponse.status, errBody)
      sendSSE(res, { type: 'error', message: 'Failed to plan app. Try again.' })
      res.end()
      return
    }

    const planData: any = await planResponse.json()
    const planText = (planData.content?.[0]?.text ?? '').trim()
      .replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()

    let plan: AppPlan
    try {
      plan = JSON.parse(planText)
    } catch {
      try {
        plan = repairJSON(planText)
      } catch {
        console.error('Plan JSON parse failed:', planText.slice(0, 300))
        sendSSE(res, { type: 'error', message: 'Failed to parse app plan. Try a more specific description.' })
        res.end()
        return
      }
    }

    // Validate plan structure
    if (!plan.screens || !Array.isArray(plan.screens) || plan.screens.length < 2) {
      sendSSE(res, { type: 'error', message: 'Invalid app plan. Try a more detailed description.' })
      res.end()
      return
    }

    // Ensure at least one home screen
    if (!plan.screens.some(s => s.isHome)) {
      plan.screens[0].isHome = true
    }

    // Cap at 8 screens
    if (plan.screens.length > 8) {
      plan.screens = plan.screens.slice(0, 8)
    }

    sendSSE(res, { type: 'plan', plan })

    // ========== PHASE 2: Generate all screens with Sonnet ==========
    const screenCount = plan.screens.length
    sendSSE(res, {
      type: 'status',
      phase: 'generating',
      message: `Generating ${screenCount} screens...`,
      current: 0,
      total: screenCount,
    })

    const genModel = userPlan === 'free' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-20250514'

    // Build the generation prompt with plan context
    const screenList = plan.screens.map((s, i) =>
      `${i + 1}. "${s.name}" (id: "${s.id}", type: ${s.screenType}${s.isHome ? ', HOME SCREEN' : ''}): ${s.description}`
    ).join('\n')

    const tabInfo = plan.navigation.tabScreens?.length
      ? `Tab screens: ${plan.navigation.tabScreens.join(', ')}. These screens MUST include an identical BottomNav with items matching these tab names. The active tab must match the current screen.`
      : 'No bottom tabs — use stack navigation only.'

    const genPrompt = `Generate ALL ${screenCount} screens for the app "${plan.appName || 'MyApp'}".

SCREEN PLAN:
${screenList}

DESIGN DIRECTION:
- Theme: ${plan.designDirection?.theme || 'dark'}
- Accent color: ${plan.designDirection?.accentColor || '#6C5CE7'} — use this for ALL primary buttons, active tabs, highlights, and interactive elements
- Style: ${plan.designDirection?.style || 'modern minimal'}

NAVIGATION:
- Type: ${plan.navigation?.type || 'stack'}
- ${tabInfo}

CRITICAL CONSISTENCY:
- ALL screens use accent color ${plan.designDirection?.accentColor || '#6C5CE7'} as primary action color
- ALL screens use the same surface colors, text colors, and border colors
- Card backgrounds, border radius, and spacing are consistent across screens
- Header styling is identical across all screens
- The app name "${plan.appName || 'MyApp'}" should appear in the Home screen header

Original user request: "${prompt}"

Return a JSON array of ${screenCount} screen objects, each with "id", "name", and "tree".`

    const genResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: genModel,
        max_tokens: 32000,
        system: [{ type: 'text', text: APP_GENERATION_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: buildMessages(conversationHistory, genPrompt),
      }),
    })

    if (!genResponse.ok) {
      const errBody = await genResponse.text()
      console.error('Generation API error:', genResponse.status, errBody)
      logUsage({ userId: user.id, projectId, modelUsed: genModel, generationType: 'app', promptPreview: prompt, success: false })
      sendSSE(res, { type: 'error', message: 'Failed to generate screens. Try again.' })
      res.end()
      return
    }

    const genData: any = await genResponse.json()
    const genText = (genData.content?.[0]?.text ?? '').trim()
      .replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()

    let screens: any
    try {
      screens = JSON.parse(genText)
    } catch {
      try {
        screens = repairJSON(genText)
      } catch {
        console.error('Screen generation JSON parse failed:', genText.slice(0, 500))
        sendSSE(res, { type: 'error', message: 'Failed to parse generated screens.' })
        res.end()
        return
      }
    }

    if (!Array.isArray(screens)) {
      if (screens && screens.tree) {
        screens = [screens]
      } else {
        sendSSE(res, { type: 'error', message: 'AI did not return valid screen array.' })
        res.end()
        return
      }
    }

    // Normalize each screen and stream progress
    const normalizedScreens = screens.map((s: any, i: number) => {
      const screenId = crypto.randomUUID()
      const normalized = {
        id: screenId,
        planId: s.id || plan.screens[i]?.id || `screen-${i + 1}`,
        name: s.name || plan.screens[i]?.name || `Screen ${i + 1}`,
        tree: normalizeComponentTree(s.tree || { type: 'View', style: {}, children: [] }),
      }
      sendSSE(res, {
        type: 'screen',
        index: i,
        screen: { id: normalized.id, name: normalized.name, tree: normalized.tree },
      })
      sendSSE(res, {
        type: 'status',
        phase: 'generating',
        message: `Generated ${normalized.name} (${i + 1}/${screenCount})`,
        current: i + 1,
        total: screenCount,
      })
      return normalized
    })

    // Build FlowConnection array from plan connections
    const planIdToScreenId = new Map<string, string>()
    for (const s of normalizedScreens) {
      planIdToScreenId.set(s.planId, s.id)
    }

    const connections = (plan.navigation?.connections || [])
      .map(c => ({
        fromScreenId: planIdToScreenId.get(c.from) || '',
        toScreenId: planIdToScreenId.get(c.to) || '',
      }))
      .filter(c => c.fromScreenId && c.toScreenId)

    // Find home screen
    const homePlanId = plan.screens.find(s => s.isHome)?.id || plan.screens[0]?.id
    const homeScreenId = planIdToScreenId.get(homePlanId) || normalizedScreens[0]?.id

    // Deduct credits
    if (!user.isMCP) {
      await deductCredits(user.id, 'app')
    }

    // Log usage
    logUsage({
      userId: user.id,
      projectId: projectId || undefined,
      modelUsed: genModel,
      tokensIn: (planData.usage?.input_tokens || 0) + (genData.usage?.input_tokens || 0),
      tokensOut: (planData.usage?.output_tokens || 0) + (genData.usage?.output_tokens || 0),
      generationType: 'app',
      promptPreview: prompt,
      success: true,
    })

    // Stream final complete event
    sendSSE(res, {
      type: 'complete',
      screens: normalizedScreens.map(s => ({ id: s.id, name: s.name, tree: s.tree })),
      connections,
      homeScreenId,
      appName: plan.appName,
      modelUsed: genModel.includes('sonnet') ? 'Sonnet' : 'Haiku',
    })

    res.end()
  } catch (err) {
    console.error('Generate app error:', err)
    sendSSE(res, { type: 'error', message: `Failed: ${err instanceof Error ? err.message : String(err)}` })
    res.end()
  }
}
