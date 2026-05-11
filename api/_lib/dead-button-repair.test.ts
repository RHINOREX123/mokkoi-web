import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { repairDeadButtons, checkBackButton, type RepairStats } from './dead-button-repair'
import type { RouteGraph } from './planner'
import type { ComponentNode } from '../../src/types/mokkoi'

const routeGraph: RouteGraph = {
  screens: [
    { id: 'Home', kind: 'screen', purpose: 'home' },
    { id: 'Settings', kind: 'screen', purpose: 'settings' },
    { id: 'Search', kind: 'screen', purpose: 'search' },
    { id: 'ProductDetail', kind: 'screen', purpose: 'product detail', params: ['id'] },
    { id: 'CartSheet', kind: 'modal', purpose: 'cart modal' },
  ],
  tabs: ['Home', 'Search', 'Settings'],
}

function freshStats(): RepairStats {
  return { buttonsScanned: 0, repaired: 0, toasted: 0, preserved: 0, errors: 0 }
}

describe('repairDeadButtons', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => warnSpy.mockRestore())

  it('repairs high-confidence, toasts low-confidence, preserves valid', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        // High confidence: exact match "Settings" → Settings screen
        {
          type: 'TouchableOpacity',
          navIntent: { kind: 'noop', toastMessage: 'Coming soon' },
          children: [{ type: 'Text', children: ['Settings'] }],
        },
        // Low confidence: opaque label, no semantic match
        {
          type: 'TouchableOpacity',
          navIntent: { kind: 'noop', toastMessage: 'Coming soon' },
          children: [{ type: 'Text', children: ['Premium offer'] }],
        },
        // Already valid: target resolves
        {
          type: 'TouchableOpacity',
          navIntent: { kind: 'push', target: 'Home' },
          children: [{ type: 'Text', children: ['Go home'] }],
        },
      ],
    }
    const stats = freshStats()
    repairDeadButtons(tree, routeGraph, 'TestScreen', stats)

    const kids = tree.children as ComponentNode[]
    expect(kids[0].navIntent).toEqual({ kind: 'push', target: 'Settings' })
    expect(kids[1].navIntent).toEqual({ kind: 'noop', toastMessage: 'Coming soon' })
    expect(kids[2].navIntent).toEqual({ kind: 'push', target: 'Home' })

    expect(stats.buttonsScanned).toBe(3)
    expect(stats.repaired).toBe(1)
    expect(stats.toasted).toBe(1)
    expect(stats.preserved).toBe(1)
    expect(stats.errors).toBe(0)
  })

  it('isolates a malformed button via per-button try/catch', () => {
    // Make a button whose children property throws on iteration via a Proxy.
    const explosive: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'noop', toastMessage: 'Coming soon' },
    }
    Object.defineProperty(explosive, 'children', {
      get() { throw new Error('boom') },
      enumerable: true,
      configurable: true,
    })

    const tree: ComponentNode = {
      type: 'View',
      children: [
        explosive,
        {
          type: 'TouchableOpacity',
          navIntent: { kind: 'noop', toastMessage: 'Coming soon' },
          children: [{ type: 'Text', children: ['Search'] }],
        },
      ],
    }
    const stats = freshStats()
    repairDeadButtons(tree, routeGraph, 'Boom', stats)

    // Second button must still be repaired.
    expect((tree.children as ComponentNode[])[1].navIntent).toEqual({
      kind: 'push',
      target: 'Search',
    })
    expect(stats.errors).toBeGreaterThanOrEqual(1)
    expect(stats.repaired).toBe(1)
  })

  it('preserves intentional bare noop (no toastMessage)', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        {
          type: 'TouchableOpacity',
          navIntent: { kind: 'noop' },
          children: [{ type: 'Text', children: ['Settings'] }],
        },
      ],
    }
    const stats = freshStats()
    repairDeadButtons(tree, routeGraph, 'Bare', stats)
    expect((tree.children as ComponentNode[])[0].navIntent).toEqual({ kind: 'noop' })
    expect(stats.preserved).toBe(1)
    expect(stats.repaired).toBe(0)
  })

  it('preserves custom (non-"Coming soon") toast noop', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        {
          type: 'TouchableOpacity',
          navIntent: { kind: 'noop', toastMessage: 'Feature gated' },
          children: [{ type: 'Text', children: ['Settings'] }],
        },
      ],
    }
    const stats = freshStats()
    repairDeadButtons(tree, routeGraph, 'Custom', stats)
    expect((tree.children as ComponentNode[])[0].navIntent).toEqual({
      kind: 'noop',
      toastMessage: 'Feature gated',
    })
    expect(stats.preserved).toBe(1)
  })

  it('resolves "See all" prefix variants via stripping', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        {
          type: 'TouchableOpacity',
          navIntent: { kind: 'noop', toastMessage: 'Coming soon' },
          children: [{ type: 'Text', children: ['See all Settings'] }],
        },
      ],
    }
    repairDeadButtons(tree, routeGraph, 'Strip')
    expect((tree.children as ComponentNode[])[0].navIntent).toEqual({
      kind: 'push',
      target: 'Settings',
    })
  })

  it('uses semantic keyword routing when an id contains the keyword', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        {
          type: 'TouchableOpacity',
          navIntent: { kind: 'noop', toastMessage: 'Coming soon' },
          children: [{ type: 'Text', children: ['Preferences'] }],
        },
      ],
    }
    repairDeadButtons(tree, routeGraph, 'Semantic')
    expect((tree.children as ComponentNode[])[0].navIntent).toEqual({
      kind: 'push',
      target: 'Settings',
    })
  })

  it('downgrades push with unresolved target to noop+toast', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        {
          type: 'TouchableOpacity',
          navIntent: { kind: 'push', target: 'NoSuchScreen' },
          children: [{ type: 'Text', children: ['x'] }],
        },
      ],
    }
    const stats = freshStats()
    repairDeadButtons(tree, routeGraph, 'Bad')
    void stats
    expect((tree.children as ComponentNode[])[0].navIntent).toEqual({
      kind: 'noop',
      toastMessage: 'Coming soon',
    })
  })
})

describe('checkBackButton', () => {
  it('warns when a detail screen lacks a back affordance', () => {
    const tree: ComponentNode = {
      type: 'SafeAreaView',
      children: [
        {
          type: 'View',
          children: [
            { type: 'Text', children: ['Product name'] },
            { type: 'Text', children: ['$9.99'] },
            { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Buy'] }] },
          ],
        },
      ],
    }
    const { warnings } = checkBackButton(tree, { id: 'ProductDetail', presentation: 'screen', params: ['id'] })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/no visible back/)
  })

  it('does not warn when a back-text TouchableOpacity is in the first rows', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        {
          type: 'TouchableOpacity',
          children: [{ type: 'Text', children: ['Back'] }],
        },
        { type: 'Text', children: ['Title'] },
      ],
    }
    const { warnings } = checkBackButton(tree, { id: 'X', presentation: 'screen', params: ['id'] })
    expect(warnings).toHaveLength(0)
  })

  it('detects a back glyph one level deep (icon in a header row)', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        {
          type: 'View',
          children: [
            {
              type: 'TouchableOpacity',
              children: [{ type: 'Icon', props: { name: 'arrow_back' } }],
            },
          ],
        },
      ],
    }
    const { warnings } = checkBackButton(tree, { id: 'X', presentation: 'screen', params: ['id'] })
    expect(warnings).toHaveLength(0)
  })

  it('skips non-detail screens (no params)', () => {
    const tree: ComponentNode = { type: 'View', children: [{ type: 'Text', children: ['Home'] }] }
    const { warnings } = checkBackButton(tree, { id: 'Home', presentation: 'screen' })
    expect(warnings).toHaveLength(0)
  })

  it('skips modals', () => {
    const tree: ComponentNode = { type: 'View', children: [{ type: 'Text', children: ['Cart'] }] }
    const { warnings } = checkBackButton(tree, { id: 'CartSheet', presentation: 'modal', params: ['id'] })
    expect(warnings).toHaveLength(0)
  })
})
