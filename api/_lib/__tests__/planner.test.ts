import { describe, it, expect } from 'vitest'
import {
  runPlanner,
  runAppPlanner,
  validatePlannerOutput,
  type CallAnthropic,
  type PlannerOutput,
} from '../planner'

// ── Fixture: canned fitness-app planner response ──────────────────────────────

const FITNESS_RESPONSE = {
  appName: 'FitForge',
  screens: [
    { id: 'home', name: 'Home', description: 'Daily activity summary and quick-start workouts', screenType: 'dashboard', isHome: true },
    { id: 'workouts', name: 'Workouts', description: 'List of all workouts user has logged', screenType: 'list' },
    { id: 'workoutDetail', name: 'Workout Detail', description: 'Detail view of one workout with sets, reps and notes', screenType: 'detail' },
    { id: 'addWorkout', name: 'Add Workout', description: 'Modal to add a new workout entry', screenType: 'form' },
    { id: 'progress', name: 'Progress', description: 'Charts and personal records over time', screenType: 'analytics' },
    { id: 'profile', name: 'Profile', description: 'User profile and settings', screenType: 'profile' },
  ],
  navigation: {
    type: 'tabs',
    tabScreens: ['home', 'workouts', 'progress', 'profile'],
    connections: [
      { from: 'workouts', to: 'workoutDetail', trigger: 'View workout' },
      { from: 'workouts', to: 'addWorkout', trigger: 'Add Workout' },
    ],
  },
  designDirection: { theme: 'dark', accentColor: '#7C5CFF', style: 'modern minimal' },
  appData: {
    workouts: [
      { id: 'w1', name: 'Push Day', durationMin: 55, kcal: 420 },
      { id: 'w2', name: 'Leg Day', durationMin: 48, kcal: 510 },
      { id: 'w3', name: 'Cardio HIIT', durationMin: 30, kcal: 360 },
    ],
    personalRecords: [
      { exercise: 'Bench Press', weightLb: 225 },
      { exercise: 'Back Squat', weightLb: 315 },
      { exercise: 'Deadlift', weightLb: 405 },
    ],
    meals: [
      { id: 'm1', name: 'Greek Yogurt Bowl', kcal: 320 },
      { id: 'm2', name: 'Chicken & Rice', kcal: 620 },
      { id: 'm3', name: 'Protein Shake', kcal: 240 },
    ],
  },
  routeGraph: {
    screens: [
      { id: 'home', kind: 'screen', purpose: 'Daily activity dashboard with quick-start', dataSource: 'workouts' },
      { id: 'workouts', kind: 'screen', purpose: 'List of all logged workouts', dataSource: 'workouts' },
      { id: 'workoutDetail', kind: 'screen', purpose: 'Detail view of one workout', params: ['workoutId'], dataSource: 'workouts' },
      { id: 'addWorkout', kind: 'modal', purpose: 'Add a new workout entry' },
      { id: 'progress', kind: 'screen', purpose: 'Progress charts and PRs', dataSource: 'personalRecords' },
      { id: 'profile', kind: 'screen', purpose: 'User profile and settings' },
      // Package A: menu-row sub-screens for the Profile screen.
      { id: 'edit-profile', kind: 'screen', purpose: 'Edit account details' },
      { id: 'notification-settings', kind: 'screen', purpose: 'Notification preferences' },
      { id: 'privacy', kind: 'screen', purpose: 'Privacy and security' },
      { id: 'help', kind: 'screen', purpose: 'Help and support' },
    ],
    tabs: ['home', 'workouts', 'progress', 'profile'],
  },
}

function mockCallApi(payload: any): CallAnthropic {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({ content: [{ text: JSON.stringify(payload) }], stop_reason: 'end_turn' }),
    text: async () => JSON.stringify(payload),
  })
}

function failingCallApi(status = 500): CallAnthropic {
  return async () => ({
    ok: false,
    status,
    json: async () => ({}),
    text: async () => 'boom',
  })
}

// ── runAppPlanner: legacy contract still works after extraction ───────────────

describe('runAppPlanner (behavior-preserving)', () => {
  it('parses a valid response into an AppPlan', async () => {
    const res = await runAppPlanner({
      callApi: mockCallApi(FITNESS_RESPONSE),
      prompt: 'fitness tracking app',
      images: [],
    })
    expect(res.plan).not.toBeNull()
    expect(res.plan?.appName).toBe('FitForge')
    expect(res.plan?.screens).toHaveLength(6)
    expect(res.plan?.navigation.tabScreens).toEqual(['home', 'workouts', 'progress', 'profile'])
  })

  it('returns failureCode=api_error when the HTTP call fails (no retry needed)', async () => {
    const res = await runAppPlanner({
      callApi: failingCallApi(),
      prompt: 'x',
      images: [],
    })
    expect(res.plan).toBeNull()
    expect(res.failureCode).toBe('api_error')
  })

  it('returns failureCode=parse_failed when output is non-JSON on both attempts', async () => {
    const bad: CallAnthropic = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: 'not json at all' }], stop_reason: 'end_turn' }),
      text: async () => 'not json',
    })
    const res = await runAppPlanner({ callApi: bad, prompt: 'x', images: [] })
    expect(res.plan).toBeNull()
    expect(res.failureCode).toBe('parse_failed')
  })
})

// ── runPlanner: deep-nav contract ─────────────────────────────────────────────

describe('runPlanner (deep-nav)', () => {
  it('returns plan + appData + routeGraph from a canned fitness response', async () => {
    const out: PlannerOutput = await runPlanner({
      callApi: mockCallApi(FITNESS_RESPONSE),
      prompt: 'fitness tracker',
      images: [],
    })
    expect(out.plan.appName).toBe('FitForge')
    expect(Object.keys(out.appData)).toEqual(expect.arrayContaining(['workouts', 'personalRecords', 'meals']))
    // 6 primary screens + 4 menu-row sub-screens (Package A).
    expect(out.routeGraph.screens).toHaveLength(10)
    expect(out.routeGraph.tabs).toEqual(['home', 'workouts', 'progress', 'profile'])
  })
})

// ── validatePlannerOutput: spec-rule checks ───────────────────────────────────

describe('validatePlannerOutput', () => {
  it('passes for the canned fitness PlannerOutput', async () => {
    const out = await runPlanner({
      callApi: mockCallApi(FITNESS_RESPONSE),
      prompt: 'fitness',
      images: [],
    })
    const report = validatePlannerOutput(out, ['home', 'workouts', 'workoutDetail', 'addWorkout', 'progress', 'profile'])
    expect(report.ok, JSON.stringify(report.issues)).toBe(true)
  })

  it('flags collections with < 3 records', async () => {
    const broken = structuredClone(FITNESS_RESPONSE)
    broken.appData.workouts = broken.appData.workouts.slice(0, 2)
    const out = await runPlanner({ callApi: mockCallApi(broken), prompt: 'fitness', images: [] })
    const report = validatePlannerOutput(out)
    expect(report.ok).toBe(false)
    expect(report.issues.some(i => i.rule === 'appData.min_records')).toBe(true)
  })

  it('flags list screens with no corresponding detail screen', async () => {
    const broken = structuredClone(FITNESS_RESPONSE)
    // Remove the detail screen — workouts (a "list" purpose) is now orphaned.
    broken.routeGraph.screens = broken.routeGraph.screens.filter(s => s.id !== 'workoutDetail')
    const out = await runPlanner({ callApi: mockCallApi(broken), prompt: 'fitness', images: [] })
    const report = validatePlannerOutput(out)
    expect(report.ok).toBe(false)
    expect(report.issues.some(i => i.rule === 'routeGraph.list_needs_detail')).toBe(true)
  })

  it('flags Add CTA without a modal screen', async () => {
    const broken = structuredClone(FITNESS_RESPONSE)
    // Strip the modal — the "Add Workout" CTA in connections is now orphaned.
    broken.routeGraph.screens = broken.routeGraph.screens.filter(s => s.kind !== 'modal')
    const out = await runPlanner({ callApi: mockCallApi(broken), prompt: 'fitness', images: [] })
    const report = validatePlannerOutput(out)
    expect(report.ok).toBe(false)
    expect(report.issues.some(i => i.rule === 'routeGraph.cta_needs_modal')).toBe(true)
  })

  it('flags navIntent targets that do not resolve to a screen id', async () => {
    const out = await runPlanner({ callApi: mockCallApi(FITNESS_RESPONSE), prompt: 'fitness', images: [] })
    const report = validatePlannerOutput(out, ['home', 'mysteryScreen'])
    expect(report.ok).toBe(false)
    expect(report.issues.some(i => i.rule === 'navIntent.target_unresolved' && i.detail.includes('mysteryScreen'))).toBe(true)
  })

  it('flags dataSource references that do not resolve to an appData collection', async () => {
    const broken = structuredClone(FITNESS_RESPONSE)
    broken.routeGraph.screens[0] = { ...broken.routeGraph.screens[0], dataSource: 'phantomCollection' }
    const out = await runPlanner({ callApi: mockCallApi(broken), prompt: 'fitness', images: [] })
    const report = validatePlannerOutput(out)
    expect(report.ok).toBe(false)
    expect(report.issues.some(i => i.rule === 'routeGraph.dataSource_unresolved')).toBe(true)
  })

  // ── Package A: list-row navigation — Profile/Settings need menu sub-screens ─
  it('flags Profile screen with no menu-row sub-screens (Package A)', async () => {
    const broken = structuredClone(FITNESS_RESPONSE)
    // Strip the menu-row sub-screens Package A's fixture added.
    const subScreenIds = new Set(['edit-profile', 'notification-settings', 'privacy', 'help'])
    broken.routeGraph.screens = broken.routeGraph.screens.filter(s => !subScreenIds.has(s.id))
    const out = await runPlanner({ callApi: mockCallApi(broken), prompt: 'fitness', images: [] })
    const report = validatePlannerOutput(out)
    expect(report.ok).toBe(false)
    expect(report.issues.some(i => i.rule === 'routeGraph.profile_needs_menu_subscreens')).toBe(true)
  })

  it('does not flag a planner output with no Profile/Settings screen', async () => {
    const minimal = structuredClone(FITNESS_RESPONSE)
    // Drop the Profile screen entirely — the rule should not fire.
    minimal.routeGraph.screens = minimal.routeGraph.screens.filter(s =>
      !['profile', 'edit-profile', 'notification-settings', 'privacy', 'help'].includes(s.id),
    )
    minimal.routeGraph.tabs = minimal.routeGraph.tabs.filter(t => t !== 'profile')
    const out = await runPlanner({ callApi: mockCallApi(minimal), prompt: 'fitness', images: [] })
    const report = validatePlannerOutput(out)
    expect(report.issues.some(i => i.rule === 'routeGraph.profile_needs_menu_subscreens')).toBe(false)
  })
})

// ── Agent 2: long-tail screens + widget mode + requiresCollections ───────────

const MEDITATION_RESPONSE = {
  appName: 'Stillpoint',
  screens: [
    { id: 'home', name: 'Timer', description: 'Meditation timer widget', screenType: 'widget', isHome: true },
    { id: 'settings', name: 'Settings', description: 'Configure duration and sounds', screenType: 'form' },
  ],
  navigation: { type: 'stack', connections: [{ from: 'home', to: 'settings', trigger: 'Open settings' }] },
  designDirection: { theme: 'dark', accentColor: '#7C5CFF', style: 'serene minimal' },
  appData: {},
  routeGraph: {
    screens: [
      { id: 'home', kind: 'screen', purpose: 'Meditation timer widget' },
      { id: 'settings', kind: 'screen', purpose: 'Configure timer duration and sound' },
    ],
    tabs: [],
  },
  requiresCollections: false,
}

const FOOD_DELIVERY_RESPONSE = {
  appName: 'NomNom',
  screens: [
    { id: 'home', name: 'Home', description: 'Featured restaurants', screenType: 'feed', isHome: true },
    { id: 'restaurants', name: 'Restaurants', description: 'Browse all restaurants', screenType: 'list' },
    { id: 'restaurantDetail', name: 'Restaurant', description: 'Restaurant menu and info', screenType: 'detail' },
    { id: 'cart', name: 'Cart', description: 'Current cart', screenType: 'list' },
    { id: 'orderDetail', name: 'Order', description: 'Order detail view', screenType: 'detail' },
    { id: 'orderHistory', name: 'Orders', description: 'List of past orders', screenType: 'list' },
    { id: 'search', name: 'Search', description: 'Search restaurants and dishes', screenType: 'search' },
    { id: 'profile', name: 'Profile', description: 'User profile', screenType: 'profile' },
    { id: 'settings', name: 'Settings', description: 'App preferences', screenType: 'settings' },
    { id: 'addAddress', name: 'Add Address', description: 'Add a delivery address', screenType: 'form' },
  ],
  navigation: {
    type: 'tabs',
    tabScreens: ['home', 'restaurants', 'orderHistory', 'profile'],
    connections: [
      { from: 'restaurants', to: 'restaurantDetail', trigger: 'View restaurant' },
      { from: 'cart', to: 'orderDetail', trigger: 'Place order' },
      { from: 'profile', to: 'addAddress', trigger: 'Add address' },
    ],
  },
  designDirection: { theme: 'light', accentColor: '#FF5A1F', style: 'friendly bold' },
  appData: {
    restaurants: [
      { id: 'r1', name: 'Pizza Place', cuisine: 'Italian', rating: 4.6 },
      { id: 'r2', name: 'Sushi Spot', cuisine: 'Japanese', rating: 4.8 },
      { id: 'r3', name: 'Taco Cart', cuisine: 'Mexican', rating: 4.4 },
    ],
    orders: [
      { id: 'o1', restaurant: 'Pizza Place', total: 24.5 },
      { id: 'o2', restaurant: 'Sushi Spot', total: 38.0 },
      { id: 'o3', restaurant: 'Taco Cart', total: 17.25 },
    ],
    addresses: [
      { id: 'a1', label: 'Home', line1: '123 Main St' },
      { id: 'a2', label: 'Work', line1: '500 Market Ave' },
      { id: 'a3', label: 'Mom', line1: '42 Oak Lane' },
    ],
  },
  routeGraph: {
    screens: [
      { id: 'home', kind: 'screen', purpose: 'Featured restaurants feed', dataSource: 'restaurants' },
      { id: 'restaurants', kind: 'screen', purpose: 'List of all restaurants', dataSource: 'restaurants' },
      { id: 'restaurantDetail', kind: 'screen', purpose: 'Restaurant detail view', params: ['id'], dataSource: 'restaurants' },
      { id: 'cart', kind: 'screen', purpose: 'Current cart contents' },
      { id: 'orderDetail', kind: 'screen', purpose: 'Order detail view', params: ['id'], dataSource: 'orders' },
      { id: 'orderHistory', kind: 'screen', purpose: 'List of past orders', dataSource: 'orders' },
      { id: 'search', kind: 'screen', purpose: 'Search restaurants and dishes' },
      { id: 'profile', kind: 'screen', purpose: 'User profile' },
      { id: 'settings', kind: 'screen', purpose: 'App settings' },
      { id: 'addAddress', kind: 'modal', purpose: 'Add a delivery address' },
    ],
    tabs: ['home', 'restaurants', 'orderHistory', 'profile'],
  },
  requiresCollections: true,
}

describe('runPlanner: requiresCollections + long-tail screens', () => {
  it('fitness response → requiresCollections:true (inferred) and includes Profile screen', async () => {
    const out = await runPlanner({ callApi: mockCallApi(FITNESS_RESPONSE), prompt: 'fitness app', images: [] })
    expect(out.requiresCollections).toBe(true)
    const ids = out.routeGraph.screens.map(s => s.id)
    expect(ids).toContain('profile')
  })

  it('meditation timer → requiresCollections:false, no Search/History/Notifications screens', async () => {
    const out = await runPlanner({ callApi: mockCallApi(MEDITATION_RESPONSE), prompt: 'meditation timer', images: [] })
    expect(out.requiresCollections).toBe(false)
    const ids = out.routeGraph.screens.map(s => s.id)
    expect(ids).not.toContain('search')
    expect(ids).not.toContain('history')
    expect(ids).not.toContain('notifications')
    expect(Object.keys(out.appData).length).toBe(0)
  })

  it('food delivery → ≥6 screens, Settings + Profile present, requiresCollections:true', async () => {
    const out = await runPlanner({ callApi: mockCallApi(FOOD_DELIVERY_RESPONSE), prompt: 'food delivery app', images: [] })
    expect(out.requiresCollections).toBe(true)
    expect(out.routeGraph.screens.length).toBeGreaterThanOrEqual(6)
    const ids = out.routeGraph.screens.map(s => s.id)
    expect(ids).toContain('settings')
    expect(ids).toContain('profile')
  })

  it('infers requiresCollections:false when appData is empty AND tabs is empty', async () => {
    const minimal = { ...MEDITATION_RESPONSE }
    delete (minimal as any).requiresCollections
    const out = await runPlanner({ callApi: mockCallApi(minimal), prompt: 'timer', images: [] })
    expect(out.requiresCollections).toBe(false)
  })

  it('infers requiresCollections:true when planner emits collections (no explicit flag)', async () => {
    const noFlag = structuredClone(FITNESS_RESPONSE) as any
    delete noFlag.requiresCollections
    const out = await runPlanner({ callApi: mockCallApi(noFlag), prompt: 'fitness', images: [] })
    expect(out.requiresCollections).toBe(true)
  })

  it('gracefully fails on gibberish planner output (parse failure throws)', async () => {
    const bad: CallAnthropic = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: 'asdkjf not parseable at all 87&*' }], stop_reason: 'end_turn' }),
      text: async () => 'asdkjf',
    })
    await expect(runPlanner({ callApi: bad, prompt: 'gibberish', images: [] })).rejects.toThrow(/parse_failed/)
  })
})
