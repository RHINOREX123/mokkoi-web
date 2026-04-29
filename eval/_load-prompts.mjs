// eval/_load-prompts.mjs — extract Mokkoi's planner+generation system prompts
// from the TypeScript source files. We don't compile TS for the harness;
// instead we read the constants out via regex. Brittle when api/_lib/
// design-system.ts changes shape — the harness will exit fast if extraction
// fails, which is an acceptable signal to update this loader.
import { readFileSync } from 'node:fs'

const DESIGN_SYSTEM_SRC = readFileSync(
  new URL('../api/_lib/design-system.ts', import.meta.url),
  'utf8',
)
const GENERATE_SRC = readFileSync(
  new URL('../api/generate.ts', import.meta.url),
  'utf8',
)
const GENERATE_FLOW_SRC = readFileSync(
  new URL('../api/generate-flow.ts', import.meta.url),
  'utf8',
)

// Pull a backtick-template constant by name. Returns the inner string (with
// any ${...} placeholders left as literal source text — we substitute below
// for the few constants we actually need).
function extractTemplate(src, name) {
  // Match `(export )?const NAME = \`...\`` non-greedy until matching backtick.
  const re = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*(?::\\s*\\w+(?:<[^>]+>)?)?\\s*=\\s*\`([\\s\\S]*?)\``, 'm')
  const m = re.exec(src)
  if (!m) throw new Error(`Could not extract template ${name} from source`)
  return m[1]
}

// Resolve `${OTHER_NAME}` placeholders by looking each one up in design-system.ts.
function resolvePlaceholders(template, lookup) {
  return template.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (full, name) => {
    if (name in lookup) return lookup[name]
    // Unknown placeholder — leave as-is, will probably degrade prompt quality.
    return full
  })
}

const DESIGN_TOKENS = extractTemplate(DESIGN_SYSTEM_SRC, 'DESIGN_TOKENS')
const CONTENT_LIBRARY = extractTemplate(DESIGN_SYSTEM_SRC, 'CONTENT_LIBRARY')
const COMPONENT_TYPES = extractTemplate(DESIGN_SYSTEM_SRC, 'COMPONENT_TYPES')
const VIEWPORT_BUDGET = extractTemplate(DESIGN_SYSTEM_SRC, 'VIEWPORT_BUDGET')
const CONTENT_DENSITY = extractTemplate(DESIGN_SYSTEM_SRC, 'CONTENT_DENSITY')
const PLATFORM_RULES = extractTemplate(DESIGN_SYSTEM_SRC, 'PLATFORM_RULES')
const FUNCTIONAL_APP_RULES = extractTemplate(DESIGN_SYSTEM_SRC, 'FUNCTIONAL_APP_RULES')
const QUALITY_CHECKLIST = extractTemplate(DESIGN_SYSTEM_SRC, 'QUALITY_CHECKLIST')
const APP_PLANNER_SYSTEM_PROMPT = extractTemplate(DESIGN_SYSTEM_SRC, 'APP_PLANNER_SYSTEM_PROMPT')

const lookup = {
  DESIGN_TOKENS, CONTENT_LIBRARY, COMPONENT_TYPES, VIEWPORT_BUDGET,
  CONTENT_DENSITY, PLATFORM_RULES, FUNCTIONAL_APP_RULES, QUALITY_CHECKLIST,
}

// SYSTEM_PROMPT_NEW from api/generate.ts (the per-screen single-shot prompt,
// NOT used for app generation — that uses APP_GENERATION_SYSTEM_PROMPT).
// We extract that one separately for completeness.
const APP_GENERATION_SYSTEM_PROMPT = (() => {
  // The constant is defined in api/generate-flow.ts. Try to extract it.
  try {
    const raw = extractTemplate(GENERATE_FLOW_SRC, 'APP_GENERATION_SYSTEM_PROMPT')
    return resolvePlaceholders(raw, lookup)
  } catch {
    // Fallback: build it from the per-screen system prompt structure.
    const raw = extractTemplate(GENERATE_SRC, 'SYSTEM_PROMPT_NEW')
    return resolvePlaceholders(raw, lookup)
  }
})()

const plannerSystem = APP_PLANNER_SYSTEM_PROMPT
const appGenerationSystem = APP_GENERATION_SYSTEM_PROMPT

// Build the per-call generation prompt (mirrors api/generate-flow.ts:340-354).
function buildGenPrompt(originalPrompt, plan) {
  const screenList = plan.screens.map((s, i) =>
    `${i + 1}. "${s.name}" (id: "${s.id}", type: ${s.screenType}${s.isHome ? ', HOME SCREEN' : ''}): ${s.description}`,
  ).join('\n')
  const tabInfo = plan.navigation?.tabScreens?.length
    ? `Tab screens: ${plan.navigation.tabScreens.join(', ')}. These screens MUST include an identical BottomNav. Active tab matches current screen.`
    : 'No bottom tabs — use stack navigation only.'

  return `Generate ALL ${plan.screens.length} screens for "${plan.appName || 'MyApp'}".

SCREEN PLAN:
${screenList}

DESIGN: Theme: ${plan.designDirection?.theme || 'dark'}, Accent: ${plan.designDirection?.accentColor || '#6C5CE7'}, Style: ${plan.designDirection?.style || 'modern minimal'}
NAVIGATION: ${plan.navigation?.type || 'stack'}. ${tabInfo}

CRITICAL: ALL screens use accent ${plan.designDirection?.accentColor || '#6C5CE7'} for actions. Same surfaces, text colors, card styles. App name "${plan.appName || 'MyApp'}" in Home header.

Original request: "${originalPrompt}"

IMPORTANT: Keep each screen's tree COMPACT. Use macro components (BottomNav, SearchBar, ProductCard, ListRow, StatCard, etc.) instead of building from raw Views. This keeps output small and ensures valid JSON.

Return ONLY a JSON array of ${plan.screens.length} screens with "id", "name", "tree". No explanation, no markdown.`
}

export default { plannerSystem, appGenerationSystem, buildGenPrompt }
