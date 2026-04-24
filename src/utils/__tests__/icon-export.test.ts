/**
 * Icon export tests.
 *
 * Verifies the Snack export path renders `Icon` nodes as @expo/vector-icons
 * Ionicons components — NOT as empty `<View />` fallbacks (the original
 * silent-drop bug) and NOT as lucide-react-native components (which crashed
 * Expo Go with "Cannot read property 'ReactCurrentOwner' of undefined" when
 * Snack's bundled react-native-svg version disagreed with our pin).
 *
 * Covers:
 *   1. Lucide kebab-case names         → correct Ionicons name
 *   2. Material Symbols snake_case     → reverse-mapped to Ionicons name
 *   3. Unknown names                   → safe `ellipse` fallback (never crash)
 *   4. `import { Ionicons } from '@expo/vector-icons'` emitted exactly once
 *   5. Snack dependencies do NOT declare @expo/vector-icons, lucide-react-native,
 *      or react-native-svg (Ionicons is pre-bundled in Snack)
 *   6. toLucidePascal / LUCIDE_TO_MATERIAL still work for the canvas Material
 *      Symbols font path (backwards compat)
 */

import { describe, it, expect } from 'vitest'
import { convertTreeToTSX } from '../exportTsx'
import {
  toLucidePascal,
  toMaterialSymbol,
  toIoniconsName,
} from '../iconMap'
import { buildSnackPayload } from '../snackUrl'
import type { ComponentNode } from '../../types/mokkoi'

function icon(name: string, extra: Record<string, unknown> = {}): ComponentNode {
  return { type: 'Icon', props: { name, size: 20, color: '#FF6B6B', ...extra } }
}

function screen(children: ComponentNode[]): ComponentNode {
  return { type: 'View', children }
}

// ─── toIoniconsName ─────────────────────────────────────────────────────────

describe('toIoniconsName', () => {
  it('maps lucide kebab-case to Ionicons names', () => {
    expect(toIoniconsName('heart')).toBe('heart')
    expect(toIoniconsName('shopping-cart')).toBe('cart')
    expect(toIoniconsName('chevron-right')).toBe('chevron-forward')
    expect(toIoniconsName('arrow-left')).toBe('arrow-back')
    expect(toIoniconsName('user')).toBe('person')
    expect(toIoniconsName('bell')).toBe('notifications')
    expect(toIoniconsName('x')).toBe('close')
    expect(toIoniconsName('check')).toBe('checkmark')
  })

  it('reverse-maps Material snake_case to Ionicons names', () => {
    expect(toIoniconsName('favorite')).toBe('heart')
    expect(toIoniconsName('shopping_cart')).toBe('cart')
    expect(toIoniconsName('arrow_back')).toBe('arrow-back')
    expect(toIoniconsName('notifications')).toBe('notifications')
    expect(toIoniconsName('person')).toBe('person')
  })

  it('falls back to "ellipse" for unknown names (never throws)', () => {
    expect(toIoniconsName('totally-not-an-icon')).toBe('ellipse')
    expect(toIoniconsName('xyzqwerty')).toBe('ellipse')
    expect(toIoniconsName('')).toBe('ellipse')
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(toIoniconsName('  HEART  ')).toBe('heart')
    expect(toIoniconsName('Shopping-Cart')).toBe('cart')
  })
})

// ─── Backwards compat: canvas still uses Material Symbols font ──────────────

describe('toMaterialSymbol (canvas path — unchanged)', () => {
  it('maps lucide kebab-case to material snake_case', () => {
    expect(toMaterialSymbol('heart')).toBe('favorite')
    expect(toMaterialSymbol('shopping-cart')).toBe('shopping_cart')
    expect(toMaterialSymbol('arrow-left')).toBe('arrow_back')
  })
})

describe('toLucidePascal (kept for backwards compat, not on export path)', () => {
  it('still maps names correctly for any consumer still calling it', () => {
    expect(toLucidePascal('heart')).toBe('Heart')
    expect(toLucidePascal('shopping-cart')).toBe('ShoppingCart')
    expect(toLucidePascal('favorite')).toBe('Heart')
    expect(toLucidePascal('totally-not-an-icon')).toBe('Circle')
  })
})

// ─── convertTreeToTSX — Ionicons emission ───────────────────────────────────

describe('convertTreeToTSX — Icon rendering', () => {
  it('emits an Ionicons component for a lucide name', () => {
    const tree = screen([icon('heart')])
    const tsx = convertTreeToTSX(tree, 'Test')

    expect(tsx).toContain("import { Ionicons } from '@expo/vector-icons';")
    expect(tsx).toContain('<Ionicons name="heart" size={20} color="#FF6B6B" />')
    // Regression: previously the Icon was silently dropped to <View />
    expect(tsx).not.toMatch(/<Icon /)
    // Regression: must not emit the old lucide-react-native import
    expect(tsx).not.toContain('lucide-react-native')
  })

  it('reverse-maps Material Symbols names to Ionicons', () => {
    const tree = screen([icon('favorite'), icon('shopping_cart')])
    const tsx = convertTreeToTSX(tree, 'Test')

    expect(tsx).toContain("import { Ionicons } from '@expo/vector-icons';")
    expect(tsx).toContain('<Ionicons name="heart" size={20}')
    expect(tsx).toContain('<Ionicons name="cart" size={20}')
  })

  it('emits Ionicons import exactly once regardless of icon count', () => {
    const tree = screen([icon('heart'), icon('user'), icon('bell'), icon('home')])
    const tsx = convertTreeToTSX(tree, 'Test')

    const matches = tsx.match(/import \{ Ionicons \} from '@expo\/vector-icons';/g)
    expect(matches).toHaveLength(1)
  })

  it('falls back to "ellipse" for unknown names (never emits a broken icon)', () => {
    const tree = screen([icon('totally-not-real')])
    const tsx = convertTreeToTSX(tree, 'Test')

    expect(tsx).toContain("import { Ionicons } from '@expo/vector-icons';")
    expect(tsx).toContain('<Ionicons name="ellipse" size={20}')
  })

  it('does NOT import @expo/vector-icons when no icons are used', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [{ type: 'Text', children: ['hello'] }],
    }
    const tsx = convertTreeToTSX(tree, 'Test')

    expect(tsx).not.toContain('@expo/vector-icons')
    expect(tsx).not.toContain('Ionicons')
  })

  it('applies size and color from node.props with sensible defaults', () => {
    const tree = screen([
      { type: 'Icon', props: { name: 'star' } }, // no size/color
    ])
    const tsx = convertTreeToTSX(tree, 'Test')

    // Defaults: size=24, color=#FFFFFF
    expect(tsx).toContain('<Ionicons name="star" size={24} color="#FFFFFF" />')
  })

  it('renders icons nested inside a TouchableOpacity without breaking nav wiring', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        {
          type: 'TouchableOpacity',
          children: [
            icon('arrow-left'),
            { type: 'Text', children: ['Back'] },
          ],
        },
      ],
    }
    const tsx = convertTreeToTSX(tree, 'Test')

    expect(tsx).toContain('<Ionicons name="arrow-back" size={20}')
    expect(tsx).toContain('<TouchableOpacity')
    expect(tsx).toContain('<Text')
  })
})

// ─── buildSnackPayload — dependencies ───────────────────────────────────────

describe('buildSnackPayload — Icon dependencies', () => {
  it('does NOT declare lucide-react-native, react-native-svg, or @expo/vector-icons', () => {
    const payload = buildSnackPayload({
      projectName: 'Test',
      screens: [
        {
          id: 's1',
          name: 'Home',
          // richer tree so it isn't filtered as "empty"
          tree: {
            type: 'View',
            children: [
              { type: 'Text', children: ['Hi'] },
              { type: 'Text', children: ['Subtitle'] },
              { type: 'Text', children: ['Body'] },
              icon('heart'),
            ],
          },
        } as never,
      ],
    })

    // @expo/vector-icons is pre-bundled in Snack — declaring it can force
    // Snack to resolve a version that conflicts with its bundled one.
    expect(payload.dependencies['@expo/vector-icons']).toBeUndefined()
    // Old icon stack must be gone (both caused the ReactCurrentOwner crash)
    expect(payload.dependencies['lucide-react-native']).toBeUndefined()
    expect(payload.dependencies['react-native-svg']).toBeUndefined()
    // expo-status-bar is still needed for the tab-bar StatusBar component
    expect(payload.dependencies['expo-status-bar']).toBeDefined()
  })

  it('emits a working Ionicons component in the generated screen file', () => {
    const payload = buildSnackPayload({
      projectName: 'Test',
      screens: [
        {
          id: 's1',
          name: 'Profile',
          tree: {
            type: 'View',
            children: [
              { type: 'Text', children: ['Profile'] },
              { type: 'Text', children: ['Subtitle'] },
              { type: 'Text', children: ['Body'] },
              icon('user'),
            ],
          },
        } as never,
      ],
    })

    const profileTsx = payload.files['screens/Profile.tsx']?.contents ?? ''
    expect(profileTsx).toContain("from '@expo/vector-icons'")
    expect(profileTsx).toContain('<Ionicons name="person" size={20}')
    expect(profileTsx).not.toContain('lucide-react-native')
  })
})
