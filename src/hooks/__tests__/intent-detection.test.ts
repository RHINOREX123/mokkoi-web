/**
 * Intent-detection regression tests (Bug 3 fix).
 *
 * The old substring-matching approach (APP_KEYWORDS = ['build an app', ...])
 * missed the common phrasing "Build a X app" because 'build a ... app' is not
 * a contiguous substring of the keyword list. The production prompt
 * "Build a food delivery app" silently routed to single-screen generation.
 *
 * This suite locks in the regex-based classifier across 20 representative
 * prompts (6 APP, 4 FLOW, 5 SINGLE, 5 APP-with-extra-category-nouns).
 *
 * Priority at the dispatch site: APP > FLOW > SINGLE. A prompt that matches
 * both APP and FLOW regexes is routed as APP (isAppPrompt is checked first
 * in handleSend).
 */

import { describe, it, expect } from 'vitest'
import { isAppPrompt, isFlowPrompt } from '../useAIGeneration'

type Intent = 'APP' | 'FLOW' | 'SINGLE'

function classify(prompt: string): Intent {
  if (isAppPrompt(prompt)) return 'APP'
  if (isFlowPrompt(prompt)) return 'FLOW'
  return 'SINGLE'
}

describe('intent detection — APP prompts (core 6)', () => {
  const cases: string[] = [
    'Build a food delivery app',
    'Build a fitness tracker',
    'Create a banking app for India',
    'Make me an e-commerce app',
    'Design a chat app',
    'Generate a social media app',
  ]
  for (const prompt of cases) {
    it(`"${prompt}" → APP`, () => {
      expect(classify(prompt)).toBe('APP')
    })
  }
})

describe('intent detection — APP prompts (extended archetypes)', () => {
  const cases: string[] = [
    'Build a podcast client',
    'Build a music player for my library',
    'Create a crypto wallet app',
    'Make a recipe book for Indian food',
    'Design a habit hub',
  ]
  for (const prompt of cases) {
    it(`"${prompt}" → APP`, () => {
      expect(classify(prompt)).toBe('APP')
    })
  }
})

describe('intent detection — FLOW prompts', () => {
  const cases: string[] = [
    'Build a checkout flow',
    'Create a signup flow',
    'Design an onboarding flow',
    'Build a password reset flow',
  ]
  for (const prompt of cases) {
    it(`"${prompt}" → FLOW`, () => {
      expect(classify(prompt)).toBe('FLOW')
    })
  }
})

describe('intent detection — SINGLE-screen prompts', () => {
  const cases: string[] = [
    'Build a login screen',
    'Create a product detail page',
    'Design a profile settings screen',
    'Make a pricing card',
    'Generate an empty state',
  ]
  for (const prompt of cases) {
    it(`"${prompt}" → SINGLE`, () => {
      expect(classify(prompt)).toBe('SINGLE')
    })
  }
})

describe('intent detection — priority semantics', () => {
  it('screen-noun short-circuit wins even when "app" appears (v1 acceptable edge)', () => {
    // Flagged for post-YC refinement: "todo app with a login screen" routes
    // to single-screen because SINGLE_SCREEN_NOUN_PATTERN matches first.
    expect(classify('Build a todo app with a login screen')).toBe('SINGLE')
  })

  it('isAppPrompt and isFlowPrompt are independent predicates', () => {
    // Dispatch site enforces APP > FLOW > SINGLE priority, but the predicates
    // themselves don't know about each other.
    expect(isAppPrompt('Build a food delivery app')).toBe(true)
    expect(isFlowPrompt('Build a food delivery app')).toBe(false)
    expect(isAppPrompt('Build a checkout flow')).toBe(false)
    expect(isFlowPrompt('Build a checkout flow')).toBe(true)
  })
})
