import { Component, type ReactNode } from 'react'
import { ScreenRenderer } from '../ScreenRenderer'
import type { ComponentNode } from '../../types/mokkoi'

/** iPhone 16 dims used by Mokkoi's canvas. Keep in sync with constants/devices.ts
 *  if the default device changes. Hardcoded here because the thumbnail doesn't
 *  care about per-project device overrides — it's a small preview, the visual
 *  delta between iPhone 14/15/16 sizes at 0.25x scale is invisible. */
const SCREEN_W = 393
const SCREEN_H = 852

interface ScaledScreenPreviewProps {
  tree: ComponentNode
}

/**
 * ScaledScreenPreview — renders a project's component-tree at thumbnail size
 * for the dashboard project cards.
 *
 * Reuses the canonical ScreenRenderer so the thumbnail is pixel-faithful to
 * what users see in the canvas — no separate paint pipeline, no drift.
 *
 * The trick is the same one PhoneFrame uses: render at the real iPhone
 * resolution (393×852), then transform: scale(0.25) inside an overflow:hidden
 * box that's sized exactly the parent slot. CSS clip prevents the rendered
 * tree from blowing out of the phone bezel.
 *
 * Wrapped in an error boundary so a single broken tree (malformed JSON,
 * unknown component type) falls back to the PhoneThumbnail's calm pulse
 * rather than crashing the whole dashboard.
 *
 * v1 PERF NOTE: each card mounts its own ScreenRenderer. For 4–8 cards on
 * the recents strip this is fine. If we render the full project list later
 * (50+ cards), gate this behind IntersectionObserver so off-screen cards
 * stay as calm pulses until scrolled into view.
 */
export function ScaledScreenPreview({ tree }: ScaledScreenPreviewProps) {
  return (
    <ThumbErrorBoundary>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: SCREEN_W,
            height: SCREEN_H,
            transform: 'scale(0.258)',
            transformOrigin: 'top left',
          }}
        >
          <ScreenRenderer tree={tree} />
        </div>
      </div>
    </ThumbErrorBoundary>
  )
}

// ---- internals ----------------------------------------------------------

interface BoundaryState { hadError: boolean }

class ThumbErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { hadError: false }
  static getDerivedStateFromError(): BoundaryState { return { hadError: true } }
  componentDidCatch(err: unknown) {
    // Don't spam — one log per boundary instance is enough to debug.
    // eslint-disable-next-line no-console
    console.warn('[mokkoi] ScaledScreenPreview render failed; falling back', err)
  }
  render() {
    if (this.state.hadError) return null
    return this.props.children
  }
}
