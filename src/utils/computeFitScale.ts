export interface FitScaleArgs {
  container: { w: number; h: number }
  device: { w: number; h: number }
  /** When non-null, overrides auto-fit. Clamped to [MIN, MAX]. */
  manualZoom: number | null
}

export const FIT_PADDING = 0.92
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 2

/** Compute the CSS transform scale to apply to the phone frame.
 *  - Auto-fit (manualZoom === null): 0.92 * min(containerW/deviceW, containerH/deviceH),
 *    capped at 1 so the phone never upscales past its device pixel size.
 *  - Manual (manualZoom !== null): user-supplied zoom, clamped to [MIN_ZOOM, MAX_ZOOM]
 *    regardless of the auto-fit cap (so the user can zoom up to 2.0).
 *  - Zero/negative container area returns 0 to avoid NaN/Infinity propagation
 *    (ResizeObserver may briefly report an unmeasured rect on first observe). */
export function computeFitScale({ container, device, manualZoom }: FitScaleArgs): number {
  if (manualZoom !== null) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, manualZoom))
  }
  if (container.w <= 0 || container.h <= 0) return 0
  const fit = Math.min(container.w / device.w, container.h / device.h) * FIT_PADDING
  return Math.min(1, fit)
}
