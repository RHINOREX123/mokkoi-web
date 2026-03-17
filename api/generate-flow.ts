import type { VercelRequest, VercelResponse } from '@vercel/node'

const FLOW_SYSTEM_PROMPT = `You are Mokkoi, an AI mobile app designer. The user wants a MULTI-SCREEN FLOW. Generate 3-5 connected screens as a JSON array. Each screen should have: { "id": string, "name": string (e.g. "Welcome", "Sign Up", "Profile Setup"), "tree": ComponentNode }.

ComponentNode structure: { "type": string, "style": {}, "props": {}, "children": [] }. Each child is either another component object or a plain string for text content. Supported types: View, Text, TextInput, TouchableOpacity, ScrollView, Image, SafeAreaView.

The screens should be logically connected — each screen flows naturally to the next. Include navigation elements (Back button, Next button, Skip, progress indicators) that reference other screens in the flow.

CRITICAL: Screen width is 320px. All layouts must use percentage widths (width: '100%', width: '48%') not fixed pixel widths. Never make any element wider than the screen. Use flexDirection: 'row' with flexWrap: 'wrap' for card grids.

ABSOLUTE RULE: NEVER use white (#FFFFFF), light gray (#F5F5F5), or ANY light color as a background. ALL backgrounds MUST be dark: #000000, #0A0A0A, #0F172A, #1E293B, #111827. ALL text MUST be light: #F1F5F9, #E2E8F0, #94A3B8, #CBD5E1. Dark theme is mandatory.

CRITICAL DESIGN RULES:
- Always use dark theme: background #0F172A, cards #1E293B, borders rgba(255,255,255,0.06)
- NEVER use #FFFFFF, #F5F5F5, #FAFAFA, white, or any light/bright background color.
- Primary accent: #818CF8 (indigo/purple), Secondary: #34D399 (green)
- Text colors: #F1F5F9 (primary), #94A3B8 (secondary), #64748B (muted). NEVER use dark text colors.
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

Return ONLY a JSON array of screen objects. No markdown, no explanation. Example format:
[{"id":"welcome","name":"Welcome","tree":{"type":"SafeAreaView","style":{},"children":[]}},{"id":"signup","name":"Sign Up","tree":{"type":"SafeAreaView","style":{},"children":[]}}]`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })
  }

  const { prompt } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' })
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
        max_tokens: 16000,
        system: [
          {
            type: 'text',
            text: FLOW_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Anthropic API error:', response.status, errorBody)
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

    return res.status(200).json({ screens, modelUsed: 'Sonnet' })
  } catch (err) {
    console.error('Generate flow error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: `Failed to generate flow: ${message}` })
  }
}
