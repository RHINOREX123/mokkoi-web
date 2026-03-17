import type { VercelRequest, VercelResponse } from '@vercel/node'

const SYSTEM_PROMPT = `You are Mokkoi, an AI mobile screen designer. Generate a React Native component tree as JSON. Return a single JSON object with structure: { "type": string, "style": {}, "props": {}, "children": [] }. Each child is either another component object or a plain string for text content. Supported types: View, Text, TextInput, TouchableOpacity, ScrollView, Image, SafeAreaView.

CRITICAL: Screen width is 320px. All layouts must use percentage widths (width: '100%', width: '48%') not fixed pixel widths. Never make any element wider than the screen. Use flexDirection: 'row' with flexWrap: 'wrap' for card grids.

ABSOLUTE RULE: NEVER use white (#FFFFFF), light gray (#F5F5F5), or ANY light color as a background. ALL backgrounds MUST be dark: #000000, #0A0A0A, #0F172A, #1E293B, #111827. ALL text MUST be light: #F1F5F9, #E2E8F0, #94A3B8, #CBD5E1. If you generate a light background, the screen will be rejected. Dark theme is mandatory.

CRITICAL DESIGN RULES:
- Always use dark theme: background #0F172A, cards #1E293B, borders rgba(255,255,255,0.06)
- NEVER use #FFFFFF, #F5F5F5, #FAFAFA, white, or any light/bright background color. Even "white text on light bg" is forbidden — backgrounds MUST be dark.
- Primary accent: #818CF8 (indigo/purple), Secondary: #34D399 (green)
- Text colors: #F1F5F9 (primary), #94A3B8 (secondary), #64748B (muted). NEVER use dark text colors like #000000, #333333, or #1A1A1A for text.
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

Return ONLY valid JSON, no markdown, no explanation.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })
  }

  const { prompt, currentScreen, imageData, imageMimeType } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' })
  }

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
  } else if (currentScreen) {
    userContent = `Here is the current screen JSON that the user wants to modify:\n${JSON.stringify(currentScreen, null, 2)}\n\nThe user's edit request: ${prompt}\n\nModify the existing screen based on their request. Keep unchanged parts the same. Return the complete modified JSON.`
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Anthropic API error:', response.status, errorBody)
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

    // Strip markdown code blocks if Claude wrapped the JSON
    let jsonText = text.trim()
    // Remove ```json ... ``` or ``` ... ``` wrappers
    jsonText = jsonText.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    jsonText = jsonText.trim()

    let tree: any
    try {
      tree = JSON.parse(jsonText)
    } catch (jsonErr) {
      // Attempt to repair truncated JSON by closing open brackets/braces
      console.warn('Initial JSON parse failed, attempting repair...')
      let repaired = jsonText
      // Count unclosed braces and brackets
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
      // Close any open strings, then brackets/braces
      if (inString) repaired += '"'
      // Trim trailing comma or colon that would make JSON invalid
      repaired = repaired.replace(/[,:\s]+$/, '')
      for (let i = 0; i < openBrackets; i++) repaired += ']'
      for (let i = 0; i < openBraces; i++) repaired += '}'
      try {
        tree = JSON.parse(repaired)
        console.log('JSON repair succeeded')
      } catch (repairErr) {
        console.error('JSON repair also failed. Raw start:', jsonText.slice(0, 500))
        return res.status(502).json({ error: `AI returned invalid JSON. Raw start: ${jsonText.slice(0, 100)}` })
      }
    }

    return res.status(200).json({ tree })
  } catch (err) {
    console.error('Generate error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: `Failed to generate screen: ${message}` })
  }
}
