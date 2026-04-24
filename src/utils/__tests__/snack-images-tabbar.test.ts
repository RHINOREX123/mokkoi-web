/**
 * Snack preview tests for Bug 1 (image URLs) and Bug 2 (tab bar rendering).
 *
 * Bug 1 (images): picsum.photos/400/300?random=N returned random stock photos
 *   because `random` is a cache-buster, not a seed. Fix uses loremflickr with
 *   keywords derived from searchQuery + a stable hash lock.
 *
 * Bug 2 (tab bar): The bottom tab bar was suppressed when only 1 screen existed
 *   (`tabCount > 1 && ...`), making the Expo Go preview look nothing like the
 *   canvas. Fix always renders the tab bar, padding with disabled placeholder
 *   tabs when realTabCount === 1.
 */

import { describe, it, expect } from 'vitest'
import { buildSnackPayload } from '../snackUrl'
import type { ComponentNode } from '../../types/mokkoi'
import type { GeneratedScreen } from '../../hooks/useScreenManagement'

function imageNode(searchQuery: string): ComponentNode {
  return {
    type: 'Image',
    props: { searchQuery, style: { width: 100, height: 100 } },
  }
}

/** Build a tree with enough content to pass the isEmptyScreen (< 3) check. */
function richTree(label: string, extra: ComponentNode[] = []): ComponentNode {
  return {
    type: 'View',
    children: [
      { type: 'Text', children: [label] },
      { type: 'Text', children: ['Subtitle'] },
      { type: 'Text', children: ['Body content'] },
      { type: 'TextInput', props: { placeholder: 'Search' } },
      ...extra,
    ],
  }
}

function screen(id: string, name: string, tree: ComponentNode): GeneratedScreen {
  return { id, name, tree } as GeneratedScreen
}

function appTsx(payload: ReturnType<typeof buildSnackPayload>): string {
  return payload.files['App.tsx']?.contents ?? ''
}

function screenTsx(payload: ReturnType<typeof buildSnackPayload>, name: string): string {
  return payload.files[`screens/${name}.tsx`]?.contents ?? ''
}

// ─── Bug 1: loremflickr keyword-locked URLs ─────────────────────────────────

describe('buildSnackPayload — image URLs (Bug 1)', () => {
  it('uses loremflickr with searchQuery-derived tags (not random picsum)', () => {
    const tree = richTree('Menu', [imageNode('margherita pizza')])
    const payload = buildSnackPayload({
      projectName: 'Test',
      screens: [screen('s1', 'Menu', tree)],
    })

    const tsx = screenTsx(payload, 'Menu')
    // Must route through loremflickr, not picsum
    expect(tsx).toContain('loremflickr.com')
    expect(tsx).not.toContain('picsum.photos')
    // Keywords from the search query
    expect(tsx).toMatch(/loremflickr\.com\/400\/300\/[^'?]*margherita[^'?]*pizza/)
    // Has a deterministic lock param
    expect(tsx).toMatch(/\?lock=\d+/)
  })

  it('returns the same URL for the same searchQuery (deterministic lock)', () => {
    const treeA = richTree('A', [imageNode('sushi platter')])
    const treeB = richTree('B', [imageNode('sushi platter')])

    const a = buildSnackPayload({ projectName: 'A', screens: [screen('s1', 'A', treeA)] })
    const b = buildSnackPayload({ projectName: 'B', screens: [screen('s1', 'B', treeB)] })

    const urlA = screenTsx(a, 'A').match(/https:\/\/loremflickr\.com\/[^'"]+/)?.[0]
    const urlB = screenTsx(b, 'B').match(/https:\/\/loremflickr\.com\/[^'"]+/)?.[0]
    expect(urlA).toBeDefined()
    expect(urlA).toBe(urlB)
  })

  it('returns different locks for different searchQueries', () => {
    const treeA = richTree('A', [imageNode('pizza')])
    const treeB = richTree('B', [imageNode('burger')])

    const a = buildSnackPayload({ projectName: 'A', screens: [screen('s1', 'A', treeA)] })
    const b = buildSnackPayload({ projectName: 'B', screens: [screen('s1', 'B', treeB)] })

    const lockA = screenTsx(a, 'A').match(/\?lock=(\d+)/)?.[1]
    const lockB = screenTsx(b, 'B').match(/\?lock=(\d+)/)?.[1]
    expect(lockA).toBeDefined()
    expect(lockB).toBeDefined()
    expect(lockA).not.toBe(lockB)
  })

  it('strips stop words and caps to 3 keywords', () => {
    const tree = richTree('Menu', [imageNode('a photo of the best burger with fries and a coke')])
    const payload = buildSnackPayload({
      projectName: 'Test',
      screens: [screen('s1', 'Menu', tree)],
    })
    const url = screenTsx(payload, 'Menu').match(/loremflickr\.com\/400\/300\/([^'"?]+)/)?.[1]
    expect(url).toBeDefined()
    // Stop words (a, of, the, with, and) removed; at most 3 tags
    expect(url).not.toMatch(/\b(a|of|the|with|and)\b/)
    const tags = (url as string).split(',')
    expect(tags.length).toBeLessThanOrEqual(3)
  })

  it('falls back to "food" when searchQuery has no usable words', () => {
    const tree = richTree('Menu', [imageNode('!@# a the of')])
    const payload = buildSnackPayload({
      projectName: 'Test',
      screens: [screen('s1', 'Menu', tree)],
    })
    expect(screenTsx(payload, 'Menu')).toContain('loremflickr.com/400/300/food')
  })
})

// ─── Bug 2: always-render tab bar ───────────────────────────────────────────

describe('buildSnackPayload — tab bar rendering (Bug 2)', () => {
  it('renders a tab bar even when only one screen exists', () => {
    const payload = buildSnackPayload({
      projectName: 'Test',
      screens: [screen('s1', 'Home', richTree('Home'))],
    })
    const app = appTsx(payload)

    // Regression: old code had `{tabCount > 1 && (` which suppressed the bar
    expect(app).not.toContain('> 1 &&')
    // The tab bar's SafeAreaView + bottom-row container should be emitted
    expect(app).toContain('<SafeAreaView')
    expect(app).toContain('borderTopWidth')
    expect(app).toContain('flexDirection: \'row\'')
  })

  it('pads with 3 disabled placeholder tabs when only 1 real screen', () => {
    const payload = buildSnackPayload({
      projectName: 'Test',
      screens: [screen('s1', 'Home', richTree('Home'))],
    })
    const app = appTsx(payload)

    // Placeholder labels and icons in the emitted arrays
    expect(app).toMatch(/const tabLabels = \[[^\]]*'Search'[^\]]*'Activity'[^\]]*'Profile'/)
    // Placeholder detection checks index against real tab count (= 1)
    expect(app).toContain('i >= 1')
    // Disabled prop + dimmed opacity for placeholders
    expect(app).toContain('disabled={isPlaceholder}')
    expect(app).toContain('opacity: isPlaceholder ? 0.35 : 1')
    // Placeholders must not wire onPress
    expect(app).toContain('isPlaceholder ? undefined : () => setActive(i)')
  })

  it('does NOT add placeholders when there are multiple real tabs', () => {
    const payload = buildSnackPayload({
      projectName: 'Test',
      screens: [
        screen('s1', 'Home', richTree('Home')),
        screen('s2', 'Feed', richTree('Feed')),
        screen('s3', 'Account', richTree('Account')),
      ],
    })
    const app = appTsx(payload)

    // tabLabels should be exactly the 3 real labels — no padding
    const labelMatch = app.match(/const tabLabels = \[([^\]]+)\]/)
    expect(labelMatch).toBeDefined()
    const labels = (labelMatch![1].match(/'[^']+'/g) ?? []).length
    expect(labels).toBe(3)
    // With 3 real tabs, placeholder index threshold is 3 — no tab hits it
    expect(app).toContain('i >= 3')
  })

  it('skips placeholder tabs whose label collides with the real tab', () => {
    // Real screen is named "Profile" — one of our placeholder candidates
    const payload = buildSnackPayload({
      projectName: 'Test',
      screens: [screen('s1', 'Profile', richTree('Profile'))],
    })
    const app = appTsx(payload)

    const labelMatch = app.match(/const tabLabels = \[([^\]]+)\]/)
    const labels = (labelMatch![1].match(/'[^']+'/g) ?? []).map(s => s.replace(/'/g, ''))
    // Profile appears once (the real tab) — not duplicated as a placeholder
    expect(labels.filter(l => l === 'Profile')).toHaveLength(1)
    // Still padded out (Search + Activity remain); total length >= 2
    expect(labels.length).toBeGreaterThanOrEqual(2)
  })
})
