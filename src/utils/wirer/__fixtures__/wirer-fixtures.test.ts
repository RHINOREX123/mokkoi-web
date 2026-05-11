/**
 * wirer-fixtures.test.ts — Golden tests for wireScreen using hand-crafted realistic fixtures.
 * One test per (fixture × from-screen) pair so failures are specific.
 */

import { describe, it, expect } from 'vitest'
import { wireScreen } from '../../wirer'
import type { ScreenInfo } from '../../wirer'
import type { FlowConnection } from '../../../components/FlowConnectors'
import type { ComponentNode } from '../../../types/mokkoi'

import foodDelivery from './food-delivery.json'
import fitness from './fitness.json'
import banking from './banking.json'
import chat from './chat.json'
import checkout from './checkout.json'

// ── Types that mirror the fixture JSON shape ──────────────────────────────────

interface FixtureScreen {
  id: string
  name: string
  tree: ComponentNode
}

interface FixtureConnection {
  fromScreenId: string
  toScreenId: string
  trigger?: string
}

interface ExpectedBinding {
  screenName: string
  buttonText: string
  target: string
}

interface ExpectedUnmatched {
  screenName: string
  trigger: string
  target: string
}

interface Fixture {
  description: string
  screens: FixtureScreen[]
  connections: FixtureConnection[]
  expectedBindings: ExpectedBinding[]
  expectedUnmatched?: ExpectedUnmatched[]
}

// ── Local text-collection helper (mirrors private collectAllText in wirer.ts) ──

function collectAllText(node: ComponentNode): string {
  const parts: string[] = []
  if (node.children) {
    for (const child of node.children) {
      if (typeof child === 'string') {
        parts.push(child.trim())
      } else {
        parts.push(collectAllText(child as ComponentNode))
      }
    }
  }
  if (node.props?.children && typeof node.props.children === 'string') {
    parts.push(node.props.children)
  }
  return parts.filter(Boolean).join(' ')
}

// ── Fixture runner ────────────────────────────────────────────────────────────

const fixtures: Array<{ name: string; fixture: Fixture }> = [
  { name: 'food-delivery', fixture: foodDelivery as Fixture },
  { name: 'fitness', fixture: fitness as Fixture },
  { name: 'banking', fixture: banking as Fixture },
  { name: 'chat', fixture: chat as Fixture },
  { name: 'checkout', fixture: checkout as Fixture },
]

for (const { name: fixtureName, fixture } of fixtures) {
  describe(`fixture: ${fixtureName}`, () => {
    // Build ScreenInfo list (same objects reused so node references are stable)
    const screens: ScreenInfo[] = fixture.screens.map(s => ({
      id: s.id,
      name: s.name,
      tree: s.tree as ComponentNode,
    }))

    const connections: FlowConnection[] = fixture.connections.map(c => ({
      fromScreenId: c.fromScreenId,
      toScreenId: c.toScreenId,
      trigger: c.trigger,
    }))

    // Find screens that have outgoing connections
    const fromScreenIds = new Set(connections.map(c => c.fromScreenId))

    for (const screen of screens) {
      if (!fromScreenIds.has(screen.id)) continue

      it(`${fixtureName} > ${screen.name} wires correctly`, () => {
        const result = wireScreen(screen, connections, screens)

        // Expected bindings for this screen
        const expectedBindings = fixture.expectedBindings.filter(
          b => b.screenName === screen.name,
        )

        // Expected unmatched for this screen
        const expectedUnmatched = (fixture.expectedUnmatched ?? []).filter(
          u => u.screenName === screen.name,
        )

        // Build actual bindings as { buttonText, target }[] by walking the tree
        // for stamped navIntent (push/openSheet target screen names).
        const actualBindings: Array<{ buttonText: string; target: string }> = []
        const walk = (node: ComponentNode): void => {
          const intent = node.navIntent
          if (intent && (intent.kind === 'push' || intent.kind === 'openSheet')) {
            actualBindings.push({
              buttonText: collectAllText(node).trim(),
              target: intent.target,
            })
          }
          if (node.children) {
            for (const c of node.children) {
              if (typeof c !== 'string') walk(c as ComponentNode)
            }
          }
        }
        walk(screen.tree)

        // Every expectedBinding must appear in actualBindings
        for (const expected of expectedBindings) {
          const found = actualBindings.some(
            a => a.buttonText === expected.buttonText && a.target === expected.target,
          )
          expect(found, `Expected binding {buttonText: "${expected.buttonText}", target: "${expected.target}"} not found in screen "${screen.name}". Actual bindings: ${JSON.stringify(actualBindings)}`).toBe(true)
        }

        // No extra bindings beyond what we expect
        expect(actualBindings.length).toBe(expectedBindings.length)

        // Unmatched: match by (trigger, target) pairs
        const actualUnmatched = result.unmatched.map(u => ({
          trigger: u.trigger,
          target: u.target,
        }))

        expect(actualUnmatched.length).toBe(expectedUnmatched.length)

        for (const expected of expectedUnmatched) {
          const found = actualUnmatched.some(
            u => u.trigger === expected.trigger && u.target === expected.target,
          )
          expect(found, `Expected unmatched {trigger: "${expected.trigger}", target: "${expected.target}"} not found in screen "${screen.name}". Actual unmatched: ${JSON.stringify(actualUnmatched)}`).toBe(true)
        }
      })
    }
  })
}
