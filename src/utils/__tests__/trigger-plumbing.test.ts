import { describe, it, expect } from 'vitest'
import { buildConnections } from '../../../api/generate-flow'

describe('buildConnections', () => {
  it('preserves trigger field from planner connection', () => {
    const plan = {
      navigation: {
        connections: [
          { from: 'screen-1', to: 'screen-2', trigger: 'Sign In' },
        ],
      },
    }
    const planIdToScreenId = new Map<string, string>([
      ['screen-1', 'uuid-aaa'],
      ['screen-2', 'uuid-bbb'],
    ])
    const result = buildConnections(plan, planIdToScreenId)
    expect(result).toHaveLength(1)
    expect(result[0].fromScreenId).toBe('uuid-aaa')
    expect(result[0].toScreenId).toBe('uuid-bbb')
    expect(result[0].trigger).toBe('Sign In')
  })

  it('filters out connections where either screen id is missing', () => {
    const plan = {
      navigation: {
        connections: [
          { from: 'screen-1', to: 'screen-unknown', trigger: 'Go' },
          { from: 'screen-1', to: 'screen-2', trigger: 'Sign In' },
        ],
      },
    }
    const planIdToScreenId = new Map<string, string>([
      ['screen-1', 'uuid-aaa'],
      ['screen-2', 'uuid-bbb'],
    ])
    const result = buildConnections(plan, planIdToScreenId)
    expect(result).toHaveLength(1)
    expect(result[0].trigger).toBe('Sign In')
  })

  it('returns empty array when there are no connections', () => {
    const plan = { navigation: { connections: [] } }
    const result = buildConnections(plan, new Map())
    expect(result).toEqual([])
  })
})
