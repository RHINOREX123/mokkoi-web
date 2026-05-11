import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateNavIntents, hoistInnerNavIntents, type NavIntentRouteGraph } from './normalizer'

describe('validateNavIntents', () => {
  const routeGraph: NavIntentRouteGraph = {
    screens: [
      { id: 'Home', kind: 'screen' },
      { id: 'ProductDetail', kind: 'screen' },
      { id: 'CartSheet', kind: 'modal' },
    ],
  }

  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => warnSpy.mockRestore())

  it('replaces missing navIntent on TouchableOpacity with noop', () => {
    const tree: any = {
      type: 'View',
      children: [
        // No navIntent — should be backfilled to noop
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Tap'] }] },
        // Already noop — left alone
        { type: 'TouchableOpacity', navIntent: { kind: 'noop' } },
        // Valid push — left alone
        { type: 'TouchableOpacity', navIntent: { kind: 'push', target: 'Home' } },
      ],
    }
    const { warnings } = validateNavIntents(tree, routeGraph)
    expect(tree.children[0].navIntent).toEqual({ kind: 'noop', toastMessage: 'Coming soon' })
    expect(tree.children[1].navIntent).toEqual({ kind: 'noop' })
    expect(tree.children[2].navIntent).toEqual({ kind: 'push', target: 'Home' })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/missing on TouchableOpacity/)
  })

  it('replaces push target not in routeGraph with noop and warns', () => {
    const tree: any = {
      type: 'View',
      children: [
        { type: 'TouchableOpacity', navIntent: { kind: 'push', target: 'NoSuchScreen' } },
      ],
    }
    const { warnings } = validateNavIntents(tree, routeGraph)
    expect(tree.children[0].navIntent).toEqual({ kind: 'noop', toastMessage: 'Coming soon' })
    expect(warnings[0]).toMatch(/push target "NoSuchScreen"/)
  })

  it('rejects openSheet pointing at a non-modal screen', () => {
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'openSheet', target: 'Home' }, // Home is a screen, not modal
    }
    const { warnings } = validateNavIntents(tree, routeGraph)
    expect(tree.navIntent).toEqual({ kind: 'noop', toastMessage: 'Coming soon' })
    expect(warnings[0]).toMatch(/openSheet target "Home"/)
  })

  it('accepts openSheet pointing at a real modal id', () => {
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'openSheet', target: 'CartSheet' },
    }
    const { warnings } = validateNavIntents(tree, routeGraph)
    expect(tree.navIntent).toEqual({ kind: 'openSheet', target: 'CartSheet' })
    expect(warnings).toHaveLength(0)
  })

  it('walks into nested children', () => {
    const tree: any = {
      type: 'View',
      children: [
        {
          type: 'ScrollView',
          children: [
            { type: 'TouchableOpacity' /* missing intent */ },
          ],
        },
      ],
    }
    const { warnings } = validateNavIntents(tree, routeGraph)
    expect(tree.children[0].children[0].navIntent).toEqual({ kind: 'noop', toastMessage: 'Coming soon' })
    expect(warnings).toHaveLength(1)
  })

  it('returns no warnings for a fully-valid tree', () => {
    const tree: any = {
      type: 'View',
      children: [
        { type: 'TouchableOpacity', navIntent: { kind: 'push', target: 'ProductDetail', params: { id: '1' } } },
      ],
    }
    const { warnings } = validateNavIntents(tree, routeGraph)
    expect(warnings).toHaveLength(0)
  })

  it('preserves valid toggleState navIntent (filter pills)', () => {
    const tree: any = {
      type: 'View',
      children: [
        { type: 'TouchableOpacity', navIntent: { kind: 'toggleState', group: 'category', stateKey: 'all' } },
        { type: 'TouchableOpacity', navIntent: { kind: 'toggleState', group: 'category', stateKey: 'pizza' } },
      ],
    }
    const { warnings } = validateNavIntents(tree, routeGraph)
    expect(tree.children[0].navIntent).toEqual({ kind: 'toggleState', group: 'category', stateKey: 'all' })
    expect(tree.children[1].navIntent).toEqual({ kind: 'toggleState', group: 'category', stateKey: 'pizza' })
    expect(warnings).toHaveLength(0)
  })

  it('strips toggleState when group is empty/missing', () => {
    const tree: any = {
      type: 'View',
      children: [
        { type: 'TouchableOpacity', navIntent: { kind: 'toggleState', group: '', stateKey: 'pizza' } },
        { type: 'TouchableOpacity', navIntent: { kind: 'toggleState', stateKey: 'pizza' } },
      ],
    }
    const { warnings } = validateNavIntents(tree, routeGraph)
    expect(tree.children[0].navIntent).toEqual({ kind: 'noop', toastMessage: 'Coming soon' })
    expect(tree.children[1].navIntent).toEqual({ kind: 'noop', toastMessage: 'Coming soon' })
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toMatch(/toggleState missing group\/stateKey/)
  })

  it('strips toggleState when stateKey is empty', () => {
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'toggleState', group: 'category', stateKey: '' },
    }
    const { warnings } = validateNavIntents(tree, routeGraph)
    expect(tree.navIntent).toEqual({ kind: 'noop', toastMessage: 'Coming soon' })
    expect(warnings[0]).toMatch(/toggleState missing group\/stateKey/)
  })

  it('preserves back navIntent (no target needed)', () => {
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'back' },
    }
    const { warnings } = validateNavIntents(tree, routeGraph)
    expect(tree.navIntent).toEqual({ kind: 'back' })
    expect(warnings).toHaveLength(0)
  })
})

// ─── Package A.2: hoistInnerNavIntents ────────────────────────────────────────

describe('hoistInnerNavIntents', () => {
  it('hoists a push intent from an inner Text up to the outer TouchableOpacity', () => {
    const tree: any = {
      type: 'TouchableOpacity',
      children: [
        { type: 'Icon', name: 'home' },
        {
          type: 'View',
          children: [
            {
              type: 'Text',
              navIntent: { kind: 'push', target: 'addresses' },
              children: ['Addresses'],
            },
            { type: 'Text', children: ['Manage delivery locations'] },
          ],
        },
        { type: 'Icon', name: 'chevron' },
      ],
    }
    const count = hoistInnerNavIntents(tree)
    expect(count).toBe(1)
    expect(tree.navIntent).toEqual({ kind: 'push', target: 'addresses' })
    expect(tree.children[1].children[0].navIntent).toBeUndefined()
  })

  it('does not hoist when the outer TouchableOpacity already has a real intent', () => {
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'push', target: 'profile' },
      children: [
        { type: 'Text', navIntent: { kind: 'push', target: 'addresses' }, children: ['Inner'] },
      ],
    }
    const count = hoistInnerNavIntents(tree)
    expect(count).toBe(0)
    expect(tree.navIntent).toEqual({ kind: 'push', target: 'profile' })
    expect(tree.children[0].navIntent).toEqual({ kind: 'push', target: 'addresses' })
  })

  it('hoists when the outer TouchableOpacity has noop navIntent', () => {
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'noop', toastMessage: 'Coming soon' },
      children: [
        { type: 'Text', navIntent: { kind: 'push', target: 'addresses' }, children: ['Inner'] },
      ],
    }
    const count = hoistInnerNavIntents(tree)
    expect(count).toBe(1)
    expect(tree.navIntent).toEqual({ kind: 'push', target: 'addresses' })
  })

  it('does not hoist when there are multiple inner intents (ambiguous)', () => {
    const tree: any = {
      type: 'TouchableOpacity',
      children: [
        { type: 'Text', navIntent: { kind: 'push', target: 'a' }, children: ['A'] },
        { type: 'Text', navIntent: { kind: 'push', target: 'b' }, children: ['B'] },
      ],
    }
    const count = hoistInnerNavIntents(tree)
    expect(count).toBe(0)
    expect(tree.navIntent).toBeUndefined()
    expect(tree.children[0].navIntent).toEqual({ kind: 'push', target: 'a' })
    expect(tree.children[1].navIntent).toEqual({ kind: 'push', target: 'b' })
  })

  it('does not hoist across nested TouchableOpacity boundaries', () => {
    // The inner TouchableOpacity should keep its own intent — the outer
    // wrapper has its own click target (the inner TO itself).
    const tree: any = {
      type: 'TouchableOpacity',
      children: [
        {
          type: 'TouchableOpacity',
          navIntent: { kind: 'push', target: 'addresses' },
          children: [{ type: 'Text', children: ['Inner button'] }],
        },
      ],
    }
    const count = hoistInnerNavIntents(tree)
    expect(count).toBe(0)
    expect(tree.navIntent).toBeUndefined()
    expect(tree.children[0].navIntent).toEqual({ kind: 'push', target: 'addresses' })
  })

  it('hoists toggleState intents too (filter pills with stranded intent)', () => {
    const tree: any = {
      type: 'TouchableOpacity',
      children: [
        { type: 'Text', navIntent: { kind: 'toggleState', group: 'category', stateKey: 'pizza' }, children: ['Pizza'] },
      ],
    }
    const count = hoistInnerNavIntents(tree)
    expect(count).toBe(1)
    expect(tree.navIntent).toEqual({ kind: 'toggleState', group: 'category', stateKey: 'pizza' })
  })

  it('runs as part of validateNavIntents and the warning surfaces', () => {
    const tree: any = {
      type: 'View',
      children: [
        {
          type: 'TouchableOpacity',
          children: [
            { type: 'Text', navIntent: { kind: 'push', target: 'Home' }, children: ['Tap'] },
          ],
        },
      ],
    }
    const rg: NavIntentRouteGraph = { screens: [{ id: 'Home', kind: 'screen' }] }
    const { warnings } = validateNavIntents(tree, rg)
    // After hoist + validation, the outer TO carries a valid push and
    // the inner Text is intent-free. The hoist warning fires.
    expect(tree.children[0].navIntent).toEqual({ kind: 'push', target: 'Home' })
    expect(tree.children[0].children[0].navIntent).toBeUndefined()
    expect(warnings.some(w => w.includes('hoisted 1 inner navIntent'))).toBe(true)
  })

  it('handles a real-world Profile menu-row tree end-to-end', () => {
    // Shape from the production smoke test (Maya Patel Profile screen).
    const tree: any = {
      type: 'View',
      children: [
        {
          type: 'TouchableOpacity',
          children: [
            { type: 'Icon', name: 'location' },
            {
              type: 'View',
              children: [
                { type: 'Text', navIntent: { kind: 'push', target: 'addresses' }, children: ['Addresses'] },
                { type: 'Text', children: ['Manage delivery locations'] },
              ],
            },
            { type: 'Icon', name: 'chevron-right' },
          ],
        },
        {
          type: 'TouchableOpacity',
          children: [
            { type: 'Icon', name: 'card' },
            {
              type: 'View',
              children: [
                { type: 'Text', navIntent: { kind: 'push', target: 'payment-methods' }, children: ['Payment Methods'] },
                { type: 'Text', children: ['Cards and digital wallets'] },
              ],
            },
            { type: 'Icon', name: 'chevron-right' },
          ],
        },
      ],
    }
    const rg: NavIntentRouteGraph = {
      screens: [
        { id: 'addresses', kind: 'screen' },
        { id: 'payment-methods', kind: 'screen' },
      ],
    }
    const { warnings } = validateNavIntents(tree, rg)
    expect(tree.children[0].navIntent).toEqual({ kind: 'push', target: 'addresses' })
    expect(tree.children[1].navIntent).toEqual({ kind: 'push', target: 'payment-methods' })
    expect(warnings.some(w => w.includes('hoisted 2 inner navIntents'))).toBe(true)
  })
})
