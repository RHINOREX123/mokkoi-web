/**
 * Icon export tests (Task A).
 *
 * Verifies the Snack export path renders `Icon` nodes as lucide-react-native
 * components — NOT as empty `<View />` fallbacks (the silent-drop bug).
 *
 * Covers:
 *   1. Lucide kebab-case names      → correct lucide component
 *   2. Material Symbols snake_case  → reverse-mapped to Lucide component
 *   3. Unknown names                → safe `Circle` fallback (never crash)
 *   4. `import { ... } from 'lucide-react-native'` is emitted once, sorted
 *   5. Multiple icons of the same name → single import entry
 *   6. Snack dependencies include lucide-react-native + react-native-svg
 */

import { describe, it, expect } from 'vitest'
import { convertTreeToTSX } from '../exportTsx'
import { toLucidePascal, toMaterialSymbol } from '../iconMap'
import { buildSnackPayload } from '../snackUrl'
import type { ComponentNode } from '../../types/mokkoi'

function icon(name: string, extra: Record<string, unknown> = {}): ComponentNode {
  return { type: 'Icon', props: { name, size: 20, color: '#FF6B6B', ...extra } }
}

function screen(children: ComponentNode[]): ComponentNode {
  return { type: 'View', children }
}

describe('toLucidePascal', () => {
  it('maps lucide kebab-case to PascalCase', () => {
    expect(toLucidePascal('heart')).toBe('Heart')
    expect(toLucidePascal('shopping-cart')).toBe('ShoppingCart')
    expect(toLucidePascal('chevron-right')).toBe('ChevronRight')
    expect(toLucidePascal('arrow-left')).toBe('ArrowLeft')
  })

  it('reverse-maps material snake_case to lucide PascalCase', () => {
    expect(toLucidePascal('favorite')).toBe('Heart')
    expect(toLucidePascal('shopping_cart')).toBe('ShoppingCart')
    expect(toLucidePascal('arrow_back')).toBe('ArrowLeft')
    expect(toLucidePascal('notifications')).toBe('Bell')
    expect(toLucidePascal('person')).toBe('User')
  })

  it('falls back to Circle for unknown names (never throws)', () => {
    expect(toLucidePascal('totally-not-an-icon')).toBe('Circle')
    expect(toLucidePascal('xyzqwerty')).toBe('Circle')
    expect(toLucidePascal('')).toBe('Circle')
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(toLucidePascal('  HEART  ')).toBe('Heart')
    expect(toLucidePascal('Shopping-Cart')).toBe('ShoppingCart')
  })
})

describe('toMaterialSymbol', () => {
  it('maps lucide kebab-case to material snake_case', () => {
    expect(toMaterialSymbol('heart')).toBe('favorite')
    expect(toMaterialSymbol('shopping-cart')).toBe('shopping_cart')
    expect(toMaterialSymbol('arrow-left')).toBe('arrow_back')
  })

  it('passes material names through', () => {
    // 'favorite' is not a Lucide key, so it falls through with hyphen→underscore
    expect(toMaterialSymbol('favorite')).toBe('favorite')
    expect(toMaterialSymbol('shopping_cart')).toBe('shopping_cart')
  })
})

describe('convertTreeToTSX — Icon rendering', () => {
  it('emits a lucide-react-native component for a lucide name', () => {
    const tree = screen([icon('heart')])
    const tsx = convertTreeToTSX(tree, 'Test')

    expect(tsx).toContain("import { Heart } from 'lucide-react-native';")
    expect(tsx).toContain('<Heart size={20} color="#FF6B6B" />')
    // Regression: previously the Icon was silently dropped to <View />
    expect(tsx).not.toMatch(/<Icon /)
  })

  it('reverse-maps Material Symbols names to Lucide components', () => {
    const tree = screen([icon('favorite'), icon('shopping_cart')])
    const tsx = convertTreeToTSX(tree, 'Test')

    expect(tsx).toContain("import { Heart, ShoppingCart } from 'lucide-react-native';")
    expect(tsx).toContain('<Heart size={20}')
    expect(tsx).toContain('<ShoppingCart size={20}')
  })

  it('deduplicates repeated icons in the import line', () => {
    const tree = screen([icon('heart'), icon('heart'), icon('heart')])
    const tsx = convertTreeToTSX(tree, 'Test')

    const matches = tsx.match(/import \{ Heart \} from 'lucide-react-native'/g)
    expect(matches).toHaveLength(1)
  })

  it('emits icons sorted alphabetically for stable output', () => {
    const tree = screen([icon('user'), icon('heart'), icon('bell')])
    const tsx = convertTreeToTSX(tree, 'Test')

    expect(tsx).toContain("import { Bell, Heart, User } from 'lucide-react-native';")
  })

  it('falls back to Circle for unknown names (never emits a broken import)', () => {
    const tree = screen([icon('totally-not-real')])
    const tsx = convertTreeToTSX(tree, 'Test')

    expect(tsx).toContain("import { Circle } from 'lucide-react-native';")
    expect(tsx).toContain('<Circle size={20}')
  })

  it('does NOT import lucide-react-native when no icons are used', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [{ type: 'Text', children: ['hello'] }],
    }
    const tsx = convertTreeToTSX(tree, 'Test')

    expect(tsx).not.toContain('lucide-react-native')
  })

  it('applies size and color from node.props with sensible defaults', () => {
    const tree = screen([
      { type: 'Icon', props: { name: 'star' } }, // no size/color
    ])
    const tsx = convertTreeToTSX(tree, 'Test')

    // Defaults: size=24, color=#FFFFFF
    expect(tsx).toContain('<Star size={24} color="#FFFFFF" />')
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

    expect(tsx).toContain('<ArrowLeft size={20}')
    expect(tsx).toContain('<TouchableOpacity')
    expect(tsx).toContain('<Text')
  })
})

describe('buildSnackPayload — Icon dependencies', () => {
  it('declares lucide-react-native and react-native-svg in Snack deps', () => {
    const payload = buildSnackPayload({
      projectName: 'Test',
      screens: [
        {
          id: 's1',
          name: 'Home',
          tree: screen([icon('heart')]),
        } as never,
      ],
    })

    expect(payload.dependencies['lucide-react-native']).toBeDefined()
    expect(payload.dependencies['react-native-svg']).toBeDefined()
    expect(payload.dependencies['expo-status-bar']).toBeDefined()
  })

  it('emits a working Icon in the generated screen file', () => {
    const payload = buildSnackPayload({
      projectName: 'Test',
      screens: [
        {
          id: 's1',
          name: 'Profile',
          tree: screen([icon('user')]),
        } as never,
      ],
    })

    const profileTsx = payload.files['screens/Profile.tsx']?.contents ?? ''
    expect(profileTsx).toContain("from 'lucide-react-native'")
    expect(profileTsx).toContain('<User size={20}')
  })
})
