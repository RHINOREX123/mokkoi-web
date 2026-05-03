#!/usr/bin/env node
// One-off verifier for the BottomNav-label fix in api/_lib/design-system.ts.
// Generates 3 apps via the same planner + per-screen path the production
// endpoint uses, then prints each app's BottomNav block per screen and
// reports whether tab labels match destination screen names.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

;(function loadDotEnv() {
  const envPath = new URL('../.env', import.meta.url)
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
})()

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) { console.error('ANTHROPIC_API_KEY missing'); process.exit(1) }

const { default: prompts } = await import('./_load-prompts.mjs')
const { plannerSystem, appGenerationSystem } = prompts

const TEST_PROMPTS = [
  { id: 'fitness', prompt: 'Build a fitness tracker with home, workouts, progress, and profile screens' },
  { id: 'recipe', prompt: 'Build a recipe app with browse, search, favorites, and profile' },
  { id: 'expense', prompt: 'Build an expense tracker with home, transactions, add expense, and profile' },
]

const TOKEN_BUDGET = 10_000, WINDOW_MS = 60_000
const RECENT = []
async function reserveTokens(maxTokens) {
  while (true) {
    const now = Date.now()
    while (RECENT.length && now - RECENT[0].t > WINDOW_MS) RECENT.shift()
    const used = RECENT.reduce((a, r) => a + r.tokens, 0)
    if (used + maxTokens <= TOKEN_BUDGET) {
      const e = { t: now, tokens: maxTokens }; RECENT.push(e); return e
    }
    const wait = (RECENT[0].t + WINDOW_MS) - now + 1000
    console.log(`  …rate budget ${used}/${TOKEN_BUDGET}, waiting ${(wait/1000).toFixed(0)}s`)
    await new Promise(r => setTimeout(r, Math.max(wait, 1000)))
  }
}
async function callAnthropic({ model, max_tokens, system, messages }) {
  const reservation = await reserveTokens(max_tokens)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages }),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  const actualOut = json?.usage?.output_tokens
  if (typeof actualOut === 'number' && actualOut < reservation.tokens) reservation.tokens = actualOut
  return json
}

function stripCodeFences(t) { return t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim() }
function repairJSON(text) {
  let t = text.trim()
  if (!t.endsWith('}') && !t.endsWith(']')) {
    const opens = (t.match(/[{\[]/g) || []).length, closes = (t.match(/[}\]]/g) || []).length
    const diff = opens - closes; if (diff > 0) t += '}'.repeat(diff)
  }
  return JSON.parse(t)
}
function stripFunctionLiterals(text) {
  let t = text
  t = t.replace(/("[\w-]+"\s*:\s*)(?:async\s*)?\([^)]*\)\s*=>\s*\{[^}]*\}/g, '$1null')
  t = t.replace(/("[\w-]+"\s*:\s*)(?:async\s*)?[\w$]+\s*=>\s*\{[^}]*\}/g, '$1null')
  t = t.replace(/("[\w-]+"\s*:\s*)(?:async\s*)?function\s*\*?[\w$]*\s*\([^)]*\)\s*\{[^}]*\}/g, '$1null')
  t = t.replace(/("on[A-Z][\w]*"\s*:\s*)([a-zA-Z_$][\w$]*)(\s*[,}\]])/g, '$1null$3')
  return t
}

// Walk a tree to find BottomNav nodes
function findBottomNavs(tree, out = []) {
  if (!tree || typeof tree !== 'object') return out
  if (tree.type === 'BottomNav') out.push(tree)
  const kids = Array.isArray(tree.children) ? tree.children : []
  for (const k of kids) findBottomNavs(k, out)
  return out
}

async function generateApp(testPrompt) {
  console.log(`\n━━━ ${testPrompt.id} ━━━`)
  const planResp = await callAnthropic({
    model: 'claude-haiku-4-5-20251001', max_tokens: 2000,
    system: plannerSystem,
    messages: [{ role: 'user', content: testPrompt.prompt }],
  })
  const planText = stripCodeFences(planResp?.content?.[0]?.text || '')
  let plan
  try { plan = JSON.parse(planText) } catch { plan = repairJSON(planText) }
  console.log(`  plan: "${plan.appName}", screens=${plan.screens.map(s => s.name).join(', ')}, tabScreens=${plan.navigation?.tabScreens?.join(',') || 'none'}`)

  const planScreens = plan.screens.slice(0, 7)
  const screenListSummary = planScreens.map((s, i) =>
    `${i + 1}. "${s.name}" (id: "${s.id}", type: ${s.screenType}${s.isHome ? ', HOME SCREEN' : ''}): ${s.description}`).join('\n')
  const tabInfo = plan.navigation?.tabScreens?.length
    ? `Tab screens: ${plan.navigation.tabScreens.join(', ')}. These screens MUST include an identical BottomNav. Active tab matches current screen.`
    : 'No bottom tabs — use stack navigation only.'
  const accent = plan.designDirection?.accentColor || '#6C5CE7'
  const theme = plan.designDirection?.theme || 'dark'
  const style = plan.designDirection?.style || 'modern minimal'

  const generatedScreens = []
  for (let i = 0; i < planScreens.length; i++) {
    const s = planScreens[i]
    const isTab = plan.navigation?.tabScreens?.includes(s.id) ?? false
    const userPrompt = `Generate ONE screen for "${plan.appName || 'MyApp'}".

APP CONTEXT
Original request: "${testPrompt.prompt}"
App name: "${plan.appName || 'MyApp'}"
Design direction: theme=${theme}, accent=${accent}, style=${style}
Navigation: ${plan.navigation?.type || 'stack'}. ${tabInfo}

FULL SCREEN LIST (for cross-screen consistency — visual language, surfaces, header style, BottomNav layout must match across all screens):
${screenListSummary}

GENERATE ONLY THIS SCREEN
id: "${s.id}"
name: "${s.name}"
type: ${s.screenType}${s.isHome ? ' (HOME SCREEN)' : ''}${isTab ? ' (TAB SCREEN — must include the same BottomNav as other tab screens, with this tab as active)' : ''}
description: ${s.description}

CRITICAL
- Use accent ${accent} for primary actions across the app.
- Use macro components (BottomNav, SearchBar, ProductCard, ListRow, StatCard, ChipSelector, RatingStars, SectionHeader, MessageBubble, FormInput, etc.) instead of building from raw Views. This is required.
- Keep the tree COMPACT (target 50–180 nodes total).
- App name "${plan.appName || 'MyApp'}" appears in the Home header${s.isHome ? ' on this screen' : ''}.

JSON OUTPUT RULES (strict — invalid output will be rejected)
- Output must be PURE JSON — no JavaScript syntax of any kind.
- DO NOT use arrow functions, function literals, bare identifiers as values, comments, trailing commas.

Return ONLY a JSON object with this exact shape, no markdown, no explanation:
{"id": "${s.id}", "name": "${s.name}", "tree": { ... }}`

    let screen = null, lastErr
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const resp = await callAnthropic({
          model: 'claude-haiku-4-5-20251001', max_tokens: 5500,
          system: appGenerationSystem,
          messages: [{ role: 'user', content: userPrompt }],
        })
        const text = stripFunctionLiterals(stripCodeFences(resp?.content?.[0]?.text || ''))
        let obj
        try { obj = JSON.parse(text) } catch { obj = repairJSON(text) }
        if (!obj || !obj.tree) throw new Error('no tree')
        screen = { id: obj.id || s.id, name: obj.name || s.name, tree: obj.tree }
        break
      } catch (err) { lastErr = err; if (attempt < 2) await new Promise(r => setTimeout(r, 2000)) }
    }
    if (screen) {
      generatedScreens.push(screen)
      console.log(`    ✓ ${i+1}/${planScreens.length} "${s.name}"`)
    } else {
      console.log(`    ✗ ${i+1}/${planScreens.length} "${s.name}" — ${lastErr?.message}`)
    }
    if (i < planScreens.length - 1) await new Promise(r => setTimeout(r, 100))
  }

  return { plan, screens: generatedScreens }
}

function evaluate(app) {
  const screenNames = new Set(app.plan.screens.map(s => s.name.toLowerCase().trim()))
  const screenIds = new Set(app.plan.screens.map(s => s.id.toLowerCase().trim()))
  // First screen with a BottomNav defines the canonical tab set
  let firstNav = null, firstNavScreenName = null
  for (const s of app.screens) {
    const navs = findBottomNavs(s.tree)
    if (navs.length > 0) { firstNav = navs[0]; firstNavScreenName = s.name; break }
  }
  if (!firstNav) return { app: app.plan.appName, ok: false, reason: 'no BottomNav found in any screen' }

  const items = (firstNav.props?.items) || []
  const rows = items.map(it => {
    const lbl = String(it.label || '').trim()
    const ico = String(it.icon || '').trim()
    const lblLower = lbl.toLowerCase()
    const matchesScreen = screenNames.has(lblLower) || screenIds.has(lblLower)
                         || [...screenNames].some(n => n.includes(lblLower) || lblLower.includes(n))
    const labelEqualsIcon = lblLower === ico.toLowerCase()
    return { label: lbl, icon: ico, matchesScreen, labelEqualsIcon }
  })
  const matched = rows.filter(r => r.matchesScreen).length
  // Pass: every label matches a screen name AND no label equals its icon name
  const ok = rows.length > 0 && matched === rows.length && rows.every(r => !r.labelEqualsIcon)
  return { app: app.plan.appName, navOnScreen: firstNavScreenName, rows, matched, total: rows.length, ok }
}

const results = []
for (const tp of TEST_PROMPTS) {
  try {
    const app = await generateApp(tp)
    const ev = evaluate(app)
    console.log('  evaluation:', JSON.stringify(ev, null, 2))
    results.push({ id: tp.id, ev })
  } catch (err) {
    console.log(`  ✗ FAILED: ${err.message}`)
    results.push({ id: tp.id, ev: { ok: false, error: err.message } })
  }
}

console.log('\n━━━ SUMMARY ━━━')
let pass = 0
for (const r of results) {
  const verdict = r.ev.ok ? 'PASS' : 'FAIL'
  if (r.ev.ok) pass++
  console.log(`${verdict}  ${r.id}  ${r.ev.app || ''}  matched=${r.ev.matched}/${r.ev.total}`)
  if (r.ev.rows) {
    for (const row of r.ev.rows) {
      console.log(`    label="${row.label}" icon="${row.icon}" matchesScreen=${row.matchesScreen ? 'Y' : 'N'} labelEqualsIcon=${row.labelEqualsIcon ? 'Y' : 'N'}`)
    }
  }
}
console.log(`\n${pass}/${results.length} apps pass`)

writeFileSync(new URL('./verify-bottomnav-results.json', import.meta.url), JSON.stringify(results, null, 2))
console.log('saved → eval/verify-bottomnav-results.json')
process.exit(pass >= 2 ? 0 : 1)
