import type { VercelRequest, VercelResponse } from '@vercel/node'

const SYSTEM_PROMPT = `You are Mokkoi, an AI mobile screen designer. Given a screen description, generate a React Native component tree as JSON. Return a single JSON object with this exact structure: { "type": string, "style": {}, "props": {}, "children": [] }. Each child is either another component object or a plain string for text content. Supported types: View, Text, TextInput, TouchableOpacity, ScrollView, Image, SafeAreaView. Use dark theme (#0F172A background, #1E293B cards, #818CF8 accent, #E2E8F0 text). Include realistic content and proper mobile spacing (padding 16-24, margins 8-16, borderRadius 12-16). Return ONLY valid JSON, no markdown, no explanation.`

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
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Anthropic API error:', response.status, errorBody)
      return res.status(502).json({ error: 'Failed to generate screen' })
    }

    const data = await response.json()
    const text: string = data.content?.[0]?.text ?? ''

    // Parse the JSON from Claude's response
    const tree = JSON.parse(text)
    return res.status(200).json({ tree })
  } catch (err) {
    console.error('Generate error:', err)
    return res.status(500).json({ error: 'Failed to generate screen' })
  }
}
