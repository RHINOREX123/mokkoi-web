import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, checkCredits, logUsage, deductCredits } from './auth-helper.js'
import { normalizeComponentTree } from './normalizer.js'
import { DESIGN_TOKENS, COMPONENT_TYPES, VIEWPORT_BUDGET, PLATFORM_RULES } from './design-system.js'

// --- Input detection ---

interface InputDetection {
  type: 'html' | 'react-jsx' | 'react-tsx' | 'tailwind-html' | 'unknown'
  source: 'stitch' | 'v0' | 'bolt' | 'lovable' | 'unknown'
  hasInlineStyles: boolean
  hasTailwind: boolean
  hasCSS: boolean
}

function detectInputType(code: string): InputDetection {
  const hasReactImport = /import\s+React|from\s+['"]react['"]|export\s+default\s+function/.test(code)
  const hasTSX = hasReactImport && /:\s*(React\.FC|JSX\.Element|string|number|boolean|\{)/.test(code)
  const hasTailwind = /\b(bg-|text-|p-|m-|flex|rounded-|shadow-|border-|gap-|w-|h-|items-|justify-|font-|leading-|tracking-|space-|grid-|col-span|row-span)\b/.test(code)
  const hasInlineStyles = /style\s*=\s*\{\s*\{/.test(code) || /style\s*=\s*"/.test(code)
  const hasCSS = /<style[\s>]|\.css['"]/.test(code)
  const hasHTMLTags = /<(?:div|section|header|main|article|footer|nav|span|p|h[1-6]|button|input|img|ul|ol|form)\b/.test(code)

  // Determine type
  let type: InputDetection['type'] = 'unknown'
  if (hasTSX) type = 'react-tsx'
  else if (hasReactImport) type = 'react-jsx'
  else if (hasTailwind && hasHTMLTags) type = 'tailwind-html'
  else if (hasHTMLTags) type = 'html'

  // Source detection
  let source: InputDetection['source'] = 'unknown'
  if (/stitch/i.test(code) || /data-stitch/i.test(code)) source = 'stitch'
  else if (/shadcn|@\/components\/ui|"use client"/.test(code)) source = 'v0'
  else if (/bolt-|data-bolt/.test(code)) source = 'bolt'
  else if (/@supabase\/supabase-js|supabase\.from\(/.test(code) && hasReactImport) source = 'lovable'

  return { type, source, hasInlineStyles, hasTailwind, hasCSS }
}

// --- Conversion system prompt ---

const HTML_IMPORT_SYSTEM_PROMPT = `You are Mokkoi's HTML-to-React-Native converter. Your job is to convert web UI code (HTML, CSS, React, Tailwind) into Mokkoi's React Native JSON component tree format.

## YOUR OUTPUT FORMAT
Return a JSON object with this EXACT structure:
{
  "type": "View",
  "style": { "flex": 1, "backgroundColor": "..." },
  "children": [ ... child nodes ... ]
}

Each node follows this structure:
{
  "type": "View" | "Text" | "ScrollView" | "Image" | "TouchableOpacity" | "TextInput" | "Switch" | "SafeAreaView" | "Icon" | "LinearGradient",
  "style": { ...React Native StyleSheet properties... },
  "props": {
    "children"?: string (for Text nodes — the actual text content goes here OR as string in children array),
    "source"?: { "uri": string } (for Image nodes),
    "placeholder"?: string (for TextInput),
    "placeholderTextColor"?: string,
    "name"?: string (for Icon — Google Material Symbols name),
    "size"?: number (for Icon),
    "color"?: string (for Icon)
  },
  "children"?: [ ...child ComponentNode[] or string for Text ]
}

## CONVERSION RULES

### Element Mapping (Web → React Native)
- <div>, <section>, <article>, <main>, <aside>, <footer> → View
- <p>, <span>, <h1>-<h6>, <label>, <a> → Text (with appropriate fontSize/fontWeight)
  h1: fontSize 34, fontWeight "700"
  h2: fontSize 28, fontWeight "700"
  h3: fontSize 24, fontWeight "600"
  h4: fontSize 20, fontWeight "600"
  h5: fontSize 17, fontWeight "600"
  h6: fontSize 14, fontWeight "600"
- <button> → TouchableOpacity wrapping a Text child
- <input>, <textarea> → TextInput
- <img> → Image with props: { source: { uri: "..." } } and searchQuery for Mokkoi image proxy
- <ul>/<ol> with <li> → View with View children (no list markers needed)
- <nav> at bottom of page → View styled as bottom tab bar
- <header> → View at top
- <svg> → View with approximate styling (use backgroundColor/borderRadius to approximate simple shapes)
- <form> → View
- <select> → TouchableOpacity styled as dropdown

### Style Conversion (CSS → React Native)
- Remove all units: "16px" → 16, "1rem" → 16, "0.5em" → 8, "1.5rem" → 24
- camelCase all properties: font-size → fontSize, background-color → backgroundColor
- Convert Tailwind classes to style objects:
  p-4 → padding: 16, p-6 → padding: 24, px-4 → paddingHorizontal: 16, py-3 → paddingVertical: 12
  m-4 → margin: 16, mb-2 → marginBottom: 8, mt-4 → marginTop: 16
  rounded-xl → borderRadius: 12, rounded-2xl → borderRadius: 16, rounded-full → borderRadius: 9999
  text-sm → fontSize: 14, text-xl → fontSize: 20, text-3xl → fontSize: 28
  font-bold → fontWeight: "700", font-semibold → fontWeight: "600", font-medium → fontWeight: "500"
  flex → flex: 1, flex-col → flexDirection: "column", flex-row → flexDirection: "row"
  items-center → alignItems: "center", justify-center → justifyContent: "center"
  justify-between → justifyContent: "space-between"
  gap-4 → gap: 16, space-y-4 → gap: 16 (on parent View)
  w-full → width: "100%", h-full → height: "100%"
  max-w-sm → maxWidth: 384
  shadow-lg → shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5
  min-h-screen → flex: 1
- box-shadow → shadowColor, shadowOffset, shadowOpacity, shadowRadius + elevation
- CSS Grid → flexbox (flexDirection: "row", flexWrap: "wrap" if needed)
- hover/focus states → IGNORE
- transition/animation → IGNORE
- @media queries → IGNORE (use mobile values)
- backdrop-filter: blur() → semi-transparent backgroundColor
- linear-gradient() → solid color (pick dominant gradient color)
- position: fixed → position: "absolute"
- overflow: scroll → wrap in ScrollView
- cursor: pointer → skip
- ::before, ::after → skip pseudo-elements
- text-decoration → textDecorationLine
- text-transform → textTransform
- letter-spacing → letterSpacing
- line-height → lineHeight (as number)
- opacity → opacity
- z-index → zIndex
- gap → gap

### Tailwind Color Mapping (common colors to hex)
bg-gray-900/#111827, bg-gray-800/#1F2937, bg-gray-700/#374151, bg-gray-600/#4B5563
bg-gray-500/#6B7280, bg-gray-400/#9CA3AF, bg-gray-300/#D1D5DB
text-white/#FFFFFF, text-gray-400/#9CA3AF, text-gray-500/#6B7280
bg-blue-600/#2563EB, bg-blue-500/#3B82F6, bg-blue-400/#60A5FA
bg-green-400/#4ADE80, bg-green-500/#22C55E, text-green-400/#4ADE80
bg-red-500/#EF4444, bg-purple-500/#A855F7, bg-indigo-500/#6366F1
bg-black/#000000, bg-white/#FFFFFF

### Color Preservation (CRITICAL)
- Keep ALL original colors EXACTLY as they appear in the input
- Do NOT substitute Mokkoi default colors
- If the input uses #1E1E2E background, the output must use #1E1E2E
- Preserve opacity values: "rgba(255,255,255,0.1)" stays as "rgba(255,255,255,0.1)"

### Layout Rules
- Root element should have: flex: 1, backgroundColor: [detected from input]
- All content must fit in a mobile viewport (width ~393px)
- If the web layout is wider than mobile, restructure:
  Multi-column grid → stack vertically or use horizontal scroll
  Wide tables → scrollable or restructured cards
  Sidebar layouts → remove sidebar, use bottom nav instead
- Maximum visible viewport ~724px height (use ScrollView for overflow)
- Keep spacing proportional but adjust for mobile: if web uses 32px padding, RN should use 16-20px
- iOS safe areas: paddingTop: 54 (status bar), paddingBottom: 34 (home indicator)

### Content Preservation
- Keep ALL text content exactly as it appears
- Keep ALL image URLs exactly as they appear
- Keep icon references — use Icon component with closest Google Material Symbols name
  Common: home, search, menu, arrow_back, chevron_right, close, favorite, star, bookmark, share, send, person, notifications, play_arrow, pause, skip_next, shopping_cart, credit_card, trending_up, monitoring, bolt, location_on, fitness_center, settings, lock, calendar_today
- Keep placeholder text in inputs
- Keep button labels

### What to Skip
- Script tags and JavaScript logic
- CSS animations and transitions
- Web-specific meta tags
- Link/stylesheet imports
- Complex SVG paths (approximate with View + backgroundColor + borderRadius)
- iframes

${DESIGN_TOKENS}
${COMPONENT_TYPES}
${VIEWPORT_BUDGET}
${PLATFORM_RULES}

## IMPORTANT
- Return ONLY valid JSON. No markdown backticks, no explanation, no preamble.
- The JSON must parse with JSON.parse() directly.
- Every node MUST have: type, style (with at least {})
- Text content goes as a string in the children array: "children": ["Hello"]
- Style values must be numbers (not "16px") or valid strings (colors, "center", etc.)
- The output should render correctly as a React Native mobile screen`

// --- Screen name detection ---

function detectScreenName(code: string): string {
  // Try to find component name from React export
  const exportMatch = code.match(/export\s+(?:default\s+)?function\s+(\w+)/)
  if (exportMatch) return exportMatch[1]

  // Try to find from HTML title or h1
  const h1Match = code.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (h1Match) return h1Match[1].trim().replace(/\s+/g, '')

  // Try from aria-label or title attribute
  const titleMatch = code.match(/(?:title|aria-label)\s*=\s*"([^"]+)"/i)
  if (titleMatch) return titleMatch[1].trim().replace(/\s+/g, '')

  return 'ImportedScreen'
}

// --- Color extraction from component tree ---

function extractColors(tree: any): string[] {
  const colors = new Set<string>()

  function walk(node: any) {
    if (!node || typeof node !== 'object') return
    const style = node.style || node.props?.style || {}
    for (const [, value] of Object.entries(style)) {
      if (typeof value === 'string' && /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/.test(value)) {
        colors.add(value)
      }
    }
    // Check Icon color prop
    if (node.props?.color && typeof node.props.color === 'string') {
      colors.add(node.props.color)
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (typeof child === 'object') walk(child)
      }
    }
  }

  walk(tree)
  return [...colors]
}

// --- JSON repair (same pattern as generate.ts) ---

function repairJSON(raw: string): any {
  let s = raw.trim()
  // Strip markdown fences
  s = s.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()

  const firstBrace = s.indexOf('{')
  if (firstBrace === -1) throw new Error('No JSON object found in response')
  const lastBrace = s.lastIndexOf('}')
  if (lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1)
  } else {
    s = s.slice(firstBrace)
  }

  try { return JSON.parse(s) } catch { /* continue to repair */ }

  let repaired = s
  // Close unclosed strings
  let inString = false, escaped = false
  for (const ch of repaired) {
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString }
  }
  if (inString) repaired += '"'

  // Remove trailing incomplete key-value pair
  repaired = repaired.replace(/,\s*"[^"]*":\s*"?[^"}\]]*$/, '')
  repaired = repaired.replace(/[,:\s]+$/, '')

  // Close unclosed brackets/braces
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

// --- Validate tree has content ---

function validateTree(tree: any): { valid: boolean; error?: string } {
  if (!tree || typeof tree !== 'object') {
    return { valid: false, error: 'Response is not a valid object' }
  }
  if (!tree.type) {
    return { valid: false, error: 'Root node missing "type" property' }
  }

  // Count children recursively
  let nodeCount = 0
  function walk(node: any) {
    if (!node || typeof node !== 'object') return
    nodeCount++
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (typeof child === 'object') walk(child)
      }
    }
  }
  walk(tree)

  if (nodeCount < 2) {
    return { valid: false, error: 'Could not detect any visual elements in the code' }
  }

  return { valid: true }
}

// --- Main handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Mokkoi-Source, X-API-Key')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // --- Authentication ---
  const user = await authenticateRequest(req, res)
  if (!user) return

  // --- Parse request body ---
  const { code, source: providedSource, projectId, screenName: providedScreenName } = req.body ?? {}

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "code" field' })
  }

  const trimmedCode = code.trim()
  if (trimmedCode.length < 50) {
    return res.status(400).json({ error: 'Code too short to convert. Paste a complete HTML/React component.' })
  }
  if (trimmedCode.length > 50000) {
    return res.status(400).json({ error: 'Code too large. Paste a single screen/component, not an entire project.' })
  }

  // --- Credit check (skip for MCP) ---
  if (!user.isMCP) {
    const creditCheck = await checkCredits(user.id, 'new_screen')
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

  // --- Detect input type ---
  const detected = detectInputType(trimmedCode)
  const source = providedSource || detected.source

  // --- Build user message ---
  const typeLabel = detected.type === 'unknown' ? 'web' : detected.type
  const tailwindNote = detected.hasTailwind ? ' (uses Tailwind CSS — convert all utility classes to React Native style objects)' : ''
  const sourceNote = source !== 'unknown' ? ` from ${source}` : ''

  const userMessage = `Convert this ${typeLabel} code${tailwindNote}${sourceNote} into a Mokkoi React Native component tree JSON.

SOURCE CODE:
\`\`\`
${trimmedCode}
\`\`\`

Requirements:
- Preserve ALL original colors exactly
- Preserve ALL text content exactly
- Fit the layout for a mobile phone viewport (393px width, iOS safe areas: paddingTop 54, paddingBottom 34)
- Use only these component types: View, Text, ScrollView, Image, TouchableOpacity, TextInput, Switch, SafeAreaView, Icon, LinearGradient
- For icons, use Google Material Symbols names (lowercase with underscores)
- Return ONLY valid JSON`

  // --- Call Claude API (always Sonnet for conversion quality) ---
  const model = 'claude-sonnet-4-20250514'
  const maxTokens = 8192

  try {
    const apiPayload = {
      model,
      max_tokens: maxTokens,
      system: [
        {
          type: 'text',
          text: HTML_IMPORT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(apiPayload),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error')
      console.error(`[import-html] Claude API error ${response.status}:`, errText)
      return res.status(502).json({ error: `AI service error (${response.status})` })
    }

    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
    }

    const rawText = data.content?.[0]?.text
    if (!rawText) {
      return res.status(502).json({ error: 'Empty response from AI service' })
    }

    // --- Parse and validate ---
    let tree: any
    try {
      tree = repairJSON(rawText)
    } catch (parseErr) {
      // Retry once with a stricter prompt
      console.warn('[import-html] JSON parse failed, retrying with stricter prompt')
      const retryPayload = {
        model,
        max_tokens: maxTokens,
        system: [
          {
            type: 'text',
            text: HTML_IMPORT_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: 'I apologize, let me return ONLY valid JSON this time:' },
          { role: 'user', content: 'Return ONLY the JSON component tree. No text before or after. Start with { and end with }.' },
        ],
      }

      const retryResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
        },
        body: JSON.stringify(retryPayload),
      })

      if (!retryResponse.ok) {
        return res.status(502).json({ error: 'Failed to parse AI response as valid JSON' })
      }

      const retryData = await retryResponse.json() as { content?: Array<{ text?: string }> }
      const retryText = retryData.content?.[0]?.text
      if (!retryText) {
        return res.status(502).json({ error: 'Empty retry response from AI service' })
      }

      try {
        tree = repairJSON(retryText)
      } catch {
        return res.status(502).json({ error: 'Failed to parse AI response as valid JSON after retry' })
      }
    }

    // Validate tree has content
    const validation = validateTree(tree)
    if (!validation.valid) {
      return res.status(422).json({ error: validation.error })
    }

    // Normalize through the same pipeline as generate.ts
    const normalizedTree = normalizeComponentTree(tree)

    // Extract metadata
    const detectedColors = extractColors(normalizedTree)
    const screenName = providedScreenName || detectScreenName(trimmedCode)

    // Build conversion notes
    const conversionNotes: string[] = []
    if (detected.hasTailwind) conversionNotes.push('Tailwind CSS classes converted to React Native style objects')
    if (detected.hasCSS) conversionNotes.push('CSS styles converted to React Native StyleSheet properties')
    if (detected.type === 'react-jsx' || detected.type === 'react-tsx') {
      conversionNotes.push('React component converted to Mokkoi JSON component tree')
    }
    if (source !== 'unknown') conversionNotes.push(`Source detected: ${source}`)

    // --- Deduct credits (after success) ---
    if (!user.isMCP) {
      await deductCredits(user.id, 'new_screen')
    }

    // --- Log usage ---
    logUsage({
      userId: user.id,
      projectId: projectId || undefined,
      modelUsed: model,
      tokensIn: data.usage?.input_tokens,
      tokensOut: data.usage?.output_tokens,
      generationType: 'new_screen',
      promptPreview: `[import-html] ${detected.type} from ${source}`,
      success: true,
    })

    return res.status(200).json({
      success: true,
      screen: {
        name: screenName,
        tree: normalizedTree,
        detectedColors,
        detectedSource: source,
        conversionNotes,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[import-html] Error:', message)

    logUsage({
      userId: user.id,
      projectId: projectId || undefined,
      modelUsed: model,
      generationType: 'new_screen',
      promptPreview: `[import-html] ${detected.type} from ${source}`,
      success: false,
    })

    return res.status(500).json({ error: `Import failed: ${message}` })
  }
}
