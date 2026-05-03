import { describe, it, expect } from 'vitest'
import { validateBottomNavLabels } from './bottomnav-validator'

describe('validateBottomNavLabels', () => {
  const SCREEN_NAMES = ['Home', 'Habits', 'Stats', 'Profile']

  function makeTree(items: Array<{ icon: string; label: string }>) {
    return {
      type: 'View',
      children: [
        { type: 'Text', children: ['Header'] },
        { type: 'BottomNav', props: { items } },
      ],
    }
  }

  it('replaces icon-name labels with positionally-matched screen names', () => {
    // Production failure pattern: Sonnet emitted icon names as labels.
    const tree = makeTree([
      { icon: 'home', label: 'home' },           // label==icon, also screen-matches via "home"⊂"Home"
      { icon: 'list', label: 'list' },           // pure icon-name label, no screen match
      { icon: 'bar_chart', label: 'bar_chart' }, // Material Symbols icon-name label
      { icon: 'person', label: 'person' },       // Material Symbols icon-name label
    ])
    validateBottomNavLabels(tree, SCREEN_NAMES)
    const items = (tree.children[1] as any).props.items
    // tab[0] 'home' substring-matches 'Home' so it stays as-is
    expect(items[0].label).toBe('home')
    // tab[1] 'list' has no screen match → positional fallback to screenNames[1] = 'Habits'
    expect(items[1].label).toBe('Habits')
    expect(items[2].label).toBe('Stats')
    expect(items[3].label).toBe('Profile')
  })

  it('leaves correct labels unchanged (idempotent on good input)', () => {
    const tree = makeTree([
      { icon: 'home',         label: 'Home' },
      { icon: 'check-circle', label: 'Habits' },
      { icon: 'bar-chart-2',  label: 'Stats' },
      { icon: 'user',         label: 'Profile' },
    ])
    validateBottomNavLabels(tree, SCREEN_NAMES)
    const items = (tree.children[1] as any).props.items
    expect(items.map((i: any) => i.label)).toEqual(['Home', 'Habits', 'Stats', 'Profile'])
  })

  it('keeps fuzzy/substring screen-name matches (e.g. "ProfileScreen", "Profile")', () => {
    const tree = makeTree([
      { icon: 'home', label: 'HomeScreen' },     // substring of/fuzzy with 'Home'
      { icon: 'list', label: 'My Habits' },      // contains 'Habits'
      { icon: 'bar',  label: 'stats' },          // case-insensitive equal to 'Stats'
      { icon: 'user', label: 'Profile' },
    ])
    validateBottomNavLabels(tree, SCREEN_NAMES)
    const items = (tree.children[1] as any).props.items
    expect(items.map((i: any) => i.label)).toEqual(['HomeScreen', 'My Habits', 'stats', 'Profile'])
  })

  it('leaves a tab alone (with warning) when index >= screenNames.length', () => {
    const tree = makeTree([
      { icon: 'home',  label: 'home' },
      { icon: 'list',  label: 'list' },
      { icon: 'star',  label: 'star' }, // pos 2 → 'Stats'
      { icon: 'cog',   label: 'cog' },  // pos 3 → 'Profile'
      { icon: 'bell',  label: 'bell' }, // pos 4 → no fallback, leave as 'bell'
    ])
    validateBottomNavLabels(tree, SCREEN_NAMES)
    const items = (tree.children[1] as any).props.items
    expect(items[0].label).toBe('home')    // 'home' ⊂ 'Home' → keep
    expect(items[1].label).toBe('Habits')  // positional
    expect(items[2].label).toBe('Stats')   // positional
    expect(items[3].label).toBe('Profile') // positional
    expect(items[4].label).toBe('bell')    // out of range, leave alone
  })

  it('handles missing/empty/malformed inputs without crashing', () => {
    expect(() => validateBottomNavLabels(null as any, SCREEN_NAMES)).not.toThrow()
    expect(() => validateBottomNavLabels({} as any, SCREEN_NAMES)).not.toThrow()
    expect(() => validateBottomNavLabels({ type: 'BottomNav', props: {} } as any, SCREEN_NAMES)).not.toThrow()
    // Empty screenNames → no-op (return tree unchanged)
    const tree = makeTree([{ icon: 'list', label: 'list' }])
    validateBottomNavLabels(tree, [])
    expect((tree.children[1] as any).props.items[0].label).toBe('list')
  })

  it('only touches BottomNav nodes — other macros are untouched', () => {
    const tree = {
      type: 'View',
      children: [
        { type: 'TabBar', props: { tabs: [{ label: 'list' }, { label: 'person' }] } },
        { type: 'BottomNav', props: { items: [{ icon: 'home', label: 'home' }, { icon: 'list', label: 'list' }] } },
      ],
    }
    validateBottomNavLabels(tree as any, SCREEN_NAMES)
    // TabBar.tabs[].label is unchanged
    expect((tree.children[0] as any).props.tabs[0].label).toBe('list')
    expect((tree.children[0] as any).props.tabs[1].label).toBe('person')
    // BottomNav fixed
    expect((tree.children[1] as any).props.items[1].label).toBe('Habits')
  })

  it('walks nested children to find BottomNav anywhere in the tree', () => {
    const tree = {
      type: 'View',
      children: [
        {
          type: 'ScrollView',
          children: [
            {
              type: 'View',
              children: [
                { type: 'BottomNav', props: { items: [{ icon: 'list', label: 'list' }] } },
              ],
            },
          ],
        },
      ],
    }
    validateBottomNavLabels(tree as any, SCREEN_NAMES)
    expect((tree.children[0] as any).children[0].children[0].props.items[0].label).toBe('Home')
  })
})
