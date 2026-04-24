import { describe, it, expect } from 'vitest'
import { tokenize, jaccard, wireScreen } from './wirer'
import type { ComponentNode } from '../types/mokkoi'
import type { FlowConnection } from '../components/FlowConnectors'
import type { ScreenInfo } from './wirer'

// ── helpers ─────────────────────────────────────────────────────────────────

function makeButton(text: string): ComponentNode {
  return {
    type: 'TouchableOpacity',
    children: [{ type: 'Text', children: [text] }],
  }
}

function makeScreen(
  id: string,
  name: string,
  buttons: ComponentNode[],
): ScreenInfo {
  return {
    id,
    name,
    tree: { type: 'View', children: buttons },
  }
}

// ── tokenize ─────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('test 1: drops stopwords and lowercases', () => {
    expect(tokenize('Add to Cart')).toEqual(['add', 'cart'])
  })

  it('test 2: trims, handles punctuation', () => {
    expect(tokenize('  GO! Now... ')).toEqual(['go', 'now'])
  })

  it('test 3: empty string returns []', () => {
    expect(tokenize('')).toEqual([])
  })
})

// ── jaccard ──────────────────────────────────────────────────────────────────

describe('jaccard', () => {
  it('test 4: partial overlap', () => {
    const score = jaccard(['a', 'b'], ['b', 'c'])
    expect(score).toBeCloseTo(1 / 3)
  })

  it('test 5: both empty returns 0', () => {
    expect(jaccard([], [])).toBe(0)
  })
})

// ── wireScreen ───────────────────────────────────────────────────────────────

describe('wireScreen', () => {
  it('test 6: exact match binds node → target, usesNavigation true', () => {
    const btn = makeButton('Add to Cart')
    const screen = makeScreen('s1', 'CartScreen', [btn])
    const targetScreen = makeScreen('s2', 'CheckoutScreen', [])
    const conn: FlowConnection = { fromScreenId: 's1', toScreenId: 's2', trigger: 'Add to Cart' }

    const result = wireScreen(screen, [conn], [screen, targetScreen])

    const btnNode = (screen.tree.children![0] as ComponentNode)
    expect(result.bindings.get(btnNode)).toBe('CheckoutScreen')
    expect(result.usesNavigation).toBe(true)
    expect(result.tree).toBe(screen.tree) // same reference
  })

  it('test 7: token-overlap match (allTokensPresent boost)', () => {
    const btn = makeButton('Add to Cart')
    const screen = makeScreen('s1', 'CartScreen', [btn])
    const targetScreen = makeScreen('s2', 'CheckoutScreen', [])
    const conn: FlowConnection = { fromScreenId: 's1', toScreenId: 's2', trigger: 'Cart' }

    const result = wireScreen(screen, [conn], [screen, targetScreen])

    const btnNode = (screen.tree.children![0] as ComponentNode)
    expect(result.bindings.get(btnNode)).toBe('CheckoutScreen')
  })

  it('test 8: disambiguation — two buttons, two triggers each bound correctly', () => {
    const cartBtn = makeButton('Cart')
    const profileBtn = makeButton('Profile')
    const screen = makeScreen('s1', 'HomeScreen', [cartBtn, profileBtn])
    const cartScreen = makeScreen('s2', 'CartScreen', [])
    const profileScreen = makeScreen('s3', 'ProfileScreen', [])

    const conns: FlowConnection[] = [
      { fromScreenId: 's1', toScreenId: 's2', trigger: 'Cart' },
      { fromScreenId: 's1', toScreenId: 's3', trigger: 'Profile' },
    ]

    const result = wireScreen(screen, conns, [screen, cartScreen, profileScreen])

    expect(result.bindings.size).toBe(2)
    expect(result.bindings.get(cartBtn)).toBe('CartScreen')
    expect(result.bindings.get(profileBtn)).toBe('ProfileScreen')
  })

  it('test 9: directional fallback — trigger has directional verb, Jaccard=0, binds first unbound button', () => {
    // "Go Now" → tokens ["go","now"]; button text "Checkout" → tokens ["checkout"]
    // Jaccard = 0 (no overlap), but "go" is a DIRECTIONAL_VERB → shouldFallback=true
    // Empty trigger must NOT trigger fallback (never blind-bind)
    const btn = makeButton('Checkout')
    const screen = makeScreen('s1', 'PaymentScreen', [btn])
    const checkoutScreen = makeScreen('s2', 'CheckoutScreen', [])
    const conn: FlowConnection = { fromScreenId: 's1', toScreenId: 's2', trigger: 'Go Now' }

    const result = wireScreen(screen, [conn], [screen, checkoutScreen])

    expect(result.bindings.get(btn)).toBe('CheckoutScreen')
    expect(result.unmatched).toHaveLength(0)
  })

  it('test 10: target-name fallback — token of target name in button text', () => {
    // trigger "???" → tokens [] (no Jaccard match, no directional verb)
    // target name "Dashboard Screen" → tokens ["dashboard","screen"]
    // button "Dashboard" → tokens ["dashboard"] → overlap → shouldFallback via target-name
    const btn = makeButton('Dashboard')
    const screen = makeScreen('s1', 'HomeScreen', [btn])
    const dashScreen = makeScreen('s2', 'Dashboard Screen', [])
    const conn: FlowConnection = { fromScreenId: 's1', toScreenId: 's2', trigger: '???' }

    const result = wireScreen(screen, [conn], [screen, dashScreen])

    expect(result.bindings.get(btn)).toBe('Dashboard Screen')
  })

  it('test 11: unmatched — no overlap, no directional, no target name', () => {
    const btn = makeButton('Settings')
    const screen = makeScreen('s1', 'HomeScreen', [btn])
    const checkoutScreen = makeScreen('s2', 'CheckoutScreen', [])
    const conn: FlowConnection = { fromScreenId: 's1', toScreenId: 's2', trigger: 'Buy Now' }

    const result = wireScreen(screen, [conn], [screen, checkoutScreen])

    expect(result.bindings.size).toBe(0)
    expect(result.unmatched).toHaveLength(1)
    expect(result.unmatched[0].trigger).toBe('Buy Now')
    expect(result.unmatched[0].target).toBe('CheckoutScreen')
  })

  it('test 12: tree not mutated', () => {
    const btn = makeButton('Go')
    const screen = makeScreen('s1', 'HomeScreen', [btn])
    const targetScreen = makeScreen('s2', 'NextScreen', [])
    const conn: FlowConnection = { fromScreenId: 's1', toScreenId: 's2', trigger: 'Go' }

    const clone = JSON.parse(JSON.stringify(screen.tree))
    wireScreen(screen, [conn], [screen, targetScreen])

    expect(JSON.stringify(screen.tree)).toBe(JSON.stringify(clone))
  })

  it('test 13: no outgoing connections — empty bindings, usesNavigation false, no throw', () => {
    const btn = makeButton('Click me')
    const screen = makeScreen('s1', 'HomeScreen', [btn])
    // no connections at all
    const result = wireScreen(screen, [], [screen])

    expect(result.bindings.size).toBe(0)
    expect(result.usesNavigation).toBe(false)
    expect(result.unmatched).toHaveLength(0)
  })

  it('test 14: nested button — deeply nested text still found', () => {
    const deepBtn: ComponentNode = {
      type: 'TouchableOpacity',
      children: [
        {
          type: 'View',
          children: [
            {
              type: 'View',
              children: [{ type: 'Text', children: ['Checkout'] }],
            },
          ],
        },
      ],
    }
    const screen: ScreenInfo = {
      id: 's1',
      name: 'CartScreen',
      tree: { type: 'View', children: [deepBtn] },
    }
    const targetScreen = makeScreen('s2', 'CheckoutScreen', [])
    const conn: FlowConnection = { fromScreenId: 's1', toScreenId: 's2', trigger: 'Checkout' }

    const result = wireScreen(screen, [conn], [screen, targetScreen])

    expect(result.bindings.get(deepBtn)).toBe('CheckoutScreen')
  })
})
