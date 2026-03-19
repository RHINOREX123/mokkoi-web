import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, checkRateLimit, logUsage, logEditDiff } from './auth-helper.js'

const SYSTEM_PROMPT = `You are Mokkoi, an AI mobile screen designer. Generate a React Native component tree as JSON. Return a single JSON object with structure: { "type": string, "style": {}, "props": {}, "children": [] }. Each child is either another component object or a plain string for text content. Supported types: View, Text, TextInput, TouchableOpacity, ScrollView, Image, SafeAreaView.

CRITICAL: Screen width is 320px. All layouts must use percentage widths (width: '100%', width: '48%') not fixed pixel widths. Never make any element wider than the screen. Use flexDirection: 'row' with flexWrap: 'wrap' for card grids.

DEFAULT THEME: Use dark backgrounds (#000000, #0A0A0A, #0F172A, #1E293B, #111827) with light text (#F1F5F9, #E2E8F0, #94A3B8, #CBD5E1) by default. However, if the user explicitly asks for light theme, white background, light mode, white/bright colors — ALWAYS respect their request. Use white/light backgrounds (#FFFFFF, #F5F5F5, #FAFAFA) with dark text (#000000, #1A1A1A, #333333) when the user asks for it. The user's explicit color/theme requests ALWAYS override defaults.

CRITICAL DESIGN RULES:
- Default dark theme: background #0F172A, cards #1E293B, borders rgba(255,255,255,0.06)
- If user requests light/white theme: background #FFFFFF/#F5F5F5, cards #FFFFFF with subtle borders, text #000000/#1A1A1A/#333333
- Primary accent: #818CF8 (indigo/purple), Secondary: #34D399 (green)
- Dark theme text: #F1F5F9 (primary), #94A3B8 (secondary), #64748B (muted). Light theme text: #000000, #1A1A1A, #6B7280.
- Use generous padding (16-24px), proper margins (12-16px), borderRadius 12-16px
- Add subtle shadows and depth to cards
- Include realistic, detailed content — not placeholder text
- Make inputs have visible borders and proper placeholder styling
- Buttons should have gradient backgrounds (linear-gradient not supported in RN, use solid #818CF8)
- Add proper spacing between all elements
- The screen should look like a premium, production-quality mobile app

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
4. COLOR: Maximum 3 brand colors + neutrals per screen. Ensure WCAG AA contrast (4.5:1 for text, 3:1 for large text). Default to dark backgrounds (#0A0A0A to #1A1A1A range). If the user asks for light theme, white background, or light mode — use white/light backgrounds with dark text. Always respect the user's explicit color/theme requests over defaults.
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

EDIT MODE: When modifying an existing screen, preserve ALL content, layout, and structure. Only change what the user specifically asks to change. If user says 'make it white background', change ONLY the background color and text colors for contrast — keep everything else identical. If user says 'recreate with light theme', keep the same layout, content, and elements but swap the color scheme. Never discard or replace existing screen content during edits.

Return ONLY valid JSON, no markdown, no explanation.`

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

  const { prompt, currentScreen, imageData, imageMimeType, projectId, screenId, screenName } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' })
  }

  // Smart model routing: detect if this is a new screen or an edit
  const isNewScreen = !currentScreen ||
    /\b(create|build|design|make a|generate|new screen|from scratch)\b/i.test(prompt)
  const isVariation = /variation/i.test(prompt) || prompt.includes('VARIATION_PROMPT')
  const isRegenerate = /regenerate/i.test(prompt)
  const hasImage = Boolean(imageData)

  // Force Sonnet + higher token limit for image-based generation (prevents truncation)
  let model: string
  let maxTokens: number
  if (hasImage) {
    model = 'claude-sonnet-4-20250514'
    maxTokens = 16000
  } else if (isNewScreen || isVariation || isRegenerate) {
    model = 'claude-sonnet-4-20250514'
    maxTokens = 12000
  } else {
    model = 'claude-haiku-4-5-20251001'
    maxTokens = 8000
  }
  console.log(`Using model: ${model} for: ${prompt.substring(0, 50)}...`)

  // Determine generation type for usage logging
  let generationType: 'new_screen' | 'edit' | 'variation' | 'regenerate' = 'new_screen'
  if (isVariation) generationType = 'variation'
  else if (isRegenerate) generationType = 'regenerate'
  else if (currentScreen) generationType = 'edit'

  // Build user message — include current screen if editing, or image if attached
  let userContent: string | Array<{ type: string; [key: string]: unknown }>
  if (imageData && typeof imageData === 'string') {
    // Screenshot-to-screen: send image with text prompt
    const textPrompt = currentScreen
      ? `Here is the current screen JSON:\n${JSON.stringify(currentScreen, null, 2)}\n\nThe user attached a screenshot and says: ${prompt}\n\nRecreate or modify the screen to match the screenshot. Return complete JSON.`
      : `Analyze this screenshot and recreate it as a React Native component tree JSON. The user says: ${prompt}\n\nRecreate this design faithfully using the supported component types. Match the layout, colors, typography, and spacing as closely as possible. Remember: ALL backgrounds must be dark theme. Return ONLY valid JSON.`
    userContent = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageMimeType || 'image/png',
          data: imageData,
        },
      },
      { type: 'text', text: textPrompt },
    ]
  } else if (isRegenerate && currentScreen) {
    // Regenerate mode: send existing tree as reference so Claude preserves screen type
    userContent = `REGENERATE MODE: You are regenerating an existing screen. The user wants a fresh design approach for the SAME type of screen. Keep the same purpose, features, and information architecture but create a new visual design. Do NOT change the screen type (e.g., if it's a fitness screen, keep it as fitness; if it's a dashboard, keep it as a dashboard).

Here is the current screen's component tree JSON for reference:
${JSON.stringify(currentScreen, null, 2)}
${screenName ? `\nScreen name: ${screenName}` : ''}

${prompt}

Generate a completely fresh design for this same type of screen. Use different layout patterns, card styles, and visual hierarchy — but preserve the same screen purpose and content type. Return ONLY valid JSON.`
  } else if (currentScreen) {
    userContent = `EDIT MODE — You MUST preserve the existing screen's layout, content, and structure. Only change what the user explicitly asks to change.

Here is the current screen's component tree JSON:
${JSON.stringify(currentScreen, null, 2)}

The user's edit request: ${prompt}

IMPORTANT: Do NOT recreate this screen from scratch. Modify the EXISTING tree above. Keep all text content, element positions, component structure, and styling that the user did NOT ask to change. If the user asks for a color/theme change, update ONLY colors — keep everything else identical. Return the complete modified JSON.`
  } else {
    userContent = prompt
  }

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
        max_tokens: maxTokens,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Anthropic API error:', response.status, errorBody)
      logUsage({
        userId: user.id,
        projectId: projectId || undefined,
        modelUsed: model,
        generationType,
        promptPreview: prompt,
        success: false,
      })
      return res.status(502).json({ error: 'Failed to generate screen' })
    }

    let data: any
    try {
      data = await response.json()
    } catch (parseErr) {
      console.error('Failed to parse Anthropic response as JSON')
      return res.status(502).json({ error: 'Invalid response from AI service' })
    }

    const text: string = data.content?.[0]?.text ?? ''
    console.log('Claude raw response length:', text.length)
    console.log('Claude raw response (first 300 chars):', text.slice(0, 300))

    if (!text) {
      return res.status(502).json({ error: 'Empty response from AI service' })
    }

    // Robust JSON repair: strips markdown fences, extracts JSON, closes truncated structures
    function repairJSON(raw: string): any {
      let s = raw.trim()
      // Strip markdown code fences
      s = s.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()

      // Extract JSON between first { and last }
      const firstBrace = s.indexOf('{')
      if (firstBrace === -1) throw new Error('No JSON object found')
      const lastBrace = s.lastIndexOf('}')
      if (lastBrace > firstBrace) {
        s = s.slice(firstBrace, lastBrace + 1)
      } else {
        // Truncated — take from first brace to end
        s = s.slice(firstBrace)
      }

      // Try direct parse first
      try { return JSON.parse(s) } catch {}

      // Repair truncated JSON
      let repaired = s
      // Close any open string
      let inString = false, escaped = false
      for (const ch of repaired) {
        if (escaped) { escaped = false; continue }
        if (ch === '\\') { escaped = true; continue }
        if (ch === '"') { inString = !inString }
      }
      if (inString) repaired += '"'

      // Remove trailing incomplete key-value pairs (e.g. `"key": "val` or `"key":`)
      repaired = repaired.replace(/,\s*"[^"]*":\s*"?[^"}\]]*$/, '')
      // Trim trailing comma, colon, or whitespace
      repaired = repaired.replace(/[,:\s]+$/, '')

      // Count and close unclosed braces/brackets
      let openBraces = 0, openBrackets = 0
      inString = false; escaped = false
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
      for (let i = 0; i < openBrackets; i++) repaired += ']'
      for (let i = 0; i < openBraces; i++) repaired += '}'

      return JSON.parse(repaired)
    }

    let tree: any
    try {
      tree = repairJSON(text)
      console.log('JSON parse succeeded')
    } catch (jsonErr) {
      console.error('JSON repair failed. Raw start:', text.slice(0, 500))
      return res.status(502).json({ error: `AI returned invalid JSON. Raw start: ${text.slice(0, 100)}` })
    }

    // --- Usage logging (fire-and-forget) ---
    logUsage({
      userId: user.id,
      projectId: projectId || undefined,
      modelUsed: model,
      tokensIn: data.usage?.input_tokens,
      tokensOut: data.usage?.output_tokens,
      generationType,
      promptPreview: prompt,
      success: true,
    })

    // --- Edit diff capture (fire-and-forget) ---
    if (currentScreen && (generationType === 'edit' || generationType === 'variation' || generationType === 'regenerate')) {
      const editType = generationType === 'edit' ? 'ai_edit' : generationType
      logEditDiff({
        userId: user.id,
        projectId: projectId || undefined,
        screenId: screenId || undefined,
        editType: editType as 'ai_edit' | 'variation' | 'regenerate',
        prompt,
        treeBefore: currentScreen,
        treeAfter: tree,
        modelUsed: model,
      })
    }

    const modelLabel = model.includes('sonnet') ? 'Sonnet' : 'Haiku'
    return res.status(200).json({ tree, modelUsed: modelLabel })
  } catch (err) {
    console.error('Generate error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: `Failed to generate screen: ${message}` })
  }
}
