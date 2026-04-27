import { describe, it, expect } from 'vitest'
import { getEntryPointScreens, isTabTrigger } from '../entryPointScreens'
import type { FlowConnection } from '../../components/FlowConnectors'

interface TestScreen { id: string; name: string }

describe('isTabTrigger', () => {
  it('returns true for known tab vocabulary', () => {
    expect(isTabTrigger('Home')).toBe(true)
    expect(isTabTrigger('menu')).toBe(true)
    expect(isTabTrigger('Profile')).toBe(true)
    expect(isTabTrigger('  CART  ')).toBe(true)
    expect(isTabTrigger('Discover')).toBe(true)
  })

  it('returns true for any trigger containing "tab"', () => {
    expect(isTabTrigger('home tab')).toBe(true)
    expect(isTabTrigger('TabBar')).toBe(true)
  })

  it('returns false for deep-link triggers', () => {
    expect(isTabTrigger('Checkout')).toBe(false)
    expect(isTabTrigger('Place Order')).toBe(false)
    expect(isTabTrigger('Add to Cart')).toBe(false)
    expect(isTabTrigger('Buy Now')).toBe(false)
  })

  it('returns false for empty / undefined trigger', () => {
    expect(isTabTrigger(undefined)).toBe(false)
    expect(isTabTrigger('')).toBe(false)
  })
})

describe('getEntryPointScreens', () => {
  const screens: TestScreen[] = [
    { id: 'home', name: 'Home' },
    { id: 'menu', name: 'Menu' },
    { id: 'cart', name: 'Cart' },
    { id: 'checkout', name: 'Checkout' },
    { id: 'tracking', name: 'Order Tracking' },
    { id: 'profile', name: 'Profile' },
  ]

  it('returns only tab targets and the first screen (excludes deep-link-only screens)', () => {
    const connections: FlowConnection[] = [
      { fromScreenId: 'home', toScreenId: 'menu', trigger: 'Menu' },
      { fromScreenId: 'home', toScreenId: 'profile', trigger: 'Profile' },
      { fromScreenId: 'menu', toScreenId: 'cart', trigger: 'Add to Cart' },
      { fromScreenId: 'cart', toScreenId: 'checkout', trigger: 'Checkout' },
      { fromScreenId: 'checkout', toScreenId: 'tracking', trigger: 'Place Order' },
    ]
    const result = getEntryPointScreens(screens, connections)
    expect(result.map(s => s.id)).toEqual(['home', 'menu', 'profile'])
  })

  it('always includes the first screen (defensive)', () => {
    // home has only deep-link incoming — but it's screen[0], so include it
    const connections: FlowConnection[] = [
      { fromScreenId: 'menu', toScreenId: 'home', trigger: 'Back' },
    ]
    const result = getEntryPointScreens(screens, connections)
    expect(result.map(s => s.id)).toContain('home')
  })

  it('treats screens with mixed incoming as entry points (tab wins)', () => {
    const connections: FlowConnection[] = [
      { fromScreenId: 'menu', toScreenId: 'cart', trigger: 'Add to Cart' }, // deep-link
      { fromScreenId: 'home', toScreenId: 'cart', trigger: 'Cart' }, // tab — wins
    ]
    const result = getEntryPointScreens(screens, connections)
    expect(result.map(s => s.id)).toContain('cart')
  })

  it('returns all screens when there are no connections', () => {
    const result = getEntryPointScreens(screens, [])
    expect(result.map(s => s.id)).toEqual(['home', 'menu', 'cart', 'checkout', 'tracking', 'profile'])
  })

  it('preserves input order (stable)', () => {
    const connections: FlowConnection[] = [
      { fromScreenId: 'home', toScreenId: 'profile', trigger: 'Profile' },
      { fromScreenId: 'home', toScreenId: 'menu', trigger: 'Menu' },
    ]
    const result = getEntryPointScreens(screens, connections)
    // home is screen[0], menu and profile are tab targets — order matches input
    expect(result.map(s => s.id)).toEqual(['home', 'menu', 'profile'])
  })

  it('returns single screen unchanged for single-screen project', () => {
    const single = [{ id: 'only', name: 'Only Screen' }]
    expect(getEntryPointScreens(single, [])).toEqual(single)
  })
})
