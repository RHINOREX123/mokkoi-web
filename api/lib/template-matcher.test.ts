import { describe, it, expect } from 'vitest'
import { matchTemplate } from './template-matcher'

describe('matchTemplate', () => {
  it('matches fitness template from explicit pill text', () => {
    const result = matchTemplate('A fitness tracking app')
    expect(result?.templateId).toBe('fitness')
    expect(result?.score).toBeGreaterThan(0.7)
  })

  it('matches food-delivery from "food delivery app"', () => {
    expect(matchTemplate('A food delivery app')?.templateId).toBe('food-delivery')
  })

  it('matches social-media from "social media app"', () => {
    expect(matchTemplate('A social media app')?.templateId).toBe('social-media')
  })

  it('matches ecommerce from "e-commerce shopping app"', () => {
    expect(matchTemplate('An e-commerce shopping app')?.templateId).toBe('ecommerce')
  })

  it('matches banking from "banking & finance app"', () => {
    expect(matchTemplate('A banking & finance app')?.templateId).toBe('banking')
  })

  it('matches music from "music streaming app"', () => {
    expect(matchTemplate('A music streaming app')?.templateId).toBe('music')
  })

  it('matches fitness from paraphrased input', () => {
    expect(matchTemplate('build me a workout tracker with exercises and progress charts')?.templateId).toBe('fitness')
  })

  it('matches food-delivery from paraphrased input', () => {
    expect(matchTemplate('I want a restaurant ordering and delivery app with cart and tracking')?.templateId).toBe('food-delivery')
  })

  it('returns null for generic prompts with no template match', () => {
    expect(matchTemplate('build me a to-do list')).toBeNull()
  })

  it('returns null for a puzzle game prompt', () => {
    expect(matchTemplate('a sudoku puzzle game with timer')).toBeNull()
  })

  it('returns null for empty prompt', () => {
    expect(matchTemplate('')).toBeNull()
  })

  it('returns null for a pet adoption app (no template)', () => {
    expect(matchTemplate('pet adoption marketplace')).toBeNull()
  })
})
