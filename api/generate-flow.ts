import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, checkRateLimit, logUsage } from './auth-helper.js'

const FLOW_SYSTEM_PROMPT = `You are Mokkoi, an AI mobile app designer. The user wants a MULTI-SCREEN FLOW. Generate 3-5 connected screens as a JSON array. Each screen should have: { "id": string, "name": string (e.g. "Welcome", "Sign Up", "Profile Setup"), "tree": ComponentNode }.

ComponentNode structure: { "type": string, "style": {}, "props": {}, "children": [] }. Each child is either another component object or a plain string for text content. Supported types: View, Text, TextInput, TouchableOpacity, ScrollView, Image, SafeAreaView.

The screens should be logically connected — each screen flows naturally to the next. Include navigation elements (Back button, Next button, Skip, progress indicators) that reference other screens in the flow.

CRITICAL: Screen width is 320px. All layouts must use percentage widths (width: '100%', width: '48%') not fixed pixel widths. Never make any element wider than the screen. Use flexDirection: 'row' with flexWrap: 'wrap' for card grids.

CRITICAL DESIGN RULES:
- Default to dark backgrounds (#0A0A0A to #1A1A1A range). If the user asks for light theme, white background, light mode, or any light color scheme — use white/light backgrounds with dark text. Always respect the user's explicit color and theme requests over defaults.
- Default dark theme: background #0F172A, cards #1E293B, borders rgba(255,255,255,0.06)
- If user requests light/white theme: background #FFFFFF/#F5F5F5, cards #FFFFFF with subtle borders, text #000000/#1A1A1A/#333333
- Primary accent: #818CF8 (indigo/purple), Secondary: #34D399 (green)
- Dark theme text: #F1F5F9 (primary), #94A3B8 (secondary), #64748B (muted). Light theme text: #000000, #1A1A1A, #6B7280.
- Use generous padding (16-24px), proper margins (12-16px), borderRadius 12-16px
- Add subtle shadows and depth to cards
- Include realistic, detailed content — not placeholder text
- Buttons should use solid #818CF8 background
- Each screen must be a complete, beautiful, production-ready design
- Include progress indicators, back/next buttons, or skip links to show flow connectivity

CRITICAL MOBILE SCREEN SIZE RULES:
- The screen viewport is 320px wide and 568px tall. ALL content MUST fit within this viewport WITHOUT scrolling.
- Maximum 5-6 UI elements per screen. No more.
- Text must be SHORT: titles max 4 words, descriptions max 10 words, body text max 2 lines.
- NO paragraphs. NO long descriptions. NO walls of text.
- Use icons and emojis instead of text where possible.
- Card components: max height 80px each.
- List items: max 3-4 items visible.
- The entire screen content must be visible at once — user should NOT need to scroll.
- Think of it as designing for an iPhone SE screen — everything compact.
- If you need more content, use tabs or pagination patterns, NOT vertical scrolling.
- NEVER generate a screen taller than 568px of content.

MOBILE DESIGN RULES (apply to every screen):
1. SPACING: Use 8pt grid system. All padding/margins should be multiples of 4 or 8. Minimum padding: 16px.
2. TOUCH TARGETS: All interactive elements minimum 44x44pt. Buttons minimum height 48px.
3. TYPOGRAPHY: Maximum 3 font sizes per screen. Body text minimum 16px. Headers 24-32px. Clear hierarchy.
4. COLOR: Maximum 3 brand colors + neutrals per screen. Ensure WCAG AA contrast (4.5:1 for text, 3:1 for large text). Default to dark backgrounds (#0A0A0A to #1A1A1A range). If the user asks for light theme, white background, light mode, or any light color scheme — use white/light backgrounds with dark text. Always respect the user's explicit color and theme requests over defaults.
5. SAFE AREAS: Always wrap in SafeAreaView. Account for notch/status bar at top (44px) and home indicator at bottom (34px).
6. SCROLLING: Wrap content in ScrollView when content exceeds viewport. Never nest ScrollViews.
7. BOTTOM NAV: Maximum 5 items. Active item should be visually distinct. Use icons + labels.
8. CARDS: Rounded corners (12-16px). Subtle border or shadow for depth. Consistent padding (16px).
9. LOADING STATES: Include ActivityIndicator or skeleton screens for async content.
10. EMPTY STATES: Include meaningful empty states for lists and feeds.
11. ICONS: Use descriptive text labels with icons. Never icon-only for important actions.
12. STATUS BAR: Style appropriately (light-content for dark themes, dark-content for light themes).
13. LAYOUT: Use flexDirection column as default. Use flexDirection row for horizontal arrangements. Always set flex: 1 on root container.
14. PLATFORM AWARENESS: Generate iOS-style by default (large titles, SF-style rounded elements, bottom tab bars).
15. ACCESSIBILITY: Add accessibilityLabel to all interactive elements. Use accessibilityRole appropriately.

Return ONLY a JSON array of screen objects. No markdown, no explanation. Example format:
[{"id":"welcome","name":"Welcome","tree":{"type":"SafeAreaView","style":{},"children":[]}},{"id":"signup","name":"Sign Up","tree":{"type":"SafeAreaView","style":{},"children":[]}}]`

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

  // --- Rate limiting (skip for MCP — they use their own key via BYOK) ---
  if (!user.isMCP) {
    const rateLimited = await checkRateLimit(user.id, res)
    if (rateLimited) return // 429 already sent
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })
  }

  const { prompt, projectId, conversationHistory } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' })
  }

  const model = 'claude-sonnet-4-20250514'

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
    console.log('Claude flow response length:', text.length)

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
        console.log('JSON repair succeeded')
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

    // Ensure each screen has required fields
    screens = screens.map((s: any, i: number) => ({
      id: s.id || `screen-${i + 1}`,
      name: s.name || `Screen ${i + 1}`,
      tree: s.tree || { type: 'View', style: {}, children: [] },
    }))

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
