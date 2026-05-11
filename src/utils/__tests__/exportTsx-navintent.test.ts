import { describe, it, expect } from 'vitest'
import { convertTreeToTSX, convertAppToTSX } from '../exportTsx'
import type { ComponentNode } from '../../types/mokkoi'

describe('convertTreeToTSX with navIntent', () => {
  it('emits navigation.navigate when TouchableOpacity has push intent', () => {
    const tree: ComponentNode = {
      type: 'View',
      children: [
        {
          type: 'TouchableOpacity',
          navIntent: { kind: 'push', target: 'ProductDetail', params: { id: 'ex1' } },
          children: [{ type: 'Text', children: ['Open'] }],
        },
      ],
    }
    const tsx = convertTreeToTSX(tree, 'Home')
    expect(tsx).toContain("import { useNavigation } from '@react-navigation/native'")
    expect(tsx).toContain('const navigation = useNavigation();')
    expect(tsx).toContain(`onPress={() => navigation.navigate('ProductDetail', {"id":"ex1"})}`)
  })

  it('emits navigation.navigate without params when params absent', () => {
    const tree: ComponentNode = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'push', target: 'Settings' },
      children: [{ type: 'Text', children: ['Go'] }],
    }
    const tsx = convertTreeToTSX(tree, 'Home')
    expect(tsx).toContain(`onPress={() => navigation.navigate('Settings')}`)
  })

  it('does not emit navigation hook for noop intents', () => {
    const tree: ComponentNode = {
      type: 'TouchableOpacity',
      navIntent: { kind: 'noop' },
      children: [{ type: 'Text', children: ['Decorative'] }],
    }
    const tsx = convertTreeToTSX(tree, 'Home')
    expect(tsx).not.toContain('useNavigation')
    expect(tsx).not.toContain('navigation.navigate')
  })
})

describe('convertAppToTSX', () => {
  it('generates NavigationContainer + Stack.Navigator with one screen per routeGraph entry', () => {
    const tsx = convertAppToTSX({
      componentNameByScreenId: { Home: 'HomeScreen', Detail: 'DetailScreen' },
      importPathByScreenId: { Home: './screens/Home', Detail: './screens/Detail' },
      appData: { products: { p1: { name: 'X' } } },
      routeGraph: {
        screens: [
          { id: 'Home', kind: 'screen' },
          { id: 'Detail', kind: 'screen' },
        ],
      },
    })
    expect(tsx).toContain("from '@react-navigation/native'")
    expect(tsx).toContain("from '@react-navigation/native-stack'")
    expect(tsx).toContain('const Stack = createNativeStackNavigator()')
    expect(tsx).toContain("import HomeScreen from './screens/Home'")
    expect(tsx).toContain("import DetailScreen from './screens/Detail'")
    expect(tsx).toContain('<Stack.Screen name="Home"')
    expect(tsx).toContain('<Stack.Screen name="Detail"')
    expect(tsx).toContain('initialRouteName="Home"')
    // appData inlined
    expect(tsx).toContain('"products"')
    expect(tsx).toContain('"p1"')
    // passed as a prop to each screen
    expect(tsx).toContain('appData={appData}')
  })

  it('marks modal screens with presentation: "modal"', () => {
    const tsx = convertAppToTSX({
      componentNameByScreenId: { Home: 'HomeScreen', CartSheet: 'CartSheetScreen' },
      importPathByScreenId: { Home: './screens/Home', CartSheet: './screens/CartSheet' },
      appData: {},
      routeGraph: {
        screens: [
          { id: 'Home', kind: 'screen' },
          { id: 'CartSheet', kind: 'modal' },
        ],
      },
    })
    // The Home screen has no presentation option.
    expect(tsx).toMatch(/<Stack\.Screen name="Home">/)
    // The modal screen carries presentation: "modal".
    expect(tsx).toMatch(/<Stack\.Screen name="CartSheet" options=\{\{ presentation: "modal" \}\}/)
    // Initial route should be the first non-modal.
    expect(tsx).toContain('initialRouteName="Home"')
  })

  it('honors planner entryScreenId when present', () => {
    const tsx = convertAppToTSX({
      componentNameByScreenId: { A: 'AScreen', B: 'BScreen' },
      importPathByScreenId: { A: './screens/A', B: './screens/B' },
      appData: {},
      routeGraph: {
        screens: [
          { id: 'A', kind: 'screen' },
          { id: 'B', kind: 'screen' },
        ],
        entryScreenId: 'B',
      },
    })
    expect(tsx).toContain('initialRouteName="B"')
  })

  it('throws when routeGraph references a screen without a component mapping', () => {
    expect(() =>
      convertAppToTSX({
        componentNameByScreenId: { Home: 'HomeScreen' },
        importPathByScreenId: { Home: './screens/Home' },
        appData: {},
        routeGraph: { screens: [{ id: 'Home' }, { id: 'Missing' }] },
      })
    ).toThrow(/missing componentName/)
  })
})
