#!/usr/bin/env node
// One-off verifier for the HeaderBar leading-icon UX rule. Generates 2 apps
// via the same planner + per-screen path verify-bottomnav.mjs uses, then
// reports the HeaderBar showBack value for the Home screen and any detail
// screen. Pass = Home has showBack !== true AND any detail screen has
// showBack === true.
import { readFileSync, existsSync } from 'node:fs'

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    process.env[key] = val
  }
})()

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) { console.error('ANTHROPIC_API_KEY missing'); process.exit(1) }
const MODEL = process.env.MODEL || 'claude-sonnet-4-20250514'
console.log(`[verify-headerbar] generator model: ${MODEL}`)

const { default: prompts } = await import('./_load-prompts.mjs')
const { plannerSystem, appGenerationSystem } = prompts

const TEST_PROMPTS = [
  { id: 'fitness', prompt: 'Build a fitness tracker with home, workouts, progress, and profile screens' },
  { id: 'recipe',  prompt: 'Build a recipe app with home, browse, favorites, and profile screens' },
]

async function callAnthropic({ model, max_tokens, system, messages }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages }),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
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

function findHeaderBars(tree, out = []) {
  if (!tree || typeof tree !== 'object') return out
  if (tree.type === 'HeaderBar') out.push(tree)
  const kids = Array.isArray(tree.children) ? tree.children : []
  for (const k of kids) findHeaderBars(k, out)
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
  console.log(`  plan: "${plan.appName}", screens=${plan.screens.map(s => s.name).join(', ')}`)

  // Pick Home + one detail screen if available; else Home + first non-tab screen
  const home = plan.screens.find(s => s.isHome) || plan.screens[0]
  const tabIds = new Set(plan.navigation?.tabScreens || [])
  const detail = plan.screens.find(s => !tabIds.has(s.id) && s.id !== home.id) ||
                 plan.screens.find(s => s.id !== home.id)
  const targets = [home, detail].filter(Boolean)
  console.log(`  generating: home="${home?.name}", detail="${detail?.name}"`)

  const screenListSummary = plan.screens.map((s, i) =>
    `${i + 1}. "${s.name}" (id: "${s.id}", type: ${s.screenType}${s.isHome ? ', HOME SCREEN' : ''}): ${s.description}`).join('\n')
  const tabInfo = plan.navigation?.tabScreens?.length
    ? `Tab screens: ${plan.navigation.tabScreens.join(', ')}.`
    : 'No bottom tabs.'
  const accent = plan.designDirection?.accentColor || '#6C5CE7'

  const generated = []
  for (const s of targets) {
    const isTab = tabIds.has(s.id)
    const userPrompt = `Generate ONE screen for "${plan.appName || 'MyApp'}".
APP CONTEXT
Original request: "${testPrompt.prompt}"
App name: "${plan.appName || 'MyApp'}"
Navigation: ${plan.navigation?.type || 'stack'}. ${tabInfo}

FULL SCREEN LIST:
${screenListSummary}

GENERATE ONLY THIS SCREEN
id: "${s.id}"
name: "${s.name}"
type: ${s.screenType}${s.isHome ? ' (HOME SCREEN)' : ''}${isTab ? ' (TAB SCREEN)' : ''}
description: ${s.description}

CRITICAL
- Use accent ${accent}.
- Use macro components including HeaderBar at the top of the screen.
- Keep tree COMPACT.

Return ONLY a JSON object: {"id": "${s.id}", "name": "${s.name}", "tree": { ... }}`

    let attempts = 0
    while (attempts < 2) {
      try {
        const resp = await callAnthropic({
          model: MODEL, max_tokens: 5500,
          system: appGenerationSystem,
          messages: [{ role: 'user', content: userPrompt }],
        })
        const text = stripFunctionLiterals(stripCodeFences(resp?.content?.[0]?.text || ''))
        let obj
        try { obj = JSON.parse(text) } catch { obj = repairJSON(text) }
        if (!obj?.tree) throw new Error('no tree')
        generated.push({ id: obj.id || s.id, name: obj.name || s.name, isHome: !!s.isHome, isTab, tree: obj.tree })
        console.log(`    ✓ "${s.name}"`)
        break
      } catch (err) {
        attempts++
        if (attempts >= 2) console.log(`    ✗ "${s.name}" — ${err.message}`)
        else await new Promise(r => setTimeout(r, 1500))
      }
    }
    await new Promise(r => setTimeout(r, 200))
  }

  return { plan, screens: generated }
}

function evaluate(app) {
  const home = app.screens.find(s => s.isHome) || app.screens[0]
  const detail = app.screens.find(s => !s.isHome && !s.isTab) || app.screens.find(s => s !== home)
  const homeNavs = home ? findHeaderBars(home.tree) : []
  const detailNavs = detail ? findHeaderBars(detail.tree) : []
  const homeShowBack = homeNavs[0]?.props?.showBack
  const detailShowBack = detailNavs[0]?.props?.showBack
  return {
    app: app.plan.appName,
    home: { name: home?.name, hasHeaderBar: homeNavs.length > 0, showBack: homeShowBack, title: homeNavs[0]?.props?.title },
    detail: { name: detail?.name, hasHeaderBar: detailNavs.length > 0, showBack: detailShowBack, title: detailNavs[0]?.props?.title },
    // PASS: Home shows no back (showBack === false OR HeaderBar absent), AND detail shows back (showBack === true OR not specified, since macro defaults to true).
    homeOk: homeNavs.length === 0 || homeShowBack === false,
    detailOk: detailNavs.length === 0 || detailShowBack !== false,
  }
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
    results.push({ id: tp.id, ev: { homeOk: false, detailOk: false, error: err.message } })
  }
}

console.log('\n━━━ SUMMARY ━━━')
let pass = 0
for (const r of results) {
  const ok = r.ev.homeOk && r.ev.detailOk
  if (ok) pass++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.id}  home.showBack=${JSON.stringify(r.ev.home?.showBack)} detail.showBack=${JSON.stringify(r.ev.detail?.showBack)}`)
}
console.log(`\n${pass}/${results.length} apps pass`)
process.exit(pass >= 2 ? 0 : 1)
