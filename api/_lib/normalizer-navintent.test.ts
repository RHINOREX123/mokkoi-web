import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateNavIntents, type NavIntentRouteGraph } from './normalizer'

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
