import { describe, it, expect } from 'vitest'
import { findNavigationTarget, normalizeTrigger, resolveNavTarget } from '../previewNavigation'
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

  it('skips connections that have no trigger defined', () => {
    // FlowConnection.trigger is optional; the wirer occasionally produces
    // connections without one. They must not match any non-empty label.
    const noTrigger: FlowConnection[] = [
      { fromScreenId: 'a', toScreenId: 'b' },
    ]
    expect(findNavigationTarget(noTrigger, 'a', 'anything')).toBeNull()
  })
})

describe('resolveNavTarget', () => {
  const screens = [
    { id: 'home', name: 'Home' },
    { id: 'profile', name: 'ProfileScreen' },
    { id: 'settings', name: 'Settings' },
    { id: 'cart', name: 'Cart' },
  ]

  it('prefers strict FlowConnection match', () => {
    const connections: FlowConnection[] = [
      { fromScreenId: 'home', toScreenId: 'cart', trigger: 'Cart' },
    ]
    expect(
      resolveNavTarget('Cart', { connections, currentScreenId: 'home', screens }),
    ).toBe('cart')
  })

  it('falls back to fuzzy screen-name match when no connection matches', () => {
    // Wirer emitted no connection for "Profile" tab; fuzzy match resolves
    // "Profile" → "ProfileScreen".
    expect(
      resolveNavTarget('Profile', { connections: [], currentScreenId: 'home', screens }),
    ).toBe('profile')
  })

  it('falls back to single outgoing connection when label has no other match', () => {
    const connections: FlowConnection[] = [
      { fromScreenId: 'home', toScreenId: 'settings', trigger: 'open_settings' },
    ]
    expect(
      resolveNavTarget('Mystery', { connections, currentScreenId: 'home', screens }),
    ).toBe('settings')
  })

  it('singleTarget skips back triggers', () => {
    const connections: FlowConnection[] = [
      { fromScreenId: 'profile', toScreenId: 'home', trigger: 'nav_back' },
    ]
    expect(
      resolveNavTarget('Mystery', { connections, currentScreenId: 'profile', screens }),
    ).toBeNull()
  })

  it('returns null when nothing matches and multiple outgoing exist', () => {
    const connections: FlowConnection[] = [
      { fromScreenId: 'home', toScreenId: 'settings', trigger: 'foo' },
      { fromScreenId: 'home', toScreenId: 'cart', trigger: 'bar' },
    ]
    expect(
      resolveNavTarget('Unknown', { connections, currentScreenId: 'home', screens }),
    ).toBeNull()
  })

  it('does not return current screen as a fuzzy target (would be a noop nav)', () => {
    expect(
      resolveNavTarget('Home', { connections: [], currentScreenId: 'home', screens }),
    ).toBeNull()
  })

  it('returns null for empty label with no singleTarget', () => {
    expect(
      resolveNavTarget('', { connections: [], currentScreenId: 'home', screens }),
    ).toBeNull()
    expect(
      resolveNavTarget(undefined, { connections: [], currentScreenId: 'home', screens }),
    ).toBeNull()
  })
})
