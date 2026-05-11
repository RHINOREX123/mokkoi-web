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

function pushTarget(node: ComponentNode): string | undefined {
  const intent = node.navIntent
  if (!intent) return undefined
  if (intent.kind === 'push' || intent.kind === 'openSheet') return intent.target
  return undefined
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
  it('test 6: exact match stamps navIntent on node, usesNavigation true', () => {
    const btn = makeButton('Add to Cart')
    const screen = makeScreen('s1', 'CartScreen', [btn])
    const targetScreen = makeScreen('s2', 'CheckoutScreen', [])
    const conn: FlowConnection = { fromScreenId: 's1', toScreenId: 's2', trigger: 'Add to Cart' }

    const result = wireScreen(screen, [conn], [screen, targetScreen])

    const btnNode = (screen.tree.children![0] as ComponentNode)
    expect(pushTarget(btnNode)).toBe('CheckoutScreen')
    expect(result.usesNavigation).toBe(true)
    expect(result.tree).toBe(screen.tree) // same reference
  })

  it('test 7: token-overlap match (allTokensPresent boost)', () => {
    const btn = makeButton('Add to Cart')
    const screen = makeScreen('s1', 'CartScreen', [btn])
    const targetScreen = makeScreen('s2', 'CheckoutScreen', [])
    const conn: FlowConnection = { fromScreenId: 's1', toScreenId: 's2', trigger: 'Cart' }

    wireScreen(screen, [conn], [screen, targetScreen])

    const btnNode = (screen.tree.children![0] as ComponentNode)
    expect(pushTarget(btnNode)).toBe('CheckoutScreen')
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

    wireScreen(screen, conns, [screen, cartScreen, profileScreen])

    expect(pushTarget(cartBtn)).toBe('CartScreen')
    expect(pushTarget(profileBtn)).toBe('ProfileScreen')
  })

  it('test 9: directional fallback — trigger has directional verb, Jaccard=0, binds first unbound button', () => {
    const btn = makeButton('Checkout')
    const screen = makeScreen('s1', 'PaymentScreen', [btn])
    const checkoutScreen = makeScreen('s2', 'CheckoutScreen', [])
    const conn: FlowConnection = { fromScreenId: 's1', toScreenId: 's2', trigger: 'Go Now' }

    const result = wireScreen(screen, [conn], [screen, checkoutScreen])

    expect(pushTarget(btn)).toBe('CheckoutScreen')
    expect(result.unmatched).toHaveLength(0)
  })

  it('test 10: target-name fallback — token of target name in button text', () => {
    const btn = makeButton('Dashboard')
    const screen = makeScreen('s1', 'HomeScreen', [btn])
    const dashScreen = makeScreen('s2', 'Dashboard Screen', [])
    const conn: FlowConnection = { fromScreenId: 's1', toScreenId: 's2', trigger: '???' }

    wireScreen(screen, [conn], [screen, dashScreen])

    expect(pushTarget(btn)).toBe('Dashboard Screen')
  })

  it('test 11: unmatched — no overlap, no directional, no target name', () => {
    const btn = makeButton('Settings')
    const screen = makeScreen('s1', 'HomeScreen', [btn])
    const checkoutScreen = makeScreen('s2', 'CheckoutScreen', [])
    const conn: FlowConnection = { fromScreenId: 's1', toScreenId: 's2', trigger: 'Buy Now' }

    const result = wireScreen(screen, [conn], [screen, checkoutScreen])

    expect(btn.navIntent).toBeUndefined()
    expect(result.unmatched).toHaveLength(1)
    expect(result.unmatched[0].trigger).toBe('Buy Now')
    expect(result.unmatched[0].target).toBe('CheckoutScreen')
  })

  it('test 12: only navIntent fields mutated on touchables; other tree shape preserved', () => {
    const btn = makeButton('Go')
    const screen = makeScreen('s1', 'HomeScreen', [btn])
    const targetScreen = makeScreen('s2', 'NextScreen', [])
    const conn: FlowConnection = { fromScreenId: 's1', toScreenId: 's2', trigger: 'Go' }

    wireScreen(screen, [conn], [screen, targetScreen])

    // The mutation stamps navIntent on the button node only.
    expect(pushTarget(btn)).toBe('NextScreen')
    // Surrounding structure untouched.
    expect(screen.tree.type).toBe('View')
    expect(screen.tree.children).toHaveLength(1)
    expect(screen.tree.navIntent).toBeUndefined()
  })

  it('test 13: no outgoing connections — usesNavigation false, no throw, no stamps', () => {
    const btn = makeButton('Click me')
    const screen = makeScreen('s1', 'HomeScreen', [btn])
    const result = wireScreen(screen, [], [screen])

    expect(btn.navIntent).toBeUndefined()
    expect(result.usesNavigation).toBe(false)
    expect(result.unmatched).toHaveLength(0)
  })

  it('test 14: nested button — deeply nested text still found and stamped', () => {
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

    wireScreen(screen, [conn], [screen, targetScreen])

    expect(pushTarget(deepBtn)).toBe('CheckoutScreen')
  })
})
