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
    expect(out.routeGraph.screens).toHaveLength(6)
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
})
