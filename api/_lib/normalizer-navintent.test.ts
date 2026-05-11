import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateNavIntents, hoistInnerNavIntents, inferCardParamsFromText, stampFilterChipToggleState, type NavIntentRouteGraph, type InferParamsRouteGraph } from './normalizer'

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
    // (defined below)
  })
})

// ─── Package A.2 part 2: inferCardParamsFromText ──────────────────────────────

describe('inferCardParamsFromText', () => {
  const restaurantsRG: InferParamsRouteGraph = {
    screens: [
      { id: 'restaurantDetail', kind: 'screen', dataSource: 'restaurants', params: ['id'] },
    ],
  }
  const restaurantsData = {
    restaurants: [
      { id: 'r1', name: 'Spice Palace', cuisine: 'Indian' },
      { id: 'r2', name: 'Burger Haven', cuisine: 'American' },
      { id: 'r3', name: 'Sushi Dreams', cuisine: 'Japanese' },
    ],
  }

  it('infers params.id from a card whose name appears in its text', () => {
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'push', target: 'restaurantDetail' },
      children: [
        { type: 'Image' },
        { type: 'Text', children: ['Spice Palace'] },
        { type: 'Text', children: ['Indian · $20 min order'] },
      ],
    }
    const count = inferCardParamsFromText(tree, restaurantsData, restaurantsRG)
    expect(count).toBe(1)
    expect(tree.navIntent.params).toEqual({ id: 'r1' })
  })

  it('does not override existing params.id', () => {
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'push', target: 'restaurantDetail', params: { id: 'r2' } },
      children: [{ type: 'Text', children: ['Spice Palace'] }],
    }
    const count = inferCardParamsFromText(tree, restaurantsData, restaurantsRG)
    expect(count).toBe(0)
    expect(tree.navIntent.params).toEqual({ id: 'r2' })
  })

  it('leaves card unchanged when text matches no record', () => {
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'push', target: 'restaurantDetail' },
      children: [{ type: 'Text', children: ['Random Cafe That Does Not Exist'] }],
    }
    const count = inferCardParamsFromText(tree, restaurantsData, restaurantsRG)
    expect(count).toBe(0)
    expect(tree.navIntent.params).toBeUndefined()
  })

  it('picks the longest matching name when multiple records substring-match', () => {
    const ambiguousData = {
      restaurants: [
        { id: 'a', name: 'Spice' },
        { id: 'b', name: 'Spice Palace' }, // longer — should win
      ],
    }
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'push', target: 'restaurantDetail' },
      children: [{ type: 'Text', children: ['Spice Palace · Indian'] }],
    }
    const count = inferCardParamsFromText(tree, ambiguousData, restaurantsRG)
    expect(count).toBe(1)
    expect(tree.navIntent.params).toEqual({ id: 'b' })
  })

  it('does not infer for cards pointing at a screen without a dataSource', () => {
    const noDataSourceRG: InferParamsRouteGraph = {
      screens: [{ id: 'about', kind: 'screen' }], // no dataSource, no params
    }
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'push', target: 'about' },
      children: [{ type: 'Text', children: ['Spice Palace'] }],
    }
    const count = inferCardParamsFromText(tree, restaurantsData, noDataSourceRG)
    expect(count).toBe(0)
    expect(tree.navIntent.params).toBeUndefined()
  })

  it('leaves sentinel-only detail templates untouched (no false-positive)', () => {
    // Detail screen template that contains `{{name}}` but never literal names.
    // Should not match any record by substring.
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'push', target: 'restaurantDetail' },
      children: [{ type: 'Text', children: ['{{name}}'] }],
    }
    const count = inferCardParamsFromText(tree, restaurantsData, restaurantsRG)
    expect(count).toBe(0)
    expect(tree.navIntent.params).toBeUndefined()
  })

  it('walks nested children to find cards inside list/scroll containers', () => {
    const tree: any = {
      type: 'ScrollView',
      children: [
        {
          type: 'View',
          children: [
            {
              type: 'TouchableOpacity',
              navIntent: { kind: 'push', target: 'restaurantDetail' },
              children: [{ type: 'Text', children: ['Burger Haven'] }],
            },
            {
              type: 'TouchableOpacity',
              navIntent: { kind: 'push', target: 'restaurantDetail' },
              children: [{ type: 'Text', children: ['Sushi Dreams'] }],
            },
          ],
        },
      ],
    }
    const count = inferCardParamsFromText(tree, restaurantsData, restaurantsRG)
    expect(count).toBe(2)
    expect(tree.children[0].children[0].navIntent.params).toEqual({ id: 'r2' })
    expect(tree.children[0].children[1].navIntent.params).toEqual({ id: 'r3' })
  })

  it('no-ops when appData is missing or empty', () => {
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'push', target: 'restaurantDetail' },
      children: [{ type: 'Text', children: ['Spice Palace'] }],
    }
    expect(inferCardParamsFromText(tree, null, restaurantsRG)).toBe(0)
    expect(inferCardParamsFromText(tree, undefined, restaurantsRG)).toBe(0)
    expect(inferCardParamsFromText(tree, {}, restaurantsRG)).toBe(0)
  })

  it('ignores modal targets even with dataSource (modals use different param flow)', () => {
    const modalRG: InferParamsRouteGraph = {
      screens: [{ id: 'restaurantSheet', kind: 'modal', dataSource: 'restaurants', params: ['id'] }],
    }
    const tree: any = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'push', target: 'restaurantSheet' },
      children: [{ type: 'Text', children: ['Spice Palace'] }],
    }
    const count = inferCardParamsFromText(tree, restaurantsData, modalRG)
    expect(count).toBe(0)
  })
})

describe('hoistInnerNavIntents — real-world Profile menu-row tree', () => {
  it('handles the Maya Patel Profile shape end-to-end', () => {
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

// ─── Package A.3: stampFilterChipToggleState ──────────────────────────────────

describe('stampFilterChipToggleState', () => {
  it('stamps toggleState on a row of 5 unintented pills', () => {
    const tree: any = {
      type: 'View',
      style: { flexDirection: 'row' },
      children: [
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['All'] }] },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Pizza'] }] },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Burgers'] }] },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Sushi'] }] },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Indian'] }] },
      ],
    }
    const count = stampFilterChipToggleState(tree)
    expect(count).toBe(5)
    const pills = tree.children
    expect(pills[0].navIntent.kind).toBe('toggleState')
    expect(pills[0].navIntent.stateKey).toBe('all')
    expect(pills[1].navIntent.stateKey).toBe('pizza')
    expect(pills[4].navIntent.stateKey).toBe('indian')
    // All pills share the same group
    const group = pills[0].navIntent.group
    expect(group).toMatch(/^filter-/)
    for (const p of pills) expect(p.navIntent.group).toBe(group)
  })

  it('overwrites noop intents (the validator backfill we want to undo)', () => {
    const tree: any = {
      type: 'View',
      style: { flexDirection: 'row' },
      children: [
        { type: 'TouchableOpacity', navIntent: { kind: 'noop', toastMessage: 'Coming soon' }, children: [{ type: 'Text', children: ['All'] }] },
        { type: 'TouchableOpacity', navIntent: { kind: 'noop', toastMessage: 'Coming soon' }, children: [{ type: 'Text', children: ['Pizza'] }] },
        { type: 'TouchableOpacity', navIntent: { kind: 'noop', toastMessage: 'Coming soon' }, children: [{ type: 'Text', children: ['Burgers'] }] },
      ],
    }
    const count = stampFilterChipToggleState(tree)
    expect(count).toBe(3)
    expect(tree.children[0].navIntent.kind).toBe('toggleState')
  })

  it('does NOT stamp when one pill already has a real push intent', () => {
    // If the model deliberately gave one chip a navigation target, leave the
    // whole row alone — it's not a pure filter row, it might be a category-
    // shortcut row that the model wanted to navigate.
    const tree: any = {
      type: 'View',
      style: { flexDirection: 'row' },
      children: [
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['All'] }] },
        { type: 'TouchableOpacity', navIntent: { kind: 'push', target: 'pizzaList' }, children: [{ type: 'Text', children: ['Pizza'] }] },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Burgers'] }] },
      ],
    }
    const count = stampFilterChipToggleState(tree)
    expect(count).toBe(0)
  })

  it('does NOT stamp a row with fewer than 3 pills', () => {
    const tree: any = {
      type: 'View',
      style: { flexDirection: 'row' },
      children: [
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Apply'] }] },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Cancel'] }] },
      ],
    }
    const count = stampFilterChipToggleState(tree)
    expect(count).toBe(0)
  })

  it('does NOT stamp when the row contains a non-button child (header pattern)', () => {
    // Header rows are flex-row but mix Text title + buttons. The runtime's
    // isFilterChipClick rejects these and so do we.
    const tree: any = {
      type: 'View',
      style: { flexDirection: 'row' },
      children: [
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Back'] }] },
        { type: 'Text', children: ['Page Title'] },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Share'] }] },
      ],
    }
    const count = stampFilterChipToggleState(tree)
    expect(count).toBe(0)
  })

  it('does NOT stamp rows where pills already carry valid toggleState', () => {
    const tree: any = {
      type: 'View',
      style: { flexDirection: 'row' },
      children: [
        { type: 'TouchableOpacity', navIntent: { kind: 'toggleState', group: 'cat', stateKey: 'all' }, children: [{ type: 'Text', children: ['All'] }] },
        { type: 'TouchableOpacity', navIntent: { kind: 'toggleState', group: 'cat', stateKey: 'pizza' }, children: [{ type: 'Text', children: ['Pizza'] }] },
        { type: 'TouchableOpacity', navIntent: { kind: 'toggleState', group: 'cat', stateKey: 'burgers' }, children: [{ type: 'Text', children: ['Burgers'] }] },
      ],
    }
    const count = stampFilterChipToggleState(tree)
    expect(count).toBe(0)
    // Existing toggleState untouched
    expect(tree.children[0].navIntent.group).toBe('cat')
  })

  it('finds pill rows nested inside a screen tree', () => {
    const tree: any = {
      type: 'View',
      children: [
        { type: 'Text', children: ['Browse Categories'] },
        {
          type: 'View',
          style: { flexDirection: 'row' },
          children: [
            { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['All'] }] },
            { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['American'] }] },
            { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Japanese'] }] },
            { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Italian'] }] },
          ],
        },
      ],
    }
    const count = stampFilterChipToggleState(tree)
    expect(count).toBe(4)
  })

  it('stamps two pill rows with DIFFERENT group ids', () => {
    // A screen with both a category filter row AND a time-range filter row.
    // Each row must get its own group so they toggle independently.
    const tree: any = {
      type: 'View',
      children: [
        {
          type: 'View', style: { flexDirection: 'row' },
          children: [
            { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['All'] }] },
            { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Pizza'] }] },
            { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Burgers'] }] },
          ],
        },
        {
          type: 'View', style: { flexDirection: 'row' },
          children: [
            { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Today'] }] },
            { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Week'] }] },
            { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Month'] }] },
          ],
        },
      ],
    }
    const count = stampFilterChipToggleState(tree)
    expect(count).toBe(6)
    const groupA = tree.children[0].children[0].navIntent.group
    const groupB = tree.children[1].children[0].navIntent.group
    expect(groupA).not.toBe(groupB)
  })

  it('skips pills with overly long text (likely not a chip)', () => {
    const tree: any = {
      type: 'View',
      style: { flexDirection: 'row' },
      children: [
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['All'] }] },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['A really long button label that is not a pill'] }] },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Pizza'] }] },
      ],
    }
    const count = stampFilterChipToggleState(tree)
    expect(count).toBe(0)
  })

  it('plays well with validateNavIntents: stamped pills survive the validator', () => {
    const tree: any = {
      type: 'View',
      style: { flexDirection: 'row' },
      children: [
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['All'] }] },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Pizza'] }] },
        { type: 'TouchableOpacity', children: [{ type: 'Text', children: ['Burgers'] }] },
      ],
    }
    stampFilterChipToggleState(tree)
    const { warnings } = validateNavIntents(tree, { screens: [] })
    // Each pill should still have its toggleState intent after validation.
    for (const p of tree.children) {
      expect(p.navIntent.kind).toBe('toggleState')
    }
    // No "missing on TouchableOpacity" or "unknown kind" warnings.
    expect(warnings.some(w => w.includes('missing on TouchableOpacity'))).toBe(false)
    expect(warnings.some(w => w.includes('unknown kind'))).toBe(false)
  })
})
