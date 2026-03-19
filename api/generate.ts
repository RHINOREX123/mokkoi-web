import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, checkCredits, logUsage, logEditDiff, deductCredits, getUserPlan } from './auth-helper.js'

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

ADVANCED DESIGN RULES:
- COLOR PALETTE: Use a maximum of 3 accent colors per screen. Primary accent for CTAs/highlights, secondary for supporting elements, tertiary for subtle accents. All other colors should be neutrals from the same gray family.
- TYPOGRAPHY SCALE: Use exactly these sizes: 12px (caption), 14px (body small), 16px (body), 18px (subtitle), 24px (title), 32px (hero). Don't use random sizes.
- CARD PATTERN: All cards should have: backgroundColor from the card surface color (#1E293B for dark, #F8FAFC for light), borderRadius: 16, padding: 16-20. Never use borderWidth for cards — use background color contrast instead.
- ICON PLACEHOLDERS: Use single emoji characters or View circles with initials/symbols instead of text descriptions for icons. Keep icons consistent in size (24x24 or 32x32).
- SECTION SPACING: Use 24px gap between major sections, 12-16px between related elements, 4-8px between tightly coupled elements (like label + value).
- STATUS BAR AWARE: Always have at least 8px padding at the top of SafeAreaView content.
- BOTTOM SAFE AREA: Leave at least 34px padding at the bottom for home indicator.
- VISUAL HIERARCHY: The most important element (score, primary stat, main CTA) should be the largest and most colorful. Secondary elements progressively smaller and more muted.

EXAMPLE OUTPUT 1 — Fitness Dashboard (Dark Theme):
{"type":"SafeAreaView","style":{"flex":1,"backgroundColor":"#0F172A"},"children":[{"type":"ScrollView","style":{"flex":1},"props":{"showsVerticalScrollIndicator":false},"children":[{"type":"View","style":{"paddingHorizontal":20,"paddingTop":16,"paddingBottom":8,"flexDirection":"row","justifyContent":"space-between","alignItems":"center"},"children":[{"type":"View","children":[{"type":"Text","props":{"style":{"fontSize":14,"color":"#94A3B8","marginBottom":4}},"children":["Good Evening"]},{"type":"Text","props":{"style":{"fontSize":24,"fontWeight":"700","color":"#F8FAFC"}},"children":["Sarah"]}]},{"type":"View","style":{"width":44,"height":44,"borderRadius":22,"backgroundColor":"#6366F1","alignItems":"center","justifyContent":"center"},"children":[{"type":"Text","props":{"style":{"fontSize":18,"fontWeight":"600","color":"#FFFFFF"}},"children":["S"]}]}]},{"type":"View","style":{"marginHorizontal":20,"marginTop":20,"backgroundColor":"#1E293B","borderRadius":16,"padding":20,"alignItems":"center"},"children":[{"type":"Text","props":{"style":{"fontSize":13,"color":"#94A3B8","marginBottom":8,"textTransform":"uppercase","letterSpacing":1.5}},"children":["Energy Score"]},{"type":"Text","props":{"style":{"fontSize":48,"fontWeight":"800","color":"#34D399"}},"children":["87"]},{"type":"Text","props":{"style":{"fontSize":14,"color":"#6EE7B7","marginTop":4}},"children":["Excellent Recovery"]}]}]}]}
Study this example. Notice: proper padding (multiples of 4), color hierarchy (bright for important, muted for secondary), rounded cards (16px), uppercase labels with letter spacing, avatar with initials, consistent spacing.

EXAMPLE OUTPUT 2 — Login Screen (Dark Theme):
{"type":"SafeAreaView","style":{"flex":1,"backgroundColor":"#0A0A0A"},"children":[{"type":"View","style":{"flex":1,"justifyContent":"center","paddingHorizontal":24},"children":[{"type":"View","style":{"alignItems":"center","marginBottom":48},"children":[{"type":"View","style":{"width":64,"height":64,"borderRadius":16,"backgroundColor":"#6366F1","alignItems":"center","justifyContent":"center","marginBottom":16},"children":[{"type":"Text","props":{"style":{"fontSize":28,"color":"#FFFFFF"}},"children":["M"]}]},{"type":"Text","props":{"style":{"fontSize":28,"fontWeight":"700","color":"#FAFAFA"}},"children":["Welcome Back"]},{"type":"Text","props":{"style":{"fontSize":15,"color":"#71717A","marginTop":8}},"children":["Sign in to continue"]}]},{"type":"View","style":{"backgroundColor":"#18181B","borderRadius":12,"padding":16,"marginBottom":12},"children":[{"type":"TextInput","props":{"placeholder":"Email","placeholderTextColor":"#52525B","style":{"fontSize":16,"color":"#FAFAFA"}}}]},{"type":"View","style":{"backgroundColor":"#18181B","borderRadius":12,"padding":16,"marginBottom":24},"children":[{"type":"TextInput","props":{"placeholder":"Password","placeholderTextColor":"#52525B","secureTextEntry":true,"style":{"fontSize":16,"color":"#FAFAFA"}}}]},{"type":"TouchableOpacity","style":{"backgroundColor":"#6366F1","borderRadius":12,"padding":16,"alignItems":"center"},"children":[{"type":"Text","props":{"style":{"fontSize":16,"fontWeight":"600","color":"#FFFFFF"}},"children":["Sign In"]}]}]}]}
Study this example. Notice: centered layout for auth screens, proper input styling with dark backgrounds, consistent border radius, good spacing between elements, placeholder colors that match the theme.

EDIT MODE: When modifying an existing screen, preserve ALL content, layout, and structure. Only change what the user specifically asks to change. If user says 'make it white background', change ONLY the background color and text colors for contrast — keep everything else identical. If user says 'recreate with light theme', keep the same layout, content, and elements but swap the color scheme. Never discard or replace existing screen content during edits.

Return ONLY valid JSON, no markdown, no explanation.`

/** Build a Claude-compatible messages array from conversation history + current prompt.
 *  Ensures alternating user/assistant roles and that the first message is user. */
function buildMessages(
  conversationHistory: Array<{ role: string; content: string }> | undefined,
  currentContent: string | Array<{ type: string; [key: string]: unknown }>
): Array<{ role: 'user' | 'assistant'; content: string | Array<{ type: string; [key: string]: unknown }> }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  if (Array.isArray(conversationHistory)) {
    for (const m of conversationHistory.slice(-5)) {
      const role = m.role === 'assistant' ? 'assistant' : 'user'
      // Claude requires alternating roles — merge consecutive same-role messages
      if (messages.length > 0 && messages[messages.length - 1].role === role) {
        messages[messages.length - 1].content += '\n' + m.content
      } else {
        messages.push({ role, content: m.content })
      }
    }
    // Claude requires first message to be user role
    if (messages.length > 0 && messages[0].role === 'assistant') {
      messages.shift()
    }
  }

  // If last history message is user role, merge or insert assistant placeholder before current
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
    // Need an assistant message before our new user message
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

  // --- Credit deduction (skip for MCP — they use their own key via BYOK) ---
  const { prompt, currentScreen, imageData, imageMimeType, projectId, screenId, screenName, conversationHistory } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' })
  }

  // Smart model routing: detect if this is a new screen or an edit
  const isNewScreen = !currentScreen ||
    /\b(create|build|design|make a|generate|new screen|from scratch)\b/i.test(prompt)
  const isVariation = /variation/i.test(prompt) || prompt.includes('VARIATION_PROMPT')
  const isRegenerate = /regenerate/i.test(prompt)
  const hasImage = Boolean(imageData)

  // Determine credit type for deduction
  const creditType: 'new_screen' | 'edit' | 'screenshot' = hasImage
    ? 'screenshot'
    : (isNewScreen || isVariation || isRegenerate) ? 'new_screen' : 'edit'

  if (!user.isMCP) {
    const creditCheck = await checkCredits(user.id, creditType)
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

  // Plan-based model routing
  const userPlan = await getUserPlan(user.id)

  let model: string
  let maxTokens: number
  if (userPlan === 'free') {
    // Free plan: always Haiku
    model = 'claude-haiku-4-5-20251001'
    maxTokens = hasImage ? 16000 : (isNewScreen || isVariation || isRegenerate) ? 12000 : 8000
  } else if (hasImage) {
    model = 'claude-sonnet-4-20250514'
    maxTokens = 16000
  } else if (isNewScreen || isVariation || isRegenerate) {
    model = 'claude-sonnet-4-20250514'
    maxTokens = 12000
  } else {
    model = 'claude-haiku-4-5-20251001'
    maxTokens = 8000
  }

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

  // Robust JSON repair: strips markdown fences, extracts JSON, closes truncated structures
  function repairJSON(raw: string): any {
    let s = raw.trim()
    s = s.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
    const firstBrace = s.indexOf('{')
    if (firstBrace === -1) throw new Error('No JSON object found')
    const lastBrace = s.lastIndexOf('}')
    if (lastBrace > firstBrace) {
      s = s.slice(firstBrace, lastBrace + 1)
    } else {
      s = s.slice(firstBrace)
    }
    try { return JSON.parse(s) } catch {}
    let repaired = s
    let inString = false, escaped = false
    for (const ch of repaired) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') { inString = !inString }
    }
    if (inString) repaired += '"'
    repaired = repaired.replace(/,\s*"[^"]*":\s*"?[^"}\]]*$/, '')
    repaired = repaired.replace(/[,:\s]+$/, '')
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

  // Partial tree parser: tries to extract a renderable tree from incomplete JSON
  function attemptPartialTreeParse(text: string): any | null {
    try {
      // Find the start of a JSON object with a "type" key
      const jsonMatch = text.match(/\{[\s\S]*"type"\s*:/)
      if (!jsonMatch) return null

      let jsonStr = text.slice(text.indexOf(jsonMatch[0]))

      // Remove any trailing incomplete key-value pair
      jsonStr = jsonStr.replace(/,\s*"[^"]*"?\s*:?\s*$/, '')
      jsonStr = jsonStr.replace(/,\s*$/, '')

      // Close unclosed strings
      let inString = false, escaped = false
      for (const ch of jsonStr) {
        if (escaped) { escaped = false; continue }
        if (ch === '\\') { escaped = true; continue }
        if (ch === '"') { inString = !inString }
      }
      if (inString) jsonStr += '"'

      // Remove trailing incomplete values after closing the string
      jsonStr = jsonStr.replace(/,\s*"[^"]*":\s*"?[^"}\]]*$/, '')
      jsonStr = jsonStr.replace(/[,:\s]+$/, '')

      // Count unclosed brackets/braces
      let openBraces = 0, openBrackets = 0
      inString = false; escaped = false
      for (const ch of jsonStr) {
        if (escaped) { escaped = false; continue }
        if (ch === '\\') { escaped = true; continue }
        if (ch === '"') { inString = !inString; continue }
        if (inString) continue
        if (ch === '{') openBraces++
        else if (ch === '}') openBraces--
        else if (ch === '[') openBrackets++
        else if (ch === ']') openBrackets--
      }

      // Close arrays then objects
      for (let i = 0; i < openBrackets; i++) jsonStr += ']'
      for (let i = 0; i < openBraces; i++) jsonStr += '}'

      const parsed = JSON.parse(jsonStr)
      if (parsed && parsed.type) return parsed
      return null
    } catch {
      return null
    }
  }

  const modelLabel = model.includes('sonnet') ? 'Sonnet' : 'Haiku'
  const apiPayload = {
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: buildMessages(conversationHistory, userContent),
  }

  // --- SSE streaming path ---
  const wantsStream = req.headers['accept'] === 'text/event-stream' || req.query?.stream === 'true'

  if (wantsStream) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ ...apiPayload, stream: true }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('Anthropic streaming API error:', response.status, errorBody)
        logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, generationType, promptPreview: prompt, success: false })
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to generate screen' })}\n\n`)
        return res.end()
      }

      const reader = response.body as any
      if (!reader || typeof reader[Symbol.asyncIterator] !== 'function') {
        // Fallback: read entire body if not iterable (shouldn't happen)
        const text = await response.text()
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Streaming not supported in this environment' })}\n\n`)
        return res.end()
      }

      let fullText = ''
      let inputTokens = 0
      let outputTokens = 0
      const decoder = new TextDecoder()
      let sseBuffer = ''
      let lastPartialTreeLen = 0

      for await (const chunk of reader) {
        const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
        sseBuffer += text

        // Parse SSE events from Anthropic's streaming format
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data || data === '[DONE]') continue

          try {
            const event = JSON.parse(data)

            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const deltaText = event.delta.text
              fullText += deltaText
              // Forward text chunk to client
              res.write(`data: ${JSON.stringify({ type: 'text', content: deltaText })}\n\n`)

              // Every ~500 chars, attempt to parse a partial tree
              if (fullText.length - lastPartialTreeLen >= 500) {
                const partialTree = attemptPartialTreeParse(fullText)
                if (partialTree) {
                  res.write(`data: ${JSON.stringify({ type: 'partial_tree', tree: partialTree })}\n\n`)
                  lastPartialTreeLen = fullText.length
                }
              }
            } else if (event.type === 'message_delta' && event.usage) {
              outputTokens = event.usage.output_tokens || 0
            } else if (event.type === 'message_start' && event.message?.usage) {
              inputTokens = event.message.usage.input_tokens || 0
            }
          } catch {
            // Skip unparseable SSE lines
          }
        }
      }

      // Stream complete — parse the full response into a component tree
      if (!fullText) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Empty response from AI service' })}\n\n`)
        return res.end()
      }

      try {
        const tree = repairJSON(fullText)

        // Deduct credits after successful generation
        if (!user.isMCP) {
          await deductCredits(user.id, creditType)
        }

        res.write(`data: ${JSON.stringify({ type: 'complete', tree, modelUsed: modelLabel })}\n\n`)

        // Usage logging
        logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, tokensIn: inputTokens, tokensOut: outputTokens, generationType, promptPreview: prompt, success: true })

        // Edit diff capture
        if (currentScreen && (generationType === 'edit' || generationType === 'variation' || generationType === 'regenerate')) {
          const editType = generationType === 'edit' ? 'ai_edit' : generationType
          logEditDiff({ userId: user.id, projectId: projectId || undefined, screenId: screenId || undefined, editType: editType as 'ai_edit' | 'variation' | 'regenerate', prompt, treeBefore: currentScreen, treeAfter: tree, modelUsed: model })
        }
      } catch (jsonErr) {
        console.error('JSON repair failed on stream. Raw start:', fullText.slice(0, 500))
        res.write(`data: ${JSON.stringify({ type: 'error', message: `AI returned invalid JSON. Raw start: ${fullText.slice(0, 100)}` })}\n\n`)
      }

      res.write('data: [DONE]\n\n')
      return res.end()
    } catch (err) {
      console.error('Streaming generate error:', err)
      const message = err instanceof Error ? err.message : String(err)
      res.write(`data: ${JSON.stringify({ type: 'error', message: `Failed to generate screen: ${message}` })}\n\n`)
      return res.end()
    }
  }

  // --- Non-streaming path (backward compatible for MCP / variations) ---
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(apiPayload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Anthropic API error:', response.status, errorBody)
      logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, generationType, promptPreview: prompt, success: false })
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
    if (!text) {
      return res.status(502).json({ error: 'Empty response from AI service' })
    }

    let tree: any
    try {
      tree = repairJSON(text)
    } catch (jsonErr) {
      console.error('JSON repair failed. Raw start:', text.slice(0, 500))
      return res.status(502).json({ error: `AI returned invalid JSON. Raw start: ${text.slice(0, 100)}` })
    }

    // Deduct credits after successful generation
    if (!user.isMCP) {
      await deductCredits(user.id, creditType)
    }

    logUsage({ userId: user.id, projectId: projectId || undefined, modelUsed: model, tokensIn: data.usage?.input_tokens, tokensOut: data.usage?.output_tokens, generationType, promptPreview: prompt, success: true })

    if (currentScreen && (generationType === 'edit' || generationType === 'variation' || generationType === 'regenerate')) {
      const editType = generationType === 'edit' ? 'ai_edit' : generationType
      logEditDiff({ userId: user.id, projectId: projectId || undefined, screenId: screenId || undefined, editType: editType as 'ai_edit' | 'variation' | 'regenerate', prompt, treeBefore: currentScreen, treeAfter: tree, modelUsed: model })
    }

    return res.status(200).json({ tree, modelUsed: modelLabel })
  } catch (err) {
    console.error('Generate error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: `Failed to generate screen: ${message}` })
  }
}
