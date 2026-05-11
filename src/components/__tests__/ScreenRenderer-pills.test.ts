import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScreenRenderer } from '../ScreenRenderer'
import type { ComponentNode } from '../../types/mokkoi'
import type { PillState } from '../../runtime/state'

/**
 * Three TouchableOpacity pills in a row, each with a toggleState navIntent
 * targeting the same group but a different stateKey.
 */
const PILL_ROW_TREE: ComponentNode = {
  type: 'View',
  style: { flexDirection: 'row' },
  children: [
    {
      type: 'TouchableOpacity',
      navIntent: { kind: 'toggleState', group: 'category', stateKey: 'all' },
      children: [{ type: 'Text', children: ['All'] }],
    },
    {
      type: 'TouchableOpacity',
      navIntent: { kind: 'toggleState', group: 'category', stateKey: 'cardio' },
      children: [{ type: 'Text', children: ['Cardio'] }],
    },
    {
      type: 'TouchableOpacity',
      navIntent: { kind: 'toggleState', group: 'category', stateKey: 'strength' },
      children: [{ type: 'Text', children: ['Strength'] }],
    },
  ],
}

function render(props: { tree: ComponentNode; pillState?: PillState; activeScreenId?: string }): string {
  return renderToStaticMarkup(createElement(ScreenRenderer, props))
}

describe('ScreenRenderer — filter-pill toggleState', () => {
  it('first pill in a group is active by default (no pillState entry)', () => {
    const html = render({ tree: PILL_ROW_TREE, pillState: {}, activeScreenId: 'home' })
    // The active pill should NOT have an opacity:0.45 — the other two should.
    const dimMatches = html.match(/opacity:0\.45/g) ?? []
    expect(dimMatches.length).toBe(2)
    // Active pill's nav data attribute should be in the markup AND not dimmed.
    expect(html).toContain('&quot;stateKey&quot;:&quot;all&quot;')
  })

  it('explicit pillState entry overrides the default-first-active', () => {
    const html = render({
      tree: PILL_ROW_TREE,
      pillState: { home: { category: 'cardio' } },
      activeScreenId: 'home',
    })
    const dimMatches = html.match(/opacity:0\.45/g) ?? []
    expect(dimMatches.length).toBe(2)
    // Confirm the dimmed pills are 'all' and 'strength' by checking the
    // markup positions: cardio's <div> should NOT carry opacity:0.45 before it.
    // Parse each pill's <div ... data-mokkoi-nav="..."> tag and check whether
    // its inline style includes opacity:0.45.
    const pillTagRe = /<div[^>]*data-mokkoi-nav="[^"]*?stateKey&quot;:&quot;(\w+)&quot;[^"]*"[^>]*>/g
    const dimmedKeys: string[] = []
    const activeKeys: string[] = []
    for (const m of html.matchAll(pillTagRe)) {
      const tag = m[0]
      const key = m[1]
      if (tag.includes('opacity:0.45')) dimmedKeys.push(key)
      else activeKeys.push(key)
    }
    expect(activeKeys).toEqual(['cardio'])
    expect(dimmedKeys.sort()).toEqual(['all', 'strength'])
  })

  it('renders unchanged when pillState/activeScreenId are not supplied', () => {
    // Old call sites (Dashboard, PhoneFrame, etc.) pass no pill props. No
    // toggleState styling should be applied — zero dimmed pills.
    const html = render({ tree: PILL_ROW_TREE })
    const dimMatches = html.match(/opacity:0\.45/g) ?? []
    expect(dimMatches.length).toBe(0)
  })

  it('non-toggleState trees render unchanged', () => {
    // A vanilla touchable with a push intent should be untouched even when
    // pillState is provided — toggleState rendering must not bleed into
    // other clickable kinds.
    const treeWithPush: ComponentNode = {
      type: 'View',
      children: [
        {
          type: 'TouchableOpacity',
          navIntent: { kind: 'push', target: 'detail' },
          children: [{ type: 'Text', children: ['Go'] }],
        },
      ],
    }
    const html = render({
      tree: treeWithPush,
      pillState: { home: { category: 'cardio' } },
      activeScreenId: 'home',
    })
    expect(html).not.toContain('opacity:0.45')
  })
})
