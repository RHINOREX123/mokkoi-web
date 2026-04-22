/**
 * Integration test: wirer → export pipeline
 *
 * Verifies that buildSnackPayload correctly wires onPress navigation
 * for multi-button screens using the wirer module (Task 3).
 */

import { describe, it, expect } from 'vitest'
import { buildSnackPayload } from '../snackUrl'
import type { ComponentNode } from '../../types/mokkoi'
import type { FlowConnection } from '../../components/FlowConnectors'

// ── Helpers ──────────────────────────────────────────────────────────────────

function btn(label: string): ComponentNode {
  return {
    type: 'TouchableOpacity',
    children: [
      { type: 'Text', children: [label] },
    ],
  }
}

function screen(id: string, name: string, tree: ComponentNode) {
  return { id, name, tree }
}

function conn(fromScreenId: string, toScreenId: string, trigger: string): FlowConnection {
  return { fromScreenId, toScreenId, trigger }
}

// ── Fixture ───────────────────────────────────────────────────────────────────

const homeTree: ComponentNode = {
  type: 'View',
  children: [
    btn('Add to Cart'),
    btn('View Profile'),
  ],
}

const cartTree: ComponentNode = {
  type: 'View',
  children: [{ type: 'Text', children: ['Your cart'] }],
}

const profileTree: ComponentNode = {
  type: 'View',
  children: [{ type: 'Text', children: ['Your profile'] }],
}

const screens = [
  screen('s-home', 'Home', homeTree),
  screen('s-cart', 'Cart', cartTree),
  screen('s-profile', 'Profile', profileTree),
]

const connections: FlowConnection[] = [
  conn('s-home', 's-cart', 'Add to Cart'),
  conn('s-home', 's-profile', 'View Profile'),
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildSnackPayload — wiring integration', () => {
  it('Home TSX contains navigation.navigate for both Cart and Profile', () => {
    const payload = buildSnackPayload({
      projectName: 'WiringTest',
      screens,
      connections,
    })

    const homeTsx = payload.files['screens/Home.tsx']?.contents ?? ''

    expect(homeTsx).toContain("navigation.navigate('Cart')")
    expect(homeTsx).toContain("navigation.navigate('Profile')")
  })

  it('Cart TSX contains zero navigation.navigate calls', () => {
    const payload = buildSnackPayload({
      projectName: 'WiringTest',
      screens,
      connections,
    })
    const cartTsx = payload.files['screens/Cart.tsx']?.contents ?? ''
    expect(cartTsx).not.toContain('navigation.navigate(')
  })

  it('Profile TSX contains zero navigation.navigate calls', () => {
    const payload = buildSnackPayload({
      projectName: 'WiringTest',
      screens,
      connections,
    })
    const profileTsx = payload.files['screens/Profile.tsx']?.contents ?? ''
    expect(profileTsx).not.toContain('navigation.navigate(')
  })

  it('Home TSX imports useNavigation', () => {
    const payload = buildSnackPayload({
      projectName: 'WiringTest',
      screens,
      connections,
    })
    const homeTsx = payload.files['screens/Home.tsx']?.contents ?? ''
    expect(homeTsx).toContain('useNavigation')
  })
})
