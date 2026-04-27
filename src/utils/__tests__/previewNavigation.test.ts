import { describe, it, expect } from 'vitest'
import { findNavigationTarget, normalizeTrigger } from '../previewNavigation'
import type { FlowConnection } from '../../components/FlowConnectors'

describe('normalizeTrigger', () => {
  it('lowercases and trims', () => {
    expect(normalizeTrigger('Checkout')).toBe('checkout')
    expect(normalizeTrigger('  PLACE ORDER  ')).toBe('place order')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeTrigger('Add  to   Cart')).toBe('add to cart')
  })

  it('handles undefined / empty', () => {
    expect(normalizeTrigger(undefined)).toBe('')
    expect(normalizeTrigger('')).toBe('')
  })
})

describe('findNavigationTarget', () => {
  const connections: FlowConnection[] = [
    { fromScreenId: 'home', toScreenId: 'menu', trigger: 'Menu' },
    { fromScreenId: 'menu', toScreenId: 'cart', trigger: 'Add to Cart' },
    { fromScreenId: 'cart', toScreenId: 'checkout', trigger: 'Checkout' },
    { fromScreenId: 'home', toScreenId: 'profile', trigger: 'Profile' },
  ]

  it('finds the matching target screen for the current screen', () => {
    expect(findNavigationTarget(connections, 'home', 'Menu')).toBe('menu')
    expect(findNavigationTarget(connections, 'cart', 'Checkout')).toBe('checkout')
  })

  it('returns null when no connection matches the label', () => {
    expect(findNavigationTarget(connections, 'home', 'Settings')).toBeNull()
  })

  it('returns null when no connection exists from the current screen', () => {
    expect(findNavigationTarget(connections, 'tracking', 'Anything')).toBeNull()
  })

  it('matches case-insensitively and ignores whitespace', () => {
    expect(findNavigationTarget(connections, 'menu', 'add  TO  cart')).toBe('cart')
    expect(findNavigationTarget(connections, 'home', '  MENU  ')).toBe('menu')
  })

  it('returns the first match when multiple connections share a normalized label', () => {
    const ambiguous: FlowConnection[] = [
      { fromScreenId: 'a', toScreenId: 'b', trigger: 'Go' },
      { fromScreenId: 'a', toScreenId: 'c', trigger: 'GO' },
    ]
    expect(findNavigationTarget(ambiguous, 'a', 'go')).toBe('b')
  })

  it('returns null for empty / undefined label', () => {
    expect(findNavigationTarget(connections, 'home', '')).toBeNull()
    expect(findNavigationTarget(connections, 'home', undefined)).toBeNull()
  })
})
