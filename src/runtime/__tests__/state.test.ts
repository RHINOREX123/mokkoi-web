import { describe, it, expect } from 'vitest'
import { getActivePillStateKey, setActivePillStateKey, type PillState } from '../state'

describe('getActivePillStateKey', () => {
  it('returns the stored stateKey for a (screen, group) pair', () => {
    const state: PillState = { home: { category: 'cardio' } }
    expect(getActivePillStateKey(state, 'home', 'category')).toBe('cardio')
  })

  it('returns the fallback when no entry exists for the screen', () => {
    const state: PillState = {}
    expect(getActivePillStateKey(state, 'home', 'category', 'all')).toBe('all')
  })

  it('returns the fallback when no entry exists for the group', () => {
    const state: PillState = { home: { otherGroup: 'x' } }
    expect(getActivePillStateKey(state, 'home', 'category', 'all')).toBe('all')
  })

  it('returns null when neither stored value nor fallback is provided', () => {
    const state: PillState = {}
    expect(getActivePillStateKey(state, 'home', 'category')).toBeNull()
  })

  it('treats empty-string entries as unset and uses fallback', () => {
    const state: PillState = { home: { category: '' } }
    expect(getActivePillStateKey(state, 'home', 'category', 'all')).toBe('all')
  })
})

describe('setActivePillStateKey', () => {
  it('sets a key in an empty state', () => {
    const next = setActivePillStateKey({}, 'home', 'category', 'cardio')
    expect(next).toEqual({ home: { category: 'cardio' } })
  })

  it('preserves other groups within the same screen', () => {
    const prev: PillState = { home: { sort: 'recent' } }
    const next = setActivePillStateKey(prev, 'home', 'category', 'cardio')
    expect(next).toEqual({ home: { sort: 'recent', category: 'cardio' } })
  })

  it('preserves other screens', () => {
    const prev: PillState = { profile: { tab: 'posts' } }
    const next = setActivePillStateKey(prev, 'home', 'category', 'cardio')
    expect(next).toEqual({
      profile: { tab: 'posts' },
      home: { category: 'cardio' },
    })
  })

  it('does not mutate the input state', () => {
    const prev: PillState = { home: { category: 'all' } }
    const before = JSON.stringify(prev)
    setActivePillStateKey(prev, 'home', 'category', 'cardio')
    expect(JSON.stringify(prev)).toBe(before)
  })

  it('roundtrips through get', () => {
    const next = setActivePillStateKey({}, 'home', 'category', 'cardio')
    expect(getActivePillStateKey(next, 'home', 'category')).toBe('cardio')
  })
})
