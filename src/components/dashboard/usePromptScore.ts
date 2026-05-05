import { useEffect, useRef, useState } from 'react'

export type PromptScope = 'clear' | 'broad' | 'narrow'

export interface PromptScore {
  /** 0–100. How clearly the prompt names what to build. */
  clarity: number
  /** 0–100. How specifically it names the user / feature surface. */
  specificity: number
  /** Coarse scope classification — drives the SCOPE badge in the HUD. */
  scope: PromptScope
  /** The single most-actionable improvement, surfaced as the trailing hint. */
  topImprovement: string
}

const NEXT_TIPS: ReadonlyArray<string> = [
  '+15 IF YOU NAME THE USER',
  '+12 IF YOU LIST 2-3 KEY SCREENS',
  '+10 IF YOU DESCRIBE THE VISUAL VIBE',
  '+8 IF YOU MENTION A PRIMARY USER ACTION',
  'TIGHTEN — TRY ONE FOCUSED PARAGRAPH',
]

const SCREEN_KEYWORDS = [
  'home', 'login', 'signup', 'profile', 'settings', 'dashboard',
  'feed', 'list', 'detail', 'cart', 'checkout', 'onboarding',
  'search', 'browse', 'chart', 'tracker', 'calendar', 'inbox',
  'chat', 'messages', 'recipe', 'workout', 'streak', 'wallet',
]

const VIBE_WORDS = [
  'minimal', 'dark', 'light', 'warm', 'cool', 'playful', 'serious',
  'editorial', 'colorful', 'pastel', 'neon', 'aesthetic',
]

const USER_WORDS = [
  'user', 'users', 'parent', 'parents', 'student', 'team', 'admin',
  'customer', 'driver', 'creator', 'fan', 'developer', 'gamer',
]

/** Hard-cap any heuristic at 95 — leave room for "perfect prompt" signal
 *  later without retraining users on what 100 looks like. */
const MAX_SCORE = 95

/**
 * Mock prompt-quality scoring.
 *
 * Deterministic, no network, no LLM. Used during v1 to drive the SignalsHUD
 * while the real scoring backend (separate task) is still under construction.
 *
 * The signal is loose but directionally honest:
 *  - clarity scales with prompt length up to ~150 chars, then plateaus
 *  - specificity adds points per detected screen/vibe/user keyword
 *  - scope is bucketed by length: < 30 chars = broad, > 300 = narrow
 *  - topImprovement targets the lowest-scoring axis with a fixed lookup
 *
 * Returns null when the prompt is empty (the dashboard treats null as IDLE).
 */
function computeScore(prompt: string): PromptScore | null {
  const trimmed = prompt.trim()
  if (trimmed.length === 0) return null

  const lower = trimmed.toLowerCase()
  const len = trimmed.length

  // Clarity grows with length up to ~150 chars; small bonus for naming a user.
  const lengthClarity = Math.min(len / 1.7, 70)
  const userBonus = USER_WORDS.some((w) => lower.includes(w)) ? 15 : 0
  const goalBonus = /\bgoal|so that|in order to\b/.test(lower) ? 10 : 0
  const clarity = Math.min(MAX_SCORE, Math.round(lengthClarity + userBonus + goalBonus))

  // Specificity rewards naming concrete screens or visual style.
  const screensHit = SCREEN_KEYWORDS.filter((w) => lower.includes(w)).length
  const vibeHit = VIBE_WORDS.filter((w) => lower.includes(w)).length
  const baseSpec = Math.min(50, len / 4)
  const specificity = Math.min(
    MAX_SCORE,
    Math.round(baseSpec + screensHit * 12 + vibeHit * 6),
  )

  // Scope bucket based on length.
  const scope: PromptScope =
    len < 30 ? 'broad' : len > 300 ? 'narrow' : 'clear'

  // Pick the single highest-leverage improvement.
  let topImprovement: string
  if (userBonus === 0) topImprovement = NEXT_TIPS[0]
  else if (screensHit < 2) topImprovement = NEXT_TIPS[1]
  else if (vibeHit === 0) topImprovement = NEXT_TIPS[2]
  else if (len > 300) topImprovement = NEXT_TIPS[4]
  else topImprovement = NEXT_TIPS[3]

  return { clarity, specificity, scope, topImprovement }
}

/**
 * usePromptScore — debounced wrapper around the mock scoring function.
 *
 * - Empty/whitespace prompt → returns null (HUD shows IDLE state)
 * - Otherwise debounces by `debounceMs` after the last keystroke before
 *   recomputing. The debounce is what makes the HUD feel "alive" without
 *   thrashing on every key.
 *
 * v1 NOTE: this is a deterministic mock. The real scoring (LLM-backed or
 * server-side heuristic) is a separate task — when it lands, replace the
 * body of this hook with a fetch + abort-on-rekey, keeping the same shape
 * so SignalsHUD doesn't change.
 */
export function usePromptScore(prompt: string, debounceMs = 600): PromptScore | null {
  const [score, setScore] = useState<PromptScore | null>(() => computeScore(prompt))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (prompt.trim().length === 0) {
      setScore(null)
      return
    }
    timer.current = setTimeout(() => {
      setScore(computeScore(prompt))
    }, debounceMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [prompt, debounceMs])

  return score
}
