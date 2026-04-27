import { describe, it, expect } from 'vitest'
import { computeFitScale } from '../computeFitScale'

describe('computeFitScale', () => {
  const device = { w: 393, h: 852 }   // iPhone Standard

  describe('auto-fit (manualZoom = null)', () => {
    it('returns 0.92*min(W/dw, H/dh) when container is smaller than device', () => {
      const s = computeFitScale({ container: { w: 600, h: 600 }, device, manualZoom: null })
      // height is the binding axis: 600/852 = 0.704 → * 0.92 = 0.648
      expect(s).toBeCloseTo(0.648, 3)
    })

    it('caps at 1.0 — never upscales past device pixel size', () => {
      const s = computeFitScale({ container: { w: 2000, h: 2000 }, device, manualZoom: null })
      expect(s).toBe(1)
    })

    it('returns 0 when container has zero area (avoids NaN)', () => {
      expect(computeFitScale({ container: { w: 0, h: 600 }, device, manualZoom: null })).toBe(0)
      expect(computeFitScale({ container: { w: 600, h: 0 }, device, manualZoom: null })).toBe(0)
    })
  })

  describe('manual zoom override', () => {
    it('returns manualZoom when set and within bounds', () => {
      const s = computeFitScale({ container: { w: 2000, h: 2000 }, device, manualZoom: 0.5 })
      expect(s).toBe(0.5)
    })

    it('clamps manual zoom to [0.25, 2.0]', () => {
      const lo = computeFitScale({ container: { w: 2000, h: 2000 }, device, manualZoom: 0.1 })
      const hi = computeFitScale({ container: { w: 2000, h: 2000 }, device, manualZoom: 5 })
      expect(lo).toBe(0.25)
      expect(hi).toBe(2)
    })
  })
})
