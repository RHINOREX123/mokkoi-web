import { describe, it, expect } from 'vitest'
import { buildDeepNavSnackPayload } from '../snackUrl'
import type { ComponentNode } from '../../types/mokkoi'

function screen(id: string, name: string, tree: ComponentNode) {
  return { id, name, tree, updatedAt: 0, component: '' } as any
}

describe('buildDeepNavSnackPayload', () => {
  const homeTree: ComponentNode = {
    type: 'View',
    children: [
      {
        type: 'TouchableOpacity',
        navIntent: { kind: 'push', target: 'Detail', params: { id: 'p1' } },
        children: [{ type: 'Text', children: ['Open detail'] }],
      },
    ],
  }
  const detailTree: ComponentNode = {
    type: 'View',
    children: [{ type: 'Text', children: ['Detail body'] }],
  }

  it('emits App.tsx with NavigationContainer + Stack and one file per screen', () => {
    const payload = buildDeepNavSnackPayload({
      projectName: 'demo',
      screens: [screen('Home', 'Home', homeTree), screen('Detail', 'Detail', detailTree)],
      appData: { products: { p1: { name: 'A' } } },
      routeGraph: {
        screens: [{ id: 'Home', kind: 'screen' }, { id: 'Detail', kind: 'screen' }],
      },
    })

    expect(payload.files['App.tsx']).toBeDefined()
    expect(payload.files['App.tsx'].contents).toContain('NavigationContainer')
    expect(payload.files['App.tsx'].contents).toContain('createNativeStackNavigator')
    expect(payload.files['App.tsx'].contents).toContain('appData={appData}')

    expect(payload.files['screens/Home.tsx']).toBeDefined()
    expect(payload.files['screens/Detail.tsx']).toBeDefined()
    // The Home screen wires the navIntent into navigation.navigate.
    expect(payload.files['screens/Home.tsx'].contents).toContain(
      `navigation.navigate('Detail', {"id":"p1"})`
    )
  })

  it('declares @react-navigation/native and native-stack as dependencies', () => {
    const payload = buildDeepNavSnackPayload({
      projectName: 'demo',
      screens: [screen('Home', 'Home', homeTree)],
      appData: {},
      routeGraph: { screens: [{ id: 'Home', kind: 'screen' }] },
    })
    expect(payload.dependencies['@react-navigation/native']).toBeDefined()
    expect(payload.dependencies['@react-navigation/native-stack']).toBeDefined()
  })

  it('produces a stub file for any routeGraph screen with no matching generated screen', () => {
    const payload = buildDeepNavSnackPayload({
      projectName: 'demo',
      screens: [screen('Home', 'Home', homeTree)],
      appData: {},
      routeGraph: {
        screens: [{ id: 'Home', kind: 'screen' }, { id: 'Ghost', kind: 'screen' }],
      },
    })
    // The Ghost screen has no matching GeneratedScreen — builder should
    // emit a placeholder so React Navigation can still resolve the route.
    const ghostFile = Object.entries(payload.files).find(([k]) => k.startsWith('screens/Ghost'))
    expect(ghostFile).toBeDefined()
    expect(ghostFile![1].contents).toContain('Screen unavailable')
  })
})
