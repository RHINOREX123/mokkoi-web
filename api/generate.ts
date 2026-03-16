import type { VercelRequest, VercelResponse } from '@vercel/node'

const SYSTEM_PROMPT = `You are Mokkoi, an AI mobile screen designer. Generate a React Native component tree as JSON. Return a single JSON object with structure: { "type": string, "style": {}, "props": {}, "children": [] }. Each child is either another component object or a plain string for text content. Supported types: View, Text, TextInput, TouchableOpacity, ScrollView, Image, SafeAreaView.

CRITICAL DESIGN RULES:
- Always use dark theme: background #0F172A, cards #1E293B, borders rgba(255,255,255,0.06)
- Primary accent: #818CF8 (indigo/purple), Secondary: #34D399 (green)
- Text colors: #F1F5F9 (primary), #94A3B8 (secondary), #64748B (muted)
- Use generous padding (16-24px), proper margins (12-16px), borderRadius 12-16px
- Add subtle shadows and depth to cards
- Include realistic, detailed content — not placeholder text
- Make inputs have visible borders and proper placeholder styling
- Buttons should have gradient backgrounds (linear-gradient not supported in RN, use solid #818CF8)
- Add proper spacing between all elements
- The screen should look like a premium, production-quality mobile app

Return ONLY valid JSON, no markdown, no explanation.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })
  }

  const { prompt, currentScreen } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' })
  }

  // Build user message — include current screen if editing
  let userContent: string
  if (currentScreen) {
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
        max_tokens: 4096,
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
      console.error('Failed to parse Claude response as JSON:', jsonText.slice(0, 500))
      return res.status(502).json({ error: `AI returned invalid JSON. Raw start: ${jsonText.slice(0, 100)}` })
    }

    return res.status(200).json({ tree })
  } catch (err) {
    console.error('Generate error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: `Failed to generate screen: ${message}` })
  }
}
