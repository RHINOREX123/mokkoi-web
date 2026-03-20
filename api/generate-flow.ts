import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, checkCredits, logUsage, deductCredits, getUserPlan } from './auth-helper.js'
import { normalizeComponentTree } from './normalizer.js'
import { DESIGN_TOKENS, CONTENT_LIBRARY, COMPONENT_TYPES, PLATFORM_RULES, QUALITY_CHECKLIST } from './design-system.js'

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

${QUALITY_CHECKLIST}

Return ONLY a JSON array of screen objects. No markdown, no explanation. Example format:
[{"id":"welcome","name":"Welcome","tree":{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54,"paddingBottom":34},"children":[]}},{"id":"signup","name":"Sign Up","tree":{"type":"View","style":{"flex":1,"backgroundColor":"#0A0A1A","paddingTop":54,"paddingBottom":34},"children":[]}}]`

/** Build a Claude-compatible messages array from conversation history + current prompt.
 *  Ensures alternating user/assistant roles and that the first message is user. */
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // --- Authentication ---
  const user = await authenticateRequest(req, res)
  if (!user) return // 401 already sent

  // --- Credit check (skip for MCP — they use their own key via BYOK) ---
  if (!user.isMCP) {
    const creditCheck = await checkCredits(user.id, 'flow')
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

  // Plan-based model routing: free always gets Haiku
  const userPlan = await getUserPlan(user.id)
  const model = userPlan === 'free' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-20250514'

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        system: [
          {
            type: 'text',
            text: FLOW_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: buildMessages(conversationHistory, prompt),
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Anthropic API error:', response.status, errorBody)
      logUsage({
        userId: user.id,
        projectId: projectId || undefined,
        modelUsed: model,
        generationType: 'flow',
        promptPreview: prompt,
        success: false,
      })
      return res.status(502).json({ error: 'Failed to generate flow' })
    }

    let data: any
    try {
      data = await response.json()
    } catch {
      console.error('Failed to parse Anthropic response as JSON')
      return res.status(502).json({ error: 'Invalid response from AI service' })
    }

    const text: string = data.content?.[0]?.text ?? ''

    if (!text) {
      return res.status(502).json({ error: 'Empty response from AI service' })
    }

    // Strip markdown code blocks
    let jsonText = text.trim()
    jsonText = jsonText.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    jsonText = jsonText.trim()

    let screens: any
    try {
      screens = JSON.parse(jsonText)
    } catch {
      // Attempt to repair truncated JSON
      console.warn('Initial JSON parse failed, attempting repair...')
      let repaired = jsonText
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
      try {
        screens = JSON.parse(repaired)
      } catch {
        console.error('JSON repair also failed. Raw start:', jsonText.slice(0, 500))
        return res.status(502).json({ error: `AI returned invalid JSON. Raw start: ${jsonText.slice(0, 100)}` })
      }
    }

    // Validate it's an array of screens
    if (!Array.isArray(screens)) {
      // If it's a single object with a tree, wrap it
      if (screens && screens.tree) {
        screens = [{ id: 'screen-1', name: 'Screen 1', tree: screens.tree }]
      } else {
        return res.status(502).json({ error: 'AI did not return a valid screen flow array' })
      }
    }

    // Ensure each screen has required fields and normalize trees
    screens = screens.map((s: any, i: number) => ({
      id: s.id || `screen-${i + 1}`,
      name: s.name || `Screen ${i + 1}`,
      tree: normalizeComponentTree(s.tree || { type: 'View', style: {}, children: [] }),
    }))

    // Deduct credits after successful generation
    if (!user.isMCP) {
      await deductCredits(user.id, 'flow')
    }

    // --- Usage logging (fire-and-forget) ---
    logUsage({
      userId: user.id,
      projectId: projectId || undefined,
      modelUsed: model,
      tokensIn: data.usage?.input_tokens,
      tokensOut: data.usage?.output_tokens,
      generationType: 'flow',
      promptPreview: prompt,
      success: true,
    })

    return res.status(200).json({ screens, modelUsed: 'Sonnet' })
  } catch (err) {
    console.error('Generate flow error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: `Failed to generate flow: ${message}` })
  }
}
