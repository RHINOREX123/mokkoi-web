/**
 * planner.ts — Phase-1 app planner for generate-flow.
 *
 * Extracted from api/generate-flow.ts (Stream A — deep navigation). Owns:
 *  - Types for the planner output (legacy AppPlan + deep-nav PlannerOutput)
 *  - JSON parsing/repair for planner responses
 *  - runAppPlanner: Anthropic Phase-1 call, parses an AppPlan, retries on
 *    parse failure with a stricter suffix. Behavior-preserving extraction
 *    of the original inline block.
 *  - runPlanner: deep-nav variant returning the full PlannerOutput (legacy
 *    AppPlan + routeGraph + appData) for downstream Streams B/C.
 *  - validatePlannerOutput: structural rule checks (every list has a
 *    detail, ≥3 records per collection, navIntent.screen references all
 *    resolve to routeGraph.screens).
 *
 * This module is intentionally self-contained: it accepts a `callApi`
 * function so tests can stub the Anthropic HTTP call without disabling the
 * real codepath in generate-flow.
 */

import { buildFullPlannerSystem } from './planner-prompt.js'

// ── Legacy AppPlan shape (matches what generate-flow consumed previously) ─────

export interface ScreenDataAction {
  kind: 'auth.signInWithPassword' | 'auth.signUp' | 'auth.signOut'
  redirectScreen?: string
}

export interface AppPlanScreen {
  id: string
  name: string
  description: string
  screenType: string
  isHome: boolean
  dataAction?: ScreenDataAction
}

export interface AppPlan {
  appName: string
  screens: AppPlanScreen[]
  navigation: {
    type: 'tabs' | 'stack' | 'hybrid'
    tabScreens?: string[]
    connections: Array<{ from: string; to: string; trigger: string }>
  }
  designDirection: { theme: string; accentColor: string; style: string }
}

// ── Deep-nav contract (Streams B/C consume these) ─────────────────────────────

export type ScreenKind = 'screen' | 'modal'

export interface ScreenEntry {
  id: string
  kind: ScreenKind
  purpose: string
  params?: string[]
  dataSource?: string
}

export interface RouteGraph {
  screens: ScreenEntry[]
  tabs: string[]
}

/** appData: domain-specific record collections, each ≥3 records. */
export type AppData = Record<string, unknown[]>

export interface PlannerOutput {
  /** Legacy plan fields preserved for downstream consumers. */
  plan: AppPlan
  appData: AppData
  routeGraph: RouteGraph
}

// ── JSON parse / repair helpers (lifted from generate-flow) ───────────────────

function stripCodeFences(text: string): string {
  return text.trim().replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
}

function repairJSON(text: string): any {
  let repaired = text
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
  return JSON.parse(repaired)
}

function repairStrayDigitQuotes(text: string): string {
  let out = text.replace(/(:\s*-?\d+(?:\.\d+)?)"(\s*[,}\]])/g, '$1$2')
  out = out.replace(/([,[]\s*-?\d+(?:\.\d+)?)"(\s*[,\]}])/g, '$1$2')
  return out
}

export function parseAppPlan(text: string): AppPlan | null {
  const jsonText = stripCodeFences(text)
  try { return JSON.parse(jsonText) } catch {}
  try { return repairJSON(jsonText) } catch {}
  const dequoted = repairStrayDigitQuotes(jsonText)
  if (dequoted !== jsonText) {
    try { return JSON.parse(dequoted) } catch {}
    try { return repairJSON(dequoted) } catch {}
  }
  const objStart = jsonText.indexOf('{')
  const objEnd = jsonText.lastIndexOf('}')
  if (objStart >= 0 && objEnd > objStart) {
    const extracted = jsonText.slice(objStart, objEnd + 1)
    try { return JSON.parse(extracted) } catch {}
    try { return repairJSON(extracted) } catch {}
    const extractedDequoted = repairStrayDigitQuotes(extracted)
    if (extractedDequoted !== extracted) {
      try { return JSON.parse(extractedDequoted) } catch {}
      try { return repairJSON(extractedDequoted) } catch {}
    }
  }
  return null
}

/** Same parser, but typed as any so deep-nav callers can pull off extra fields. */
function parseDeepPlan(text: string): any {
  return parseAppPlan(text) as any
}

export const STRICT_OBJECT_SUFFIX = '\n\nOutput MUST be a single JSON object, nothing before or after. No markdown fences. No explanation. The first character is `{`. The last character is `}`. Numeric values MUST NOT be quoted: write `"count": 5` (correct) NOT `"count": 5"` (wrong — stray quote breaks parsing). All number literals are unquoted.'

/** Validate / sanitize the `dataAction` field on a planner screen. */
export function validateDataAction(raw: unknown): ScreenDataAction | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const kind = r.kind
  if (kind !== 'auth.signInWithPassword' && kind !== 'auth.signUp' && kind !== 'auth.signOut') {
    return undefined
  }
  const out: ScreenDataAction = { kind }
  if (typeof r.redirectScreen === 'string' && r.redirectScreen.length > 0) {
    out.redirectScreen = r.redirectScreen
  }
  return out
}

// ── HTTP client contract ──────────────────────────────────────────────────────

export interface AnthropicCallResult {
  ok: boolean
  status: number
  json: () => Promise<any>
  text: () => Promise<string>
}

export type CallAnthropic = (body: Record<string, unknown>) => Promise<AnthropicCallResult>

export interface RunPlannerArgs {
  /** Anthropic HTTP wrapper. Tests inject a stub. */
  callApi: CallAnthropic
  prompt: string
  images: Array<{ data: string; mimeType?: string }>
  conversationHistory?: Array<{ role: string; content: string }>
  templateId?: string | null
  /** Defaults to claude-haiku-4-5-20251001 to match prior behavior. */
  model?: string
}

export interface RunAppPlannerResult {
  plan: AppPlan | null
  /** When plan is null, a short tag describing why (logged by caller). */
  failureCode?: 'api_error' | 'parse_failed'
  rawText?: string
  stopReason?: string
}

// ── Message builder (mirrors generate-flow's buildMessages) ───────────────────

function buildMessages(
  conversationHistory: Array<{ role: string; content: string }> | undefined,
  currentContent: string,
  images: Array<{ data: string; mimeType?: string }>,
): Array<{ role: 'user' | 'assistant'; content: any }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: any }> = []
  if (Array.isArray(conversationHistory)) {
    for (const m of conversationHistory.slice(-5)) {
      const role = m.role === 'assistant' ? 'assistant' : 'user'
      if (messages.length > 0 && messages[messages.length - 1].role === role && typeof messages[messages.length - 1].content === 'string') {
        messages[messages.length - 1].content += '\n' + m.content
      } else {
        messages.push({ role, content: m.content })
      }
    }
    if (messages.length > 0 && messages[0].role === 'assistant') {
      messages.shift()
    }
  }
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
    messages.push({ role: 'assistant', content: 'Understood, continuing.' })
  }
  const finalContent = images.length > 0
    ? [
        ...images.map(img => ({
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: img.mimeType || 'image/png', data: img.data },
        })),
        { type: 'text' as const, text: currentContent },
      ]
    : currentContent
  return [...messages, { role: 'user', content: finalContent }]
}

// ── runAppPlanner (behavior-preserving extraction) ────────────────────────────

const DEFAULT_PLANNER_MODEL = 'claude-haiku-4-5-20251001'

/**
 * Behavior-preserving extraction of the original Phase-1 planner block from
 * api/generate-flow.ts (legacy AppPlan shape). Does NOT emit SSE — the caller
 * still owns user-facing progress. Returns `{ plan }` on success or
 * `{ plan: null, failureCode }` so the caller decides how to surface errors.
 */
export async function runAppPlanner(args: RunPlannerArgs): Promise<RunAppPlannerResult> {
  const { callApi, prompt, images, conversationHistory, templateId } = args
  const model = args.model ?? DEFAULT_PLANNER_MODEL

  const plannerSystem = buildFullPlannerSystem(templateId, images.length > 0)
  const plannerBody = {
    model,
    max_tokens: 2000,
    system: [{ type: 'text', text: plannerSystem, cache_control: { type: 'ephemeral' } }],
    messages: buildMessages(conversationHistory, prompt, images),
  }

  let planResponse = await callApi(plannerBody)
  if (!planResponse.ok) {
    return { plan: null, failureCode: 'api_error' }
  }

  let planData: any = await planResponse.json()
  let planText: string = planData.content?.[0]?.text ?? ''
  let plan: AppPlan | null = parseAppPlan(planText)

  // Retry once on parse failure with bumped tokens + strict suffix.
  if (!plan) {
    const retryResp = await callApi({
      ...plannerBody,
      max_tokens: 64000,
      system: [{ type: 'text', text: plannerSystem + STRICT_OBJECT_SUFFIX, cache_control: { type: 'ephemeral' } }],
    })
    if (retryResp.ok) {
      planData = await retryResp.json()
      planText = planData.content?.[0]?.text ?? ''
      plan = parseAppPlan(planText)
    }
  }

  if (!plan) {
    return { plan: null, failureCode: 'parse_failed', rawText: planText, stopReason: planData?.stop_reason }
  }
  return { plan, rawText: planText, stopReason: planData?.stop_reason }
}

// ── runPlanner (deep-nav variant) ─────────────────────────────────────────────

/**
 * Deep-nav planner: returns the full PlannerOutput including appData and
 * routeGraph. Asks the LLM to emit additional fields via DEEP_NAV_PLANNER_RULES.
 */
export async function runPlanner(args: RunPlannerArgs): Promise<PlannerOutput> {
  const { callApi, prompt, images, conversationHistory, templateId } = args
  const model = args.model ?? DEFAULT_PLANNER_MODEL

  const plannerSystem = buildFullPlannerSystem(templateId, images.length > 0, { deepNav: true })
  const plannerBody = {
    model,
    max_tokens: 4000,
    system: [{ type: 'text', text: plannerSystem, cache_control: { type: 'ephemeral' } }],
    messages: buildMessages(conversationHistory, prompt, images),
  }

  let planResponse = await callApi(plannerBody)
  if (!planResponse.ok) {
    throw new Error('planner: api_error')
  }

  let planData: any = await planResponse.json()
  let planText: string = planData.content?.[0]?.text ?? ''
  let parsed: any = parseDeepPlan(planText)

  if (!parsed) {
    const retryResp = await callApi({
      ...plannerBody,
      max_tokens: 64000,
      system: [{ type: 'text', text: plannerSystem + STRICT_OBJECT_SUFFIX, cache_control: { type: 'ephemeral' } }],
    })
    if (retryResp.ok) {
      planData = await retryResp.json()
      planText = planData.content?.[0]?.text ?? ''
      parsed = parseDeepPlan(planText)
    }
  }

  if (!parsed) throw new Error('planner: parse_failed')

  // Split: legacy AppPlan fields vs deep-nav extras.
  const plan: AppPlan = {
    appName: parsed.appName,
    screens: parsed.screens ?? [],
    navigation: parsed.navigation ?? { type: 'stack', connections: [] },
    designDirection: parsed.designDirection ?? { theme: 'dark', accentColor: '#6C5CE7', style: 'modern minimal' },
  }
  const appData: AppData = (parsed.appData && typeof parsed.appData === 'object') ? parsed.appData : {}
  const routeGraph: RouteGraph = {
    screens: Array.isArray(parsed.routeGraph?.screens) ? parsed.routeGraph.screens : [],
    tabs: Array.isArray(parsed.routeGraph?.tabs) ? parsed.routeGraph.tabs : [],
  }

  return { plan, appData, routeGraph }
}

// ── Validation: structural rule checks against the spec ───────────────────────

export interface ValidationIssue {
  rule: string
  detail: string
}

export interface ValidationReport {
  ok: boolean
  issues: ValidationIssue[]
}

/**
 * Validate a PlannerOutput against the deep-nav rules:
 *  - Every list/grid/feed screen has a detail screen in routeGraph
 *  - Every "Add X" / "Filter X" / "Share X" CTA has a modal screen entry
 *  - ≥3 records per appData collection
 *  - Every navIntent target in `navIntents` (passed by caller, since
 *    intents live on generated ComponentNodes downstream) resolves to a
 *    screen id in routeGraph.screens
 */
export function validatePlannerOutput(
  out: PlannerOutput,
  navIntentTargets: string[] = [],
): ValidationReport {
  const issues: ValidationIssue[] = []

  const screenIds = new Set(out.routeGraph.screens.map(s => s.id))

  // Rule: ≥3 records per appData collection.
  for (const [collectionName, records] of Object.entries(out.appData)) {
    if (!Array.isArray(records) || records.length < 3) {
      issues.push({
        rule: 'appData.min_records',
        detail: `Collection "${collectionName}" must have at least 3 records (has ${Array.isArray(records) ? records.length : 0}).`,
      })
    }
  }

  // Rule: every list/grid/feed screen must have a corresponding detail.
  // Heuristic: a planner screen with screenType matching list-like patterns
  // OR a routeGraph entry whose purpose mentions "list"/"grid"/"feed"/"browse".
  const listLike = out.routeGraph.screens.filter(s => {
    const p = (s.purpose ?? '').toLowerCase()
    return /\b(list|grid|feed|browse|catalog|all\b)/.test(p)
  })
  for (const listScreen of listLike) {
    const hasDetail = out.routeGraph.screens.some(s => {
      if (s.id === listScreen.id) return false
      const p = (s.purpose ?? '').toLowerCase()
      return /\bdetail\b|\bview\b|\bshow\b/.test(p) && s.kind === 'screen'
    })
    if (!hasDetail) {
      issues.push({
        rule: 'routeGraph.list_needs_detail',
        detail: `List/grid screen "${listScreen.id}" (${listScreen.purpose}) has no corresponding detail screen in routeGraph.`,
      })
    }
  }

  // Rule: every Add/Filter/Share CTA in plan.navigation.connections.trigger
  // must have a corresponding modal screen entry.
  const ctaTriggers = (out.plan.navigation?.connections ?? [])
    .map(c => (c.trigger ?? '').trim())
    .filter(t => /^(add|filter|share)\b/i.test(t))
  for (const trigger of ctaTriggers) {
    const hasModal = out.routeGraph.screens.some(s => s.kind === 'modal')
    if (!hasModal) {
      issues.push({
        rule: 'routeGraph.cta_needs_modal',
        detail: `CTA "${trigger}" requires a modal screen in routeGraph but none exists.`,
      })
      break
    }
  }

  // Rule: every navIntent target must resolve to a screen id.
  for (const target of navIntentTargets) {
    if (!screenIds.has(target)) {
      issues.push({
        rule: 'navIntent.target_unresolved',
        detail: `navIntent target "${target}" does not appear in routeGraph.screens.`,
      })
    }
  }

  // Rule: dataSource references must resolve to appData collections.
  for (const s of out.routeGraph.screens) {
    if (s.dataSource && !(s.dataSource in out.appData)) {
      issues.push({
        rule: 'routeGraph.dataSource_unresolved',
        detail: `Screen "${s.id}" references dataSource "${s.dataSource}" but no such collection exists in appData.`,
      })
    }
  }

  return { ok: issues.length === 0, issues }
}
