import { describe, it, expect } from 'vitest'
import { isLikelyHallucination } from './transcribe'

describe('isLikelyHallucination', () => {
  it.each([
    ['thanks'],
    ['bye'],
    ['um, build a fitness app'],
    ['uh sure'],
    ['build a recipe app'],
  ])('lets legitimate short reply pass: %s', (input) => {
    expect(isLikelyHallucination(input)).toBe(false)
  })

  it.each([
    ['ChatGPT'],
    ['ChatGPT, ChatGPT'],
    ['Thanks for watching'],
    ['Subscribe to my channel'],
    ['♪♫'],
    ['©2024'],
    ['uh'],
    ['mm'],
    ['A user describing a mobile app to build'],
    ['mobile app to build:'],
  ])('rejects hallucination: %s', (input) => {
    expect(isLikelyHallucination(input)).toBe(true)
  })
})
